# invite — App Store Metadata Draft

Use this as a working draft for App Store Connect and Google Play Console listings.
All fields are editable — update before submission.

---

## App identity

| Field | Value |
|---|---|
| **App name** | invite |
| **Bundle ID** | com.invite.app |
| **Primary category** | Food & Drink |
| **Secondary category** | Finance (or Utilities) |

---

## Subtitle options

Pick one (30 character limit each):

1. `Split bills, not friendships`
2. `Group dining made easy`
3. `Snap receipts. Split fairly.`
4. `The honest way to split bills`

---

## Short description (80 characters — Google Play)

> Scan receipts, assign items, and settle up after group dinners — no math needed.

---

## Full description (up to 4,000 characters — App Store / Google Play)

> Going out to eat with friends is great. Splitting the bill isn't.
>
> invite makes it easy. Snap a photo of the receipt, let invite read the items, and assign each dish to the person who ordered it. Everyone sees exactly what they owe — no arguments, no calculator.
>
> **How it works**
> 1. Create an event and pick a restaurant
> 2. Share the invite link — friends join in one tap
> 3. Snap the receipt — invite reads the items automatically
> 4. Assign items to the right person
> 5. See who owes what, and how to pay
>
> **Features**
> - Automatic receipt scanning with OCR
> - Works at any restaurant — any receipt
> - Simple invite links that open directly in the app
> - No accounts required for guests to join and view
> - No payment processing — you settle with your preferred app (Venmo, Zelle, Cash App, etc.)
>
> invite does not process payments. It only tracks who ordered what.

---

## Keywords (App Store — 100 character limit, comma-separated)

```
bill split,receipt scanner,group dinner,dinner split,tab split,split check,restaurant,OCR receipt
```

Alternative keywords to rotate in:
- `venmo calculator`
- `group tab`
- `dinner bills`
- `split restaurant bill`
- `receipt divider`

---

## What's New (first release)

> First release of invite — snap receipts, assign items, and see exactly who owes what after group dinners. No math required.

---

## Privacy & data

- **Privacy policy URL:** _(TODO — host at `https://<BACKEND_DOMAIN>/privacy`)_
- **Data collected:** name, email, event details, receipt photos, optional location for restaurant search
- **No payment data collected** — invite does not process or store card or bank information
- **Location usage:** optional, for restaurant search only (not stored)

See `docs/privacy-policy-todo.md` for full data inventory.

---

## Beta positioning

This is a TestFlight beta. Expected audience: friends and early adopters comfortable with rough edges.

Beta notes to include in TestFlight "What to Test":
- Receipt scanning accuracy (especially multi-page and dark/blurry receipts)
- Invite link flow from a clean device (no prior app install)
- Location permission prompt and restaurant search
- Bill assignment on large group events (8+ people)
- Report any crash, freeze, or wrong total

---

## Support contact

- **Support URL:** _(TODO — add a contact page or email address)_
- **Marketing URL:** _(optional — can be same as support URL for initial release)_

---

## Age rating

Expected rating: **4+** (no objectionable content, no in-app purchases at launch)

Complete the age rating questionnaire in App Store Connect. Select "No" for all sensitive content categories.

---

## Pricing

- Free at launch
- No in-app purchases initially
- _(Revisit if monetization is added later)_
