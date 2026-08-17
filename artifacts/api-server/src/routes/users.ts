import { Router, Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import multer from "multer";
import { randomUUID } from "crypto";
import { getAuth, clerkClient } from "@clerk/express";
import { aliasedTable, and, eq, exists, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db, userProfilesTable, friendshipsTable, eventParticipantsTable, eventsTable, pushTokensTable, itemAssignmentsTable, paymentRequestsTable, eventMessagesTable } from "@workspace/db";
import { objectStorageClient } from "../lib/objectStorage";
import { resolveDisplayName } from "../lib/helpers";
import { splitGcsPath, gcsPathFromObjectPath, signedAvatarUrl } from "../lib/gcs";
import { logger } from "../lib/logger";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── Lightweight auth gate ────────────────────────────────────────────────────
// Must run BEFORE multer so unauthenticated requests never cause the server to
// allocate the 10 MB in-memory buffer.
function requireAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

// ─── Handle validation ────────────────────────────────────────────────────────

const RESERVED_HANDLES = new Set([
  "admin", "support", "owmo", "api", "system",
  "null", "undefined", "root", "moderator", "staff",
]);

function validateHandle(raw: string): { handle: string } | { error: string; status: 400 } {
  const handle = raw.trim().toLowerCase();
  if (handle.length < 3 || handle.length > 20) {
    return { error: "Handle must be 3–20 characters", status: 400 };
  }
  if (!/^[a-z0-9_]+$/.test(handle)) {
    return { error: "Handle may only contain letters, numbers, and underscores", status: 400 };
  }
  if (handle.startsWith("_") || handle.endsWith("_")) {
    return { error: "Handle cannot start or end with an underscore", status: 400 };
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { error: "That handle is reserved", status: 400 };
  }
  return { handle };
}

// ─── Response shape ───────────────────────────────────────────────────────────

type ProfileRow = typeof userProfilesTable.$inferSelect;

function toProfileResponse(profile: ProfileRow, avatarUrl: string | null) {
  return {
    id: profile.id,
    clerkUserId: profile.clerkUserId,
    email: profile.email,
    displayName: resolveDisplayName(profile.displayName, profile.handle),
    handle: profile.handle,
    bio: profile.bio ?? null,
    cashAppHandle: profile.cashAppHandle ?? null,
    venmoHandle: profile.venmoHandle ?? null,
    preferredPaymentMethod: profile.preferredPaymentMethod ?? null,
    zelleInfo: profile.zelleInfo ?? null,
    cashAppVerified: profile.cashAppVerified ?? false,
    venmoVerified: profile.venmoVerified ?? false,
    avatarObjectPath: profile.avatarObjectPath ?? null,
    avatarUrl,
    phoneNumber: profile.phoneNumber ?? null,
    phoneNumberHash: profile.phoneNumberHash ?? null,
    createdAt: profile.createdAt,
  };
}

// ─── GET /users/suggestions ───────────────────────────────────────────────────

router.get("/users/suggestions", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [myProfile] = await db
    .select({ id: userProfilesTable.id })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);

  if (!myProfile) { res.status(404).json({ error: "Profile not found" }); return; }

  // Find co-participants from shared events, count shared events, exclude
  // users who already have any friendship record (any status) with the caller.
  const rows = await db.execute(
    sql`
      SELECT
        up.id,
        up.display_name,
        up.email,
        up.handle,
        up.avatar_object_path,
        up.bio,
        COUNT(DISTINCT ep2.event_id)::int AS shared_event_count
      FROM event_participants ep1
      JOIN event_participants ep2
        ON ep1.event_id = ep2.event_id
       AND ep2.user_id <> ${myProfile.id}
      JOIN user_profiles up
        ON up.id = ep2.user_id
      WHERE ep1.user_id = ${myProfile.id}
        AND NOT EXISTS (
          SELECT 1 FROM friendships f
          WHERE (f.requester_user_id = ${myProfile.id} AND f.addressee_user_id = ep2.user_id)
             OR (f.requester_user_id = ep2.user_id AND f.addressee_user_id = ${myProfile.id})
        )
      GROUP BY up.id, up.display_name, up.email, up.handle, up.avatar_object_path, up.bio
      ORDER BY shared_event_count DESC
      LIMIT 10
    `,
  );

  const withUrls = await Promise.all(
    (rows.rows as Array<{
      id: number;
      display_name: string | null;
      email: string;
      handle: string;
      avatar_object_path: string | null;
      bio: string | null;
      shared_event_count: number;
    }>).map(async (r) => {
      const avatarUrl = r.avatar_object_path ? await signedAvatarUrl(r.avatar_object_path) : null;
      return {
        id: r.id,
        displayName: resolveDisplayName(r.display_name, r.handle),
        handle: r.handle,
        avatarUrl,
        bio: r.bio ?? null,
        sharedEventCount: r.shared_event_count,
      };
    }),
  );

  res.json(withUrls);
});

// ─── GET /users/search ────────────────────────────────────────────────────────

router.get("/users/search", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const q = ((req.query.q as string) ?? "").trim();
  if (q.length < 2) {
    res.status(400).json({ error: "Query must be at least 2 characters" });
    return;
  }

  const [myProfile] = await db
    .select({ id: userProfilesTable.id })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);

  if (!myProfile) { res.status(404).json({ error: "Profile not found" }); return; }

  const normalizedQ = q.startsWith("@") ? q.slice(1).toLowerCase() : q.toLowerCase();

  const results = await db
    .select({
      id: userProfilesTable.id,
      displayName: userProfilesTable.displayName,
      email: userProfilesTable.email,
      handle: userProfilesTable.handle,
      avatarObjectPath: userProfilesTable.avatarObjectPath,
      bio: userProfilesTable.bio,
    })
    .from(userProfilesTable)
    .where(
      and(
        ne(userProfilesTable.id, myProfile.id),
        or(
          ilike(userProfilesTable.displayName, `%${normalizedQ}%`),
          ilike(userProfilesTable.handle, `${normalizedQ}%`),
        ),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${userProfilesTable.handle} = ${normalizedQ} THEN 0 ELSE 1 END`,
      userProfilesTable.displayName,
    )
    .limit(20);

  const withUrls = await Promise.all(
    results.map(async (r) => {
      const avatarUrl = r.avatarObjectPath ? await signedAvatarUrl(r.avatarObjectPath) : null;
      return {
        id: r.id,
        displayName: resolveDisplayName(r.displayName, r.handle),
        handle: r.handle,
        avatarUrl,
        bio: r.bio ?? null,
      };
    }),
  );

  res.json(withUrls);
});

// ─── GET /users/me ────────────────────────────────────────────────────────────

router.get("/users/me", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);

  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const avatarUrl = profile.avatarObjectPath
    ? await signedAvatarUrl(profile.avatarObjectPath)
    : null;

  res.json(toProfileResponse(profile, avatarUrl));
});

// ─── POST /users/me (upsert on first login) ───────────────────────────────────

router.post("/users/me", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Derive email from the verified Clerk identity — never trust client-supplied email,
  // as accepting an arbitrary email from req.body would allow any authenticated user to
  // set a victim's email on their profile and impersonate them in search/discovery flows.
  let email: string;
  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const primary = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    );
    if (!primary?.emailAddress) {
      res.status(400).json({ error: "No verified email address on Clerk account" });
      return;
    }
    email = primary.emailAddress;
  } catch {
    res.status(500).json({ error: "Failed to retrieve identity from auth provider" });
    return;
  }

  const { displayName } = req.body as { displayName?: string };
  const resolvedDisplayName = displayName?.trim() || email.split("@")[0] || "User";

  // Generate a unique handle from display name or email prefix
  const baseSlug = resolvedDisplayName
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20) || "user";

  const paddedSlug = baseSlug.length < 3 ? baseSlug.padEnd(3, "u") : baseSlug;

  let handle = paddedSlug;
  let suffix = 2;

  // Phase 1: optimistic uniqueness scan (handles the common sequential-signup case)
  while (true) {
    const [taken] = await db
      .select({ id: userProfilesTable.id })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.handle, handle))
      .limit(1);
    if (!taken) break;
    handle = `${paddedSlug.slice(0, 17)}_${suffix++}`;
  }

  // Phase 2: insert with retry on unique_violation (handles concurrent signups that
  // race through Phase 1 with the same handle before either commits).
  let profile: typeof userProfilesTable.$inferSelect | undefined;
  while (!profile) {
    try {
      const [inserted] = await db
        .insert(userProfilesTable)
        .values({ clerkUserId, email, displayName: resolvedDisplayName, handle })
        .onConflictDoUpdate({
          target: userProfilesTable.clerkUserId,
          set: { email },
        })
        .returning();
      profile = inserted;
    } catch (err: any) {
      // 23505 = unique_violation; retry with a fresh suffix if it's the handle column
      if (err.code === "23505" && String(err.constraint ?? err.detail ?? "").includes("handle")) {
        logger.warn({ handle, err: err.message }, "Handle collision on insert, retrying with suffix");
        handle = `${paddedSlug.slice(0, 17)}_${suffix++}`;
      } else {
        throw err;
      }
    }
  }

  const avatarUrl = profile.avatarObjectPath
    ? await signedAvatarUrl(profile.avatarObjectPath)
    : null;

  res.json(toProfileResponse(profile, avatarUrl));
});

// ─── PATCH /users/me ──────────────────────────────────────────────────────────

router.patch("/users/me", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { displayName, handle, bio, cashAppHandle, venmoHandle, preferredPaymentMethod, zelleInfo, cashAppVerified, venmoVerified, phoneNumber, phoneNumberHash } = req.body as {
    displayName?: string;
    handle?: string;
    bio?: string;
    cashAppHandle?: string;
    venmoHandle?: string;
    preferredPaymentMethod?: string | null;
    zelleInfo?: string | null;
    cashAppVerified?: boolean;
    venmoVerified?: boolean;
    phoneNumber?: string | null;
    phoneNumberHash?: string | null;
  };

  const updates: {
    displayName?: string;
    handle?: string;
    bio?: string | null;
    cashAppHandle?: string | null;
    venmoHandle?: string | null;
    preferredPaymentMethod?: string | null;
    zelleInfo?: string | null;
    cashAppVerified?: boolean;
    venmoVerified?: boolean;
    phoneNumber?: string | null;
    phoneNumberHash?: string | null;
  } = {};

  if (displayName !== undefined) {
    if (!displayName.trim()) {
      res.status(400).json({ error: "displayName cannot be blank" });
      return;
    }
    updates.displayName = displayName.trim();
  }

  if (handle !== undefined) {
    const result = validateHandle(handle);
    if ("error" in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    // Check uniqueness — exclude current user
    const [myProfile] = await db
      .select({ id: userProfilesTable.id })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkUserId, clerkUserId))
      .limit(1);
    if (!myProfile) { res.status(404).json({ error: "Profile not found" }); return; }

    const [taken] = await db
      .select({ id: userProfilesTable.id })
      .from(userProfilesTable)
      .where(and(eq(userProfilesTable.handle, result.handle), ne(userProfilesTable.id, myProfile.id)))
      .limit(1);
    if (taken) {
      res.status(409).json({ error: "That handle is already taken" });
      return;
    }
    updates.handle = result.handle;
  }

  if (bio !== undefined) updates.bio = bio.trim() || null;
  if (cashAppHandle !== undefined) updates.cashAppHandle = cashAppHandle.trim() || null;
  if (venmoHandle !== undefined) updates.venmoHandle = venmoHandle.trim() || null;
  if (preferredPaymentMethod !== undefined) {
    const valid = ["cash_app", "venmo", "zelle", null];
    if (!valid.includes(preferredPaymentMethod)) {
      res.status(400).json({ error: "preferredPaymentMethod must be cash_app, venmo, zelle, or null" });
      return;
    }
    updates.preferredPaymentMethod = preferredPaymentMethod;
  }
  if (zelleInfo !== undefined) updates.zelleInfo = zelleInfo === null ? null : zelleInfo.trim() || null;
  if (cashAppVerified !== undefined) updates.cashAppVerified = Boolean(cashAppVerified);
  if (venmoVerified !== undefined) updates.venmoVerified = Boolean(venmoVerified);
  // Reset verified flags when handles change
  if (cashAppHandle !== undefined) updates.cashAppVerified = false;
  if (venmoHandle !== undefined) updates.venmoVerified = false;
  if (phoneNumber !== undefined) updates.phoneNumber = typeof phoneNumber === "string" && phoneNumber.trim() ? phoneNumber.trim().slice(0, 30) : null;
  if (phoneNumberHash !== undefined) updates.phoneNumberHash = typeof phoneNumberHash === "string" && phoneNumberHash.trim() ? phoneNumberHash.trim() : null;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields provided to update" });
    return;
  }

  const [updated] = await db
    .update(userProfilesTable)
    .set(updates)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Profile not found" }); return; }

  const avatarUrl = updated.avatarObjectPath
    ? await signedAvatarUrl(updated.avatarObjectPath)
    : null;

  res.json(toProfileResponse(updated, avatarUrl));
});

// ─── POST /users/me/avatar ────────────────────────────────────────────────────

router.post(
  "/users/me/avatar",
  requireAuthMiddleware,
  upload.single("image"),
  async (req, res) => {
    const auth = getAuth(req);
    const clerkUserId = auth?.userId!;

    const file = req.file;
    if (!file) { res.status(400).json({ error: "image file is required" }); return; }

    const [existing] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkUserId, clerkUserId))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Profile not found" }); return; }

    const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateObjectDir) { res.status(500).json({ error: "Storage not configured" }); return; }

    const uuid = randomUUID();
    const fullGcsPath = `${privateObjectDir}/avatar-photos/${uuid}`;
    const { bucketName, objectName } = splitGcsPath(fullGcsPath);

    const bucket = objectStorageClient.bucket(bucketName);
    const gcsFile = bucket.file(objectName);
    await gcsFile.save(file.buffer, { contentType: file.mimetype, resumable: false });

    const newObjectPath = `/objects/avatar-photos/${uuid}`;
    const oldObjectPath = existing.avatarObjectPath;

    // Update DB first — if this fails the new GCS object is orphaned (acceptable),
    // but the profile never loses its existing avatar link.
    const [updated] = await db
      .update(userProfilesTable)
      .set({ avatarObjectPath: newObjectPath })
      .where(eq(userProfilesTable.clerkUserId, clerkUserId))
      .returning();

    // Only delete the old object after the DB row is committed.
    if (oldObjectPath) {
      try {
        const old = gcsPathFromObjectPath(oldObjectPath);
        await objectStorageClient.bucket(old.bucketName).file(old.objectName).delete();
      } catch (err) {
        logger.warn({ err, oldObjectPath }, "Failed to delete old avatar from storage");
      }
    }

    const avatarUrl = updated ? await signedAvatarUrl(newObjectPath) : null;

    res.json({ avatarUrl });
  },
);

// ─── POST /users/match-phones ─────────────────────────────────────────────────
// Accepts up to 50 SHA-256 hashed phone numbers and returns profiles of users
// whose stored hash matches. Raw phone numbers are never sent to or stored on
// the server — all hashing happens client-side.
//
// Rate-limited to 5 requests per 15 minutes per authenticated user to prevent
// bulk enumeration of registered phone numbers.

const matchPhonesRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => {
    const auth = getAuth(req);
    return auth?.userId ?? ipKeyGenerator(req);
  },
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

router.post("/users/match-phones", matchPhonesRateLimit, async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [myProfile] = await db
    .select({ id: userProfilesTable.id })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, auth.userId))
    .limit(1);

  if (!myProfile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { hashes } = req.body as { hashes?: unknown };
  if (!Array.isArray(hashes) || hashes.length === 0) {
    res.json({ matches: [] });
    return;
  }

  const safeHashes: string[] = (hashes as unknown[])
    .filter((h): h is string => typeof h === "string" && h.length > 0)
    .slice(0, 50);

  if (safeHashes.length === 0) {
    res.json({ matches: [] });
    return;
  }

  // Only surface matches for users already visible to the caller via an
  // accepted friendship or a shared event. This mirrors the relationship-gating
  // policy on GET /users/:id and prevents the endpoint from acting as a
  // general phone-number→profile oracle for strangers.
  const callerEp = db
    .select({ eventId: eventParticipantsTable.eventId })
    .from(eventParticipantsTable)
    .where(eq(eventParticipantsTable.userId, myProfile.id));

  const matched = await db
    .select({
      id: userProfilesTable.id,
      displayName: userProfilesTable.displayName,
      handle: userProfilesTable.handle,
      avatarObjectPath: userProfilesTable.avatarObjectPath,
      bio: userProfilesTable.bio,
    })
    .from(userProfilesTable)
    .where(
      and(
        ne(userProfilesTable.id, myProfile.id),
        inArray(userProfilesTable.phoneNumberHash, safeHashes),
        or(
          // Accepted friendship in either direction
          exists(
            db
              .select({ x: sql`1` })
              .from(friendshipsTable)
              .where(
                and(
                  eq(friendshipsTable.status, "accepted"),
                  or(
                    and(
                      eq(friendshipsTable.requesterUserId, myProfile.id),
                      eq(friendshipsTable.addresseeUserId, userProfilesTable.id),
                    ),
                    and(
                      eq(friendshipsTable.addresseeUserId, myProfile.id),
                      eq(friendshipsTable.requesterUserId, userProfilesTable.id),
                    ),
                  ),
                ),
              ),
          ),
          // Shared event participation
          exists(
            db
              .select({ x: sql`1` })
              .from(eventParticipantsTable)
              .where(
                and(
                  eq(eventParticipantsTable.userId, userProfilesTable.id),
                  inArray(eventParticipantsTable.eventId, callerEp),
                ),
              ),
          ),
        ),
      ),
    );

  const withUrls = await Promise.all(
    matched.map(async (r) => {
      const avatarUrl = r.avatarObjectPath ? await signedAvatarUrl(r.avatarObjectPath) : null;
      return {
        id: r.id,
        displayName: resolveDisplayName(r.displayName, r.handle),
        handle: r.handle,
        avatarUrl,
        bio: r.bio ?? null,
      };
    }),
  );

  res.json({ matches: withUrls });
});

// ─── GET /users/:id (relationship-gated) ─────────────────────────────────────

router.get("/users/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid user id" }); return; }

  // Resolve caller's internal profile id
  const [myProfile] = await db
    .select({ id: userProfilesTable.id })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, auth.userId))
    .limit(1);

  if (!myProfile) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Self-lookup is always permitted
  if (myProfile.id !== id) {
    // Check for a friendship in either direction (any status — even pending
    // requests mean both parties already know of each other)
    const [friendship] = await db
      .select({ id: friendshipsTable.id })
      .from(friendshipsTable)
      .where(
        or(
          and(
            eq(friendshipsTable.requesterUserId, myProfile.id),
            eq(friendshipsTable.addresseeUserId, id),
          ),
          and(
            eq(friendshipsTable.requesterUserId, id),
            eq(friendshipsTable.addresseeUserId, myProfile.id),
          ),
        ),
      )
      .limit(1);

    if (!friendship) {
      // Check whether both users share at least one event.
      // Raw SQL is used for the self-join because Drizzle ORM does not support
      // aliased self-joins on the same table without extra boilerplate.
      const sharedEventResult = await db.execute(
        sql`SELECT 1 FROM event_participants ep1
            JOIN event_participants ep2
              ON ep1.event_id = ep2.event_id
            WHERE ep1.user_id = ${myProfile.id}
              AND ep2.user_id = ${id}
            LIMIT 1`,
      );

      if (sharedEventResult.rows.length === 0) {
        // Return 404 rather than 403 to avoid confirming the account exists
        res.status(404).json({ error: "User not found" });
        return;
      }
    }
  }

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.id, id))
    .limit(1);

  if (!profile) { res.status(404).json({ error: "User not found" }); return; }

  const avatarUrl = profile.avatarObjectPath
    ? await signedAvatarUrl(profile.avatarObjectPath)
    : null;

  res.json({
    id: profile.id,
    displayName: resolveDisplayName(profile.displayName, profile.handle),
    handle: profile.handle,
    avatarUrl,
    bio: profile.bio ?? null,
  });
});

// ─── DELETE /api/users/me ─────────────────────────────────────────────────────

router.delete("/users/me", requireAuthMiddleware, async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);

  if (!profile) {
    await (clerkClient as any).users.deleteUser(clerkUserId);
    res.json({ ok: true });
    return;
  }

  const userId = profile.id;

  try {
    await db.transaction(async (tx) => {
      await tx.delete(pushTokensTable).where(eq(pushTokensTable.userId, userId));
      await tx.delete(friendshipsTable).where(
        or(eq(friendshipsTable.requesterUserId, userId), eq(friendshipsTable.addresseeUserId, userId))
      );
      await tx.delete(itemAssignmentsTable).where(eq(itemAssignmentsTable.userId, userId));
      // Delete payment requests where this user is either the guest OR the host —
      // both FKs are onDelete: "restrict", so omitting either blocks profile deletion.
      await tx.delete(paymentRequestsTable).where(
        or(eq(paymentRequestsTable.guestUserId, userId), eq(paymentRequestsTable.hostUserId, userId))
      );
      await tx.delete(eventMessagesTable).where(eq(eventMessagesTable.userId, userId));
      await tx.delete(eventParticipantsTable).where(eq(eventParticipantsTable.userId, userId));
      await tx.delete(userProfilesTable).where(eq(userProfilesTable.id, userId));
    });
  } catch (err: any) {
    if (err.code === "23503") {
      res.status(409).json({ error: "Your account has active data that could not be removed automatically. Please contact support." });
      return;
    }
    throw err;
  }

  await (clerkClient as any).users.deleteUser(clerkUserId);

  res.json({ ok: true });
});

// ─── GET /users/me/financial-summary ─────────────────────────────────────────

router.get("/users/me/financial-summary", requireAuthMiddleware, async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const userId = profile.id;
  const guestProfile = aliasedTable(userProfilesTable, "guest_profile");
  const hostProfile = aliasedTable(userProfilesTable, "host_profile");

  const [asHostRows, asGuestRows] = await Promise.all([
    db
      .select({
        id: paymentRequestsTable.id,
        eventId: paymentRequestsTable.eventId,
        eventTitle: eventsTable.title,
        amountCents: paymentRequestsTable.amountCents,
        status: paymentRequestsTable.status,
        guestDisplayName: guestProfile.displayName,
        guestHandle: guestProfile.handle,
      })
      .from(paymentRequestsTable)
      .innerJoin(eventsTable, eq(eventsTable.id, paymentRequestsTable.eventId))
      .innerJoin(guestProfile, eq(guestProfile.id, paymentRequestsTable.guestUserId))
      .where(eq(paymentRequestsTable.hostUserId, userId)),

    db
      .select({
        id: paymentRequestsTable.id,
        eventId: paymentRequestsTable.eventId,
        eventTitle: eventsTable.title,
        amountCents: paymentRequestsTable.amountCents,
        status: paymentRequestsTable.status,
        hostDisplayName: hostProfile.displayName,
        hostHandle: hostProfile.handle,
      })
      .from(paymentRequestsTable)
      .innerJoin(eventsTable, eq(eventsTable.id, paymentRequestsTable.eventId))
      .innerJoin(hostProfile, eq(hostProfile.id, paymentRequestsTable.hostUserId))
      .where(eq(paymentRequestsTable.guestUserId, userId)),
  ]);

  const owedToMe = asHostRows
    .filter((r) => r.status === "requested" || r.status === "paid")
    .reduce((s, r) => s + r.amountCents, 0);

  const iOwe = asGuestRows
    .filter((r) => r.status === "requested")
    .reduce((s, r) => s + r.amountCents, 0);

  const totalHosted = asHostRows.reduce((s, r) => s + r.amountCents, 0);
  const totalSpent = asGuestRows.reduce((s, r) => s + r.amountCents, 0);

  const owedToMeBreakdown = asHostRows
    .filter((r) => r.status === "requested" || r.status === "paid")
    .map((r) => ({
      requestId: r.id,
      eventId: r.eventId,
      eventTitle: r.eventTitle,
      personName: r.guestDisplayName ?? `@${r.guestHandle}`,
      personHandle: r.guestHandle,
      amountCents: r.amountCents,
      status: r.status,
    }));

  const iOweBreakdown = asGuestRows
    .filter((r) => r.status === "requested")
    .map((r) => ({
      requestId: r.id,
      eventId: r.eventId,
      eventTitle: r.eventTitle,
      personName: r.hostDisplayName ?? `@${r.hostHandle}`,
      personHandle: r.hostHandle,
      amountCents: r.amountCents,
      status: r.status,
    }));

  res.json({ owedToMe, iOwe, totalHosted, totalSpent, owedToMeBreakdown, iOweBreakdown });
});

// ─── POST /api/users/push-token ──────────────────────────────────────────────

router.post("/push-token", async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, auth.userId))
    .limit(1);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const { token } = req.body as { token?: string };
  if (
    !token?.trim() ||
    (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken["))
  ) {
    res.status(400).json({ error: "Valid Expo push token required" }); return;
  }

  await db
    .insert(pushTokensTable)
    .values({ userId: profile.id, token: token.trim(), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [pushTokensTable.userId, pushTokensTable.token],
      set: { updatedAt: new Date() },
    });

  res.json({ ok: true });
});

export default router;
