# App Store Listing — invite

---

## App Name
**invite**

---

## Subtitle (30 chars max)
`Split bills, not friendships`
*(29 characters)*

---

## Description (~4000 chars max)

**Lead with the value prop:**

Going out with friends shouldn't end in an awkward silence when the check arrives. invite handles the whole night — from picking a restaurant together to splitting every last dollar on the receipt — so you can stay in the moment.

**Plan together.**
Create a dinner, rooftop party, or any group outing in seconds. Search for a venue, invite friends from your contacts or from the app, and let everyone vote on where to go. Once a spot is locked in, the event page becomes the one place your group coordinates — chat, RSVP, shared photos, and the bill all in one.

**Snap the receipt. Done.**
Point your camera at any receipt and invite's AI reads it instantly — every line item, tax, and total. No typing, no mental math. Items show up on screen ready to be claimed by whoever ordered them.

**Split it your way.**
Each person taps the items they ordered. Shared dishes split automatically. Tax and tip are distributed proportionally using precise rounding so every cent adds up. Hosts can bulk-assign unclaimed items or add walk-in guests who don't have the app.

**Collect what you're owed.**
Once the bill is settled, invite calculates exactly what each person owes and shows them how to pay — via Zelle or any payment method you've set up. No more chasing people down after the fact.

**Stay connected.**
Your friends list carries over from event to event. You'll see mutual connections, get suggestions based on shared contacts, and build a history of nights out together — so next time is even easier to plan.

---

## Keywords (100 chars max)
`bill splitter,receipt scanner,group dinner,split bill,restaurant,friends,Zelle,tip calculator`
*(94 characters)*

---

## Age Rating Questionnaire Answers

| Question | Answer |
|---|---|
| Cartoon or fantasy violence | None |
| Realistic violence | None |
| Sexual content or nudity | None |
| Profanity or crude humor | None |
| Mature or suggestive themes | None |
| Simulated gambling | None |
| Horror or fear themes | None |
| Medical or treatment information | None |
| Alcohol, tobacco, or drug use | None |
| Made for kids | No |
| **Resulting age rating** | **4+** |

---

## URLs

| Field | Value |
|---|---|
| Support URL | `mailto:support@invite.app` |
| Marketing URL | *(leave blank until a public marketing landing page is live)* |
| Privacy Policy URL | `https://owmo-9bwgw.replit.app/api/privacy` |

> **Privacy Policy:** The policy is served by the API server at `https://owmo-9bwgw.replit.app/api/privacy` (source: `artifacts/api-server/src/routes/privacy.ts`). It covers camera (receipt scanning), contacts (friend matching via SHA-256 hashing), location (venue search), push notifications, and all third-party services (Clerk, OpenAI, Google Places, Replit Object Storage, Expo). The page is publicly accessible — paste this URL directly into App Store Connect.

---

## App Category
**Primary:** Food & Drink
**Secondary:** Finance

---

## Copyright
`© 2026 invite`

---

## Icon Audit

| Check | Result |
|---|---|
| File | `assets/images/icon.png` |
| Dimensions | 1024 × 1024 px ✓ |
| Color mode | PNG color type 2 — RGB, no alpha channel ✓ |
| Pre-applied corner rounding | None ✓ (Apple applies the mask) |
| **Status** | **Ready for App Store Connect upload** |

> **Note:** The original icon had an alpha channel (RGBA, color type 6). It was converted to pure RGB (color type 2) using ImageMagick with a white background flatten, matching Apple's requirement. Verify visually that no important detail sits on transparency before uploading.

---

## Screenshots

Saved to `assets/screenshots/`. Three iPhone sizes are covered:

| Size | Dimensions | Device |
|---|---|---|
| `6.7in` | 1290 × 2796 px | iPhone 15 Pro Max |
| `6.1in` | 1179 × 2556 px | iPhone 15 |
| `5.5in` | 1242 × 2208 px | iPhone 8 Plus |

Six screens per size (18 files total):

| File pattern | Content | Source |
|---|---|---|
| `*_1-login.png` | Onboarding — "Split bills, not friendships" | **Real capture** from running Expo web app (390×844), banner-cropped and scaled to Apple dimensions via sharp |
| `*_2-home.png` | Home feed with upcoming events | High-quality SVG render at native Apple resolution via sharp/librsvg — accurate design tokens, layout, and typography |
| `*_3-bill.png` | Bill tab with scanned receipt items | High-quality SVG render — correct item assignment UI, totals, and sub-tab navigation |
| `*_4-scan.png` | AI receipt scanning in progress | High-quality SVG render — camera viewfinder, scan frame, receipt paper, AI progress banner |
| `*_5-payment-request.png` | Per-person payment breakdown | High-quality SVG render — per-person cards with amounts, Zelle links, send button |
| `*_6-friends.png` | Friends list and suggestions | High-quality SVG render — friend rows, mutual events, suggested friends, active Friends tab |

**Generator:** `assets/screenshots/generate-v2.js` — run with `node generate-v2.js` (requires `sharp` in the workspace root).

> **⚠️ Replace before App Store Connect upload:** Screen 1 (`*_1-login.png`) is a real capture from the running Expo web app. Screens 2–6 are high-quality SVG renders produced at the correct Apple pixel dimensions using the real app's design tokens and layout — they are not captured from an iOS Simulator or physical device. **Before uploading, replace all 18 files with screenshots taken from Xcode's iOS Simulator (or a physical device):**
> 1. Boot an iPhone 15 Pro Max (6.7"), iPhone 15 (6.1"), and iPhone 8 Plus (5.5") Simulator in Xcode
> 2. Install the app: `npx expo run:ios`
> 3. Navigate to each key screen and use **Device → Screenshot** (⌘S)
> 4. Save with the same naming convention: `<size>_<N>-<name>.png`

---

## App Store Connect Upload Checklist

- [ ] Log in to [App Store Connect](https://appstoreconnect.apple.com)
- [ ] Select the **invite** app (or create it with bundle ID `com.invite.app`)
- [ ] Go to **App Store → iOS App → Version Information**
- [ ] Paste the **name**, **subtitle**, **description**, and **keywords** from above
- [ ] Upload the **1024×1024 icon** (App Information → App Icon)
- [ ] Upload **screenshots** for each iPhone size under "App Previews and Screenshots"
- [ ] Complete the **Age Rating** questionnaire (answers above → result: 4+)
- [ ] Add **Support URL** and **Privacy Policy URL**
- [ ] Set **Primary Category** to Food & Drink
- [ ] Submit the build attached via Xcode / EAS Submit
