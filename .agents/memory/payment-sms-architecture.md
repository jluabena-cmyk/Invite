---
name: Payment SMS architecture
description: How the SMS payment request feature works, why phone numbers are now stored raw, and the two-tier guest system.
---

# Payment SMS architecture

## Two-tier guest system
- **App users** — tracked via `payment_requests` table (has `guestUserId`). Phone stored as hash only for contact-matching privacy. SMS uses share sheet fallback.
- **Non-app guests** — tracked via `guest_participants` / `saved_guests` (has `guestParticipantId`). Raw phone stored in `saved_guests.phone_number`. SMS via `SMS.sendSMSAsync`.

## Phone number storage decision
Raw `phone_number` added to `user_profiles` table (migration: `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone_number text`). Stored in plaintext like Venmo/Cash App handles — user opts in, shared with event hosts only. Hash (`phone_number_hash`) still used for contact-matching. Privacy policy will need updating before next App Store submission.

**Why:** Without raw phone, host share button can't pre-fill the SMS recipient for app users. Non-app guests already had raw phone. Hashing was a contact-discovery privacy measure, not a payment-UX constraint.

## SMS message format
Both tiers get the same personalized message:
```
Hi [Name]! You owe $X.XX for [Event Name].

Venmo → https://venmo.com/u/{handle}?txn=pay&amount=X.XX&note={event}
Cash App → https://cash.app/${handle}/X.XX
Zelle → send $X.XX to {zelleInfo}

Full summary: {url}   ← non-app guests only
```

## Key files
- `lib/db/src/schema/userProfiles.ts` — `phoneNumber` field added
- `artifacts/api-server/src/routes/users.ts` — PATCH stores raw phone; GET returns it
- `artifacts/api-server/src/routes/paymentRequests.ts` — host query includes `guestPhoneNumber`
- `artifacts/bill-splitter/vendor/api-client-react/src/generated/api.schemas.ts` — `UserProfile.phoneNumber`, `UpdateUserRequest.phoneNumber`, `PaymentRequest.guestPhoneNumber`
- `artifacts/bill-splitter/app/(tabs)/profile.tsx` — save sends raw phone alongside hash; remove clears both
- `artifacts/bill-splitter/app/event/[id].tsx` — chatbubble icon = has phone (opens SMS directly); share icon = no phone (share sheet)

## Venmo/Cash App deep link formats
- Venmo: `https://venmo.com/u/{handle}?txn=pay&amount={X.XX}&note={encodedNote}` (strip leading `@`)
- Cash App: `https://cash.app/${handle}/{X.XX}` (ensure leading `$`)
- Zelle: no deep link exists — plain text only
