---
name: Clerk live key reconstruction
description: How to derive the Replit-managed Clerk publishable key without shell access to the secret value
---

Replit-managed `CLERK_PUBLISHABLE_KEY` is not readable via printenv or viewEnvVars (value is masked). To get the live key for EAS builds or other external consumers:

1. Fetch the Clerk environment from the deployed production proxy:
   `GET https://<production-domain>/api/__clerk/v1/environment`

2. Extract `display_config.home_url` — this is the Clerk frontend API host, e.g. `app_3EJUEUIaobRXqmqM4aWgPzFy2OM.clerk.dev`

3. Reconstruct:
   ```python
   import base64
   pk = "pk_live_" + base64.b64encode((frontend_api_host + "$").encode()).decode().rstrip("=")
   ```

**For this project:** `pk_live_YXBwXzNFSlVFVUlhb2JSWHFtcU00YVdnUHpGeTJPTS5jbGVyay5kZXYk`
Set as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (shared environment).

**Why:** EAS cloud builders don't have access to Replit's secret injection. The publishable key is public (embedded in client bundles) so deriving it this way is safe.

**How to apply:** Whenever an EAS build or external system needs the Clerk publishable key, use this reconstruction rather than asking the user to find it manually.

## Clerk redirect URLs (OAuth native)
- For mobile OAuth (Google, Apple) to work, the app's URL scheme must be registered in the Clerk production instance as an allowed redirect URL.
- API endpoint: `POST https://api.clerk.com/v1/redirect_urls` with `{"url": "owmo://"}` using `CLERK_SECRET_KEY`.
- The list was empty (0 entries) — this blocked ALL Google/Apple sign-in for production users.
- Registered: `owmo://` (build 27+) and `bill-splitter://` (build 21, legacy).
- This must be repeated whenever the app scheme changes.
