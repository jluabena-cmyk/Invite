import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import {
  db,
  userProfilesTable,
  eventsTable,
  eventParticipantsTable,
  eventMessagesTable,
} from "@workspace/db";
import { inArray, eq } from "drizzle-orm";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// vi.mock is hoisted; use vi.hoisted so the mock fns are available in the factory.
const { mockSendExpoPush, mockGetUnmutedTokensForEvent } = vi.hoisted(() => ({
  mockSendExpoPush: vi.fn().mockResolvedValue(undefined),
  mockGetUnmutedTokensForEvent: vi.fn().mockResolvedValue([]),
}));

vi.mock("../lib/sendExpoPush", () => ({
  sendExpoPush: mockSendExpoPush,
  getUnmutedTokensForEvent: mockGetUnmutedTokensForEvent,
  getTokensForUsers: vi.fn().mockResolvedValue([]),
}));

// Mutable variable read by the getAuth closure at request time.
let currentClerkUserId = "test_chat_host_001";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: currentClerkUserId }),
}));

// ── Constants ─────────────────────────────────────────────────────────────────

const HOST_CLERK_ID = "test_chat_host_001";
const PARTICIPANT_CLERK_ID = "test_chat_participant_002";

// ── Seed data ─────────────────────────────────────────────────────────────────

let hostProfileId: number;
let participantProfileId: number;
let eventId: number;

const cleanup = {
  messageIds: [] as number[],
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
      email: `chat_host_${ts}@test.invalid`,
      handle: `chathost_${ts}`,
    })
    .onConflictDoUpdate({
      target: userProfilesTable.clerkUserId,
      set: { email: `chat_host_${ts}@test.invalid`, handle: `chathost_${ts}` },
    })
    .returning();
  hostProfileId = host.id;
  cleanup.profileIds.push(host.id);

  const [participant] = await db
    .insert(userProfilesTable)
    .values({
      clerkUserId: PARTICIPANT_CLERK_ID,
      email: `chat_participant_${ts}@test.invalid`,
      handle: `chatpart_${ts}`,
    })
    .onConflictDoUpdate({
      target: userProfilesTable.clerkUserId,
      set: { email: `chat_participant_${ts}@test.invalid`, handle: `chatpart_${ts}` },
    })
    .returning();
  participantProfileId = participant.id;
  cleanup.profileIds.push(participant.id);

  const [event] = await db
    .insert(eventsTable)
    .values({ ownerUserId: host.id, title: "Chat Test Event" })
    .returning();
  eventId = event.id;
  cleanup.eventIds.push(event.id);

  const [hostPart] = await db
    .insert(eventParticipantsTable)
    .values({ eventId: event.id, userId: host.id, role: "host" })
    .returning();
  cleanup.participantIds.push(hostPart.id);

  const [partPart] = await db
    .insert(eventParticipantsTable)
    .values({ eventId: event.id, userId: participant.id, role: "accepted" })
    .returning();
  cleanup.participantIds.push(partPart.id);
}

async function cleanupAll() {
  if (cleanup.messageIds.length) {
    await db
      .delete(eventMessagesTable)
      .where(inArray(eventMessagesTable.id, cleanup.messageIds));
    cleanup.messageIds = [];
  }
  // cascade handles messages + participants when events are deleted
  if (cleanup.eventIds.length) {
    await db
      .delete(eventsTable)
      .where(inArray(eventsTable.id, cleanup.eventIds));
    cleanup.eventIds = [];
  }
  if (cleanup.profileIds.length) {
    await db
      .delete(userProfilesTable)
      .where(inArray(userProfilesTable.id, cleanup.profileIds));
    cleanup.profileIds = [];
  }
  cleanup.participantIds = [];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Chat: unread badges, mark-as-read, and push notifications", () => {
  beforeAll(async () => {
    await seedBase();
  });

  afterAll(async () => {
    await cleanupAll();
  });

  beforeEach(() => {
    currentClerkUserId = HOST_CLERK_ID;
    mockSendExpoPush.mockClear();
    mockGetUnmutedTokensForEvent.mockClear().mockResolvedValue([]);
  });

  // ── GET /api/events: unreadChatCount ────────────────────────────────────────

  describe("GET /api/events — unreadChatCount field", () => {
    it("returns 0 when there are no messages", async () => {
      const res = await request(app).get("/api/events");
      expect(res.status).toBe(200);
      type EventItem = { id: number; unreadChatCount?: number };
      const event = (res.body as EventItem[]).find((e) => e.id === eventId);
      expect(event).toBeDefined();
      expect(Number(event!.unreadChatCount)).toBe(0);
    });

    it("counts all messages when chatLastReadAt is null (never read)", async () => {
      const [msg1] = await db
        .insert(eventMessagesTable)
        .values({ eventId, userId: participantProfileId, body: "Hello host!" })
        .returning();
      cleanup.messageIds.push(msg1.id);

      const [msg2] = await db
        .insert(eventMessagesTable)
        .values({ eventId, userId: participantProfileId, body: "Still there?" })
        .returning();
      cleanup.messageIds.push(msg2.id);

      const res = await request(app).get("/api/events");
      expect(res.status).toBe(200);
      type EventItem = { id: number; unreadChatCount?: number };
      const event = (res.body as EventItem[]).find((e) => e.id === eventId);
      expect(Number(event!.unreadChatCount)).toBeGreaterThanOrEqual(2);
    });

    it("returns 0 immediately after mark-as-read with no subsequent messages", async () => {
      // Mark as read now — all existing messages become read
      const readRes = await request(app).post(`/api/events/${eventId}/chat/read`);
      expect(readRes.status).toBe(204);

      const res = await request(app).get("/api/events");
      expect(res.status).toBe(200);
      type EventItem = { id: number; unreadChatCount?: number };
      const event = (res.body as EventItem[]).find((e) => e.id === eventId);
      expect(Number(event!.unreadChatCount)).toBe(0);
    });

    it("counts only messages inserted after the last mark-as-read", async () => {
      // Insert a new message with a timestamp clearly after the mark-read above
      const futureTs = new Date(Date.now() + 2000);
      const [newMsg] = await db
        .insert(eventMessagesTable)
        .values({
          eventId,
          userId: participantProfileId,
          body: "New message after read",
          createdAt: futureTs,
        })
        .returning();
      cleanup.messageIds.push(newMsg.id);

      const res = await request(app).get("/api/events");
      expect(res.status).toBe(200);
      type EventItem = { id: number; unreadChatCount?: number };
      const event = (res.body as EventItem[]).find((e) => e.id === eventId);
      expect(Number(event!.unreadChatCount)).toBe(1);
    });
  });

  // ── POST /api/events/:id/chat/read — authorization ─────────────────────────

  describe("POST /api/events/:id/chat/read — authorization", () => {
    it("returns 401 when userId is absent", async () => {
      currentClerkUserId = "";
      const res = await request(app).post(`/api/events/${eventId}/chat/read`);
      expect(res.status).toBe(401);
    });

    it("returns 403 when the user is not a participant in the event", async () => {
      const ts = Date.now();
      const [outsider] = await db
        .insert(userProfilesTable)
        .values({
          clerkUserId: `outsider_${ts}`,
          email: `outsider_${ts}@test.invalid`,
          handle: `outsider_${ts}`,
        })
        .returning();
      cleanup.profileIds.push(outsider.id);

      currentClerkUserId = `outsider_${ts}`;
      const res = await request(app).post(`/api/events/${eventId}/chat/read`);
      expect(res.status).toBe(403);
    });

    it("returns 204 for the event host", async () => {
      currentClerkUserId = HOST_CLERK_ID;
      const res = await request(app).post(`/api/events/${eventId}/chat/read`);
      expect(res.status).toBe(204);
    });

    it("returns 204 for an accepted participant", async () => {
      currentClerkUserId = PARTICIPANT_CLERK_ID;
      const res = await request(app).post(`/api/events/${eventId}/chat/read`);
      expect(res.status).toBe(204);
    });
  });

  // ── POST /api/events/:id/chat — push notification recipients ───────────────

  describe("POST /api/events/:id/chat — push notification recipients", () => {
    it("excludes the sender from the push recipient list", async () => {
      mockGetUnmutedTokensForEvent.mockResolvedValueOnce(["ExponentPushToken[test001]"]);

      currentClerkUserId = HOST_CLERK_ID;
      const res = await request(app)
        .post(`/api/events/${eventId}/chat`)
        .send({ body: "Hello from host!" });
      expect(res.status).toBe(201);

      expect(mockGetUnmutedTokensForEvent).toHaveBeenCalledOnce();
      const [calledEventId, calledUserIds] = mockGetUnmutedTokensForEvent.mock.calls[0] as [number, number[]];
      expect(calledEventId).toBe(eventId);
      expect(calledUserIds).toContain(participantProfileId);
      expect(calledUserIds).not.toContain(hostProfileId);
    });

    it("calls sendExpoPush with a token list, sender name, and message preview", async () => {
      mockGetUnmutedTokensForEvent.mockResolvedValueOnce(["ExponentPushToken[test002]"]);

      currentClerkUserId = HOST_CLERK_ID;
      await request(app)
        .post(`/api/events/${eventId}/chat`)
        .send({ body: "Dinner at 7pm!" });

      expect(mockSendExpoPush).toHaveBeenCalledOnce();
      const [tokens, title, body] = mockSendExpoPush.mock.calls[0] as [string[], string, string];
      expect(tokens).toContain("ExponentPushToken[test002]");
      expect(typeof title).toBe("string");
      expect(title.length).toBeGreaterThan(0);
      expect(body).toContain("Dinner at 7pm!");
    });

    it("does not call sendExpoPush when no tokens are available", async () => {
      mockGetUnmutedTokensForEvent.mockResolvedValueOnce([]);

      currentClerkUserId = HOST_CLERK_ID;
      await request(app)
        .post(`/api/events/${eventId}/chat`)
        .send({ body: "Silent message" });

      expect(mockSendExpoPush).not.toHaveBeenCalled();
    });

    it("sets chatLastReadAt for the sender synchronously so GET /events immediately shows 0 unread for them", async () => {
      // Use a dedicated clean event to avoid accumulated message state from earlier tests
      const [cleanEvent] = await db
        .insert(eventsTable)
        .values({ ownerUserId: hostProfileId, title: "Clean Sync Test Event" })
        .returning();
      cleanup.eventIds.push(cleanEvent.id);
      // Add participant so the event appears in their GET /events
      await db
        .insert(eventParticipantsTable)
        .values({ eventId: cleanEvent.id, userId: participantProfileId, role: "accepted" })
        .returning();

      // Participant sends a message
      currentClerkUserId = PARTICIPANT_CLERK_ID;
      const sendRes = await request(app)
        .post(`/api/events/${cleanEvent.id}/chat`)
        .send({ body: "I am sending this message" });
      expect(sendRes.status).toBe(201);

      // Sender's own message must not count as unread (chatLastReadAt was advanced on send)
      const eventsRes = await request(app).get("/api/events");
      expect(eventsRes.status).toBe(200);
      type EventItem = { id: number; unreadChatCount?: number };
      const event = (eventsRes.body as EventItem[]).find((e) => e.id === cleanEvent.id);
      expect(Number(event!.unreadChatCount)).toBe(0);
    });

    it("new message after mark-read increments unreadChatCount by exactly 1", async () => {
      // Use a dedicated clean event so earlier tests' accumulated messages don't interfere
      const [cleanEvent] = await db
        .insert(eventsTable)
        .values({ ownerUserId: hostProfileId, title: "Clean Mark-Read Test Event" })
        .returning();
      cleanup.eventIds.push(cleanEvent.id);
      // Host needs a participant row so the event appears in GET /events
      await db
        .insert(eventParticipantsTable)
        .values({ eventId: cleanEvent.id, userId: hostProfileId, role: "host" })
        .returning();

      // Host marks chat as read on the fresh event
      currentClerkUserId = HOST_CLERK_ID;
      const readRes = await request(app).post(`/api/events/${cleanEvent.id}/chat/read`);
      expect(readRes.status).toBe(204);

      // A new message arrives from the participant (future timestamp to be strictly after mark-read)
      const futureTs = new Date(Date.now() + 5000);
      const [newMsg] = await db
        .insert(eventMessagesTable)
        .values({
          eventId: cleanEvent.id,
          userId: participantProfileId,
          body: "New message after host marked as read",
          createdAt: futureTs,
        })
        .returning();
      cleanup.messageIds.push(newMsg.id);

      // Host should now see exactly 1 unread
      const eventsRes = await request(app).get("/api/events");
      expect(eventsRes.status).toBe(200);
      type EventItem = { id: number; unreadChatCount?: number };
      const event = (eventsRes.body as EventItem[]).find((e) => e.id === cleanEvent.id);
      expect(Number(event!.unreadChatCount)).toBe(1);
    });

    it("does not call sendExpoPush when the sender is the only participant", async () => {
      // Create a solo event (only the host, no other participants)
      const ts = Date.now();
      const [soloEvent] = await db
        .insert(eventsTable)
        .values({ ownerUserId: hostProfileId, title: "Solo Event" })
        .returning();
      cleanup.eventIds.push(soloEvent.id);

      const [soloHostPart] = await db
        .insert(eventParticipantsTable)
        .values({ eventId: soloEvent.id, userId: hostProfileId, role: "host" })
        .returning();
      cleanup.participantIds.push(soloHostPart.id);

      currentClerkUserId = HOST_CLERK_ID;
      const res = await request(app)
        .post(`/api/events/${soloEvent.id}/chat`)
        .send({ body: "Talking to myself" });
      expect(res.status).toBe(201);

      expect(mockSendExpoPush).not.toHaveBeenCalled();
      expect(mockGetUnmutedTokensForEvent).not.toHaveBeenCalled();
    });
  });
});
