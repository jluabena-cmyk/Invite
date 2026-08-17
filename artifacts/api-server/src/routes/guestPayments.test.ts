import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../app";
import { buildGuestItemizedLines, selectHostPaymentMethod } from "./guestPayments";
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
import { and, eq, inArray } from "drizzle-orm";

// ── Clerk mock ────────────────────────────────────────────────────────────────
// clerkMiddleware must be a no-op so the request passes through, and
// getAuth must return a controllable userId.

const TEST_CLERK_ID = "test_clerk_host_001";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: TEST_CLERK_ID }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

let hostProfileId: number;
let eventId: number;
let guestParticipantId: number;

const cleanupIds: {
  guestPaymentIds: number[];
  itemAssignmentIds: number[];
  receiptItemIds: number[];
  receiptIds: number[];
  participantIds: number[];
  eventIds: number[];
  profileIds: number[];
} = {
  guestPaymentIds: [],
  itemAssignmentIds: [],
  receiptItemIds: [],
  receiptIds: [],
  participantIds: [],
  eventIds: [],
  profileIds: [],
};

async function seedBase() {
  const handle = `host_${Date.now()}`;

  const [profile] = await db
    .insert(userProfilesTable)
    .values({
      clerkUserId: TEST_CLERK_ID,
      email: `${handle}@test.invalid`,
      handle,
    })
    .returning();
  hostProfileId = profile.id;
  cleanupIds.profileIds.push(profile.id);

  const [event] = await db
    .insert(eventsTable)
    .values({ ownerUserId: profile.id, title: "Test Dinner" })
    .returning();
  eventId = event.id;
  cleanupIds.eventIds.push(event.id);

  const [hostParticipant] = await db
    .insert(eventParticipantsTable)
    .values({ eventId: event.id, userId: profile.id, role: "host" })
    .returning();
  cleanupIds.participantIds.push(hostParticipant.id);

  const [guestParticipant] = await db
    .insert(eventParticipantsTable)
    .values({
      eventId: event.id,
      userId: null,
      guestName: "Alice Guest",
      role: "guest",
      cashAppHandle: "aliceguest",
    })
    .returning();
  guestParticipantId = guestParticipant.id;
  cleanupIds.participantIds.push(guestParticipant.id);
}

async function cleanupAll() {
  if (cleanupIds.guestPaymentIds.length > 0) {
    await db
      .delete(guestPaymentRequestsTable)
      .where(inArray(guestPaymentRequestsTable.id, cleanupIds.guestPaymentIds));
    cleanupIds.guestPaymentIds = [];
  }
  if (cleanupIds.itemAssignmentIds.length > 0) {
    await db
      .delete(itemAssignmentsTable)
      .where(inArray(itemAssignmentsTable.id, cleanupIds.itemAssignmentIds));
    cleanupIds.itemAssignmentIds = [];
  }
  if (cleanupIds.receiptItemIds.length > 0) {
    await db
      .delete(receiptItemsTable)
      .where(inArray(receiptItemsTable.id, cleanupIds.receiptItemIds));
    cleanupIds.receiptItemIds = [];
  }
  if (cleanupIds.receiptIds.length > 0) {
    await db
      .delete(receiptsTable)
      .where(inArray(receiptsTable.id, cleanupIds.receiptIds));
    cleanupIds.receiptIds = [];
  }
  // Cascades handle participants + payments when events are deleted
  if (cleanupIds.eventIds.length > 0) {
    await db
      .delete(eventsTable)
      .where(inArray(eventsTable.id, cleanupIds.eventIds));
    cleanupIds.eventIds = [];
    cleanupIds.participantIds = [];
    cleanupIds.guestPaymentIds = [];
  }
  if (cleanupIds.profileIds.length > 0) {
    await db
      .delete(userProfilesTable)
      .where(inArray(userProfilesTable.id, cleanupIds.profileIds));
    cleanupIds.profileIds = [];
  }
}

// ── POST summary-link ─────────────────────────────────────────────────────────

describe("POST /events/:eventId/guest-payments/:guestParticipantId/summary-link", () => {
  beforeAll(async () => {
    await seedBase();
  });

  afterAll(async () => {
    await cleanupAll();
  });

  it("generates a token when no payment record and no receipt exist", async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/guest-payments/${guestParticipantId}/summary-link`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summaryUrl");
    expect(res.body).toHaveProperty("token");
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(0);
    expect(res.body.summaryUrl).toContain(res.body.token);

    // The underlying record should have been created with amountCents = 0
    const [record] = await db
      .select()
      .from(guestPaymentRequestsTable)
      .where(eq(guestPaymentRequestsTable.eventParticipantId, guestParticipantId))
      .limit(1);

    expect(record).toBeDefined();
    expect(record!.amountCents).toBe(0);
    expect(record!.summaryToken).toBe(res.body.token);

    cleanupIds.guestPaymentIds.push(record!.id);
  });

  it("reuses the existing token on a subsequent call", async () => {
    const res1 = await request(app)
      .post(`/api/events/${eventId}/guest-payments/${guestParticipantId}/summary-link`)
      .send();

    const res2 = await request(app)
      .post(`/api/events/${eventId}/guest-payments/${guestParticipantId}/summary-link`)
      .send();

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.token).toBe(res2.body.token);
    // summaryUrl may differ in host/port across supertest calls; verify only that
    // both URLs contain the same token (the idempotent part).
    expect(res1.body.summaryUrl).toContain(res1.body.token);
    expect(res2.body.summaryUrl).toContain(res2.body.token);

    // Still only one record in the DB for this guest
    const records = await db
      .select()
      .from(guestPaymentRequestsTable)
      .where(eq(guestPaymentRequestsTable.eventParticipantId, guestParticipantId));

    expect(records.length).toBe(1);
  });

  it("returns 404 for an unknown guestParticipantId", async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/guest-payments/999999/summary-link`)
      .send();

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 403 when the caller is not a host", async () => {
    // Create a separate event owned by a different user so the mock clerk ID
    // has no host participation
    const [otherProfile] = await db
      .insert(userProfilesTable)
      .values({
        clerkUserId: "other_clerk_id_999",
        email: `other_${Date.now()}@test.invalid`,
        handle: `other_${Date.now()}`,
      })
      .returning();
    cleanupIds.profileIds.push(otherProfile.id);

    const [otherEvent] = await db
      .insert(eventsTable)
      .values({ ownerUserId: otherProfile.id, title: "Other Dinner" })
      .returning();
    cleanupIds.eventIds.push(otherEvent.id);

    const [otherGuest] = await db
      .insert(eventParticipantsTable)
      .values({ eventId: otherEvent.id, userId: null, guestName: "Bob", role: "guest" })
      .returning();
    cleanupIds.participantIds.push(otherGuest.id);

    const res = await request(app)
      .post(`/api/events/${otherEvent.id}/guest-payments/${otherGuest.id}/summary-link`)
      .send();

    expect(res.status).toBe(403);
  });
});

// ── GET /guest-summary/:token (JSON) ─────────────────────────────────────────

describe("GET /guest-summary/:token — JSON endpoint", () => {
  let token: string;
  let paymentRecordId: number;

  beforeAll(async () => {
    await seedBase();

    // Generate a token via the API (no receipt → amountCents = 0)
    const res = await request(app)
      .post(`/api/events/${eventId}/guest-payments/${guestParticipantId}/summary-link`)
      .send();

    expect(res.status).toBe(200);
    token = res.body.token;

    const [record] = await db
      .select()
      .from(guestPaymentRequestsTable)
      .where(eq(guestPaymentRequestsTable.eventParticipantId, guestParticipantId))
      .limit(1);
    paymentRecordId = record!.id;
    cleanupIds.guestPaymentIds.push(paymentRecordId);
  });

  afterAll(async () => {
    await cleanupAll();
  });

  it("returns 404 for an invalid / non-existent token", async () => {
    const res = await request(app).get("/api/guest-summary/totally-invalid-token-xyz");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("returns correct shape when no receipt exists (zero owed, empty itemized)", async () => {
    const res = await request(app).get(`/api/guest-summary/${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      guestName: "Alice Guest",
      eventTitle: "Test Dinner",
      amountCents: 0,
      paidAt: null,
      itemized: [],
    });
  });

  it("returns paidAt as a non-null string when the record is marked paid", async () => {
    const now = new Date();
    await db
      .update(guestPaymentRequestsTable)
      .set({ paidAt: now })
      .where(eq(guestPaymentRequestsTable.id, paymentRecordId));

    const res = await request(app).get(`/api/guest-summary/${token}`);

    expect(res.status).toBe(200);
    expect(res.body.paidAt).not.toBeNull();
    expect(typeof res.body.paidAt).toBe("string");

    // Reset for other tests
    await db
      .update(guestPaymentRequestsTable)
      .set({ paidAt: null })
      .where(eq(guestPaymentRequestsTable.id, paymentRecordId));
  });

  it("returns null payment handles when host has no payment info configured", async () => {
    const res = await request(app).get(`/api/guest-summary/${token}`);

    expect(res.status).toBe(200);
    expect(res.body.cashAppHandle).toBeNull();
    expect(res.body.venmoHandle).toBeNull();
    expect(res.body.zelleInfo).toBeNull();
  });

  it("returns exactly one payment method when the host has several set (host preference wins)", async () => {
    // Set all three payment methods with Cash App as the host preference
    await db
      .update(userProfilesTable)
      .set({
        cashAppHandle: "hostcashapp",
        venmoHandle: "hostvenmo",
        zelleInfo: "host@zelle.example",
        preferredPaymentMethod: "cash_app",
      })
      .where(eq(userProfilesTable.id, hostProfileId));

    const res = await request(app).get(`/api/guest-summary/${token}`);

    expect(res.status).toBe(200);
    expect(res.body.paymentMethod).toBe("cash_app");
    expect(res.body.cashAppHandle).toBe("hostcashapp");
    // Non-selected methods are not exposed
    expect(res.body.venmoHandle).toBeNull();
    expect(res.body.zelleInfo).toBeNull();

    // Clean up
    await db
      .update(userProfilesTable)
      .set({ cashAppHandle: null, venmoHandle: null, zelleInfo: null, preferredPaymentMethod: null })
      .where(eq(userProfilesTable.id, hostProfileId));
  });

  it("falls back deterministically (Venmo first) when the host has no preference", async () => {
    await db
      .update(userProfilesTable)
      .set({ cashAppHandle: "hostcashapp", venmoHandle: "hostvenmo", zelleInfo: "host@zelle.example", preferredPaymentMethod: null })
      .where(eq(userProfilesTable.id, hostProfileId));

    const res = await request(app).get(`/api/guest-summary/${token}`);

    expect(res.status).toBe(200);
    expect(res.body.paymentMethod).toBe("venmo");
    expect(res.body.venmoHandle).toBe("hostvenmo");
    expect(res.body.cashAppHandle).toBeNull();
    expect(res.body.zelleInfo).toBeNull();

    await db
      .update(userProfilesTable)
      .set({ cashAppHandle: null, venmoHandle: null, zelleInfo: null })
      .where(eq(userProfilesTable.id, hostProfileId));
  });

  it("returns amountCents and itemized lines when a receipt with assignments exists", async () => {
    // Seed a receipt, one item, and assign it to the guest
    const [receipt] = await db
      .insert(receiptsTable)
      .values({
        eventId,
        uploadedByUserId: hostProfileId,
        tax: "1.00",
        tip: "0.00",
        total: "11.00",
      })
      .returning();
    cleanupIds.receiptIds.push(receipt.id);

    const [item] = await db
      .insert(receiptItemsTable)
      .values({ receiptId: receipt.id, name: "Pizza", price: "10.00", quantity: 1 })
      .returning();
    cleanupIds.receiptItemIds.push(item.id);

    const [assignment] = await db
      .insert(itemAssignmentsTable)
      .values({ receiptItemId: item.id, guestParticipantId, claimed: true })
      .returning();
    cleanupIds.itemAssignmentIds.push(assignment.id);

    const res = await request(app).get(`/api/guest-summary/${token}`);

    expect(res.status).toBe(200);
    // amountCents should be > 0 (the whole $11.00 since only this guest is assigned)
    expect(res.body.amountCents).toBeGreaterThan(0);
    expect(res.body.itemized.length).toBeGreaterThan(0);
    expect(res.body.itemized[0]).toMatchObject({ name: "Pizza" });
    expect(typeof res.body.itemized[0].priceCents).toBe("number");
  });
});

// ── GET /guest-summary/:token/view (HTML) ────────────────────────────────────

describe("GET /guest-summary/:token/view — HTML page", () => {
  let token: string;
  let paymentRecordId: number;

  beforeAll(async () => {
    await seedBase();

    const res = await request(app)
      .post(`/api/events/${eventId}/guest-payments/${guestParticipantId}/summary-link`)
      .send();

    expect(res.status).toBe(200);
    token = res.body.token;

    const [record] = await db
      .select()
      .from(guestPaymentRequestsTable)
      .where(eq(guestPaymentRequestsTable.eventParticipantId, guestParticipantId))
      .limit(1);
    paymentRecordId = record!.id;
    cleanupIds.guestPaymentIds.push(paymentRecordId);
  });

  afterAll(async () => {
    await cleanupAll();
  });

  it("returns 404 HTML for an invalid token", async () => {
    const res = await request(app).get("/api/guest-summary/bad-token-abc/view");

    expect(res.status).toBe(404);
    expect(res.text).toContain("not found");
  });

  it("serves HTML with the guest name in the page when no receipt exists", async () => {
    const res = await request(app).get(`/api/guest-summary/${token}/view`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain("Alice Guest");
    expect(res.text).toContain("Test Dinner");
  });

  it("shows the paid banner when paidAt is set", async () => {
    await db
      .update(guestPaymentRequestsTable)
      .set({ paidAt: new Date() })
      .where(eq(guestPaymentRequestsTable.id, paymentRecordId));

    const res = await request(app).get(`/api/guest-summary/${token}/view`);

    expect(res.status).toBe(200);
    expect(res.text).toContain("paid-banner");
    expect(res.text).toContain("Already paid");

    await db
      .update(guestPaymentRequestsTable)
      .set({ paidAt: null })
      .where(eq(guestPaymentRequestsTable.id, paymentRecordId));
  });

  it("renders without itemized list when no receipt exists", async () => {
    const res = await request(app).get(`/api/guest-summary/${token}/view`);

    expect(res.status).toBe(200);
    // No <ul class="items"> in the response when there are no itemized lines
    expect(res.text).not.toContain('class="items"');
  });

  it("shows fallback message and no payment buttons when host has no payment info", async () => {
    // Ensure host profile has no payment info (reset from any prior test)
    await db
      .update(userProfilesTable)
      .set({ cashAppHandle: null, venmoHandle: null, zelleInfo: null })
      .where(eq(userProfilesTable.id, hostProfileId));

    const res = await request(app).get(`/api/guest-summary/${token}/view`);

    expect(res.status).toBe(200);
    expect(res.text).toContain("No payment handle on file");
    // CSS defines .btn-cashapp / .btn-venmo / .zelle-box so check for the
    // element attribute, which only appears when the block is rendered.
    expect(res.text).not.toContain('class="btn btn-cashapp"');
    expect(res.text).not.toContain('class="btn btn-venmo"');
    expect(res.text).not.toContain('<div class="zelle-box"');
  });

  it("renders Cash App button with host's handle in the deep-link URL", async () => {
    await db
      .update(userProfilesTable)
      .set({ cashAppHandle: "hostcashapp", venmoHandle: null, zelleInfo: null })
      .where(eq(userProfilesTable.id, hostProfileId));

    const res = await request(app).get(`/api/guest-summary/${token}/view`);

    expect(res.status).toBe(200);
    // The deep-link URL must reference the host's $hostcashapp handle
    expect(res.text).toContain("cash.app/$hostcashapp");
    // The guest's own cashAppHandle must NOT appear in any payment URL
    expect(res.text).not.toContain("cash.app/$aliceguest");
    expect(res.text).not.toContain("cash.app/aliceguest");
    // No fallback message when a payment method is present
    expect(res.text).not.toContain("No payment handle on file");

    await db
      .update(userProfilesTable)
      .set({ cashAppHandle: null })
      .where(eq(userProfilesTable.id, hostProfileId));
  });

  it("renders Venmo button with host's handle in the deep-link URL", async () => {
    await db
      .update(userProfilesTable)
      .set({ cashAppHandle: null, venmoHandle: "hostvenmo", zelleInfo: null })
      .where(eq(userProfilesTable.id, hostProfileId));

    const res = await request(app).get(`/api/guest-summary/${token}/view`);

    expect(res.status).toBe(200);
    // The deep-link URL must reference the host's venmo handle
    expect(res.text).toContain("venmo.com/u/hostvenmo");
    // The guest participant has no venmoHandle so this is purely a
    // host-vs-guest guard, but confirm the displayed handle is the host's
    expect(res.text).toContain("Pay @hostvenmo via Venmo");
    // No fallback message when a payment method is present
    expect(res.text).not.toContain("No payment handle on file");

    await db
      .update(userProfilesTable)
      .set({ venmoHandle: null })
      .where(eq(userProfilesTable.id, hostProfileId));
  });

  it("renders Zelle section with host's zelleInfo when set", async () => {
    await db
      .update(userProfilesTable)
      .set({ cashAppHandle: null, venmoHandle: null, zelleInfo: "host@zelle.example" })
      .where(eq(userProfilesTable.id, hostProfileId));

    const res = await request(app).get(`/api/guest-summary/${token}/view`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('<div class="zelle-box"');
    expect(res.text).toContain("Pay via Zelle");
    expect(res.text).toContain("host@zelle.example");
    // No fallback when Zelle info is present
    expect(res.text).not.toContain("No payment handle on file");
    // No Cash App / Venmo buttons (check element attr, not CSS class name)
    expect(res.text).not.toContain('class="btn btn-cashapp"');
    expect(res.text).not.toContain('class="btn btn-venmo"');

    await db
      .update(userProfilesTable)
      .set({ zelleInfo: null })
      .where(eq(userProfilesTable.id, hostProfileId));
  });

  it("returns 404 HTML when the event has been deleted after the token was issued", async () => {
    // Create a separate short-lived event whose deletion we can test
    const [tempProfile] = await db
      .insert(userProfilesTable)
      .values({
        clerkUserId: "temp_clerk_deleted_event",
        email: `temp_del_${Date.now()}@test.invalid`,
        handle: `temp_del_${Date.now()}`,
      })
      .returning();

    const [tempEvent] = await db
      .insert(eventsTable)
      .values({ ownerUserId: tempProfile.id, title: "Temp Dinner" })
      .returning();

    const [tempHostPart] = await db
      .insert(eventParticipantsTable)
      .values({ eventId: tempEvent.id, userId: tempProfile.id, role: "host" })
      .returning();

    const [tempGuest] = await db
      .insert(eventParticipantsTable)
      .values({ eventId: tempEvent.id, userId: null, guestName: "Temp Guest", role: "guest" })
      .returning();

    // Insert a payment record with a token directly (simulates token already issued)
    const deletedToken = "deleted-event-token-" + Date.now();
    const [tempPayment] = await db
      .insert(guestPaymentRequestsTable)
      .values({
        eventParticipantId: tempGuest.id,
        amountCents: 500,
        summaryToken: deletedToken,
      })
      .returning();

    // Delete the event (cascades to participants and payment records via FK)
    await db.delete(eventsTable).where(eq(eventsTable.id, tempEvent.id));

    // Also clean up the profile
    await db.delete(userProfilesTable).where(eq(userProfilesTable.id, tempProfile.id));

    // The token references a now-deleted participant → should 404
    const res = await request(app).get(`/api/guest-summary/${deletedToken}/view`);

    expect(res.status).toBe(404);
  });
});

// ── Unit tests: buildGuestItemizedLines & selectHostPaymentMethod ─────────────

describe("buildGuestItemizedLines", () => {
  const items = [
    { id: 1, name: "Burger", price: "10.00", quantity: 1 },
    { id: 2, name: "Fries", price: "5.01", quantity: 1 },
  ];
  const assignments = [
    { receiptItemId: 1, guestParticipantId: 11, userId: null, claimed: true },
    { receiptItemId: 2, guestParticipantId: 11, userId: null, claimed: true },
    { receiptItemId: 2, guestParticipantId: 12, userId: null, claimed: true },
  ];

  const sum = (lines: Array<{ priceCents: number }>) =>
    lines.reduce((s, l) => s + l.priceCents, 0);

  it("splits shared items with the remainder to the first claimant and reconciles exactly", () => {
    // Guest 11: Burger $10.00 + Fries first-claimant share $2.51 = $12.51
    const lines = buildGuestItemizedLines(11, items, assignments, 1251);
    expect(lines).toEqual([
      { name: "Burger", priceCents: 1000 },
      { name: "Fries", priceCents: 251 },
    ]);
    expect(sum(lines)).toBe(1251);

    // Guest 12: Fries second-claimant share $2.50
    const lines12 = buildGuestItemizedLines(12, items, assignments, 250);
    expect(lines12).toEqual([{ name: "Fries", priceCents: 250 }]);
    expect(sum(lines12)).toBe(250);
  });

  it("adds a 'Tax, tip & fees' line when owed exceeds item shares (tax/tip/service fees/total scaling)", () => {
    const lines = buildGuestItemizedLines(11, items, assignments, 1500);
    expect(lines[lines.length - 1]).toEqual({ name: "Tax, tip & fees", priceCents: 249 });
    expect(sum(lines)).toBe(1500);
  });

  it("adds a negative 'Discounts & adjustments' line when owed is below item shares", () => {
    const lines = buildGuestItemizedLines(11, items, assignments, 1100);
    expect(lines[lines.length - 1]).toEqual({ name: "Discounts & adjustments", priceCents: -151 });
    expect(sum(lines)).toBe(1100);
  });

  it("returns no lines when the guest claimed nothing", () => {
    expect(buildGuestItemizedLines(99, items, assignments, 500)).toEqual([]);
  });
});

describe("selectHostPaymentMethod", () => {
  it("returns the host's preferred method when configured", () => {
    expect(
      selectHostPaymentMethod({
        cashAppHandle: "c", venmoHandle: "v", zelleInfo: "z", preferredMethod: "zelle",
      }),
    ).toBe("zelle");
  });

  it("falls back Venmo → Cash App → Zelle when preference is unusable", () => {
    expect(
      selectHostPaymentMethod({ cashAppHandle: "c", venmoHandle: "v", zelleInfo: "z", preferredMethod: null }),
    ).toBe("venmo");
    expect(
      selectHostPaymentMethod({ cashAppHandle: "c", venmoHandle: null, zelleInfo: "z", preferredMethod: "venmo" }),
    ).toBe("cash_app");
    expect(
      selectHostPaymentMethod({ cashAppHandle: null, venmoHandle: null, zelleInfo: "z", preferredMethod: null }),
    ).toBe("zelle");
  });

  it("returns null when the host has no methods", () => {
    expect(
      selectHostPaymentMethod({ cashAppHandle: null, venmoHandle: null, zelleInfo: null, preferredMethod: null }),
    ).toBeNull();
  });
});
