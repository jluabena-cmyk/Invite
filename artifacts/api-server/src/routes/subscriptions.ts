import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { fetchRcEntitlement } from "../lib/revenuecat";
import { FREE_EVENT_LIMIT } from "../lib/config";

const router = Router();

const REVENUECAT_WEBHOOK_AUTH = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER ?? "";

async function resolveProfile(clerkUserId: string) {
  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);
  return profile ?? null;
}

// ─── GET /users/me/subscription ───────────────────────────────────────────────

router.get("/users/me/subscription", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const hostedEventsSent = profile.hostedEventsSent ?? 0;

  const isPremium =
    profile.subscriptionStatus === "premium" &&
    (profile.premiumExpiresAt === null || profile.premiumExpiresAt > new Date());

  return res.status(200).json({
    subscriptionStatus: isPremium ? "premium" : "free",
    hostedEventsSent,
    eventsRemaining: Math.max(0, FREE_EVENT_LIMIT - hostedEventsSent),
    freeEventLimit: FREE_EVENT_LIMIT,
    premiumExpiresAt: profile.premiumExpiresAt?.toISOString() ?? null,
  });
});

// ─── POST /users/me/subscription/sync ──────────────────────────────────────────
// Called by the client immediately after a successful RevenueCat purchase to
// eagerly sync entitlement status without waiting for the webhook.
// Uses the RevenueCat V1 REST API with the existing public SDK key.

router.post("/users/me/subscription/sync", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await resolveProfile(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const rcData = await fetchRcEntitlement(clerkUserId);

  if (rcData) {
    if (rcData.isPremium) {
      await db
        .update(userProfilesTable)
        .set({ subscriptionStatus: "premium", premiumExpiresAt: rcData.expiresAt })
        .where(eq(userProfilesTable.clerkUserId, clerkUserId));
    } else {
      // RC confirmed no active entitlement — sync that downgrade to DB.
      const alreadyExpired =
        profile.premiumExpiresAt !== null && profile.premiumExpiresAt <= new Date();
      if (alreadyExpired || profile.subscriptionStatus === "free") {
        await db
          .update(userProfilesTable)
          .set({ subscriptionStatus: "free", premiumExpiresAt: null })
          .where(eq(userProfilesTable.clerkUserId, clerkUserId));
      }
    }
  }

  // Re-read fresh state and return
  const fresh = await resolveProfile(clerkUserId);
  if (!fresh) return res.status(404).json({ error: "Profile not found" });

  const hostedEventsSent = fresh.hostedEventsSent ?? 0;
  const isPremium =
    fresh.subscriptionStatus === "premium" &&
    (fresh.premiumExpiresAt === null || fresh.premiumExpiresAt > new Date());

  return res.status(200).json({
    subscriptionStatus: isPremium ? "premium" : "free",
    hostedEventsSent,
    eventsRemaining: Math.max(0, FREE_EVENT_LIMIT - hostedEventsSent),
    freeEventLimit: FREE_EVENT_LIMIT,
    premiumExpiresAt: fresh.premiumExpiresAt?.toISOString() ?? null,
  });
});

// ─── POST /webhooks/revenuecat ─────────────────────────────────────────────────
// RevenueCat sends webhook events for subscription lifecycle changes.
// Authorization: We check the Authorization header matches our shared secret.
//
// Event mapping (following Apple/Google subscription semantics):
//   INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, UNCANCELLATION
//     → set premium with expiresAt from event
//   CANCELLATION, BILLING_ISSUE
//     → keep premium, but record the scheduled expiry date so the user retains
//       access until period end. The isPremium check enforces the date boundary.
//   EXPIRATION, REFUND
//     → immediately revoke to free (entitlement is truly gone)

router.post("/webhooks/revenuecat", async (req, res) => {
  const authHeader = req.headers["authorization"] ?? "";
  if (!REVENUECAT_WEBHOOK_AUTH || authHeader !== REVENUECAT_WEBHOOK_AUTH) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const event = req.body?.event;
  if (!event) return res.status(400).json({ error: "Missing event" });

  const eventType: string = event.type ?? "";
  const appUserId: string = event.app_user_id ?? event.original_app_user_id ?? "";
  const expirationAtMs: number | null = event.expiration_at_ms ?? null;

  if (!appUserId) return res.status(400).json({ error: "Missing app_user_id" });

  try {
    if (
      eventType === "INITIAL_PURCHASE" ||
      eventType === "RENEWAL" ||
      eventType === "PRODUCT_CHANGE" ||
      eventType === "UNCANCELLATION"
    ) {
      // Active subscription — grant premium with expiry from event
      const premiumExpiresAt = expirationAtMs ? new Date(expirationAtMs) : null;
      await db
        .update(userProfilesTable)
        .set({ subscriptionStatus: "premium", premiumExpiresAt })
        .where(eq(userProfilesTable.clerkUserId, appUserId));
    } else if (eventType === "CANCELLATION" || eventType === "BILLING_ISSUE") {
      // Cancellation = user will not renew, but entitlement is still active until expiry.
      // Billing issue = RevenueCat has a grace period before actual expiration.
      // In both cases: keep status "premium", update premiumExpiresAt so the
      // isPremium date-boundary check handles the eventual access loss correctly.
      const premiumExpiresAt = expirationAtMs ? new Date(expirationAtMs) : null;
      await db
        .update(userProfilesTable)
        .set({
          subscriptionStatus: "premium",
          ...(premiumExpiresAt !== null ? { premiumExpiresAt } : {}),
        })
        .where(eq(userProfilesTable.clerkUserId, appUserId));
    } else if (eventType === "EXPIRATION" || eventType === "REFUND") {
      // True entitlement loss — immediately revoke
      await db
        .update(userProfilesTable)
        .set({ subscriptionStatus: "free", premiumExpiresAt: null })
        .where(eq(userProfilesTable.clerkUserId, appUserId));
    }
    // All other event types (TEST, etc.) are acknowledged but ignored.

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[revenuecat webhook] error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;
