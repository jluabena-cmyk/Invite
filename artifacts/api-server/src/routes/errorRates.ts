/**
 * GET /api/admin/error-rates
 *
 * Returns hourly error counts per endpoint for the last 24 hours, grouped
 * by (endpoint, statusCode, windowStart), most recent first.
 *
 * Protected by the same X-Admin-Token header as /api/admin/telemetry.
 */

import { Router } from "express";
import { desc, gte } from "drizzle-orm";
import { db, apiErrorCountsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

const ADMIN_TOKEN = process.env.TELEMETRY_ADMIN_TOKEN ?? "";

router.get("/admin/error-rates", async (req, res) => {
  if (!ADMIN_TOKEN || req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select()
      .from(apiErrorCountsTable)
      .where(gte(apiErrorCountsTable.windowStart, since))
      .orderBy(desc(apiErrorCountsTable.windowStart), desc(apiErrorCountsTable.count))
      .limit(500);
    res.json({ errorRates: rows, count: rows.length });
  } catch (err) {
    logger.error({ err }, "[error-rates] Failed to query error counts");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
