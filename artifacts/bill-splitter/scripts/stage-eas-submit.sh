#!/usr/bin/env bash
# Submit an iOS production build to App Store Connect.
#
# Authentication uses an App Store Connect API Key (.p8) — more reliable than
# Apple ID + app-specific password and works without 2FA interaction.
#
# ═══════════════════════════════════════════════════════════════════════════
#  FULL RELEASE CHECKLIST — complete every step before running this script
# ═══════════════════════════════════════════════════════════════════════════
#
#  1. VERSION BUMP
#     □ Bump `version` in artifacts/bill-splitter/app.config.js (e.g. "1.0.1")
#     □ Bump `ios.buildNumber` in app.config.js — must be strictly greater
#       than the previously submitted build number (App Store rejects reuse)
#
#  2. WHAT'S NEW
#     □ Prepare release notes (max 4000 chars) for "What's New in This Version"
#       in App Store Connect.
#     □ Note any new permissions / entitlements added — reviewers look for these.
#
#  3. BUILD THE IPA  (choose ONE path based on EAS quota availability)
#
#     ── PATH A: CLOUD BUILD (default, requires available EAS quota) ──────────
#     □ Requires: EXPO_TOKEN and EXPO_PUBLIC_DOMAIN set in environment.
#     □ Run from Replit (Linux OK):
#         bash scripts/stage-eas-build.sh
#     □ Wait for the build to finish (usually 15-30 min):
#         Monitor at https://expo.dev/accounts/jluabena/builds
#         or poll: eas build:list --platform ios --limit 5
#     □ Submit using --latest (this script's default):
#         ASC_APP_ID=6790176677 bash scripts/stage-eas-submit.sh
#
#     ── PATH B: LOCAL BUILD (use when EAS quota is exhausted) ───────────────
#     □ Requires: macOS with Xcode installed (cannot run on Linux/Replit).
#     □ Run on your Mac:
#         bash scripts/stage-eas-build.sh --local
#     □ Locate the .ipa produced in the stage dir (printed at end of build).
#       It is typically named build-<timestamp>.ipa inside the tmp stage dir.
#     □ Submit by passing the local .ipa path directly (bypasses --latest):
#         ASC_APP_ID=6790176677 bash scripts/stage-eas-submit.sh --path /path/to/build.ipa
#
#     QUOTA NOTE:
#       - Free EAS plan: ~30 iOS build-minutes/month; resets on the 1st.
#       - Check remaining quota: https://expo.dev/accounts/jluabena/billing
#       - Upgrade plan:          https://expo.dev/pricing
#
#  4. VERIFY THE BUILD (optional but recommended before submission)
#     □ Install the .ipa on a physical device or simulator and confirm:
#         - Sign in / sign up flow works
#         - Bill split and scan flows work
#         - RevenueCat paywall appears correctly
#
#  5. APP STORE CONNECT PREREQUISITES
#     □ Screenshot set is up to date for all required device sizes.
#       (see artifacts/mockup-sandbox — Screenshot1–5.tsx components)
#     □ App Store metadata (description, keywords, category) is current.
#       (reference: .local/app-store-metadata.md)
#     □ Privacy policy URL is live and reachable.
#     □ If new data types are collected, update the App Privacy questionnaire
#       in App Store Connect before submission.
#
#  6. SUBMIT (run this script — see step 3 for the correct command)
#     □ After submission, monitor App Store Connect:
#       https://appstoreconnect.apple.com
#     □ TestFlight processing takes 5-30 min; App Store review takes 1-3 days.
#     □ Once approved, release manually or configure auto-release in ASC.
# ═══════════════════════════════════════════════════════════════════════════
#
# Prerequisites (must be set in the environment / Replit secrets):
#   EXPO_TOKEN       — EAS auth token (expo.dev → Account Settings → Access Tokens)
#   ASC_APP_ID       — App Store Connect numeric app ID (6790176677)
#                      NOTE: this secret is NOT auto-exported to the shell by Replit.
#                      Pass it inline: ASC_APP_ID=6790176677 bash scripts/stage-eas-submit.sh
#   APPLE_TEAM_ID    — Apple Developer team ID (FNBGUZQ4T3)
#   ASC_KEY_ID       — App Store Connect API Key ID (XKFJ37U826)
#   ASC_ISSUER_ID    — App Store Connect API Issuer ID
#   ASC_API_KEY_P8   — Full contents of the AuthKey_<KeyID>.p8 file
#
# Usage:
#   bash scripts/stage-eas-submit.sh                       # production, latest EAS cloud build
#   bash scripts/stage-eas-submit.sh --path /tmp/build.ipa # production, local .ipa file
#   bash scripts/stage-eas-submit.sh staging               # staging profile, latest cloud build
#   bash scripts/stage-eas-submit.sh staging --path /tmp/build.ipa  # staging, local .ipa
set -euo pipefail

# ── Argument parsing ────────────────────────────────────────────────────────
PROFILE="production"
LOCAL_IPA=""

i=1
while [ "$i" -le "$#" ]; do
  arg="${!i}"
  case "$arg" in
    --path)
      i=$((i + 1))
      LOCAL_IPA="${!i}"
      ;;
    --path=*)
      LOCAL_IPA="${arg#--path=}"
      ;;
    *)
      PROFILE="$arg"
      ;;
  esac
  i=$((i + 1))
done

if [ -n "$LOCAL_IPA" ]; then
  echo "==> LOCAL IPA MODE: submitting $LOCAL_IPA (bypasses EAS --latest lookup)"
  if [ ! -f "$LOCAL_IPA" ]; then
    echo "ERROR: file not found: $LOCAL_IPA" >&2
    exit 1
  fi
else
  echo "==> CLOUD BUILD MODE: submitting --latest EAS cloud build for profile '$PROFILE'"
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE_DIR="$(mktemp -d /tmp/eas_submit_stage.XXXXXX)"
# Use python3 for cross-platform symlink resolution (macOS BSD readlink
# does not support -f; GNU readlink on Linux does, but python3 works on both).
EAS_BIN="$(python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$APP_DIR/node_modules/.bin/eas")"
P8_FILE="$STAGE_DIR/AuthKey_${ASC_KEY_ID:-MISSING}.p8"

echo ""
echo "==> Checking required environment variables..."
missing=0
for var in EXPO_TOKEN ASC_APP_ID APPLE_TEAM_ID; do
  if [ -z "${!var:-}" ]; then
    echo "  ERROR: $var is not set" >&2
    missing=$((missing + 1))
  fi
done
if [ "$missing" -gt 0 ]; then
  echo "" >&2
  echo "Set the $missing missing variable(s) above, then re-run." >&2
  echo "Tip: ASC_APP_ID is not auto-exported by Replit. Pass it inline:" >&2
  echo "  ASC_APP_ID=6790176677 bash scripts/stage-eas-submit.sh" >&2
  exit 1
fi
# ASC_KEY_ID / ASC_ISSUER_ID / ASC_API_KEY_P8 are optional — if absent, EAS
# will use the App Store Connect API key it already has stored as a remote
# credential (the same one used during eas build).
if [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ] && [ -n "${ASC_API_KEY_P8:-}" ]; then
  echo "  ASC API key provided via env vars — will write .p8 file."
  HAS_LOCAL_ASC_KEY=1
else
  echo "  ASC_KEY_ID/ASC_ISSUER_ID/ASC_API_KEY_P8 not set — EAS will use remote stored credentials."
  HAS_LOCAL_ASC_KEY=0
fi
echo "  All required variables are set."

echo ""
echo "==> Staging $APP_DIR -> $STAGE_DIR"
tar -C "$APP_DIR" \
  --exclude='./node_modules' \
  --exclude='./.expo' \
  --exclude='./ios' \
  --exclude='./android' \
  --exclude='./.git' \
  --exclude='./dist' \
  -cf - . | (cd "$STAGE_DIR" && tar -xf -)
# eas submit needs to resolve Expo plugins (expo-router etc.) — symlink node_modules
# from the source so it can read app.config.js without a full npm install.
ln -s "$APP_DIR/node_modules" "$STAGE_DIR/node_modules"

# Write the .p8 key content to a temp file only when credentials were supplied locally.
# When absent, EAS uses the API key it already has stored as a remote credential.
if [ "$HAS_LOCAL_ASC_KEY" = "1" ]; then
  printf '%s' "$ASC_API_KEY_P8" > "$P8_FILE"
  chmod 600 "$P8_FILE"
  echo "==> Wrote API key to $P8_FILE"
  # Export the path so the Python expansion picks it up and injects it into eas.json
  export ASC_API_KEY_PATH="$P8_FILE"
else
  echo "==> Skipping .p8 write — using EAS remote credentials."
fi

# Expand $VAR_NAME references in eas.json submit section from the local shell.
echo ""
echo "==> Expanding env var references in eas.json [$PROFILE] submit profile..."
python3 - "$STAGE_DIR" "$PROFILE" << 'PYEOF'
import json, os, sys

stage_dir, profile = sys.argv[1], sys.argv[2]
eas_path = os.path.join(stage_dir, 'eas.json')
eas = json.load(open(eas_path))

# Expand build env section
build_section = eas.get('build', {})
profile_cfg = build_section.get(profile, {})
env = profile_cfg.get('env', {})
expanded = 0
for key, val in env.items():
    if isinstance(val, str) and val.startswith('$'):
        var_name = val[1:]
        shell_val = os.environ.get(var_name)
        if shell_val:
            env[key] = shell_val
            expanded += 1
profile_cfg['env'] = env
build_section[profile] = profile_cfg
eas['build'] = build_section

# Expand submit profile section
submit_section = eas.get('submit', {})
submit_profile = submit_section.get(profile, {})
ios_submit = submit_profile.get('ios', {})
for key, val in ios_submit.items():
    if isinstance(val, str) and val.startswith('$'):
        var_name = val[1:]
        shell_val = os.environ.get(var_name)
        if shell_val:
            ios_submit[key] = shell_val
            expanded += 1
            print(f'  expanded submit.{profile}.ios.{key}')
submit_profile['ios'] = ios_submit
submit_section[profile] = submit_profile
eas['submit'] = submit_section

json.dump(eas, open(eas_path, 'w'), indent=2)
print(f'Expanded {expanded} env var references in eas.json')
PYEOF

echo ""
echo "==> Running eas submit for iOS (profile: $PROFILE)..."
echo "    ASC App ID:   $ASC_APP_ID"
echo "    Apple Team:   $APPLE_TEAM_ID"
echo "    ASC Key ID:   ${ASC_KEY_ID:-<using EAS remote>}"
echo "    Issuer ID:    ${ASC_ISSUER_ID:-<using EAS remote>}"
echo ""

cd "$STAGE_DIR"

if [ -n "$LOCAL_IPA" ]; then
  # Local IPA path: user ran stage-eas-build.sh --local and has the .ipa on disk.
  # EAS submit --path uploads and submits that specific file — no --latest lookup needed.
  echo "    IPA path:     $LOCAL_IPA"
  echo ""
  # Unset Apple ID credentials so EAS falls back to the API key in eas.json
  env -u EXPO_APPLE_ID -u EXPO_APPLE_APP_SPECIFIC_PASSWORD \
    EAS_NO_VCS=1 EXPO_TOKEN="$EXPO_TOKEN" \
    "$EAS_BIN" submit \
      --platform ios \
      --profile "$PROFILE" \
      --path "$LOCAL_IPA" \
      --non-interactive
else
  # Cloud build path: submit the most recently finished EAS cloud build.
  # Unset Apple ID credentials so EAS falls back to the API key in eas.json
  env -u EXPO_APPLE_ID -u EXPO_APPLE_APP_SPECIFIC_PASSWORD \
    EAS_NO_VCS=1 EXPO_TOKEN="$EXPO_TOKEN" \
    "$EAS_BIN" submit \
      --platform ios \
      --profile "$PROFILE" \
      --latest \
      --non-interactive
fi

echo ""
echo "==> Submission complete. Check App Store Connect for review status."
echo "    https://appstoreconnect.apple.com/apps/$ASC_APP_ID"
echo "    Staged project kept at: $STAGE_DIR (p8 key is inside — delete when done)"
