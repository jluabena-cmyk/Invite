import { Router } from "express";
import { getAuth } from "@clerk/express";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  eventsTable,
  eventParticipantsTable,
  savedGuestsTable,
  itemAssignmentsTable,
  receiptItemsTable,
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

// ─── GET /saved-guests ────────────────────────────────────────────────────────

router.get("/saved-guests", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(401).json({ error: "Profile not found" });

  const contacts = await db
    .select()
    .from(savedGuestsTable)
    .where(eq(savedGuestsTable.hostUserId, profile.id))
    .orderBy(asc(savedGuestsTable.name));

  return res.status(200).json({ contacts });
});

// ─── POST /saved-guests ───────────────────────────────────────────────────────

router.post("/saved-guests", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(401).json({ error: "Profile not found" });

  const { name, notes } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }

  const notesVal = typeof notes === "string" && notes.trim() ? notes.trim() : null;

  const [contact] = await db
    .insert(savedGuestsTable)
    .values({ hostUserId: profile.id, name: name.trim().slice(0, 100), notes: notesVal })
    .returning();

  return res.status(201).json({ contact });
});

// ─── PATCH /saved-guests/:id ──────────────────────────────────────────────────

router.patch("/saved-guests/:id", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(401).json({ error: "Profile not found" });

  const [existing] = await db
    .select()
    .from(savedGuestsTable)
    .where(and(eq(savedGuestsTable.id, id), eq(savedGuestsTable.hostUserId, profile.id)))
    .limit(1);

  if (!existing) return res.status(404).json({ error: "Contact not found" });

  const { name, notes, cashAppHandle, venmoHandle, phoneNumber } = req.body ?? {};
  const updates: { name?: string; notes?: string | null; cashAppHandle?: string | null; venmoHandle?: string | null; phoneNumber?: string | null } = {};

  if (typeof name === "string" && name.trim()) {
    updates.name = name.trim().slice(0, 100);
  }
  if (notes !== undefined) {
    updates.notes = typeof notes === "string" && notes.trim() ? notes.trim() : null;
  }
  if (cashAppHandle !== undefined) {
    updates.cashAppHandle = typeof cashAppHandle === "string" && cashAppHandle.trim() ? cashAppHandle.trim().slice(0, 50) : null;
  }
  if (venmoHandle !== undefined) {
    updates.venmoHandle = typeof venmoHandle === "string" && venmoHandle.trim() ? venmoHandle.trim().slice(0, 50) : null;
  }
  if (phoneNumber !== undefined) {
    updates.phoneNumber = typeof phoneNumber === "string" && phoneNumber.trim() ? phoneNumber.trim().slice(0, 30) : null;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  const [updated] = await db
    .update(savedGuestsTable)
    .set(updates)
    .where(eq(savedGuestsTable.id, id))
    .returning();

  return res.status(200).json({ contact: updated });
});

// ─── DELETE /saved-guests/:id ─────────────────────────────────────────────────

router.delete("/saved-guests/:id", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(401).json({ error: "Profile not found" });

  const [existing] = await db
    .select()
    .from(savedGuestsTable)
    .where(and(eq(savedGuestsTable.id, id), eq(savedGuestsTable.hostUserId, profile.id)))
    .limit(1);

  if (!existing) return res.status(404).json({ error: "Contact not found" });

  await db.delete(savedGuestsTable).where(eq(savedGuestsTable.id, id));

  return res.status(200).json({ ok: true });
});

// ─── GET /saved-guests/:id/history ────────────────────────────────────────────
// Returns cross-event payment history for this saved contact.

router.get("/saved-guests/:id/history", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(401).json({ error: "Profile not found" });

  const [contact] = await db
    .select()
    .from(savedGuestsTable)
    .where(and(eq(savedGuestsTable.id, id), eq(savedGuestsTable.hostUserId, profile.id)))
    .limit(1);

  if (!contact) return res.status(404).json({ error: "Contact not found" });

  const participantRows = await db
    .select({
      participantId: eventParticipantsTable.id,
      eventId: eventParticipantsTable.eventId,
      joinedAt: eventParticipantsTable.joinedAt,
    })
    .from(eventParticipantsTable)
    .where(eq(eventParticipantsTable.savedGuestId, id));

  if (participantRows.length === 0) {
    return res.status(200).json({ contact, history: [] });
  }

  const eventIds = participantRows.map((r) => r.eventId);
  const participantIds = participantRows.map((r) => r.participantId);

  // Fetch event metadata
  const allEvents = await db
    .select({
      id: eventsTable.id,
      title: eventsTable.title,
      startsAt: eventsTable.startsAt,
      createdAt: eventsTable.createdAt,
    })
    .from(eventsTable)
    .where(inArray(eventsTable.id, eventIds))
    .orderBy(desc(eventsTable.createdAt));

  const allEventsMap = new Map(allEvents.map((e) => [e.id, e]));

  // Step 1: Get item assignments for these participants (what they owe)
  const myAssignments = await db
    .select({
      guestParticipantId: itemAssignmentsTable.guestParticipantId,
      receiptItemId: itemAssignmentsTable.receiptItemId,
      claimed: itemAssignmentsTable.claimed,
      priceDollars: receiptItemsTable.price,
      quantity: receiptItemsTable.quantity,
    })
    .from(itemAssignmentsTable)
    .innerJoin(receiptItemsTable, eq(itemAssignmentsTable.receiptItemId, receiptItemsTable.id))
    .where(inArray(itemAssignmentsTable.guestParticipantId, participantIds));

  if (myAssignments.length === 0) {
    // No assignments at all — build history with zero amounts
    const history = participantRows
      .map((p) => {
        const event = allEventsMap.get(p.eventId);
        if (!event) return null;
        return {
          eventId: event.id,
          eventTitle: event.title,
          eventDate: event.startsAt ?? event.createdAt,
          joinedAt: p.joinedAt,
          participantId: p.participantId,
          amountCents: 0,
          paidCents: 0,
          paymentStatus: "none" as const,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b!.eventDate).getTime() - new Date(a!.eventDate).getTime());
    return res.status(200).json({ contact, history });
  }

  // Step 2: For each item these participants owe, count total assignees across ALL participants
  // (needed to correctly split shared items: e.g. $10 item split 2 ways = $5 each)
  const itemIdsNeeded = [...new Set(myAssignments.map((a) => a.receiptItemId))];
  const assigneeCountRows = await db
    .select({
      receiptItemId: itemAssignmentsTable.receiptItemId,
      assigneeCount: count(itemAssignmentsTable.id),
    })
    .from(itemAssignmentsTable)
    .where(inArray(itemAssignmentsTable.receiptItemId, itemIdsNeeded))
    .groupBy(itemAssignmentsTable.receiptItemId);

  const assigneeCountByItem = new Map<number, number>(
    assigneeCountRows.map((r) => [r.receiptItemId, Number(r.assigneeCount)]),
  );

  // Step 3: Compute per-participant owed amount using the canonical split:
  //   shareCents = floor(itemSubtotalCents / totalAssigneesForItem)
  // This matches the mobile app's bill-splitting logic exactly.
  const assignmentsByParticipant = new Map<number, { totalCents: number }>();
  for (const row of myAssignments) {
    if (row.guestParticipantId == null) continue;
    const subtotalCents = Math.round(parseFloat(row.priceDollars) * row.quantity * 100);
    const totalAssignees = assigneeCountByItem.get(row.receiptItemId) ?? 1;
    const shareCents = Math.floor(subtotalCents / totalAssignees);
    const existing = assignmentsByParticipant.get(row.guestParticipantId) ?? { totalCents: 0 };
    existing.totalCents += shareCents;
    assignmentsByParticipant.set(row.guestParticipantId, existing);
  }

  // Step 4: Fetch guest payment records for these participants to get canonical payment status.
  // guest_payment_requests.paidAt drives "paid" status; requestedAt drives "requested".
  const guestPaymentRows = await db
    .select({
      eventParticipantId: guestPaymentRequestsTable.eventParticipantId,
      amountCents: guestPaymentRequestsTable.amountCents,
      requestedAt: guestPaymentRequestsTable.requestedAt,
      paidAt: guestPaymentRequestsTable.paidAt,
    })
    .from(guestPaymentRequestsTable)
    .where(inArray(guestPaymentRequestsTable.eventParticipantId, participantIds));

  const guestPaymentByParticipant = new Map(
    guestPaymentRows.map((r) => [r.eventParticipantId, r]),
  );

  const history = participantRows
    .map((p) => {
      const event = allEventsMap.get(p.eventId);
      if (!event) return null;
      const amounts = assignmentsByParticipant.get(p.participantId);
      const totalCents = amounts?.totalCents ?? 0;

      // Use guest payment record for payment status when available (canonical source of truth).
      const gpr = guestPaymentByParticipant.get(p.participantId);
      let paymentStatus: "paid" | "requested" | "unpaid" | "none";
      let paidCents = 0;
      if (totalCents === 0) {
        paymentStatus = "none";
      } else if (gpr?.paidAt) {
        paymentStatus = "paid";
        paidCents = gpr.amountCents;
      } else if (gpr?.requestedAt) {
        paymentStatus = "requested";
      } else {
        paymentStatus = "unpaid";
      }
      return {
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.startsAt ?? event.createdAt,
        joinedAt: p.joinedAt,
        participantId: p.participantId,
        amountCents: totalCents,
        paidCents,
        paymentStatus,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b!.eventDate).getTime() - new Date(a!.eventDate).getTime());

  return res.status(200).json({ contact, history });
});

export default router;
