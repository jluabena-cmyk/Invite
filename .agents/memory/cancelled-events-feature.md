---
name: Cancelled events acknowledgement
description: How per-user dismissal of cancelled events works end-to-end
---

## Rule
Cancelled events stay on the Home screen until the user taps "Dismiss".
After dismissal they move to the Cancelled Events page (acknowledged log).

**Why:** UX requirement — users shouldn't lose history of cancelled events,
but also shouldn't be permanently confronted with them on the home feed.

## How to apply
- DB column: `event_participants.cancelled_acknowledged_at TIMESTAMP`
- GET /events WHERE clause: `OR(cancelledAt IS NULL, cancelledAcknowledgedAt IS NULL)`
  so unacknowledged cancelled events still appear on Home
- GET /events/cancelled returns: `cancelledAt IS NOT NULL AND cancelledAcknowledgedAt IS NOT NULL`
- PATCH /events/:eventId/cancelled-acknowledgement sets the timestamp (idempotent)
- Both new routes MUST be registered before `/:eventId` in events.ts to avoid Express matching them as event IDs
- Optimistic update on Home: remove card from cache immediately, roll back on error, invalidate both events + cancelled-events query keys on settle
