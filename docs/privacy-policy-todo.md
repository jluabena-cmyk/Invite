# invite — Privacy Policy TODO

This document describes what data invite collects and how it is used.
Use this as the source of truth when drafting a formal privacy policy.
A formal privacy policy page (web URL) is required before App Store submission.

---

## What invite collects

### Identity & account data
- **Name / display name** — entered by the user during account setup or profile edit
- **Email address** — collected through the Clerk authentication flow
- **Authentication credentials** — managed by Clerk; invite does not store passwords

### Event data
- **Event name, date, and time** — created by the host
- **Restaurant / venue name and location** — selected via Google Places (name + address stored per event)
- **Event attendee list** — who joined via invite link

### Location data
- **Location search terms** — text typed into the restaurant search field (processed by Google Places API, not stored by invite)
- **Device GPS location** — requested optionally when the user taps "Use my location" in restaurant search; used only to bias search results; not logged or stored

### Receipt data
- **Receipt photos** — uploaded by the host; stored in Replit Object Storage
- **OCR-extracted line items** — text and amounts parsed from receipt photos by OCR; stored per event
- **Item assignments** — which attendee is assigned to which line item

### Payment / settlement data
- **Payment handles** — e.g. Venmo usernames or other handles entered by the host for settlement instructions; stored as plain text per event
- **No financial data is collected or processed** — invite does not handle card numbers, bank accounts, ACH, or any monetary transactions; it only records who owes what and where to pay

### Messaging
- _(If in-app chat is added in a future version, update this section)_
- No in-app messaging currently exists

---

## What invite does NOT collect or do

- invite does not process payments
- invite does not store card numbers or bank account details
- invite does not sell or share user data with advertisers
- invite does not run analytics beyond what Expo/Clerk provide by default

---

## Third-party services

| Service | What it receives | Link |
|---|---|---|
| Clerk | Email, auth tokens, session metadata | https://clerk.com/privacy |
| Google Places API | Restaurant search text, optional device location | https://policies.google.com/privacy |
| Replit Object Storage | Receipt photo files | https://replit.com/privacy |
| Expo / EAS | App telemetry, crash reports (if enabled) | https://expo.dev/privacy |

---

## Data retention

- Event data and receipt photos are retained until the host deletes the event
- User account data is retained until the user deletes their account
- Define and document a deletion flow before App Store submission

---

## Action items before App Store submission

- [ ] Draft a formal privacy policy based on this document
- [ ] Host the privacy policy at a public URL (e.g. `https://<BACKEND_DOMAIN>/privacy`)
- [ ] Add the privacy policy URL to App Store Connect
- [ ] Add a "Delete my account" option in the app (required by App Store guidelines)
- [ ] Confirm Expo crash reporting opt-in/opt-out behavior and disclose it
- [ ] Confirm Google Places API data retention terms apply and are disclosed
