---
name: Google Places integration
description: How places/search works — Google Places Text Search (New) primary, Nominatim fallback, destinationPlaceId stored end-to-end.
---

**Route:** `GET /api/places/search?q=&lat=&lng=&locationBias=` in `artifacts/api-server/src/routes/events.ts`

**Primary:** Google Places Text Search (New) API
- `POST https://places.googleapis.com/v1/places:searchText`
- Field mask: `places.id,places.displayName,places.formattedAddress,places.location`
- `X-Goog-Api-Key` header from `process.env.GOOGLE_PLACES_API_KEY` (Replit Secret, server-side ONLY)
- Location bias: circle with 15km radius around lat/lng when available
- Returns `{ placeId: place.id, name, address, lat, lng }`

**Fallback:** Nominatim (OpenStreetMap) — used when Google key is missing or Google request fails. Also still used for geocoding `locationBias` city/ZIP strings to lat/lng.

**Storage:** `destination_place_id TEXT` column added to `events` table. Stored through POST /events and PATCH /events/:id. Surfaced in GET /events list response and full event rows.

**Why:** Nominatim has poor coverage for restaurant/business name search; Google Places gives much better results. Nominatim is retained for city/ZIP geocoding (it's reliable there) and as a fallback.

**Data flow:** Mobile app → `searchPlaces()` → GET /places/search → Google → returns `placeId` → stored as `destinationPlaceId` on create/edit event.
