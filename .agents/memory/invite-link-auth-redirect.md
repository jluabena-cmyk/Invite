---
name: Invite Link Auth Redirect
description: How the join-via-link flow threads auth redirects and what's intentionally public.
---

# Invite Link Auth Redirect Pattern

## The rule
`GET /api/join/:code` has NO auth guard — it returns a public event preview (name, host, participant count) so the join screen can render before the user signs in.

`POST /api/events/join` requires auth (as before).

## Auth redirect threading
`app/join/[code].tsx` uses `useAuth().isLoaded/isSignedIn`. If not signed in after Clerk loads, it calls:
```ts
router.replace(`/(auth)/sign-in?redirect=/join/${code}`)
```

Both `sign-in.tsx` and `sign-up.tsx` read `useLocalSearchParams<{ redirect?: string }>()` and after every successful auth path (email+password, MFA verify, Google SSO) navigate to `redirectPath` instead of the old hardcoded `"/"`.

The sign-in ↔ sign-up cross-links also thread the param:
```tsx
<Link href={{ pathname: "/(auth)/sign-up", params: { redirect: redirectPath } }}>
```

**Why:** Without this, a user following a deep link who isn't signed in gets dropped at the home tab after auth, losing the join context.

## Auto-friend on join
After a successful participant insert in `POST /events/join`, the route finds the host and upserts a friendship:
- No existing row → insert `{ requesterUserId: joiner, addresseeUserId: host, status: "pending" }`
- Host had a pending request toward joiner → update to `"accepted"`
- Already friends or same-direction pending → skip

## Deep link scheme
Share message uses `bill-splitter://join/${code}` as the deep link. Expo Router handles this via the `app/join/[code].tsx` file-based route.
