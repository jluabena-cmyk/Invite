/**
 * Integration tests for sendInviteReminders.
 *
 * Covers:
 *  1. Happy path — sends push and stamps reminderSentAt for eligible users.
 *  2. Already-reminded guard — skips rows where reminderSentAt is already set.
 *  3. Already-responded guard — skips users whose role is no longer "invited".
 *  4. No-push-token edge case — stamps reminderSentAt even when there are no tokens.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  db,
  userProfilesTable,
  eventsTable,
  eventParticipantsTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

// ── sendExpoPush mock ──────────────────────────────────────────────────────────
// Intercept push helpers so tests never reach Expo's API.

const mockGetTokensForUsers = vi.fn<(ids: number[]) => Promise<string[]>>();
const mockSendExpoPush = vi
  .fn<(tokens: string[], title: string, body: string, data?: Record<string, unknown>) => Promise<void>>()
  .mockResolvedValue(undefined);

vi.mock("./sendExpoPush", () => ({
  getTokensForUsers: (...args: Parameters<typeof mockGetTokensForUsers>) =>
    mockGetTokensForUsers(...args),
  sendExpoPush: (...args: Parameters<typeof mockSendExpoPush>) =>
    mockSendExpoPush(...args),
  getUnmutedTokensForEvent: vi.fn().mockResolvedValue([]),
}));

// Import the function under test AFTER the mock is set up so it picks up the
// vi.mock replacement.
const { sendInviteReminders } = await import("./inviteReminder");

// ── Helpers ────────────────────────────────────────────────────────────────────

/** A joinedAt timestamp that is comfortably older than the 24-hour cutoff. */
function olderThan24h(): Date {
  return new Date(Date.now() - 25 * 60 * 60 * 1000);
}

/** A joinedAt timestamp that is within the last 24 hours (too recent). */
function lessThan24h(): Date {
  return new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
}

// ── Seed / cleanup state ───────────────────────────────────────────────────────

let hostProfileId: number;
let eventId: number;

const cleanupIds = {
  participantIds: [] as number[],
  eventIds: [] as number[],
  profileIds: [] as number[],
};

async function seedBase() {
  const ts = Date.now();

  const [host] = await db
    .insert(userProfilesTable)
    .values({
      clerkUserId: `reminder_host_${ts}`,
      email: `reminder_host_${ts}@test.invalid`,
      handle: `reminder_host_${ts}`,
    })
    .returning();
  hostProfileId = host.id;
  cleanupIds.profileIds.push(host.id);

  const [event] = await db
    .insert(eventsTable)
    .values({ ownerUserId: host.id, title: "Reminder Test Event" })
    .returning();
  eventId = event.id;
  cleanupIds.eventIds.push(event.id);

  // Host participant row (not targeted by the reminder job).
  const [hostPart] = await db
    .insert(eventParticipantsTable)
    .values({ eventId: event.id, userId: host.id, role: "host" })
    .returning();
  cleanupIds.participantIds.push(hostPart.id);
}

/** Insert a fresh guest user plus their participant row; returns both IDs. */
async function insertGuest(opts: {
  role?: string;
  joinedAt?: Date;
  reminderSentAt?: Date | null;
}): Promise<{ userId: number; participantId: number }> {
  const ts = Date.now() + Math.random();

  const [profile] = await db
    .insert(userProfilesTable)
    .values({
      clerkUserId: `reminder_guest_${ts}`,
      email: `reminder_guest_${ts}@test.invalid`,
      handle: `reminder_guest_${ts}`,
    })
    .returning();
  cleanupIds.profileIds.push(profile.id);

  const [part] = await db
    .insert(eventParticipantsTable)
    .values({
      eventId,
      userId: profile.id,
      role: opts.role ?? "invited",
      joinedAt: opts.joinedAt ?? olderThan24h(),
      reminderSentAt: opts.reminderSentAt ?? null,
    })
    .returning();
  cleanupIds.participantIds.push(part.id);

  return { userId: profile.id, participantId: part.id };
}

async function cleanupAll() {
  // Delete participants first (cascade from events handles them, but be explicit).
  if (cleanupIds.participantIds.length) {
    await db
      .delete(eventParticipantsTable)
      .where(inArray(eventParticipantsTable.id, cleanupIds.participantIds));
    cleanupIds.participantIds = [];
  }
  if (cleanupIds.eventIds.length) {
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
}

/** Fetch the current reminderSentAt for a participant row. */
async function getReminderSentAt(participantId: number): Promise<Date | null> {
  const [row] = await db
    .select({ reminderSentAt: eventParticipantsTable.reminderSentAt })
    .from(eventParticipantsTable)
    .where(eq(eventParticipantsTable.id, participantId));
  return row?.reminderSentAt ?? null;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("sendInviteReminders", () => {
  beforeAll(async () => {
    await seedBase();
  });

  afterAll(async () => {
    await cleanupAll();
  });

  beforeEach(() => {
    mockGetTokensForUsers.mockReset();
    mockSendExpoPush.mockReset().mockResolvedValue(undefined);
  });

  // ── 1. Happy path ────────────────────────────────────────────────────────────

  it("sends a push to an eligible invited user and stamps reminderSentAt", async () => {
    const FAKE_TOKEN = "ExponentPushToken[reminder-happy-path-001]";
    const { userId, participantId } = await insertGuest({
      role: "invited",
      joinedAt: olderThan24h(),
      reminderSentAt: null,
    });

    mockGetTokensForUsers.mockResolvedValueOnce([FAKE_TOKEN]);

    await sendInviteReminders();

    // getTokensForUsers must have been called with this user's ID.
    const calls = mockGetTokensForUsers.mock.calls.filter((c) =>
      c[0].includes(userId),
    );
    expect(calls.length).toBeGreaterThanOrEqual(1);

    // sendExpoPush must have fired with the fake token.
    const pushCalls = mockSendExpoPush.mock.calls.filter(([tokens]) =>
      (tokens as string[]).includes(FAKE_TOKEN),
    );
    expect(pushCalls.length).toBe(1);
    const [, title, body] = pushCalls[0];
    expect(title).toBe("Don't forget — you're invited! 🎉");
    expect(body).toContain("Reminder Test Event");

    // reminderSentAt must have been stamped.
    const stampedAt = await getReminderSentAt(participantId);
    expect(stampedAt).not.toBeNull();
  });

  // ── 2. Already-reminded guard ────────────────────────────────────────────────

  it("skips a user whose reminderSentAt is already set", async () => {
    const alreadyRemindedAt = new Date(Date.now() - 60_000); // 1 min ago
    const { userId, participantId } = await insertGuest({
      role: "invited",
      joinedAt: olderThan24h(),
      reminderSentAt: alreadyRemindedAt,
    });

    await sendInviteReminders();

    // getTokensForUsers must NOT have been called for this user.
    const calls = mockGetTokensForUsers.mock.calls.filter((c) =>
      c[0].includes(userId),
    );
    expect(calls).toHaveLength(0);

    // sendExpoPush must NOT have been called for this user.
    expect(mockSendExpoPush).not.toHaveBeenCalled();

    // reminderSentAt should remain the original value (not overwritten).
    const stampedAt = await getReminderSentAt(participantId);
    expect(stampedAt?.getTime()).toBeCloseTo(alreadyRemindedAt.getTime(), -3);
  });

  // ── 3. Already-responded guard ───────────────────────────────────────────────

  it("does not remind a user who has since accepted (role changed)", async () => {
    const { userId } = await insertGuest({
      role: "accepted",
      joinedAt: olderThan24h(),
      reminderSentAt: null,
    });

    await sendInviteReminders();

    const calls = mockGetTokensForUsers.mock.calls.filter((c) =>
      c[0].includes(userId),
    );
    expect(calls).toHaveLength(0);
    expect(mockSendExpoPush).not.toHaveBeenCalled();
  });

  it("does not remind a user who has since declined (role changed)", async () => {
    const { userId } = await insertGuest({
      role: "declined",
      joinedAt: olderThan24h(),
      reminderSentAt: null,
    });

    await sendInviteReminders();

    const calls = mockGetTokensForUsers.mock.calls.filter((c) =>
      c[0].includes(userId),
    );
    expect(calls).toHaveLength(0);
    expect(mockSendExpoPush).not.toHaveBeenCalled();
  });

  // ── 4. No push token edge case ───────────────────────────────────────────────

  it("stamps reminderSentAt even when the user has no push tokens", async () => {
    const { userId, participantId } = await insertGuest({
      role: "invited",
      joinedAt: olderThan24h(),
      reminderSentAt: null,
    });

    // Return an empty token list — user hasn't granted push permissions.
    mockGetTokensForUsers.mockResolvedValueOnce([]);

    await sendInviteReminders();

    // getTokensForUsers must still have been called for this user.
    const calls = mockGetTokensForUsers.mock.calls.filter((c) =>
      c[0].includes(userId),
    );
    expect(calls.length).toBeGreaterThanOrEqual(1);

    // sendExpoPush must NOT have been called (no tokens to send to).
    expect(mockSendExpoPush).not.toHaveBeenCalled();

    // But reminderSentAt must still be stamped so we don't retry forever.
    const stampedAt = await getReminderSentAt(participantId);
    expect(stampedAt).not.toBeNull();
  });

  // ── 5. Too-recent invitation — within 24-hour window ────────────────────────

  it("does not remind a user whose invitation is less than 24 hours old", async () => {
    const { userId } = await insertGuest({
      role: "invited",
      joinedAt: lessThan24h(),
      reminderSentAt: null,
    });

    await sendInviteReminders();

    const calls = mockGetTokensForUsers.mock.calls.filter((c) =>
      c[0].includes(userId),
    );
    expect(calls).toHaveLength(0);
    expect(mockSendExpoPush).not.toHaveBeenCalled();
  });
});
