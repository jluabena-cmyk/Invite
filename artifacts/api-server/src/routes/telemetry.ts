/**
 * Telemetry routes
 *
 * POST /api/telemetry/launch  — anonymous, rate-limited. Records one row per
 *   app session so we can diagnose production launch failures (black screen,
 *   Clerk timeouts, etc.) without shipping a new build.
 *
 * GET  /api/admin/telemetry   — returns the last 100 launch events. Protected
 *   by X-Admin-Token header checked against the TELEMETRY_ADMIN_TOKEN env var.
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { desc, lt } from "drizzle-orm";
import { db, appLaunchEventsTable } from "@workspace/db";
import type { AppLaunchEvent } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

// ─── Admin token ──────────────────────────────────────────────────────────────

const ADMIN_TOKEN = process.env.TELEMETRY_ADMIN_TOKEN ?? "";

// ─── Rate limiting ────────────────────────────────────────────────────────────

const launchRateLimit = rateLimit({
  windowMs: 60 * 1_000, // 1 minute
  limit: 10,            // generous for one-per-session calls
  keyGenerator: (req) => req.ip ?? req.socket?.remoteAddress ?? "unknown",
  // Disable express-rate-limit's IPv6 keyGenerator validation — it fires on
  // any keyGenerator that reads req.ip directly, but our usage is fine here
  // since Replit's single-hop trust proxy already normalises the IP.
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many requests" });
  },
  // Bypass rate limiting in the test environment so the test suite can send
  // more than 10 requests per minute without hitting the limit.
  skip: () => process.env.NODE_ENV === "test",
});

// ─── Input validation ─────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface LaunchPayload {
  sessionId:    string;
  buildNumber?: string;
  appVersion?:  string;
  platform?:    "ios" | "android";
  clerkStatus:  "loaded" | "timed_out";
  msToClerk?:   number;
  firstScreen?: string;
  errorCode?:   string;
  apiReachable?: boolean;
  apiPingMs?:    number;
  bakedDomain?:  string;
  bakedProxyUrl?: string;
  proxyReachable?: boolean;
  proxyPingMs?:  number;
}

function parseLaunchPayload(body: unknown): LaunchPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const sessionId = typeof b.sessionId === "string" && UUID_RE.test(b.sessionId)
    ? b.sessionId : null;
  if (!sessionId) return null;

  const clerkStatus = b.clerkStatus === "loaded" || b.clerkStatus === "timed_out"
    ? b.clerkStatus : null;
  if (!clerkStatus) return null;

  const str = (v: unknown, maxLen: number) =>
    typeof v === "string" && v.length <= maxLen ? v : undefined;
  const platform = b.platform === "ios" || b.platform === "android"
    ? b.platform : undefined;
  const msToClerk = typeof b.msToClerk === "number" && b.msToClerk >= 0 && b.msToClerk <= 120_000
    ? Math.round(b.msToClerk) : undefined;

  const apiReachable = typeof b.apiReachable === "boolean" ? b.apiReachable : undefined;
  const apiPingMs = typeof b.apiPingMs === "number" && b.apiPingMs >= 0 && b.apiPingMs <= 30_000
    ? Math.round(b.apiPingMs) : undefined;

  const proxyReachable = typeof b.proxyReachable === "boolean" ? b.proxyReachable : undefined;
  const proxyPingMs = typeof b.proxyPingMs === "number" && b.proxyPingMs >= 0 && b.proxyPingMs <= 30_000
    ? Math.round(b.proxyPingMs) : undefined;

  return {
    sessionId,
    clerkStatus,
    buildNumber: str(b.buildNumber, 20),
    appVersion:  str(b.appVersion, 20),
    platform,
    msToClerk,
    firstScreen: str(b.firstScreen, 200),
    errorCode:   str(b.errorCode, 100),
    apiReachable,
    apiPingMs,
    bakedDomain:   str(b.bakedDomain, 100),
    bakedProxyUrl: str(b.bakedProxyUrl, 200),
    proxyReachable,
    proxyPingMs,
  };
}

// ─── POST /api/telemetry/launch ───────────────────────────────────────────────

router.post("/telemetry/launch", launchRateLimit, async (req, res) => {
  const payload = parseLaunchPayload(req.body);
  if (!payload) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    // ON CONFLICT DO NOTHING enforces one-row-per-session (unique index on
    // session_id) while keeping the endpoint idempotent for the client.
    const rows = await db.insert(appLaunchEventsTable).values(payload).onConflictDoNothing().returning();
    if (rows.length > 0) broadcastLaunchEvent(rows[0]);
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "[telemetry] Failed to insert launch event");
    // Return 204 anyway — the app is fire-and-forget; don't alarm the client.
    res.status(204).send();
  }
});

// ─── GET /api/admin/telemetry ─────────────────────────────────────────────────

router.get("/admin/telemetry", async (req, res) => {
  if (!ADMIN_TOKEN || req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const events = await db
      .select()
      .from(appLaunchEventsTable)
      .orderBy(desc(appLaunchEventsTable.createdAt))
      .limit(100);
    res.json({ events, count: events.length });
  } catch (err) {
    logger.error({ err }, "[telemetry] Failed to query launch events");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/admin/telemetry/summary ────────────────────────────────────────

router.get("/admin/telemetry/summary", async (req, res) => {
  if (!ADMIN_TOKEN || req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    // Fetch all rows (30-day window is enforced by the pruning job) and compute
    // the summary in JS — avoids non-portable SQL aggregate expressions (e.g.
    // percentile_cont) and keeps the logic easy to test.
    const events: AppLaunchEvent[] = await db
      .select()
      .from(appLaunchEventsTable)
      .orderBy(desc(appLaunchEventsTable.createdAt));

    // Group by buildNumber, treating null as "(unknown)".
    const buildMap = new Map<string, AppLaunchEvent[]>();
    for (const event of events) {
      const key = event.buildNumber ?? "(unknown)";
      if (!buildMap.has(key)) buildMap.set(key, []);
      buildMap.get(key)!.push(event);
    }

    const summary = Array.from(buildMap.entries()).map(([buildNumber, rows]) => {
      const total    = rows.length;
      const timedOut = rows.filter((r) => r.clerkStatus === "timed_out").length;

      // Median ms_to_clerk (ignore rows where the field is null).
      const msValues = rows
        .map((r) => r.msToClerk)
        .filter((v): v is number => v != null)
        .sort((a, b) => a - b);

      let medianMsToClerk: number | null = null;
      if (msValues.length > 0) {
        const mid = Math.floor(msValues.length / 2);
        medianMsToClerk =
          msValues.length % 2 === 0
            ? Math.round((msValues[mid - 1] + msValues[mid]) / 2)
            : msValues[mid];
      }

      // Top first-screen values by frequency (up to 5).
      const screenCounts = new Map<string, number>();
      for (const row of rows) {
        if (row.firstScreen) {
          screenCounts.set(
            row.firstScreen,
            (screenCounts.get(row.firstScreen) ?? 0) + 1,
          );
        }
      }
      const topScreens = Array.from(screenCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([screen, count]) => ({ screen, count }));

      // API reachability percent: only count rows that reported a value.
      const apiRows = rows.filter((r) => r.apiReachable != null);
      const apiReachablePercent =
        apiRows.length > 0
          ? Math.round((apiRows.filter((r) => r.apiReachable === true).length / apiRows.length) * 1000) / 10
          : null;

      return { buildNumber, total, timedOut, medianMsToClerk, topScreens, apiReachablePercent };
    });

    // Sort builds descending: numeric build numbers first (most recent first),
    // then lexicographic fallback for non-numeric labels.
    summary.sort((a, b) => {
      const na = Number(a.buildNumber);
      const nb = Number(b.buildNumber);
      if (!isNaN(na) && !isNaN(nb)) return nb - na;
      return b.buildNumber.localeCompare(a.buildNumber);
    });

    res.json({ summary });
  } catch (err) {
    logger.error({ err }, "[telemetry] Failed to compute telemetry summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── SSE live stream ─────────────────────────────────────────────────────────
// Keeps a set of open SSE response objects. When a new launch event is
// recorded the route handler calls broadcastLaunchEvent() so connected
// dashboard clients see it immediately without polling.

const sseClients = new Set<import("express").Response>();

function broadcastLaunchEvent(event: unknown) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) {
    try { res.write(data); } catch { sseClients.delete(res); }
  }
}

router.get("/admin/telemetry/stream", (req, res) => {
  // EventSource can't set custom headers, so we accept the token as either
  // a header (for programmatic use) or a query param (for browser EventSource).
  const tokenFromQuery = typeof req.query.token === "string" ? req.query.token : undefined;
  const tokenFromHeader = typeof req.headers["x-admin-token"] === "string" ? req.headers["x-admin-token"] : undefined;
  const provided = tokenFromHeader ?? tokenFromQuery;
  if (!ADMIN_TOKEN || provided !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send a heartbeat comment every 25 s to keep the connection alive
  // through proxies that close idle connections.
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { /* client gone */ }
  }, 25_000);

  sseClients.add(res);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// ─── 30-day pruning job ───────────────────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1_000;

async function pruneOldLaunchEvents() {
  try {
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
    const result = await db
      .delete(appLaunchEventsTable)
      .where(lt(appLaunchEventsTable.createdAt, cutoff));
    // result.rowCount may be undefined on some adapters; log only when truthy
    const deleted = (result as { rowCount?: number }).rowCount ?? 0;
    if (deleted > 0) {
      logger.info({ deleted }, "[telemetry] Pruned old launch events");
    }
  } catch (err) {
    logger.warn({ err }, "[telemetry] Failed to prune launch events (non-fatal)");
  }
}

// Run once shortly after boot, then every 24 h.
setTimeout(() => {
  void pruneOldLaunchEvents();
  setInterval(() => void pruneOldLaunchEvents(), 24 * 60 * 60 * 1_000);
}, 30_000);

export default router;
