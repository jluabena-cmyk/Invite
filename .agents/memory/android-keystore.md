---
name: Android keystore for com.owmo.app
description: How the Android release keystore was created and uploaded to EAS for the Owmo app.
---

# Android Keystore — com.owmo.app

## How it was created
No Java/keytool was available in the Replit environment, so the keystore was generated using OpenSSL (PKCS12 format) and uploaded to EAS via the GraphQL API.

## EAS credential IDs
- Keystore ID: `fc991616-7eff-4d22-a3aa-eb6e848b50a5`
- AndroidAppCredentials ID: `34ee7fb7-3fcf-4e98-89d5-c2425c8f7a30`
- AndroidAppBuildCredentials ID: `7df5c3d2-fc4e-4b2c-83c4-927a704876a4` (set as default)

## SHA-1 fingerprint
`BB:D5:4D:55:63:7F:96:8C:63:60:BB:32:EF:EA:29:01:5C:4C:94:30`

This SHA-1 was registered in Google Cloud Console as an Android OAuth 2.0 client for package `com.owmo.app`.

## Key alias
`owmo-key`

## Important notes
- The keystore passwords are stored only in EAS (not recoverable from this repo)
- To view/export credentials: `eas credentials -p android` (interactive, needs EXPO_TOKEN + TTY)
- If you need to re-upload: use the GraphQL mutations `androidKeystore.createAndroidKeystore` + `androidAppCredentials.createAndroidAppCredentials` + `androidAppBuildCredentials.createAndroidAppBuildCredentials`

**Why:** keytool/Java not available in Replit container; OpenSSL PKCS12 is a valid Android keystore format that EAS accepts.
