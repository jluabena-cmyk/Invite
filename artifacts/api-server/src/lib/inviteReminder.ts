/**
 * Scheduled job: send one follow-up push to invited guests who haven't
 * responded after 24 hours and haven't already been reminded.
 *
 * Runs periodically from index.ts. Uses getTokensForUsers (not
 * getUnmutedTokensForEvent) because invited users are not yet full
 * participants and won't appear in the muted-notifications join.
 */

import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db, eventParticipantsTable, eventsTable } from "@workspace/db";
import { getTokensForUsers, sendExpoPush } from "./sendExpoPush";
import { logger } from "./logger";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function sendInviteReminders(): Promise<void> {
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);

  // Find invited participants whose invitation is older than 24 h and who
  // haven't been reminded yet. Join events so we can include the event title.
  const pending = await db
    .select({
      participantId: eventParticipantsTable.id,
      userId: eventParticipantsTable.userId,
      eventId: eventParticipantsTable.eventId,
      eventTitle: eventsTable.title,
    })
    .from(eventParticipantsTable)
    .innerJoin(eventsTable, eq(eventsTable.id, eventParticipantsTable.eventId))
    .where(
      and(
        eq(eventParticipantsTable.role, "invited"),
        lt(eventParticipantsTable.joinedAt, cutoff),
        isNull(eventParticipantsTable.reminderSentAt),
        // Only remind users with a real account (userId is non-null for app users)
        sql`${eventParticipantsTable.userId} IS NOT NULL`,
      ),
    );

  if (!pending.length) return;

  logger.info({ count: pending.length }, "[invite-reminder] sending reminders");

  for (const row of pending) {
    const userId = row.userId;
    if (userId == null) continue;

    try {
      const tokens = await getTokensForUsers([userId]);
      if (tokens.length) {
        const eventTitle = row.eventTitle ?? "an event";
        await sendExpoPush(
          tokens,
          "Don't forget — you're invited! 🎉",
          `Don't forget — you're invited to ${eventTitle}!`,
          { screen: "event", eventId: row.eventId },
        );
      }

      // Mark as reminded regardless of whether they had a push token, so we
      // don't re-process them on subsequent runs.
      await db
        .update(eventParticipantsTable)
        .set({ reminderSentAt: new Date() })
        .where(eq(eventParticipantsTable.id, row.participantId));
    } catch (err) {
      logger.warn(
        { err, participantId: row.participantId, userId },
        "[invite-reminder] failed to remind participant",
      );
    }
  }
}
