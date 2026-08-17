# invite — Setup Guide

## Sign in with Apple (Clerk Dashboard)

Sign in with Apple requires manual configuration in your Clerk dashboard before it will work in production builds.

### Steps

1. **Apple Developer Portal**
   - Sign in to [developer.apple.com](https://developer.apple.com).
   - Under **Certificates, Identifiers & Profiles → Identifiers**, locate your App ID (`com.invite.app`) and enable the **Sign In with Apple** capability.
   - Create a **Services ID** (e.g. `com.invite.app.signin`) — this is your Apple Services ID / Client ID.
   - Under the Services ID, configure **Sign In with Apple** and add the Clerk-provided redirect URL as a Return URL (you get this from the Clerk dashboard in step 3).

2. **Generate an Apple Private Key**
   - In the Apple Developer Portal under **Keys**, create a new key with **Sign In with Apple** enabled.
   - Associate it with your App ID.
   - Download the `.p8` key file (you can only download it once).
   - Note the **Key ID** shown.

3. **Configure Apple OAuth in Clerk**
   - Go to your [Clerk Dashboard](https://dashboard.clerk.com) → **User & Authentication → Social Connections**.
   - Enable **Apple** as a provider.
   - Enter:
     - **Services ID** (from step 1)
     - **Team ID** (your 10-character Apple Developer Team ID)
     - **Key ID** (from step 2)
     - **Private Key** (contents of the `.p8` file from step 2)
   - Copy the **Authorized redirect URI** that Clerk displays and add it to your Apple Services ID Return URLs (step 1).

4. **EAS Build**
   - The `com.apple.developer.applesignin` entitlement is already declared in `app.json`.
   - Run `eas build` — EAS will automatically include the entitlement in the provisioning profile when the capability is enabled on your App ID (step 1).

### Notes

- Sign in with Apple only appears in the app on iOS (`Platform.OS === "ios"`). This matches Apple's requirement that it appears wherever other third-party social logins are shown.
- No code changes are needed once the Clerk dashboard is configured — the `oauth_apple` strategy is already wired up in the sign-in and sign-up screens.
