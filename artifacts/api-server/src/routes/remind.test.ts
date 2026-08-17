import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../app";
import {
  db,
  userProfilesTable,
  eventsTable,
  eventParticipantsTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

// ── Clerk mock ─────────────────────────────────────────────────────────────────
// The authenticated caller is the host throughout these tests.

const HOST_CLERK_ID = "test_remind_host_001";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: HOST_CLERK_ID }),
}));

// ── sendExpoPush mock ──────────────────────────────────────────────────────────

const mockGetTokensForUsers = vi.fn<(ids: number[]) => Promise<string[]>>();
const mockSendExpoPush = vi
  .fn<(tokens: string[], title: string, body: string, data?: Record<string, unknown>) => Promise<void>>()
  .mockResolvedValue(undefined);

vi.mock("../lib/sendExpoPush", () => ({
  getTokensForUsers: (...args: Parameters<typeof mockGetTokensForUsers>) =>
    mockGetTokensForUsers(...args),
  sendExpoPush: (...args: Parameters<typeof mockSendExpoPush>) =>
    mockSendExpoPush(...args),
  getUnmutedTokensForEvent: vi.fn().mockResolvedValue([]),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Drain the micro-task / timer queue so fire-and-forget IIFEs resolve. */
const drain = () => new Promise<void>((resolve) => setTimeout(resolve, 60));

// ── Shared seed/cleanup (one lifecycle for all describe blocks) ────────────────

let hostProfileId: number;
let inviteeProfileId: number;
let eventId: number;
let guestParticipantId: number; // app-less guest

const cleanupIds = {
  eventIds: [] as number[],
  profileIds: [] as number[],
};

beforeAll(async () => {
  const ts = Date.now();

  const [host] = await db
    .insert(userProfilesTable)
    .values({
      clerkUserId: HOST_CLERK_ID,
      email: `remind_host_${ts}@test.invalid`,
      handle: `remind_host_${ts}`,
      displayName: "Remind Host",
    })
    .returning();
  hostProfileId = host.id;
  cleanupIds.profileIds.push(host.id);

  const [invitee] = await db
    .insert(userProfilesTable)
    .values({
      clerkUserId: `remind_invitee_${ts}`,
      email: `remind_invitee_${ts}@test.invalid`,
      handle: `remind_invitee_${ts}`,
    })
    .returning();
  inviteeProfileId = invitee.id;
  cleanupIds.profileIds.push(invitee.id);

  const [event] = await db
    .insert(eventsTable)
    .values({ ownerUserId: host.id, title: "Remind Test Event" })
    .returning();
  eventId = event.id;
  cleanupIds.eventIds.push(event.id);

  // Host participant row
  await db.insert(eventParticipantsTable).values({
    eventId: event.id,
    userId: host.id,
    role: "host",
  });

  // Invited user participant row
  await db.insert(eventParticipantsTable).values({
    eventId: event.id,
    userId: invitee.id,
    role: "invited",
  });

  // App-less guest row (role 'guest' is what POST /events/:eventId/guests creates)
  const [guest] = await db
    .insert(eventParticipantsTable)
    .values({
      eventId: event.id,
      userId: null,
      guestName: "Remind Guest",
      role: "guest",
    })
    .returning();
  guestParticipantId = guest.id;
});

afterAll(async () => {
  if (cleanupIds.eventIds.length) {
    // Cascade removes all participant rows.
    await db
      .delete(eventsTable)
      .where(inArray(eventsTable.id, cleanupIds.eventIds));
    cleanupIds.eventIds = [];
  }
  if (cleanupIds.profileIds.length) {
    await db
      .delete(userProfilesTable)
      .where(inArray(userProfilesTable.id, cleanupIds.profileIds));
    cleanupIds.profileIds = [];
  }
});

// ── Tests: user participant remind ─────────────────────────────────────────────

describe("POST /events/:eventId/participants/:targetUserId/remind", () => {
  beforeEach(async () => {
    mockGetTokensForUsers.mockReset().mockResolvedValue([]);
    mockSendExpoPush.mockReset().mockResolvedValue(undefined);
    // Reset the invitee's row to invited with no reminderSentAt.
    await db
      .update(eventParticipantsTable)
      .set({ role: "invited", reminderSentAt: null })
      .where(
        and(
          eq(eventParticipantsTable.eventId, eventId),
          eq(eventParticipantsTable.userId, inviteeProfileId),
        ),
      );
  });

  it("returns 200 and stamps reminderSentAt when the guest has a push token", async () => {
    const FAKE_TOKEN = "ExponentPushToken[remind-test-token-001]";
    mockGetTokensForUsers.mockResolvedValueOnce([FAKE_TOKEN]);

    const res = await request(app).post(
      `/api/events/${eventId}/participants/${inviteeProfileId}/remind`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("reminderSentAt");
    expect(typeof res.body.reminderSentAt).toBe("string");

    await drain();

    // Push was dispatched to the invitee (not the host).
    expect(mockGetTokensForUsers).toHaveBeenCalledTimes(1);
    expect(mockGetTokensForUsers.mock.calls[0][0]).toEqual([inviteeProfileId]);
    expect(mockSendExpoPush).toHaveBeenCalledTimes(1);
    const [tokens, title] = mockSendExpoPush.mock.calls[0];
    expect(tokens).toContain(FAKE_TOKEN);
    expect(title).toMatch(/invited/i);
  });

  it("returns 200 and skips sendExpoPush when the invitee has no push tokens", async () => {
    mockGetTokensForUsers.mockResolvedValueOnce([]);

    const res = await request(app).post(
      `/api/events/${eventId}/participants/${inviteeProfileId}/remind`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("reminderSentAt");

    await drain();

    expect(mockGetTokensForUsers).toHaveBeenCalledTimes(1);
    expect(mockSendExpoPush).not.toHaveBeenCalled();
  });

  it("returns 429 when called again within 24 h (atomic cooldown respected)", async () => {
    mockGetTokensForUsers.mockResolvedValue([]);

    // First call succeeds.
    const first = await request(app).post(
      `/api/events/${eventId}/participants/${inviteeProfileId}/remind`,
    );
    expect(first.status).toBe(200);

    // Second call within the cooldown window must be rejected.
    const second = await request(app).post(
      `/api/events/${eventId}/participants/${inviteeProfileId}/remind`,
    );
    expect(second.status).toBe(429);
    expect(second.body.error).toMatch(/24 hours/i);
    expect(typeof second.body.retryAfterMs).toBe("number");
    expect(second.body.retryAfterMs).toBeGreaterThan(0);
  });

  it("returns 409 when the target participant has already responded", async () => {
    await db
      .update(eventParticipantsTable)
      .set({ role: "accepted" })
      .where(
        and(
          eq(eventParticipantsTable.eventId, eventId),
          eq(eventParticipantsTable.userId, inviteeProfileId),
        ),
      );

    const res = await request(app).post(
      `/api/events/${eventId}/participants/${inviteeProfileId}/remind`,
    );

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/haven't responded/i);
  });

  it("returns 404 for a userId that is not in the event", async () => {
    const res = await request(app).post(
      `/api/events/${eventId}/participants/999999/remind`,
    );

    expect(res.status).toBe(404);
  });

  it("returns 200 even when getTokensForUsers rejects (no unhandled rejection)", async () => {
    mockGetTokensForUsers.mockRejectedValueOnce(new Error("DB connection lost"));

    const res = await request(app).post(
      `/api/events/${eventId}/participants/${inviteeProfileId}/remind`,
    );

    // The HTTP response must succeed — the push is fire-and-forget.
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("reminderSentAt");

    // Drain so the rejected promise settles; no uncaughtException should fire.
    await drain();

    // sendExpoPush must not have been called (the rejection aborted the IIFE).
    expect(mockSendExpoPush).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller is not the host of the event", async () => {
    // The mock always returns HOST_CLERK_ID; test the non-host case by requesting
    // against an event where that profile has no host row.
    const [otherEvent] = await db
      .insert(eventsTable)
      .values({ ownerUserId: hostProfileId, title: "Other Event" })
      .returning();
    // Note: HOST_CLERK_ID profile has NO participant row in otherEvent.
    try {
      const res = await request(app).post(
        `/api/events/${otherEvent.id}/participants/${inviteeProfileId}/remind`,
      );
      expect(res.status).toBe(403);
    } finally {
      await db.delete(eventsTable).where(eq(eventsTable.id, otherEvent.id));
    }
  });
});

// ── Tests: app-less guest remind ───────────────────────────────────────────────

describe("POST /events/:eventId/guests/:guestParticipantId/remind", () => {
  beforeEach(async () => {
    mockGetTokensForUsers.mockReset().mockResolvedValue([]);
    mockSendExpoPush.mockReset().mockResolvedValue(undefined);
    // Reset the guest row (role: "guest" is the role all app-less guests get).
    await db
      .update(eventParticipantsTable)
      .set({ role: "guest", reminderSentAt: null })
      .where(eq(eventParticipantsTable.id, guestParticipantId));
  });

  it("returns 200 and stamps reminderSentAt (no push for app-less guests)", async () => {
    const res = await request(app).post(
      `/api/events/${eventId}/guests/${guestParticipantId}/remind`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("reminderSentAt");
    expect(typeof res.body.reminderSentAt).toBe("string");

    await drain();

    // App-less guests have no push tokens — sendExpoPush must never fire.
    expect(mockSendExpoPush).not.toHaveBeenCalled();
  });

  it("returns 429 when called again within 24 h (atomic cooldown respected)", async () => {
    const first = await request(app).post(
      `/api/events/${eventId}/guests/${guestParticipantId}/remind`,
    );
    expect(first.status).toBe(200);

    const second = await request(app).post(
      `/api/events/${eventId}/guests/${guestParticipantId}/remind`,
    );
    expect(second.status).toBe(429);
    expect(second.body.error).toMatch(/24 hours/i);
    expect(second.body.retryAfterMs).toBeGreaterThan(0);
  });

  it("returns 409 when the guest row has a non-guest role", async () => {
    // Manually set a role other than 'guest' to simulate an unexpected state.
    await db
      .update(eventParticipantsTable)
      .set({ role: "host" })
      .where(eq(eventParticipantsTable.id, guestParticipantId));

    const res = await request(app).post(
      `/api/events/${eventId}/guests/${guestParticipantId}/remind`,
    );

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/app-less guests/i);
  });

  it("returns 404 for a guestParticipantId that doesn't exist", async () => {
    const res = await request(app).post(
      `/api/events/${eventId}/guests/999999/remind`,
    );

    expect(res.status).toBe(404);
  });
});
