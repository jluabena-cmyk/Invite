import app from "./app";
import { logger } from "./lib/logger";
import { pruneOldErrorCounts } from "./middleware/errorRateTracker";
import { pruneOldUploadEvents } from "./middleware/uploadEventsTracker";
import { runPendingMigrations } from "./lib/dbMigrations";
import { sendInviteReminders } from "./lib/inviteReminder";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Run idempotent schema migrations before accepting traffic so that the
// chat_last_read_at column (and any future additions) always exist in production
// by the time requests hit endpoints that reference them.
void (async () => {
  await runPendingMigrations().catch((err: unknown) => {
    logger.error({ err }, "DB migrations failed — aborting startup");
    process.exit(1);
  });

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

  // Prune api_error_counts and upload_events rows older than 30 days once on startup, then daily.
  const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
  void pruneOldErrorCounts().catch((e: unknown) =>
    logger.warn({ err: e }, "[error-rate-tracker] Initial prune failed"),
  );
  void pruneOldUploadEvents().catch((e: unknown) =>
    logger.warn({ err: e }, "[upload-events-tracker] Initial prune failed"),
  );
  setInterval(() => {
    void pruneOldErrorCounts().catch((e: unknown) =>
      logger.warn({ err: e }, "[error-rate-tracker] Scheduled prune failed"),
    );
    void pruneOldUploadEvents().catch((e: unknown) =>
      logger.warn({ err: e }, "[upload-events-tracker] Scheduled prune failed"),
    );
  }, PRUNE_INTERVAL_MS).unref();

  // Send follow-up reminders to invited guests who haven't responded after 24 h.
  // Run once shortly after startup (in case the server was down), then hourly.
  const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  setTimeout(() => {
    void sendInviteReminders().catch((e: unknown) =>
      logger.warn({ err: e }, "[invite-reminder] Initial run failed"),
    );
    setInterval(() => {
      void sendInviteReminders().catch((e: unknown) =>
        logger.warn({ err: e }, "[invite-reminder] Scheduled run failed"),
      );
    }, REMINDER_INTERVAL_MS).unref();
  }, 30_000).unref(); // 30-second startup delay so migrations complete first
  });
})();
