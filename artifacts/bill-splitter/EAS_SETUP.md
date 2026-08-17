# EAS Build & Submit Setup

One-time manual steps required before `eas build` and `eas submit` will succeed.
Work through these in order — each step unlocks the next.

---

## Step 1 — Create the EAS project and get a Project ID

```bash
cd artifacts/bill-splitter
npx eas-cli login        # log in to your Expo account (create one free at expo.dev if needed)
npx eas-cli init         # creates the project on Expo and prints the UUID
```

`eas init` writes the UUID into `app.json` automatically **and** prints it to the terminal.

Once you have the UUID, add it as a Replit secret so `app.config.js` picks it up at build time:

| Secret name      | Value                                      |
|------------------|--------------------------------------------|
| `EAS_PROJECT_ID` | The UUID printed by `eas init` (e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`) |

`app.config.js` reads this via `process.env.EAS_PROJECT_ID` and injects it into the built app.
The static placeholder in `app.json` is intentionally left as-is — `app.config.js` takes precedence
over `app.json` at build time, so only the Replit secret matters.

---

## Step 2 — Set up iOS Distribution Certificate & Provisioning Profile

EAS manages these for you automatically with `credentialsSource: "remote"` (already set in
`eas.json`). When you run your first production build, EAS will:

1. Generate a **Distribution Certificate** on your behalf (or let you upload an existing one).
2. Create an **App Store Distribution Provisioning Profile** tied to `com.invite.app`.
3. Store both securely in the EAS credentials store.

**Prerequisite:** Your Apple Developer account must be enrolled in the **Apple Developer Program**
($99/year) before any distribution certificate or provisioning profile can be created.

If you prefer to supply your own credentials:
```bash
npx eas-cli credentials --platform ios
# Choose: Distribution Certificate → Upload existing certificate
# Then:  Provisioning Profile → Upload existing profile
```

---

## Step 3 — Upload the APNs push notification key

Push notifications require an Apple Push Notification service (.p8) key.

**Option A — EAS dashboard (recommended):**
1. Go to https://expo.dev/accounts/[your-account]/projects/invite/credentials
2. Under **iOS → Push Notifications Key**, click **Add**.
3. Upload the `.p8` file and enter the Key ID and Apple Team ID.

**Option B — CLI:**
```bash
npx eas-cli credentials --platform ios
# Select: Push Notifications Key → Set up a new push key
```

Add two more Replit secrets:

| Secret name    | Value                                         |
|----------------|-----------------------------------------------|
| `APNS_KEY_ID`  | 10-character key ID from Apple Developer      |
| `APPLE_TEAM_ID`| Your 10-character Apple Developer Team ID     |

---

## Step 4 — Register the app in App Store Connect

1. Sign in to [App Store Connect](https://appstoreconnect.apple.com).
2. Click **+** → **New App** → platform: iOS, bundle ID: `com.invite.app`.
3. Note the **Apple ID** (numeric, e.g. `6743210987`) shown on the app's page.
4. Add it as a Replit secret:

| Secret name  | Value                                        |
|--------------|----------------------------------------------|
| `ASC_APP_ID` | Numeric App Store app ID from App Store Connect |

This is used by `eas submit` to know which App Store Connect listing to upload to
(configured in `eas.json` under `submit.production.ios.ascAppId`).

---

## Step 5 — Run a production build

Make sure all secrets from the steps above are set in Replit, then:

```bash
cd artifacts/bill-splitter
npx eas-cli build --platform ios --profile production
```

- Build number auto-increments on every production build (`ios.autoIncrement: true`).
- EAS streams logs to the terminal; the finished `.ipa` is uploaded to the EAS dashboard.
- A link to download the artifact is printed when the build completes.

---

## Step 6 — Submit to the App Store / TestFlight

After the build succeeds:

```bash
npx eas-cli submit --platform ios --profile production --latest
```

This uploads the `.ipa` to App Store Connect via the App Store Connect API.
The app will appear in TestFlight within a few minutes and in App Store review after you
submit it for review in App Store Connect.

---

## Required Replit secrets summary

| Secret name                        | Where it comes from                       | Used by           |
|------------------------------------|-------------------------------------------|-------------------|
| `EAS_PROJECT_ID`                   | `eas init` output                         | `app.config.js`   |
| `APPLE_TEAM_ID`                    | Apple Developer Portal → Membership       | build + submit    |
| `APNS_KEY_ID`                      | Apple Developer Portal → Keys             | build             |
| `ASC_APP_ID`                       | App Store Connect → App → Apple ID field  | `eas submit`      |
| `EXPO_PUBLIC_DOMAIN`               | Your deployed API hostname (no `https://`)| build             |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`| Clerk dashboard (production key)          | build             |
| `EXPO_PUBLIC_CLERK_PROXY_URL`      | `https://<domain>/api/__clerk`            | build             |

---

## Build profile reference

| Profile       | Distribution | Target                  |
|---------------|--------------|-------------------------|
| `development` | Internal     | iOS Simulator           |
| `preview`     | Internal     | Physical device (ad-hoc)|
| `production`  | Store        | App Store / TestFlight  |

---

## Remaining blockers before App Store review

See `BUILD_CHECKLIST.md` for the full pre-submission checklist. Key items:

- [ ] Privacy policy URL live at `https://<domain>/api/privacy`
- [ ] Age rating questionnaire completed in App Store Connect
- [ ] Export compliance declaration (HTTPS-only → exempt)
- [ ] App Store screenshots uploaded (6.7" and 5.5" iPhone required)
