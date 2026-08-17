import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../app";
import {
  db,
  userProfilesTable,
  eventsTable,
  eventParticipantsTable,
  pushTokensTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";

// ── Clerk mock ─────────────────────────────────────────────────────────────────
// The authenticated caller is the guest (the person who RSVPs), not the host.

const GUEST_CLERK_ID = "test_rsvp_guest_001";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: GUEST_CLERK_ID }),
}));

// ── sendExpoPush mock ──────────────────────────────────────────────────────────
// Intercept both helpers so tests never touch Expo's API.

const mockGetUnmutedTokensForEvent = vi.fn<
  (eventId: number, userIds: number[]) => Promise<string[]>
>();
const mockSendExpoPush = vi.fn<
  (tokens: string[], title: string, body: string, data?: Record<string, unknown>) => Promise<void>
>().mockResolvedValue(undefined);

vi.mock("../lib/sendExpoPush", () => ({
  getTokensForUsers: vi.fn().mockResolvedValue([]),
  getUnmutedTokensForEvent: (
    ...args: Parameters<typeof mockGetUnmutedTokensForEvent>
  ) => mockGetUnmutedTokensForEvent(...args),
  sendExpoPush: (...args: Parameters<typeof mockSendExpoPush>) =>
    mockSendExpoPush(...args),
}));

// ── Seed / cleanup state ───────────────────────────────────────────────────────

let hostProfileId: number;
let guestProfileId: number;
let eventId: number;

const cleanupIds = {
  participantIds: [] as number[],
  eventIds: [] as number[],
  profileIds: [] as number[],
  pushTokenIds: [] as number[],
};

const HOST_PUSH_TOKEN = "ExponentPushToken[rsvp-host-token-001]";

async function seedBase() {
  const ts = Date.now();

  // Host profile
  const [host] = await db
    .insert(userProfilesTable)
    .values({
      clerkUserId: `rsvp_host_${ts}`,
      email: `rsvp_host_${ts}@test.invalid`,
      handle: `rsvp_host_${ts}`,
      displayName: "Test Host",
    })
    .returning();
  hostProfileId = host.id;
  cleanupIds.profileIds.push(host.id);

  // Guest profile (this is the authenticated user)
  const [guest] = await db
    .insert(userProfilesTable)
    .values({
      clerkUserId: GUEST_CLERK_ID,
      email: `rsvp_guest_${ts}@test.invalid`,
      handle: `rsvp_guest_${ts}`,
      displayName: "Test Guest",
    })
    .returning();
  guestProfileId = guest.id;
  cleanupIds.profileIds.push(guest.id);

  // Event owned by the host
  const [event] = await db
    .insert(eventsTable)
    .values({ ownerUserId: host.id, title: "RSVP Push Test Event" })
    .returning();
  eventId = event.id;
  cleanupIds.eventIds.push(event.id);

  // Host participant row
  const [hostPart] = await db
    .insert(eventParticipantsTable)
    .values({ eventId: event.id, userId: host.id, role: "host" })
    .returning();
  cleanupIds.participantIds.push(hostPart.id);

  // Guest participant row (invited)
  const [guestPart] = await db
    .insert(eventParticipantsTable)
    .values({ eventId: event.id, userId: guest.id, role: "invited" })
    .returning();
  cleanupIds.participantIds.push(guestPart.id);
}

async function cleanupAll() {
  if (cleanupIds.pushTokenIds.length) {
    await db
      .delete(pushTokensTable)
      .where(inArray(pushTokensTable.id, cleanupIds.pushTokenIds));
    cleanupIds.pushTokenIds = [];
  }
  if (cleanupIds.eventIds.length) {
    // Cascade handles participants.
    await db
      .delete(eventsTable)
      .where(inArray(eventsTable.id, cleanupIds.eventIds));
    cleanupIds.eventIds = [];
    cleanupIds.participantIds = [];
  }
  if (cleanupIds.profileIds.length) {
    await db
      .delete(userProfilesTable)
      .where(inArray(userProfilesTable.id, cleanupIds.profileIds));
    cleanupIds.profileIds = [];
  }
}

/** Drain the micro-task / timer queue so fire-and-forget IIFEs resolve. */
const drain = () => new Promise<void>((resolve) => setTimeout(resolve, 50));

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("PATCH /events/:eventId/invitations/me — RSVP push notifications", () => {
  beforeAll(async () => {
    await seedBase();
  });

  afterAll(async () => {
    await cleanupAll();
  });

  beforeEach(() => {
    mockGetUnmutedTokensForEvent.mockReset();
    mockSendExpoPush.mockReset().mockResolvedValue(undefined);
  });

  it("sends a push to the host's token when the guest accepts", async () => {
    mockGetUnmutedTokensForEvent.mockResolvedValueOnce([HOST_PUSH_TOKEN]);

    const res = await request(app)
      .patch(`/api/events/${eventId}/invitations/me`)
      .send({ action: "accept" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("accepted");

    await drain();

    // getUnmutedTokensForEvent must have been called with the host's userId.
    expect(mockGetUnmutedTokensForEvent).toHaveBeenCalledTimes(1);
    const [calledEventId, calledUserIds] =
      mockGetUnmutedTokensForEvent.mock.calls[0];
    expect(calledEventId).toBe(eventId);
    expect(calledUserIds).toContain(hostProfileId);
    // Must NOT have included the guest.
    expect(calledUserIds).not.toContain(guestProfileId);

    // sendExpoPush must have fired with the host's token.
    expect(mockSendExpoPush).toHaveBeenCalledTimes(1);
    const [tokens, title] = mockSendExpoPush.mock.calls[0];
    expect(tokens).toContain(HOST_PUSH_TOKEN);
    expect(title).toBe("New RSVP");
  });

  it("sends a push to the host's token when the guest declines", async () => {
    // Reset the guest's participant role back to invited so decline is valid.
    const { and, eq } = await import("drizzle-orm");
    await db
      .update(eventParticipantsTable)
      .set({ role: "invited" })
      .where(
        and(
          eq(eventParticipantsTable.eventId, eventId),
          eq(eventParticipantsTable.userId, guestProfileId),
        ),
      );

    mockGetUnmutedTokensForEvent.mockResolvedValueOnce([HOST_PUSH_TOKEN]);

    const res = await request(app)
      .patch(`/api/events/${eventId}/invitations/me`)
      .send({ action: "decline" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("declined");

    await drain();

    expect(mockGetUnmutedTokensForEvent).toHaveBeenCalledTimes(1);
    const [calledEventId, calledUserIds] =
      mockGetUnmutedTokensForEvent.mock.calls[0];
    expect(calledEventId).toBe(eventId);
    expect(calledUserIds).toContain(hostProfileId);
    expect(calledUserIds).not.toContain(guestProfileId);

    expect(mockSendExpoPush).toHaveBeenCalledTimes(1);
    const [tokens, title] = mockSendExpoPush.mock.calls[0];
    expect(tokens).toContain(HOST_PUSH_TOKEN);
    expect(title).toBe("RSVP Update");
  });

  it("does not send a push when the host has notifications muted for the event", async () => {
    // Reset the guest back to invited so accept is valid again.
    const { and, eq } = await import("drizzle-orm");
    await db
      .update(eventParticipantsTable)
      .set({ role: "invited" })
      .where(
        and(
          eq(eventParticipantsTable.eventId, eventId),
          eq(eventParticipantsTable.userId, guestProfileId),
        ),
      );

    // Host has muted — getUnmutedTokensForEvent returns an empty list.
    mockGetUnmutedTokensForEvent.mockResolvedValueOnce([]);

    const res = await request(app)
      .patch(`/api/events/${eventId}/invitations/me`)
      .send({ action: "accept" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("accepted");

    await drain();

    // The lookup was still attempted for the host.
    expect(mockGetUnmutedTokensForEvent).toHaveBeenCalledTimes(1);
    const [, calledUserIds] = mockGetUnmutedTokensForEvent.mock.calls[0];
    expect(calledUserIds).toContain(hostProfileId);

    // sendExpoPush may be called but must receive an empty token list —
    // the real implementation early-exits when no valid tokens are present,
    // so no notification reaches the host.
    if (mockSendExpoPush.mock.calls.length > 0) {
      for (const [tokens] of mockSendExpoPush.mock.calls) {
        expect(tokens).not.toContain(HOST_PUSH_TOKEN);
        expect((tokens as string[]).filter((t: string) => t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["))).toHaveLength(0);
      }
    }
  });
});
