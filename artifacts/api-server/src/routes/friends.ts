import { Router } from "express";
import { getAuth } from "@clerk/express";
import { and, eq, inArray, or } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm";
import { db, friendshipsTable, userProfilesTable } from "@workspace/db";
import { resolveDisplayName } from "../lib/helpers";
import { signedAvatarUrl } from "../lib/gcs";

const router = Router();

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function resolveMyId(clerkUserId: string): Promise<number | null> {
  const [p] = await db
    .select({ id: userProfilesTable.id })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);
  return p?.id ?? null;
}

const req_profile = aliasedTable(userProfilesTable, "req_profile");
const addr_profile = aliasedTable(userProfilesTable, "addr_profile");

async function fetchFriendships(myId: number) {
  return db
    .select({
      friendshipId: friendshipsTable.id,
      requesterUserId: friendshipsTable.requesterUserId,
      addresseeUserId: friendshipsTable.addresseeUserId,
      status: friendshipsTable.status,
      source: friendshipsTable.source,
      createdAt: friendshipsTable.createdAt,
      reqId: req_profile.id,
      reqDisplayName: req_profile.displayName,
      reqEmail: req_profile.email,
      reqHandle: req_profile.handle,
      reqAvatarObjectPath: req_profile.avatarObjectPath,
      reqBio: req_profile.bio,
      addrId: addr_profile.id,
      addrDisplayName: addr_profile.displayName,
      addrEmail: addr_profile.email,
      addrHandle: addr_profile.handle,
      addrAvatarObjectPath: addr_profile.avatarObjectPath,
      addrBio: addr_profile.bio,
    })
    .from(friendshipsTable)
    .innerJoin(req_profile, eq(friendshipsTable.requesterUserId, req_profile.id))
    .innerJoin(addr_profile, eq(friendshipsTable.addresseeUserId, addr_profile.id))
    .where(
      and(
        or(
          eq(friendshipsTable.requesterUserId, myId),
          eq(friendshipsTable.addresseeUserId, myId),
        ),
        inArray(friendshipsTable.status, ["pending", "accepted"]),
      ),
    );
}

async function mapFriendshipRow(
  row: Awaited<ReturnType<typeof fetchFriendships>>[number],
  myId: number,
) {
  const amRequester = row.requesterUserId === myId;
  const otherAvatarPath = amRequester ? row.addrAvatarObjectPath : row.reqAvatarObjectPath;
  const avatarUrl = otherAvatarPath ? await signedAvatarUrl(otherAvatarPath) : null;

  const otherUser = {
    id: amRequester ? row.addrId : row.reqId,
    displayName: resolveDisplayName(
      amRequester ? row.addrDisplayName : row.reqDisplayName,
      amRequester ? row.addrHandle : row.reqHandle,
    ),
    handle: amRequester ? row.addrHandle : row.reqHandle,
    avatarUrl,
    bio: (amRequester ? row.addrBio : row.reqBio) ?? null,
  };

  return {
    friendshipId: row.friendshipId,
    status: row.status,
    source: row.source,
    amRequester,
    user: otherUser,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── GET /friends ─────────────────────────────────────────────────────────────

router.get("/friends", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const myId = await resolveMyId(clerkUserId);
  if (!myId) { res.status(404).json({ error: "Profile not found" }); return; }

  const rows = await fetchFriendships(myId);
  const mapped = await Promise.all(rows.map((r) => mapFriendshipRow(r, myId)));

  const strip = ({ amRequester: _, ...rest }: typeof mapped[number]) => rest;

  res.json({
    friends: mapped.filter((r) => r.status === "accepted").map(strip),
    incoming: mapped.filter((r) => r.status === "pending" && !r.amRequester).map(strip),
    outgoing: mapped.filter((r) => r.status === "pending" && r.amRequester).map(strip),
  });
});

// ─── POST /friends/request ────────────────────────────────────────────────────

router.post("/friends/request", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const myId = await resolveMyId(clerkUserId);
  if (!myId) { res.status(404).json({ error: "Profile not found" }); return; }

  const { addresseeId, source } = req.body as { addresseeId?: unknown; source?: unknown };
  if (typeof addresseeId !== "number" || !Number.isInteger(addresseeId)) {
    res.status(400).json({ error: "addresseeId (integer) is required" });
    return;
  }
  const resolvedSource = source === "contact_match" ? "contact_match" : "manual";

  if (addresseeId === myId) {
    res.status(400).json({ error: "Cannot send a friend request to yourself" });
    return;
  }

  const [addressee] = await db
    .select({ id: userProfilesTable.id })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.id, addresseeId))
    .limit(1);
  if (!addressee) { res.status(404).json({ error: "User not found" }); return; }

  // Check for any existing relationship in either direction
  const [existing] = await db
    .select()
    .from(friendshipsTable)
    .where(
      or(
        and(
          eq(friendshipsTable.requesterUserId, myId),
          eq(friendshipsTable.addresseeUserId, addresseeId),
        ),
        and(
          eq(friendshipsTable.requesterUserId, addresseeId),
          eq(friendshipsTable.addresseeUserId, myId),
        ),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.status === "accepted") {
      res.status(409).json({ error: "Already friends" });
      return;
    }
    // Same direction (me → them): duplicate pending
    if (existing.requesterUserId === myId && existing.status === "pending") {
      res.status(409).json({ error: "Friend request already sent" });
      return;
    }
    // Reverse pending (them → me): auto-accept
    if (existing.requesterUserId === addresseeId && existing.status === "pending") {
      await db
        .update(friendshipsTable)
        .set({ status: "accepted" })
        .where(eq(friendshipsTable.id, existing.id));
      res.json({ friendshipId: existing.id, status: "accepted", wasIncoming: true });
      return;
    }
  }

  const [created] = await db
    .insert(friendshipsTable)
    .values({ requesterUserId: myId, addresseeUserId: addresseeId, status: "pending", source: resolvedSource })
    .returning();

  res.status(201).json({ friendshipId: created.id, status: "pending" });
});

// ─── PATCH /friends/:id (accept or decline) ───────────────────────────────────

router.patch("/friends/:id", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const myId = await resolveMyId(clerkUserId);
  if (!myId) { res.status(404).json({ error: "Profile not found" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid friendship id" }); return; }

  const { action } = req.body as { action?: string };
  if (action !== "accept" && action !== "decline") {
    res.status(400).json({ error: "action must be 'accept' or 'decline'" });
    return;
  }

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(and(eq(friendshipsTable.id, id), eq(friendshipsTable.status, "pending")))
    .limit(1);

  if (!friendship) { res.status(404).json({ error: "Pending friend request not found" }); return; }

  if (friendship.addresseeUserId !== myId) {
    res.status(403).json({ error: "You can only respond to requests sent to you" });
    return;
  }

  if (action === "accept") {
    await db
      .update(friendshipsTable)
      .set({ status: "accepted" })
      .where(eq(friendshipsTable.id, id));
    res.json({ friendshipId: id, status: "accepted" });
  } else {
    await db.delete(friendshipsTable).where(eq(friendshipsTable.id, id));
    res.status(204).send();
  }
});

// ─── DELETE /friends/:id (cancel or remove) ───────────────────────────────────

router.delete("/friends/:id", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const myId = await resolveMyId(clerkUserId);
  if (!myId) { res.status(404).json({ error: "Profile not found" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid friendship id" }); return; }

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.id, id))
    .limit(1);

  if (!friendship) { res.status(404).json({ error: "Friendship not found" }); return; }

  const isRequester = friendship.requesterUserId === myId;
  const isAddressee = friendship.addresseeUserId === myId;

  if (!isRequester && !isAddressee) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  if (friendship.status === "pending" && !isRequester) {
    res.status(403).json({ error: "Only the sender can cancel a pending request" });
    return;
  }

  await db.delete(friendshipsTable).where(eq(friendshipsTable.id, id));
  res.status(204).send();
});

export default router;
