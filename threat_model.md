# Threat Model

## Project Overview

Invite is a mobile bill-splitting application with an Expo client and a public Express API backed by PostgreSQL, Clerk authentication, Replit Object Storage, Google Places, and OpenAI OCR. Users create events, invite participants, upload receipt photos, assign items, and send payment requests to other participants.

Production scope for security review is the deployed API in `artifacts/api-server/` plus the mobile client flows that drive it in `artifacts/bill-splitter/`. The mockup sandbox is development-only and should be ignored unless production reachability is demonstrated. Assume `NODE_ENV=production` in production and that TLS is handled by the platform.

## Assets

- **User accounts and sessions** — Clerk identities and the server-side authorization decisions derived from them. Compromise allows impersonation across all event and payment flows.
- **Event membership and invite state** — host, participant, accepted, invited, and declined roles determine access to receipts, chat, photos, and billing actions. Mistakes here become broken access control.
- **Receipt data and receipt photos** — uploaded receipt images, OCR output, item assignments, subtotals, fees, and totals. These can reveal private spending and group participation.
- **Payment destination data** — Cash App, Venmo, and Zelle destinations shown to other users when settling balances. Tampering here can redirect money.
- **Application secrets and paid API capability** — database credentials, Clerk proxy secret, Google Places API key, and OpenAI integration credentials. Abuse can expose data or create billing impact.
- **Private object storage paths and signed URLs** — avatar, event photo, and receipt photo object references plus signed download URLs. These must only be issued to authorized users.

## Trust Boundaries

- **Mobile client to API** — all request bodies, params, and headers are untrusted. The server must authenticate and authorize every sensitive route.
- **Public internet to public endpoints** — the deployment is public, so any unauthenticated route is internet-reachable and must resist abuse, enumeration, and quota exhaustion.
- **Reverse proxy headers to auth routing** — raw `X-Forwarded-*` values must be treated as attacker input unless derived through the platform or Express trust-proxy helpers. Authentication, proxying, and host-based key selection must not trust directly supplied forwarded headers.
- **API to PostgreSQL** — the API has full data access; injection or authorization mistakes at the route layer can expose all app data.
- **API to object storage sidecar / GCS** — the API can create signed URLs and manipulate private files. Authorization must be enforced before signing or streaming objects.
- **API to third-party services** — Google Places and OpenAI calls spend external quota and process user data. Inputs and access must be constrained to prevent abuse and disclosure.
- **Authenticated user to privileged event role** — hosts can mutate billing state, generate join codes, and invite/remove participants. Those actions must not be reachable by invited, declined, or unrelated users.

## Scan Anchors

- Production server entry points: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*.ts`
- Highest-risk code areas: `artifacts/api-server/src/routes/events.ts`, `artifacts/api-server/src/routes/paymentRequests.ts`, `artifacts/api-server/src/routes/users.ts`, storage helpers in `artifacts/api-server/src/lib/gcs.ts` and `artifacts/api-server/src/lib/objectStorage.ts`
- Public surface: `GET /healthz`, `GET /join/:code`, `GET /places/photos`, and Clerk proxy handling in `/api/__clerk`
- Authenticated surface: user profile, friends, places search/details, event detail/chat/billing/photo routes, payment request routes
- Invitation policy anchor: `POST /events` and `POST /events/:eventId/invitations` must enforce the same server-side rules for who may be invited, especially for private events
- Privacy and abuse anchors: `POST /users/match-phones` for contact discovery, photo upload routes under `/events/:eventId/photos` and `/events/:eventId/receipt/photos`, OCR scan route `/events/:eventId/receipt/photos/:photoId/scan`, and payment-request ownership after `/events/:eventId/transfer-host`
- Dev-only areas to usually ignore: `artifacts/mockup-sandbox/`, build scripts under `artifacts/bill-splitter/scripts/`

## Threat Categories

### Spoofing

The application relies on Clerk-authenticated requests to bind actions to a specific profile. Every protected API route must require a valid Clerk identity and must resolve the acting profile from that identity rather than trusting client-supplied identifiers or profile metadata.

Payment-destination metadata must not be treated as trustworthy simply because a logged-in user set it. The system must prevent users from presenting unverified or attacker-controlled payment destinations as trusted destinations for others.

### Tampering

Hosts can mutate receipts, participant assignments, payment requests, and event membership. Those state transitions must be enforced server-side with role checks tied to the current event, and cross-event identifiers must be rejected.

User-controlled inputs that influence storage object selection, payment destinations, join codes, invitation targets, or third-party API requests must be validated so that users cannot tamper with other users' data or misuse server-side capabilities.

### Information Disclosure

Receipt photos, OCR outputs, event membership, chat messages, payment requests, and private object URLs contain sensitive personal and financial context. They must only be returned to users whose current event role permits access.

Signed URLs and image streaming endpoints are especially sensitive because they bypass normal application routing once issued. The API must not issue or proxy private object access for merely invited, declined, or unrelated users.

Contact-discovery data is also sensitive. Deterministic phone-number hashes and the profile records they unlock must not become a general membership-testing oracle for any authenticated account.

Per the product privacy policy, basic profile fields such as display name, handle, avatar, and bio are intentionally discoverable to authenticated users through social search and invite flows. Do not re-propose that visibility as a vulnerability unless additional sensitive fields or broader non-user-disclosed data become exposed.

Minimal metadata preview for someone who already possesses an active event share code is treated as intentionally disclosed invitation context. Only report this area if private-event join restrictions are bypassed, share codes become enumerable, or the preview expands beyond the minimal intended fields.

Error responses should avoid exposing internal stack traces, secrets, or provider-specific details beyond what is necessary for users to recover.

### Denial of Service

Because the deployment is public, unauthenticated endpoints and third-party API proxy routes can be abused for quota exhaustion or resource consumption. Public routes that invoke paid or rate-limited upstream services must be constrained so internet traffic cannot burn external quota or degrade service for legitimate users.

Upload, OCR, Places proxy, and image-processing flows must remain bounded in size and invocation rate so authenticated abuse cannot overwhelm the API or downstream services or burn paid upstream quota. In particular, upload limits must take effect before large request bodies are fully buffered, and duplicate or immediately rejected scan requests must not consume shared OCR budget.

### Elevation of Privilege

The main privilege boundary is between non-members, invited/declined users, active participants, and hosts. The system must ensure that limited roles cannot reach receipt data, billing controls, item assignment operations, host-only actions, or private object downloads that are intended only for active participants or hosts.

Private-event invitation controls must be enforced consistently across every mutation path, including event creation and later invitation endpoints, so hosts cannot use one route to bypass restrictions that another route correctly enforces.

Financial-control ownership must follow the current host role, not stale row ownership captured before a host transfer. Payment-request mutations and confirmation flows must re-authorize against the event's current host.

All database interactions must remain parameterized or ORM-driven, and any route that accepts object IDs must verify that those IDs belong to the current event before acting on them.
