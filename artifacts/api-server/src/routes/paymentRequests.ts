import { Router } from "express";
import { getAuth } from "@clerk/express";
import { aliasedTable, and, eq, inArray, ne } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  eventsTable,
  eventParticipantsTable,
  receiptsTable,
  receiptItemsTable,
  itemAssignmentsTable,
  paymentRequestsTable,
} from "@workspace/db";

import { sendExpoPush, getTokensForUsers, getUnmutedTokensForEvent } from "../lib/sendExpoPush";
import { maskZelle } from "../lib/maskZelle";
import { fetchRcEntitlement } from "../lib/revenuecat";
import { FREE_EVENT_LIMIT } from "../lib/config";

const router = Router();

const FULL_ACCESS_ROLES = ["host", "participant", "accepted"];

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function resolveProfile(clerkUserId: string) {
  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);
  return profile ?? null;
}

async function resolveEvent(eventId: number) {
  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, eventId))
    .limit(1);
  return event ?? null;
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

// ─── Amount computation (mirrors frontend computeTotals exactly) ───────────────

interface ReceiptRow {
  tax: string | null;
  tip: string | null;
  total: string | null;
}

interface ItemRow {
  id: number;
  price: string;
  quantity: number;
}

interface AssignmentRow {
  receiptItemId: number;
  userId: number | null;
  claimed: boolean;
}

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
    .map(({ id, w }) => ({
      id,
      frac:
        (totalCents * w) / totalWeight -
        Math.floor((totalCents * w) / totalWeight),
    }))
    .sort((a, b) => b.frac - a.frac || a.id - b.id);

  for (let i = 0; i < remainder; i++) {
    result[sorted[i].id] = (result[sorted[i].id] ?? 0) + 1;
  }

  return result;
}

function computeGuestAmountsCents(
  items: ItemRow[],
  assignments: AssignmentRow[],
  receipt: ReceiptRow,
): Record<number, number> {
  const taxCents = Math.round(parseFloat(receipt.tax ?? "0") * 100);
  const tipCents = Math.round(parseFloat(receipt.tip ?? "0") * 100);
  const totalCents = Math.round(parseFloat(receipt.total ?? "0") * 100);

  const itemByParticipant: Record<number, number> = {};
  let unallocatedItemCents = 0;

  for (const item of items) {
    const subtotalCents = Math.round(parseFloat(item.price) * item.quantity * 100);
    const active = assignments.filter(
      (a) => a.receiptItemId === item.id && a.claimed,
    );
    if (active.length === 0) {
      unallocatedItemCents += subtotalCents;
    } else {
      const shareCents = Math.floor(subtotalCents / active.length);
      const remainderCents = subtotalCents - shareCents * active.length;
      active.forEach((a, idx) => {
        const extra = idx === 0 ? remainderCents : 0;
        if (a.userId === null) {
          // Guest's share cannot be sent as a payment request — treat as unallocated
          unallocatedItemCents += shareCents + extra;
          return;
        }
        itemByParticipant[a.userId] =
          (itemByParticipant[a.userId] ?? 0) + shareCents + extra;
      });
    }
  }

  const totalWeightCents =
    Object.values(itemByParticipant).reduce((s, v) => s + v, 0) +
    unallocatedItemCents;

  if (totalCents > 0) {
    if (totalWeightCents === 0) return {};
    const weights: Record<number, number> = { ...itemByParticipant };
    if (unallocatedItemCents > 0) weights[-1] = unallocatedItemCents;
    const dist = distributeProportionally(totalCents, weights, totalWeightCents);
    const byParticipant: Record<number, number> = {};
    for (const uid of Object.keys(itemByParticipant).map(Number)) {
      byParticipant[uid] = dist[uid] ?? 0;
    }
    return byParticipant;
  }

  if (taxCents === 0 && tipCents === 0) return itemByParticipant;

  const weights: Record<number, number> = { ...itemByParticipant };
  if (unallocatedItemCents > 0) weights[-1] = unallocatedItemCents;

  const taxDist = distributeProportionally(taxCents, weights, totalWeightCents);
  const tipDist = distributeProportionally(tipCents, weights, totalWeightCents);

  const byParticipant: Record<number, number> = {};
  for (const uid of Object.keys(itemByParticipant).map(Number)) {
    byParticipant[uid] =
      (itemByParticipant[uid] ?? 0) +
      (taxDist[uid] ?? 0) +
      (tipDist[uid] ?? 0);
  }

  return byParticipant;
}

// ─── POST /events/:eventId/payment-requests ───────────────────────────────────

router.post("/events/:eventId/payment-requests", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(401).json({ error: "Profile not found" });

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) return res.status(403).json({ error: "Not a participant" });
  if (participation.role !== "host")
    return res.status(403).json({ error: "Only hosts can create payment requests" });

  const event = await resolveEvent(eventId);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.cancelledAt)
    return res.status(409).json({ error: "Cannot create payment requests for a cancelled event" });

  // ── Subscription gate ───────────────────────────────────────────────────────
  const hostedEventsSent = profile.hostedEventsSent ?? 0;
  let isPremium =
    profile.subscriptionStatus === "premium" &&
    (profile.premiumExpiresAt === null || profile.premiumExpiresAt > new Date());

  if (!isPremium && hostedEventsSent >= FREE_EVENT_LIMIT) {
    // Safety valve: DB may be stale if a webhook was delayed or missed.
    // Do a live RC check before blocking the user.
    const rcData = await fetchRcEntitlement(profile.clerkUserId);
    if (rcData?.isPremium) {
      // RC says premium — sync DB so future requests don't need this fallback.
      await db
        .update(userProfilesTable)
        .set({ subscriptionStatus: "premium", premiumExpiresAt: rcData.expiresAt })
        .where(eq(userProfilesTable.clerkUserId, profile.clerkUserId));
      isPremium = true;
    }
  }

  if (!isPremium && hostedEventsSent >= FREE_EVENT_LIMIT) {
    return res.status(402).json({
      error: "SUBSCRIPTION_REQUIRED",
      message: `You have reached the limit of ${FREE_EVENT_LIMIT} free hosted events. Please upgrade to Premium to continue sending payment requests.`,
      hostedEventsSent,
      limit: FREE_EVENT_LIMIT,
    });
  }
  // ───────────────────────────────────────────────────────────────────────────

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
  if (items.length === 0)
    return res.status(400).json({ error: "Receipt has no items" });

  const assignments = await db
    .select()
    .from(itemAssignmentsTable)
    .where(
      inArray(
        itemAssignmentsTable.receiptItemId,
        items.map((i) => i.id),
      ),
    );

  const amountsByGuest = computeGuestAmountsCents(items, assignments, receipt);

  const guestParticipants = await db
    .select()
    .from(eventParticipantsTable)
    .where(
      and(
        eq(eventParticipantsTable.eventId, eventId),
        ne(eventParticipantsTable.userId, profile.id),
        inArray(eventParticipantsTable.role, FULL_ACCESS_ROLES),
      ),
    );

  const rawNote = req.body?.note;
  const noteVal =
    typeof rawNote === "string" && rawNote.trim() ? rawNote.trim() : null;

  const results = [];
  for (const participant of guestParticipants) {
    if (participant.userId === null) continue;
    const amountCents = amountsByGuest[participant.userId] ?? 0;
    if (amountCents <= 0) continue;

    const [row] = await db
      .insert(paymentRequestsTable)
      .values({
        eventId,
        receiptId: receipt.id,
        hostUserId: profile.id,
        guestUserId: participant.userId,
        amountCents,
        note: noteVal,
        status: "requested",
      })
      .onConflictDoUpdate({
        target: [paymentRequestsTable.receiptId, paymentRequestsTable.guestUserId],
        set: {
          hostUserId: profile.id,
          amountCents,
          note: noteVal,
          updatedAt: new Date(),
        },
        where: eq(paymentRequestsTable.status, "requested"),
      })
      .returning();

    if (row) results.push(row);
  }

  // Increment hostedEventsSent only on the FIRST successful send for this event
  // (re-sends for the same event via onConflictDoUpdate should not cost an extra credit)
  const isFirstSend = results.length > 0 && results.some((r) => r.createdAt.getTime() === r.updatedAt?.getTime());
  if (isFirstSend) {
    const newCount = (profile.hostedEventsSent ?? 0) + 1;
    await db
      .update(userProfilesTable)
      .set({ hostedEventsSent: newCount })
      .where(eq(userProfilesTable.id, profile.id));

    // Fire a one-time "running low" push notification when the host uses their
    // (FREE_EVENT_LIMIT - 2)th event slot (currently 6th), giving 2 events notice.
    const WARNING_THRESHOLD = FREE_EVENT_LIMIT - 2;
    if (!isPremium && newCount === WARNING_THRESHOLD && !profile.freeEventWarningNotified) {
      await db
        .update(userProfilesTable)
        .set({ freeEventWarningNotified: true })
        .where(eq(userProfilesTable.id, profile.id));
      const hostTokens = await getTokensForUsers([profile.id]);
      void sendExpoPush(
        hostTokens,
        "You have 2 free events left",
        "Upgrade to keep hosting unlimited events",
        { screen: "paywall" },
      );
    }
  }

  // Notify each guest that they have a new payment request
  const guestUserIds = results.map((r) => r.guestUserId);
  if (guestUserIds.length > 0) {
    const tokens = await getUnmutedTokensForEvent(eventId, guestUserIds);
    const hostName = profile.displayName ?? profile.handle ?? "Your host";
    const zelleInfo: string | null = profile.zelleInfo ?? null;
    const notifBody = zelleInfo
      ? `You owe money — send to ${maskZelle(zelleInfo)} on Zelle`
      : `You owe money from "${event.title}" — tap to view`;
    const notifData: Record<string, unknown> = { screen: "event", eventId };
    if (zelleInfo) notifData.hostZelleInfo = zelleInfo;
    void sendExpoPush(tokens, `Payment request from ${hostName}`, notifBody, notifData);
  }

  return res.status(200).json({ requests: results });
});

// ─── GET /events/:eventId/payment-requests ────────────────────────────────────

router.get("/events/:eventId/payment-requests", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(401).json({ error: "Profile not found" });

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) return res.status(403).json({ error: "Not a participant" });
  if (!FULL_ACCESS_ROLES.includes(participation.role))
    return res.status(403).json({ error: "Access denied" });

  const guestProfile = aliasedTable(userProfilesTable, "guest_profile");
  const hostProfile = aliasedTable(userProfilesTable, "host_profile");

  const hostPaymentFields = {
    hostCashAppHandle: hostProfile.cashAppHandle,
    hostVenmoHandle: hostProfile.venmoHandle,
    hostZelleInfo: hostProfile.zelleInfo,
    hostPreferredPaymentMethod: hostProfile.preferredPaymentMethod,
  };

  if (participation.role === "host") {
    const rows = await db
      .select({
        id: paymentRequestsTable.id,
        eventId: paymentRequestsTable.eventId,
        receiptId: paymentRequestsTable.receiptId,
        hostUserId: paymentRequestsTable.hostUserId,
        guestUserId: paymentRequestsTable.guestUserId,
        guestDisplayName: guestProfile.displayName,
        guestHandle: guestProfile.handle,
        guestPhoneNumber: guestProfile.phoneNumber,
        guestPreferredPaymentMethod: guestProfile.preferredPaymentMethod,
        amountCents: paymentRequestsTable.amountCents,
        note: paymentRequestsTable.note,
        status: paymentRequestsTable.status,
        createdAt: paymentRequestsTable.createdAt,
        updatedAt: paymentRequestsTable.updatedAt,
        ...hostPaymentFields,
      })
      .from(paymentRequestsTable)
      .innerJoin(guestProfile, eq(guestProfile.id, paymentRequestsTable.guestUserId))
      .innerJoin(hostProfile, eq(hostProfile.id, paymentRequestsTable.hostUserId))
      .where(eq(paymentRequestsTable.eventId, eventId));

    return res.status(200).json({ requests: rows });
  }

  const rows = await db
    .select({
      id: paymentRequestsTable.id,
      eventId: paymentRequestsTable.eventId,
      receiptId: paymentRequestsTable.receiptId,
      hostUserId: paymentRequestsTable.hostUserId,
      guestUserId: paymentRequestsTable.guestUserId,
      guestDisplayName: guestProfile.displayName,
      guestHandle: guestProfile.handle,
      amountCents: paymentRequestsTable.amountCents,
      note: paymentRequestsTable.note,
      status: paymentRequestsTable.status,
      createdAt: paymentRequestsTable.createdAt,
      updatedAt: paymentRequestsTable.updatedAt,
      ...hostPaymentFields,
    })
    .from(paymentRequestsTable)
    .innerJoin(guestProfile, eq(guestProfile.id, paymentRequestsTable.guestUserId))
    .innerJoin(hostProfile, eq(hostProfile.id, paymentRequestsTable.hostUserId))
    .where(
      and(
        eq(paymentRequestsTable.eventId, eventId),
        eq(paymentRequestsTable.guestUserId, profile.id),
      ),
    );

  return res.status(200).json({ requests: rows });
});

// ─── PATCH /payment-requests/:requestId (host edits amount/note) ─────────────

router.patch("/payment-requests/:requestId", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const requestId = parseInt(req.params.requestId, 10);
  if (isNaN(requestId)) return res.status(400).json({ error: "Invalid request ID" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(401).json({ error: "Profile not found" });

  const [paymentRequest] = await db
    .select()
    .from(paymentRequestsTable)
    .where(eq(paymentRequestsTable.id, requestId))
    .limit(1);

  if (!paymentRequest) return res.status(404).json({ error: "Payment request not found" });
  if (paymentRequest.status !== "requested")
    return res.status(400).json({ error: "Can only edit a payment request with status 'requested'" });

  const participation = await resolveParticipation(paymentRequest.eventId, profile.id);
  if (!participation || participation.role !== "host")
    return res.status(403).json({ error: "Only the current event host can edit this payment request" });

  const { amountCents, note } = req.body ?? {};
  if (typeof amountCents !== "number" || amountCents <= 0 || !Number.isInteger(amountCents))
    return res.status(400).json({ error: "amountCents must be a positive integer" });

  const noteVal = typeof note === "string" && note.trim() ? note.trim() : null;

  const [updated] = await db
    .update(paymentRequestsTable)
    .set({ amountCents, note: noteVal, updatedAt: new Date() })
    .where(eq(paymentRequestsTable.id, requestId))
    .returning();

  return res.status(200).json({ request: updated });
});

// ─── PATCH /payment-requests/:requestId/status ───────────────────────────────

router.patch("/payment-requests/:requestId/status", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const requestId = parseInt(req.params.requestId, 10);
  if (isNaN(requestId)) return res.status(400).json({ error: "Invalid request ID" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(401).json({ error: "Profile not found" });

  const [paymentRequest] = await db
    .select()
    .from(paymentRequestsTable)
    .where(eq(paymentRequestsTable.id, requestId))
    .limit(1);

  if (!paymentRequest) return res.status(404).json({ error: "Payment request not found" });

  const { status } = req.body ?? {};
  const isGuest = paymentRequest.guestUserId === profile.id;

  // Re-verify that the caller currently holds a full-access role in the event
  const participation = await resolveParticipation(paymentRequest.eventId, profile.id);
  if (!participation || !FULL_ACCESS_ROLES.includes(participation.role))
    return res.status(403).json({ error: "Access denied" });

  const isHost = participation.role === "host";

  if (!isHost && !isGuest)
    return res.status(403).json({ error: "You can only update your own payment requests" });

  if (isHost) {
    if (status !== "received")
      return res.status(400).json({ error: "Only 'received' is a valid host transition" });
    if (paymentRequest.status !== "paid")
      return res
        .status(400)
        .json({ error: `Cannot transition from '${paymentRequest.status}' to 'received'` });
  } else {
    if (status !== "paid")
      return res.status(400).json({ error: "Only 'paid' is a valid guest transition" });
    if (paymentRequest.status !== "requested")
      return res
        .status(400)
        .json({ error: `Cannot transition from '${paymentRequest.status}' to 'paid'` });
  }

  const [updated] = await db
    .update(paymentRequestsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(paymentRequestsTable.id, requestId))
    .returning();

  // Push notifications for status transitions
  const [eventRow] = await db
    .select({ title: eventsTable.title })
    .from(eventsTable)
    .where(eq(eventsTable.id, paymentRequest.eventId))
    .limit(1);
  const eventTitle = eventRow?.title ?? "your event";
  const amountDollars = (paymentRequest.amountCents / 100).toFixed(2);

  if (isGuest && status === "paid") {
    // Guest marked as paid → notify host
    const tokens = await getUnmutedTokensForEvent(paymentRequest.eventId, [paymentRequest.hostUserId]);
    const guestName = profile.displayName ?? profile.handle ?? "A guest";
    void sendExpoPush(
      tokens,
      `${guestName} marked as paid`,
      `$${amountDollars} for "${eventTitle}" — tap to confirm`,
      { screen: "event", eventId: paymentRequest.eventId },
    );
  } else if (isHost && status === "received") {
    // Host confirmed receipt → notify guest
    const tokens = await getUnmutedTokensForEvent(paymentRequest.eventId, [paymentRequest.guestUserId]);
    const hostName = profile.displayName ?? profile.handle ?? "Your host";
    void sendExpoPush(
      tokens,
      "Payment confirmed ✓",
      `${hostName} confirmed your $${amountDollars} for "${eventTitle}"`,
      { screen: "event", eventId: paymentRequest.eventId },
    );
  }

  return res.status(200).json({ request: updated });
});

export default router;
