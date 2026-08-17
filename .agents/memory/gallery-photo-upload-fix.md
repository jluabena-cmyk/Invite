---
name: Gallery photo upload fix
description: Root causes for photos not loading in the photos tab and the bill tab, and what was fixed.
---

# Gallery Photo Upload Fix

## Root causes

### 1. Old multipart `POST /events/:eventId/photos` endpoint still alive
After the presigned-URL flow was added (task #422), the old multipart gallery upload endpoint was never removed. Any TestFlight build predating the client-side presigned changes would call that endpoint — and the reverse proxy drops large multipart POST bodies, so uploads silently failed.

**Fix:** Removed the old multipart endpoint. Only the presigned flow remains:
- `POST /events/:eventId/photos/upload-url` → signed GCS PUT URL + HMAC token
- Direct PUT to GCS (bypasses proxy)
- `POST /events/:eventId/photos/confirm` → DB record + signed download URL

### 2. Signed download URLs expired in 5 minutes
Both `signDownloadUrl` in `events.ts` and `lib/gcs.ts` used `Date.now() + 300_000`. React Query caches event data; if the page stayed open longer than 5 minutes, all photo thumbnails went blank.

**Fix:** Changed expiry to `Date.now() + 3_600_000` (1 hour) in both locations.

**Why:** React Query's stale time for event data is several minutes; a 5-minute URL expiry races with the cache. 1 hour gives plenty of headroom without meaningfully weakening security (URLs are signed and single-use in practice).
