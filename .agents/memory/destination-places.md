---
name: Destination/places search pattern
description: How location search is implemented — Nominatim proxy, DB column naming, client function shape.
---

## Pattern
- Backend proxy: `GET /api/places/search?q=&lat=&lng=` in events.ts router
- Nominatim (OpenStreetMap) — no API key needed; `User-Agent` header required
- viewbox bias when lat/lng provided (`lngN±1, latN±1`, bounded=0)
- Returns `[{ placeId, name, address, lat, lng }]` — name = first CSV segment of display_name

## DB column naming
- `restaurant_name` column kept as-is (not renamed) — stores destination name
- New columns added: `destination_address text`, `destination_lat real`, `destination_lng real`
- `real` type IS available in `drizzle-orm/pg-core` (import as `real`)

## API client
- `searchPlaces(q, lat?, lng?)` is a raw async function in api.ts (NOT a React Query hook)
- Exported from package via `export *` from generated/api — no extra index change needed
- `PlaceResult` interface added to api.schemas.ts

**Why:** Raw function needed for debounce-triggered imperative calls; hooks are for declarative data fetching.

## Frontend UX (index.tsx)
- 300ms debounce, 2-char min, max 5 inline results (not absolutely positioned)
- Location permission requested once on field focus; denial shows non-blocking hint
- Field becomes read-only when a result is selected; × button to clear
- Create button disabled until destinationQuery has content
