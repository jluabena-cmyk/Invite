import { randomBytes } from "crypto";
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  eventsTable,
  eventParticipantsTable,
  receiptsTable,
  receiptItemsTable,
  itemAssignmentsTable,
  guestPaymentRequestsTable,
} from "@workspace/db";

const router = Router();

async function resolveProfile(clerkUserId: string) {
  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);
  return profile ?? null;
}

async function resolveParticipation(eventId: number, userId: number) {
  const [row] = await db
    .select()
    .from(eventParticipantsTable)
    .where(
      and(
        eq(eventParticipantsTable.eventId, eventId),
        eq(eventParticipantsTable.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ─── Compute owed amount for a single app-less guest participant ───────────────

interface ReceiptRow { tax: string | null; tip: string | null; total: string | null }
interface ItemRow { id: number; price: string; quantity: number }
interface AssignmentRow { receiptItemId: number; guestParticipantId: number | null; userId: number | null; claimed: boolean }

function distributeProportionally(
  totalCents: number,
  weights: Record<number, number>,
  totalWeight: number,
): Record<number, number> {
  if (totalCents === 0 || totalWeight === 0) return {};
  const entries = Object.entries(weights).map(([k, w]) => ({ id: Number(k), w }));
  const result: Record<number, number> = {};
  let allocated = 0;
  for (const { id, w } of entries) {
    const floor = Math.floor((totalCents * w) / totalWeight);
    result[id] = floor;
    allocated += floor;
  }
  const remainder = totalCents - allocated;
  const sorted = entries
    .map(({ id, w }) => ({ id, frac: (totalCents * w) / totalWeight - Math.floor((totalCents * w) / totalWeight) }))
    .sort((a, b) => b.frac - a.frac || a.id - b.id);
  for (let i = 0; i < remainder; i++) {
    result[sorted[i].id] = (result[sorted[i].id] ?? 0) + 1;
  }
  return result;
}

function computeGuestOwedCents(
  guestParticipantId: number,
  items: ItemRow[],
  assignments: AssignmentRow[],
  receipt: ReceiptRow,
): number {
  const taxCents = Math.round(parseFloat(receipt.tax ?? "0") * 100);
  const tipCents = Math.round(parseFloat(receipt.tip ?? "0") * 100);
  const totalCents = Math.round(parseFloat(receipt.total ?? "0") * 100);

  // Keys: positive = userId, negative = -guestParticipantId
  const itemByParticipant: Record<number, number> = {};
  let unallocatedItemCents = 0;

  for (const item of items) {
    const subtotalCents = Math.round(parseFloat(item.price) * item.quantity * 100);
    const active = assignments.filter((a) => a.receiptItemId === item.id && a.claimed);
    if (active.length === 0) {
      unallocatedItemCents += subtotalCents;
    } else {
      const shareCents = Math.floor(subtotalCents / active.length);
      const remainderCents = subtotalCents - shareCents * active.length;
      active.forEach((a, idx) => {
        const key = a.guestParticipantId != null ? -a.guestParticipantId : (a.userId ?? 0);
        itemByParticipant[key] = (itemByParticipant[key] ?? 0) + shareCents + (idx === 0 ? remainderCents : 0);
      });
    }
  }

  const totalWeightCents =
    Object.values(itemByParticipant).reduce((s, v) => s + v, 0) + unallocatedItemCents;

  const guestKey = -guestParticipantId;

  if (totalCents > 0) {
    if (totalWeightCents === 0) return 0;
    const weights: Record<number, number> = { ...itemByParticipant };
    if (unallocatedItemCents > 0) weights[-999999] = unallocatedItemCents;
    const dist = distributeProportionally(totalCents, weights, totalWeightCents);
    return dist[guestKey] ?? 0;
  }

  if (taxCents === 0 && tipCents === 0) {
    return itemByParticipant[guestKey] ?? 0;
  }

  const weights: Record<number, number> = { ...itemByParticipant };
  if (unallocatedItemCents > 0) weights[-999999] = unallocatedItemCents;
  const taxDist = distributeProportionally(taxCents, weights, totalWeightCents);
  const tipDist = distributeProportionally(tipCents, weights, totalWeightCents);

  return (
    (itemByParticipant[guestKey] ?? 0) +
    (taxDist[guestKey] ?? 0) +
    (tipDist[guestKey] ?? 0)
  );
}

// ─── Itemized breakdown for a single guest ─────────────────────────────────────
// Lines always sum exactly to `owedCents`: each claimed item is listed at the
// guest's raw share (item subtotal split evenly among claimants, remainder to
// the first claimant — the same weighting used by computeGuestOwedCents), and
// any difference vs. the owed amount is a single reconciling line: positive →
// "Tax, tip & fees", negative → "Discounts & adjustments".

export function buildGuestItemizedLines(
  guestParticipantId: number,
  items: Array<ItemRow & { name?: string | null }>,
  assignments: AssignmentRow[],
  owedCents: number,
): Array<{ name: string; priceCents: number }> {
  const lines: Array<{ name: string; priceCents: number }> = [];
  let itemsShareCents = 0;

  for (const item of items) {
    const subtotalCents = Math.round(parseFloat(item.price) * item.quantity * 100);
    const active = assignments.filter((a) => a.receiptItemId === item.id && a.claimed);
    const idx = active.findIndex((a) => a.guestParticipantId === guestParticipantId);
    if (idx === -1) continue;
    const shareCents = Math.floor(subtotalCents / active.length);
    const remainderCents = idx === 0 ? subtotalCents - shareCents * active.length : 0;
    const myShareCents = shareCents + remainderCents;
    itemsShareCents += myShareCents;
    lines.push({ name: item.name ?? "Item", priceCents: myShareCents });
  }

  if (lines.length === 0) return [];

  const residualCents = owedCents - itemsShareCents;
  if (residualCents > 0) {
    lines.push({ name: "Tax, tip & fees", priceCents: residualCents });
  } else if (residualCents < 0) {
    lines.push({ name: "Discounts & adjustments", priceCents: residualCents });
  }
  return lines;
}

// ─── Single payment method selection ──────────────────────────────────────────
// The guest-facing summary presents exactly one payment option: the host's
// preferred method when it is configured, otherwise a deterministic fallback
// (Venmo → Cash App → Zelle) — mirroring the app's SMS message logic.

export function selectHostPaymentMethod(opts: {
  cashAppHandle: string | null;
  venmoHandle: string | null;
  zelleInfo: string | null;
  preferredMethod: string | null;
}): "venmo" | "cash_app" | "zelle" | null {
  const available: Record<string, boolean> = {
    venmo: !!opts.venmoHandle,
    cash_app: !!opts.cashAppHandle,
    zelle: !!opts.zelleInfo,
  };
  if (opts.preferredMethod && available[opts.preferredMethod])
    return opts.preferredMethod as "venmo" | "cash_app" | "zelle";
  if (available.venmo) return "venmo";
  if (available.cash_app) return "cash_app";
  if (available.zelle) return "zelle";
  return null;
}

// ─── POST /events/:eventId/guest-payments ─────────────────────────────────────
// Create (or upsert) a guest payment record for an app-less guest participant.

router.post("/events/:eventId/guest-payments", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(401).json({ error: "Profile not found" });

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || participation.role !== "host")
    return res.status(403).json({ error: "Only hosts can create guest payment records" });

  const { guestParticipantId, notes, action } = req.body ?? {};
  if (typeof guestParticipantId !== "number" || !Number.isInteger(guestParticipantId) || guestParticipantId <= 0)
    return res.status(400).json({ error: "guestParticipantId must be a positive integer" });
  if (action !== undefined && action !== "mark_requested" && action !== "mark_paid")
    return res.status(400).json({ error: "action must be mark_requested or mark_paid" });

  // Validate the participant is an app-less guest in this event
  const [guestParticipant] = await db
    .select()
    .from(eventParticipantsTable)
    .where(
      and(
        eq(eventParticipantsTable.id, guestParticipantId),
        eq(eventParticipantsTable.eventId, eventId),
        eq(eventParticipantsTable.role, "guest"),
      ),
    )
    .limit(1);

  if (!guestParticipant) return res.status(404).json({ error: "Guest participant not found" });
  if (guestParticipant.userId !== null)
    return res.status(400).json({ error: "Participant is not an app-less guest" });

  // Compute owed amount
  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.eventId, eventId))
    .limit(1);

  if (!receipt) return res.status(400).json({ error: "No receipt found for this event" });

  const items = await db
    .select()
    .from(receiptItemsTable)
    .where(eq(receiptItemsTable.receiptId, receipt.id));

  const assignments = items.length > 0
    ? await db
        .select()
        .from(itemAssignmentsTable)
        .where(
          inArray(
            itemAssignmentsTable.receiptItemId,
            items.map((i) => i.id),
          ),
        )
    : [];

  const amountCents = computeGuestOwedCents(guestParticipantId, items, assignments, receipt);
  if (amountCents <= 0)
    return res.status(400).json({ error: "Guest has no owed amount" });

  const notesVal = typeof notes === "string" && notes.trim() ? notes.trim() : null;
  const now = new Date();
  const requestedAt = action === "mark_requested" ? now : undefined;
  const paidAt = action === "mark_paid" ? now : undefined;

  // Upsert: if a record already exists for this participant, update it
  const [existing] = await db
    .select()
    .from(guestPaymentRequestsTable)
    .where(eq(guestPaymentRequestsTable.eventParticipantId, guestParticipantId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(guestPaymentRequestsTable)
      .set({
        amountCents,
        notes: notesVal,
        updatedAt: now,
        ...(requestedAt ? { requestedAt } : {}),
        ...(paidAt ? { paidAt } : {}),
      })
      .where(eq(guestPaymentRequestsTable.id, existing.id))
      .returning();
    return res.status(200).json({ guestPayment: updated });
  }

  const [created] = await db
    .insert(guestPaymentRequestsTable)
    .values({ eventParticipantId: guestParticipantId, amountCents, notes: notesVal, requestedAt, paidAt })
    .returning();

  return res.status(201).json({ guestPayment: created });
});

// ─── GET /events/:eventId/guest-payments ──────────────────────────────────────
// Returns all guest payment records for app-less guests in this event.

router.get("/events/:eventId/guest-payments", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(401).json({ error: "Profile not found" });

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || participation.role !== "host")
    return res.status(403).json({ error: "Only hosts can view guest payment records" });

  // Get all app-less guests in this event
  const guestParticipants = await db
    .select()
    .from(eventParticipantsTable)
    .where(
      and(
        eq(eventParticipantsTable.eventId, eventId),
        eq(eventParticipantsTable.role, "guest"),
      ),
    );

  if (guestParticipants.length === 0) {
    return res.status(200).json({ guestPayments: [] });
  }

  const participantIds = guestParticipants.map((p) => p.id);

  const payments = await db
    .select()
    .from(guestPaymentRequestsTable)
    .where(inArray(guestPaymentRequestsTable.eventParticipantId, participantIds));

  return res.status(200).json({ guestPayments: payments });
});

// ─── PATCH /guest-payments/:id ────────────────────────────────────────────────
// Update a guest payment record: mark as "requested" (Cash App sent) or "paid".

router.patch("/guest-payments/:id", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(401).json({ error: "Profile not found" });

  const [guestPayment] = await db
    .select()
    .from(guestPaymentRequestsTable)
    .where(eq(guestPaymentRequestsTable.id, id))
    .limit(1);

  if (!guestPayment) return res.status(404).json({ error: "Guest payment record not found" });

  // Verify the caller is the host of the event that contains this participant
  const [participant] = await db
    .select()
    .from(eventParticipantsTable)
    .where(eq(eventParticipantsTable.id, guestPayment.eventParticipantId))
    .limit(1);

  if (!participant) return res.status(404).json({ error: "Participant not found" });

  const participation = await resolveParticipation(participant.eventId, profile.id);
  if (!participation || participation.role !== "host")
    return res.status(403).json({ error: "Only hosts can update guest payment records" });

  const { action } = req.body ?? {};

  if (action === "mark_requested") {
    const [updated] = await db
      .update(guestPaymentRequestsTable)
      .set({ requestedAt: new Date(), updatedAt: new Date() })
      .where(eq(guestPaymentRequestsTable.id, id))
      .returning();
    return res.status(200).json({ guestPayment: updated });
  }

  if (action === "mark_paid") {
    const [updated] = await db
      .update(guestPaymentRequestsTable)
      .set({ paidAt: new Date(), updatedAt: new Date() })
      .where(eq(guestPaymentRequestsTable.id, id))
      .returning();
    return res.status(200).json({ guestPayment: updated });
  }

  if (action === "unmark_paid") {
    const [updated] = await db
      .update(guestPaymentRequestsTable)
      .set({ paidAt: null, updatedAt: new Date() })
      .where(eq(guestPaymentRequestsTable.id, id))
      .returning();
    return res.status(200).json({ guestPayment: updated });
  }

  return res.status(400).json({ error: "action must be one of: mark_requested, mark_paid, unmark_paid" });
});

// ─── POST /events/:eventId/guest-payments/:guestParticipantId/summary-link ────
// Generate (or return existing) a shareable summary token for an app-less guest.
// Host-only. Returns { summaryUrl: string }.

router.post("/events/:eventId/guest-payments/:guestParticipantId/summary-link", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const eventId = parseInt(req.params.eventId, 10);
  const guestParticipantId = parseInt(req.params.guestParticipantId, 10);
  if (isNaN(eventId) || isNaN(guestParticipantId))
    return res.status(400).json({ error: "Invalid IDs" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(401).json({ error: "Profile not found" });

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || participation.role !== "host")
    return res.status(403).json({ error: "Only hosts can generate guest summary links" });

  // Validate the participant is an app-less guest in this event
  const [guestParticipant] = await db
    .select()
    .from(eventParticipantsTable)
    .where(
      and(
        eq(eventParticipantsTable.id, guestParticipantId),
        eq(eventParticipantsTable.eventId, eventId),
        eq(eventParticipantsTable.role, "guest"),
      ),
    )
    .limit(1);

  if (!guestParticipant) return res.status(404).json({ error: "Guest participant not found" });
  if (guestParticipant.userId !== null)
    return res.status(400).json({ error: "Participant is not an app-less guest" });

  // Find or create a guest payment record; reuse token if one already exists
  let [record] = await db
    .select()
    .from(guestPaymentRequestsTable)
    .where(eq(guestPaymentRequestsTable.eventParticipantId, guestParticipantId))
    .limit(1);

  if (record?.summaryToken) {
    const summaryUrl = buildSummaryUrl(req, record.summaryToken);
    return res.json({ summaryUrl, token: record.summaryToken });
  }

  // Generate a new token and upsert
  const token = randomBytes(24).toString("hex");

  if (record) {
    await db
      .update(guestPaymentRequestsTable)
      .set({ summaryToken: token, updatedAt: new Date() })
      .where(eq(guestPaymentRequestsTable.id, record.id));
  } else {
    // We need an amountCents to create the record; compute it now
    const [receipt] = await db
      .select()
      .from(receiptsTable)
      .where(eq(receiptsTable.eventId, eventId))
      .limit(1);

    const amountCents = receipt
      ? await (async () => {
          const items = await db
            .select()
            .from(receiptItemsTable)
            .where(eq(receiptItemsTable.receiptId, receipt.id));
          const assignments = items.length > 0
            ? await db
                .select()
                .from(itemAssignmentsTable)
                .where(inArray(itemAssignmentsTable.receiptItemId, items.map((i) => i.id)))
            : [];
          return computeGuestOwedCents(guestParticipantId, items, assignments, receipt);
        })()
      : 0;

    [record] = await db
      .insert(guestPaymentRequestsTable)
      .values({ eventParticipantId: guestParticipantId, amountCents, summaryToken: token })
      .returning();
  }

  const summaryUrl = buildSummaryUrl(req, token);
  return res.json({ summaryUrl, token });
});

function buildSummaryUrl(req: import("express").Request, token: string): string {
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "";
  return `${proto}://${host}/api/guest-summary/${token}/view`;
}

// ─── GET /guest-summary/:token (JSON) ─────────────────────────────────────────
// No auth required. Returns the guest's itemized summary as JSON.

router.get("/guest-summary/:token", async (req, res) => {
  const { token } = req.params;

  const [record] = await db
    .select()
    .from(guestPaymentRequestsTable)
    .where(eq(guestPaymentRequestsTable.summaryToken, token))
    .limit(1);

  if (!record) return res.status(404).json({ error: "Summary not found" });

  const [participant] = await db
    .select()
    .from(eventParticipantsTable)
    .where(eq(eventParticipantsTable.id, record.eventParticipantId))
    .limit(1);

  if (!participant) return res.status(404).json({ error: "Participant not found" });

  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, participant.eventId))
    .limit(1);

  if (!event) return res.status(404).json({ error: "Event not found" });

  // Re-compute the current owed amount (receipt may have changed since token was generated)
  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.eventId, participant.eventId))
    .limit(1);

  let amountCents = record.amountCents;
  let itemizedLines: Array<{ name: string; priceCents: number }> = [];

  if (receipt) {
    const items = await db
      .select()
      .from(receiptItemsTable)
      .where(eq(receiptItemsTable.receiptId, receipt.id));

    const assignments = items.length > 0
      ? await db
          .select()
          .from(itemAssignmentsTable)
          .where(inArray(itemAssignmentsTable.receiptItemId, items.map((i) => i.id)))
      : [];

    amountCents = computeGuestOwedCents(record.eventParticipantId, items, assignments, receipt);

    // Persist the refreshed amount back so the host's tracking UI stays current
    if (amountCents !== record.amountCents) {
      await db
        .update(guestPaymentRequestsTable)
        .set({ amountCents, updatedAt: new Date() })
        .where(eq(guestPaymentRequestsTable.id, record.id));
    }

    itemizedLines = buildGuestItemizedLines(record.eventParticipantId, items, assignments, amountCents);
  }

  // Fetch host payment info from the host's user profile
  const [hostParticipant] = await db
    .select()
    .from(eventParticipantsTable)
    .where(
      and(
        eq(eventParticipantsTable.eventId, participant.eventId),
        eq(eventParticipantsTable.role, "host"),
      ),
    )
    .limit(1);

  let hostCashAppHandle: string | null = null;
  let hostVenmoHandle: string | null = null;
  let hostZelleInfo: string | null = null;
  let hostPreferredMethod: string | null = null;

  if (hostParticipant?.userId != null) {
    const [hostProfile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.id, hostParticipant.userId))
      .limit(1);
    hostCashAppHandle = hostProfile?.cashAppHandle ?? null;
    hostVenmoHandle = hostProfile?.venmoHandle ?? null;
    hostZelleInfo = hostProfile?.zelleInfo ?? null;
    hostPreferredMethod = hostProfile?.preferredPaymentMethod ?? null;
  }

  // Expose exactly one payment method: host preference, then deterministic fallback
  const selectedMethod = selectHostPaymentMethod({
    cashAppHandle: hostCashAppHandle,
    venmoHandle: hostVenmoHandle,
    zelleInfo: hostZelleInfo,
    preferredMethod: hostPreferredMethod,
  });

  return res.json({
    guestName: participant.guestName ?? "Guest",
    eventTitle: event.title,
    eventDate: event.startsAt ?? null,
    restaurantName: event.restaurantName ?? null,
    amountCents,
    paidAt: record.paidAt ?? null,
    paymentMethod: selectedMethod,
    cashAppHandle: selectedMethod === "cash_app" ? hostCashAppHandle : null,
    venmoHandle: selectedMethod === "venmo" ? hostVenmoHandle : null,
    zelleInfo: selectedMethod === "zelle" ? hostZelleInfo : null,
    itemized: itemizedLines,
  });
});

// ─── GET /guest-summary/:token/view (HTML) ────────────────────────────────────
// No auth required. Serves a self-contained HTML payment summary page.

router.get("/guest-summary/:token/view", async (req, res) => {
  const { token } = req.params;

  const [record] = await db
    .select()
    .from(guestPaymentRequestsTable)
    .where(eq(guestPaymentRequestsTable.summaryToken, token))
    .limit(1);

  if (!record) {
    res.status(404).send("<h1>Summary not found</h1>");
    return;
  }

  const [participant] = await db
    .select()
    .from(eventParticipantsTable)
    .where(eq(eventParticipantsTable.id, record.eventParticipantId))
    .limit(1);

  const [event] = participant
    ? await db.select().from(eventsTable).where(eq(eventsTable.id, participant.eventId)).limit(1)
    : [];

  if (!participant || !event) {
    res.status(404).send("<h1>Summary not found</h1>");
    return;
  }

  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.eventId, participant.eventId))
    .limit(1);

  let amountCents = record.amountCents;
  let itemizedLines: Array<{ name: string; priceCents: number }> = [];

  if (receipt) {
    const items = await db
      .select()
      .from(receiptItemsTable)
      .where(eq(receiptItemsTable.receiptId, receipt.id));
    const assignments = items.length > 0
      ? await db
          .select()
          .from(itemAssignmentsTable)
          .where(inArray(itemAssignmentsTable.receiptItemId, items.map((i) => i.id)))
      : [];

    amountCents = computeGuestOwedCents(record.eventParticipantId, items, assignments, receipt);

    // Persist the refreshed amount back so the host's tracking UI stays current
    if (amountCents !== record.amountCents) {
      await db
        .update(guestPaymentRequestsTable)
        .set({ amountCents, updatedAt: new Date() })
        .where(eq(guestPaymentRequestsTable.id, record.id));
    }

    itemizedLines = buildGuestItemizedLines(record.eventParticipantId, items, assignments, amountCents);
  }

  // Fetch host payment info from the host's user profile
  const [hostParticipantView] = await db
    .select()
    .from(eventParticipantsTable)
    .where(
      and(
        eq(eventParticipantsTable.eventId, participant.eventId),
        eq(eventParticipantsTable.role, "host"),
      ),
    )
    .limit(1);

  let hostCashApp: string | null = null;
  let hostVenmo: string | null = null;
  let hostZelle: string | null = null;
  let hostPreferred: string | null = null;

  if (hostParticipantView?.userId != null) {
    const [hostProfile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.id, hostParticipantView.userId))
      .limit(1);
    hostCashApp = hostProfile?.cashAppHandle ?? null;
    hostVenmo = hostProfile?.venmoHandle ?? null;
    hostZelle = hostProfile?.zelleInfo ?? null;
    hostPreferred = hostProfile?.preferredPaymentMethod ?? null;
  }

  // Render exactly one payment method: host preference, then deterministic fallback
  const selectedMethod = selectHostPaymentMethod({
    cashAppHandle: hostCashApp,
    venmoHandle: hostVenmo,
    zelleInfo: hostZelle,
    preferredMethod: hostPreferred,
  });

  const guestName = participant.guestName ?? "Guest";
  const dollars = (amountCents / 100).toFixed(2);
  const isPaid = !!record.paidAt;

  const formatCents = (c: number) =>
    `$${(c / 100).toFixed(2)}`;

  const itemizedHtml = itemizedLines.length > 0
    ? `<ul class="items">${itemizedLines
        .map((l) => `<li><span class="item-name">${escHtml(l.name)}</span><span class="item-price">${l.priceCents < 0 ? "-" : ""}${formatCents(Math.abs(l.priceCents))}</span></li>`)
        .join("")}</ul>`
    : "";

  const cashAppHandle = hostCashApp ? (hostCashApp.startsWith("$") ? hostCashApp.slice(1) : hostCashApp) : null;
  const venmoHandle = hostVenmo ? (hostVenmo.startsWith("@") ? hostVenmo.slice(1) : hostVenmo) : null;

  const encodedNote = encodeURIComponent(event.title);

  // Native deep links open the payment app pre-filled (same scheme used in the iOS app).
  // JavaScript tries the native scheme first; falls back to the web URL after 1.5 s
  // in case the app isn't installed.
  let payButton = "";
  let payScript = "";

  if (!isPaid) {
    if (selectedMethod === "cash_app" && cashAppHandle) {
      const nativeUrl = `cashapp://pay/$${cashAppHandle}?amount=${dollars}&note=${encodedNote}`;
      const webUrl    = `https://cash.app/$${cashAppHandle}`;
      payButton = `<button class="btn btn-cashapp" onclick="handlePay('${nativeUrl}','${webUrl}')">Pay $${escHtml(cashAppHandle)} via Cash App · $${dollars}</button>`;
      payScript  = `<script>function handlePay(n,w){var t=Date.now();setTimeout(function(){if(Date.now()-t<2200)window.location.href=w;},1500);window.location.href=n;}<\/script>`;
    } else if (selectedMethod === "venmo" && venmoHandle) {
      const nativeUrl = `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(venmoHandle)}&amount=${dollars}&note=${encodedNote}`;
      const webUrl    = `https://venmo.com/u/${encodeURIComponent(venmoHandle)}?txn=pay&amount=${dollars}&note=${encodedNote}`;
      payButton = `<button class="btn btn-venmo" onclick="handlePay('${nativeUrl}','${webUrl}')">Pay @${escHtml(venmoHandle)} via Venmo · $${dollars}</button>`;
      payScript  = `<script>function handlePay(n,w){var t=Date.now();setTimeout(function(){if(Date.now()-t<2200)window.location.href=w;},1500);window.location.href=n;}<\/script>`;
    } else if (selectedMethod === "zelle" && hostZelle) {
      payButton = `<div class="zelle-box">
        <p class="zelle-label">Pay via Zelle</p>
        <p class="zelle-id">${escHtml(hostZelle)}</p>
        <p class="zelle-amount">Send <strong>$${dollars}</strong> to the address above</p>
        <p class="zelle-hint">Open your banking app → Zelle → Send money</p>
      </div>`;
    }
  }

  const paidBanner = isPaid
    ? `<div class="paid-banner"><span class="paid-check">✓</span> Already paid — you're all done!</div>`
    : "";

  const noHandle = !payButton && !isPaid
    ? `<p class="no-handle">No payment handle on file — contact the host to arrange payment.</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your bill — ${escHtml(event.title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #FAF5EF;
      color: #1C1917;
      min-height: 100vh;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 32px 16px 56px;
    }

    .card {
      background: #ffffff;
      border-radius: 20px;
      max-width: 420px;
      width: 100%;
      padding: 28px 24px 32px;
      box-shadow: 0 2px 24px rgba(28, 25, 23, 0.08);
    }

    /* ── Header ── */
    .eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: #C2410C;
      margin-bottom: 6px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #1C1917;
      margin-bottom: 3px;
      line-height: 1.2;
    }
    .subtitle {
      font-size: 14px;
      color: #78716C;
      margin-bottom: 24px;
    }

    /* ── Amount box ── */
    .amount-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #F5F0EB;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 0;
    }
    .amount-label { font-size: 14px; color: #78716C; }
    .amount-value {
      font-size: 34px;
      font-weight: 800;
      color: #1C1917;
      letter-spacing: -1.5px;
    }

    /* ── Item lines ── */
    .items {
      list-style: none;
      margin: 0 0 20px;
      border-bottom: 1px solid #F0EAE2;
    }
    .items li {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 11px 0;
      border-top: 1px solid #F0EAE2;
      font-size: 15px;
      gap: 12px;
    }
    .item-name { color: #1C1917; flex: 1; }
    .item-price { font-weight: 600; color: #1C1917; white-space: nowrap; }

    /* ── Divider between amount + items ── */
    .section-gap { height: 20px; }

    /* ── Pay button ── */
    .btn {
      display: block;
      width: 100%;
      text-align: center;
      padding: 16px;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 700;
      text-decoration: none;
      border: none;
      cursor: pointer;
      margin-bottom: 0;
      transition: opacity .15s;
      -webkit-tap-highlight-color: transparent;
    }
    .btn:active { opacity: 0.78; }
    .btn-cashapp { background: #00d632; color: #fff; }
    .btn-venmo   { background: #3D95CE; color: #fff; }

    /* ── Zelle box ── */
    .zelle-box {
      border: 2px solid #7C3AED;
      border-radius: 14px;
      padding: 16px 18px;
      background: #faf5ff;
    }
    .zelle-label {
      font-size: 11px;
      font-weight: 700;
      color: #7C3AED;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 6px;
    }
    .zelle-id {
      font-size: 18px;
      font-weight: 700;
      color: #1C1917;
      margin-bottom: 4px;
      word-break: break-all;
    }
    .zelle-amount {
      font-size: 14px;
      color: #1C1917;
      margin-bottom: 4px;
    }
    .zelle-hint { font-size: 13px; color: #78716C; }

    /* ── Paid / status banners ── */
    .paid-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #d1fae5;
      color: #065f46;
      border-radius: 12px;
      padding: 13px 16px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .paid-check {
      font-size: 18px;
      font-weight: 800;
    }

    .no-handle {
      font-size: 14px;
      color: #78716C;
      text-align: center;
      padding: 4px 0;
      line-height: 1.5;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 28px;
      font-size: 12px;
      color: #A8A29E;
      text-align: center;
      letter-spacing: 0.02em;
    }
    .footer strong { color: #C2410C; font-weight: 700; }
  </style>
  ${payScript}
</head>
<body>
  <div class="card">
    <p class="eyebrow">Payment Summary</p>
    <h1>${escHtml(guestName)}</h1>
    <p class="subtitle">${escHtml(event.title)}${event.restaurantName ? ` · ${escHtml(event.restaurantName)}` : ""}</p>

    ${paidBanner}

    <div class="amount-row">
      <span class="amount-label">Your share</span>
      <span class="amount-value">$${dollars}</span>
    </div>

    ${itemizedHtml ? `<div class="section-gap"></div>${itemizedHtml}` : "<div class=\"section-gap\"></div>"}

    ${payButton}
    ${noHandle}

    <p class="footer">Powered by <strong>Owmo</strong></p>
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default router;
