/**
 * GET /api/ping
 *
 * Ultra-lightweight liveness probe. The mobile app fires this at JS runtime
 * start (before ClerkProvider mounts) and records reachability + round-trip
 * time in the launch telemetry row — so we can distinguish "Clerk proxy
 * unreachable" from "API server down" without shipping a new build.
 *
 * No auth, no rate limiting — the response is a constant 28 bytes.
 */
import { Router } from "express";

const router = Router();

router.get("/ping", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

export default router;
