/**
 * GET /api/admin/upload-stats
 *
 * Returns daily upload event counts grouped by (type, outcome) for a
 * configurable date range, so the dashboard can render an Upload Health chart.
 *
 * Query parameters (all optional, evaluated in this priority order):
 *   since  — ISO-8601 date/datetime string for the start of the range
 *   until  — ISO-8601 date/datetime string for the end of the range (default: now)
 *   days   — integer number of trailing days (default: 14)
 *
 * Protected by the same X-Admin-Token header as the other admin routes.
 */

import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

const MAX_DAYS = 365;
const DEFAULT_DAYS = 14;

const router = Router();

router.get("/admin/upload-stats", async (req, res) => {
  // Read at request time so tests that set the env var in beforeAll see it.
  const ADMIN_TOKEN = process.env.TELEMETRY_ADMIN_TOKEN ?? "";
  if (!ADMIN_TOKEN || req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // ── Resolve the time window ──────────────────────────────────────────────
  let sinceDate: Date;
  let untilDate: Date;

  const sinceParam = req.query["since"] as string | undefined;
  const untilParam = req.query["until"] as string | undefined;
  const daysParam  = req.query["days"]  as string | undefined;

  /**
   * Parse a date/datetime string from a query param.
   * Date-only strings (YYYY-MM-DD) are ambiguous — they parse to midnight UTC,
   * which makes the selected day look empty.  When `inclusive` is true we
   * advance by one day so that `created_at <= untilDate` captures all events
   * on that calendar day (i.e. the bound is exclusive at the start of the next day).
   */
  function parseDate(raw: string, inclusive = false): Date | null {
    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) return null;
    if (inclusive && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
      // Advance by exactly one day so the whole calendar day is included.
      return new Date(parsed.getTime() + 86_400_000);
    }
    return parsed;
  }

  // `until` (or now).  Date-only inputs are treated as inclusive end-of-day.
  if (untilParam) {
    untilDate = parseDate(untilParam, /* inclusive */ true) ?? new Date();
  } else {
    untilDate = new Date();
  }

  // `since` wins over `days`
  if (sinceParam) {
    const parsed = parseDate(sinceParam, false);
    if (parsed === null) {
      res.status(400).json({ error: "Invalid 'since' date" });
      return;
    }
    sinceDate = parsed;
  } else {
    const days = Math.min(
      MAX_DAYS,
      Math.max(1, parseInt(daysParam ?? String(DEFAULT_DAYS), 10) || DEFAULT_DAYS),
    );
    sinceDate = new Date(untilDate.getTime() - days * 86_400_000);
  }

  // Reject reversed or equal ranges (no events can fall in an empty window).
  if (sinceDate >= untilDate) {
    res.status(400).json({ error: "'since' must be before 'until'" });
    return;
  }

  try {
    const rows = await db.execute<{
      date: string;
      type: string;
      outcome: string;
      build_number: string | null;
      count: number;
    }>(sql`
      SELECT
        DATE(created_at)     AS date,
        type,
        outcome,
        build_number,
        COUNT(*)::INTEGER    AS count
      FROM upload_events
      WHERE created_at >= ${sinceDate.toISOString()}
        AND created_at <= ${untilDate.toISOString()}
      GROUP BY DATE(created_at), type, outcome, build_number
      ORDER BY date DESC, type, outcome, build_number
    `);

    const stats = rows.rows.map((r) => ({
      date: r.date,
      type: r.type,
      outcome: r.outcome,
      buildNumber: r.build_number ?? null,
      count: r.count,
    }));

    // Per-build, per-day failure rate breakdown (null build_number rows excluded).
    const buildDateRows = await db.execute<{
      build_number: string;
      date: string;
      success_count: number;
      failure_count: number;
    }>(sql`
      SELECT
        build_number,
        DATE(created_at)                                          AS date,
        COUNT(*) FILTER (WHERE outcome = 'success')::INTEGER      AS success_count,
        COUNT(*) FILTER (WHERE outcome <> 'success')::INTEGER     AS failure_count
      FROM upload_events
      WHERE created_at >= ${sinceDate.toISOString()}
        AND created_at <= ${untilDate.toISOString()}
        AND build_number IS NOT NULL
      GROUP BY build_number, DATE(created_at)
      ORDER BY date DESC, build_number
    `);

    const byBuildDate = buildDateRows.rows.map((r) => ({
      buildNumber: r.build_number,
      date: r.date,
      successCount: r.success_count,
      failureCount: r.failure_count,
    }));

    res.json({ stats, byBuildDate, since: sinceDate.toISOString(), until: untilDate.toISOString() });
  } catch (err) {
    logger.error({ err }, "[upload-stats] Failed to query upload events");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
