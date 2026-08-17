# invite — Production Build Checklist

Work through this list in order before running an EAS production build.
Nothing here deploys or submits automatically — every step requires a manual action.

---

## Phase 1 — Deploy the backend first

- [ ] Deploy `artifacts/api-server` to Replit (or another host).
- [ ] Confirm the deployment is healthy:
  ```
  curl https://<BACKEND_DOMAIN>/api/healthz
  # Expected: {"status":"ok"}
  ```
- [ ] Note the backend domain (e.g. `my-api.replit.app`). You will use it in the steps below.

---

## Phase 2 — Set production env vars in eas.json

Open `artifacts/bill-splitter/eas.json` and fill in the `production.env` block:

| Key | Value |
|---|---|
| `EXPO_PUBLIC_DOMAIN` | Backend hostname only — no `https://`, no trailing slash. Example: `my-api.replit.app` |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Production Clerk publishable key (`pk_live_...`) |
| `EXPO_PUBLIC_CLERK_PROXY_URL` | Full URL: `https://<BACKEND_DOMAIN>/api/__clerk` |

These are **not secrets** — they are baked into the app bundle and visible to end users. Committing them is safe.

---

## Phase 3 — Update expo-router origin

In `artifacts/bill-splitter/app.json`, update the expo-router plugin entry:

```json
["expo-router", { "origin": "https://<BACKEND_DOMAIN>" }]
```

Replace `<BACKEND_DOMAIN>` with the same hostname used for `EXPO_PUBLIC_DOMAIN`.

---

## Phase 4 — Run the EAS production build

```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Log in to your Expo account
eas login

# Build for both platforms
eas build --platform all --profile production
```

For iOS only: `--platform ios`
For Android only: `--platform android`

---

## Phase 5 — TestFlight smoke test checklist

After the iOS build is available in TestFlight, verify the following on a real device:

### Auth
- [ ] App opens and shows sign-in screen
- [ ] Sign in with email / Google / Apple works
- [ ] Token is persisted (reopen app — stays signed in)

### Events
- [ ] Create a new event (name, restaurant search, date/time)
- [ ] Event appears in the home tab
- [ ] Invite link generates and copies correctly (`invite://join/<code>`)
- [ ] A second device can open the invite link and join the event

### Receipts
- [ ] Camera opens when tapping the camera button
- [ ] Photo library opens when tapping the library button
- [ ] Receipt photo quality check alert appears (Retake / Use Anyway)
- [ ] OCR runs and line items appear
- [ ] OCR failure shows 3-button recovery alert (Try Again / Take New Photo / Add Manually)
- [ ] Manual item entry works

### Bill split
- [ ] Assign items to attendees
- [ ] Totals update correctly
- [ ] All-unclaimed → me bulk assign works (ActivityIndicator shows)
- [ ] Clear button works (ActivityIndicator shows)
- [ ] Add another receipt photo option works

### Location
- [ ] Location permission prompt appears on first use
- [ ] Restaurant search returns results
- [ ] Selecting a restaurant fills in event details

### Navigation
- [ ] Bottom tabs work (Home, Profile)
- [ ] Event detail opens from home list
- [ ] Back navigation works throughout
- [ ] Cancelled events list is accessible

---

## Phase 6 — Payment deep-link verification

Venmo and Cash App URI schemes are undocumented and can break silently after
either app updates. Run this check before every TestFlight and App Store submission.

### 6a — Automated (run in CI or locally before building)

```bash
cd artifacts/bill-splitter && pnpm test utils/__tests__/paymentMessage.test.ts
```

The `pickPaymentLink — deep-link URI scheme regression` suite pins the exact
URL shape. A failure means the scheme may have changed — verify manually before
shipping.

### 6b — Manual device check (physical iOS device)

**Setup:** Add your own Venmo handle and Cash App handle to your profile in the app, then create a test event with yourself and one other participant and assign a $0.01 item to them. Send them a payment request from the Balances tab so the SMS lands on a device you control.

**Venmo check** (device must have Venmo installed):

| # | Action | Expected result |
|---|--------|-----------------|
| 1 | Tap the Venmo deep link in the payment SMS | Venmo opens on the **payment-confirmation screen** with the recipient handle and amount pre-filled |
| 2 | Confirm the amount shown matches the $0.01 test amount | Amount is pre-filled — NOT showing $0 or blank |
| 3 | Confirm it goes to the right recipient handle | Handle matches the host's Venmo handle |

**Cash App check** (device must have Cash App installed):

| # | Action | Expected result |
|---|--------|-----------------|
| 4 | Set host preferred method to Cash App, re-send the request, tap the Cash App deep link | Cash App opens on the **payment screen** with handle and amount pre-filled |
| 5 | Confirm the amount shown matches the $0.01 test amount | Amount is pre-filled — NOT showing $0 or blank |

**App-not-installed check:**

| # | Action | Expected result |
|---|--------|-----------------|
| 6 | Tap a `venmo://` link on a device without Venmo installed | iOS shows "Cannot Open Page" or "No App Found" alert — the app should not crash and should not silently do nothing with no feedback |

> **Note:** iOS does **not** automatically redirect to the App Store for unregistered custom URL schemes — that only happens with universal links or explicit App Store URLs. Steps 6's expected result is a system alert, not an App Store redirect. If you want to handle this gracefully in-app, see the follow-up task for `Linking.canOpenURL` preflight checks.

**If step 1 or 4 opens only a profile page** (no amount pre-fill), the URI
scheme broke upstream. Common causes after a Venmo/Cash App update:

- Venmo: `paycharge` path renamed, or `txn=pay` / `recipients` param changed
- Cash App: `/pay/` path renamed, or `amount` param renamed

File a task to investigate the updated scheme before releasing.

---

## Remaining blockers before App Store (not TestFlight)

- [ ] Privacy policy URL — required for App Store submission (see `docs/privacy-policy-todo.md`)
- [ ] Support contact — email or URL
- [ ] Age rating questionnaire in App Store Connect
- [ ] Export compliance (if using any encryption beyond HTTPS — declare exemption)
