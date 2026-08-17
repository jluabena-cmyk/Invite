import { and, eq, inArray } from "drizzle-orm";
import { db, pushTokensTable, eventParticipantsTable } from "@workspace/db";

export async function getTokensForUsers(userIds: number[]): Promise<string[]> {
  if (!userIds.length) return [];
  const rows = await db
    .select({ token: pushTokensTable.token })
    .from(pushTokensTable)
    .where(inArray(pushTokensTable.userId, userIds));
  return rows.map((r) => r.token);
}

/**
 * Like getTokensForUsers but filters out users who have muted notifications
 * for the specified event. Use this for all event-specific push notifications
 * so that per-event mute preferences are respected.
 */
export async function getUnmutedTokensForEvent(
  eventId: number,
  userIds: number[],
): Promise<string[]> {
  if (!userIds.length) return [];
  const rows = await db
    .select({ token: pushTokensTable.token })
    .from(pushTokensTable)
    .innerJoin(
      eventParticipantsTable,
      eq(eventParticipantsTable.userId, pushTokensTable.userId),
    )
    .where(
      and(
        inArray(pushTokensTable.userId, userIds),
        eq(eventParticipantsTable.eventId, eventId),
        eq(eventParticipantsTable.notificationsMuted, false),
      ),
    );
  return rows.map((r) => r.token);
}

export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const valid = tokens.filter(
    (t) => t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["),
  );
  if (!valid.length) return;
  const messages = valid.map((to) => ({
    to,
    title,
    body,
    data: data ?? {},
    sound: "default",
  }));
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* fire-and-forget — never fail the request */ }
}
