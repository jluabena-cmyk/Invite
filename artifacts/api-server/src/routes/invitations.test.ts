import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../app";
import {
  db,
  userProfilesTable,
  eventsTable,
  eventParticipantsTable,
  friendshipsTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";

// ── Clerk mock ────────────────────────────────────────────────────────────────
// The host is the authenticated caller throughout these tests.

const HOST_CLERK_ID = "test_inv_host_001";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: HOST_CLERK_ID }),
}));

// ── sendExpoPush mock ─────────────────────────────────────────────────────────
// We intercept the push-notification helpers so the test never touches Expo
// and so we can assert which userId(s) were passed to getTokensForUsers.

const mockGetTokensForUsers = vi.fn<(ids: number[]) => Promise<string[]>>();
const mockSendExpoPush = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockGetUnmutedTokensForEvent = vi.fn<() => Promise<string[]>>().mockResolvedValue([]);

vi.mock("../lib/sendExpoPush", () => ({
  getTokensForUsers: (...args: Parameters<typeof mockGetTokensForUsers>) =>
    mockGetTokensForUsers(...args),
  sendExpoPush: (...args: Parameters<typeof mockSendExpoPush>) =>
    mockSendExpoPush(...args),
  getUnmutedTokensForEvent: (...args: Parameters<typeof mockGetUnmutedTokensForEvent>) =>
    mockGetUnmutedTokensForEvent(...args),
}));

// ── Seed / cleanup state ───────────────────────────────────────────────────────

let hostProfileId: number;
let inviteeProfileId: number;
let eventId: number;

const cleanupIds = {
  friendshipIds: [] as number[],
  participantIds: [] as number[],
  eventIds: [] as number[],
  profileIds: [] as number[],
};

async function seedBase() {
  const ts = Date.now();

  const [host] = await db
    .insert(userProfilesTable)
    .values({
      clerkUserId: HOST_CLERK_ID,
      email: `inv_host_${ts}@test.invalid`,
      handle: `inv_host_${ts}`,
    })
    .returning();
  hostProfileId = host.id;
  cleanupIds.profileIds.push(host.id);

  const [invitee] = await db
    .insert(userProfilesTable)
    .values({
      clerkUserId: `inv_invitee_${ts}`,
      email: `inv_invitee_${ts}@test.invalid`,
      handle: `inv_invitee_${ts}`,
    })
    .returning();
  inviteeProfileId = invitee.id;
  cleanupIds.profileIds.push(invitee.id);

  const [event] = await db
    .insert(eventsTable)
    .values({ ownerUserId: host.id, title: "Invitation Test Event" })
    .returning();
  eventId = event.id;
  cleanupIds.eventIds.push(event.id);

  const [hostPart] = await db
    .insert(eventParticipantsTable)
    .values({ eventId: event.id, userId: host.id, role: "host" })
    .returning();
  cleanupIds.participantIds.push(hostPart.id);

  // Accepted friendship so the host is allowed to invite the invitee.
  const [friendship] = await db
    .insert(friendshipsTable)
    .values({
      requesterUserId: host.id,
      addresseeUserId: invitee.id,
      status: "accepted",
    })
    .returning();
  cleanupIds.friendshipIds.push(friendship.id);
}

async function cleanupAll() {
  if (cleanupIds.friendshipIds.length) {
    await db
      .delete(friendshipsTable)
      .where(inArray(friendshipsTable.id, cleanupIds.friendshipIds));
    cleanupIds.friendshipIds = [];
  }
  if (cleanupIds.eventIds.length) {
    // Cascades handle participants when events are deleted.
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /events/:eventId/invitations — push notification targeting", () => {
  beforeAll(async () => {
    await seedBase();
  });

  afterAll(async () => {
    await cleanupAll();
  });

  it("calls getTokensForUsers with the invited user's ID, not the host's", async () => {
    // Return a fake token so sendExpoPush is also triggered.
    mockGetTokensForUsers.mockResolvedValueOnce(["ExponentPushToken[fake-token-invitee]"]);
    mockGetTokensForUsers.mockResolvedValue([]);

    const res = await request(app)
      .post(`/api/events/${eventId}/invitations`)
      .send({ userId: inviteeProfileId });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(inviteeProfileId);

    // The fire-and-forget async block runs in the same micro-task queue.
    // Drain the event loop so the void IIFE has a chance to resolve.
    await new Promise((resolve) => setTimeout(resolve, 50));

    // getTokensForUsers must have been called exactly once, with [inviteeProfileId].
    expect(mockGetTokensForUsers).toHaveBeenCalledTimes(1);
    const [calledWith] = mockGetTokensForUsers.mock.calls[0];
    expect(calledWith).toEqual([inviteeProfileId]);

    // Crucially, it must NOT have been called with the host's ID.
    expect(calledWith).not.toContain(hostProfileId);

    // sendExpoPush should have fired because a token was returned.
    expect(mockSendExpoPush).toHaveBeenCalledTimes(1);
  });

  it("skips the push notification cleanly when the invited user has no tokens", async () => {
    // First create a second invitee to have a fresh user to invite.
    const ts = Date.now();
    const [secondInvitee] = await db
      .insert(userProfilesTable)
      .values({
        clerkUserId: `inv_invitee2_${ts}`,
        email: `inv_invitee2_${ts}@test.invalid`,
        handle: `inv_invitee2_${ts}`,
      })
      .returning();
    cleanupIds.profileIds.push(secondInvitee.id);

    // Friendship so the host can invite them.
    const [friendship] = await db
      .insert(friendshipsTable)
      .values({
        requesterUserId: hostProfileId,
        addresseeUserId: secondInvitee.id,
        status: "accepted",
      })
      .returning();
    cleanupIds.friendshipIds.push(friendship.id);

    // No push tokens for this user.
    mockGetTokensForUsers.mockResolvedValueOnce([]);
    mockSendExpoPush.mockClear();

    const res = await request(app)
      .post(`/api/events/${eventId}/invitations`)
      .send({ userId: secondInvitee.id });

    expect(res.status).toBe(201);

    // Drain the event loop.
    await new Promise((resolve) => setTimeout(resolve, 50));

    // getTokensForUsers was still called with the invitee's ID (not the host's).
    const lastCall = mockGetTokensForUsers.mock.calls.at(-1)!;
    expect(lastCall[0]).toEqual([secondInvitee.id]);
    expect(lastCall[0]).not.toContain(hostProfileId);

    // sendExpoPush must NOT have been called — no tokens means no notification.
    expect(mockSendExpoPush).not.toHaveBeenCalled();
  });
});
