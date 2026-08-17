#!/usr/bin/env bash
# Stage and launch an EAS production build for Owmo.
#
# ─── QUOTA SITUATION ────────────────────────────────────────────────────────
# The free EAS plan allows ~30 iOS build-minutes/month on EAS workers.
# The first production build (July 2026) exhausted that quota.
#
# TWO WAYS TO BUILD — choose based on your situation:
#
#   Cloud build (default)  — eas build --platform <ios|android>
#     Runs on Expo's managed workers.  Counts against the monthly quota.
#     Safe on Aug 1+ (quota resets).  Works from any machine (Linux OK).
#
#   Local build (--local)  — eas build --platform ios --local
#     Runs entirely on THIS machine.  Zero quota consumed.  No EAS workers.
#     REQUIRES: macOS with Xcode installed (iOS only; the ipa is compiled locally).
#     Use this when the EAS quota is exhausted or to skip the queue.
#     NOTE: Android local builds require a local JDK + Android SDK — not recommended.
#
# Usage:
#   bash scripts/stage-eas-build.sh                              # cloud iOS build (production)
#   bash scripts/stage-eas-build.sh --platform android           # cloud Android build (production)
#   bash scripts/stage-eas-build.sh --local                      # local iOS build on this Mac
#   bash scripts/stage-eas-build.sh production --local           # explicit profile + local iOS
#   bash scripts/stage-eas-build.sh staging                      # cloud iOS build, staging profile
#   bash scripts/stage-eas-build.sh staging --platform android   # cloud Android build, staging profile
#   bash scripts/stage-eas-build.sh --strict-versions            # abort if native dep versions drift
#   bash scripts/stage-eas-build.sh --dry-run                    # run all staging steps, skip EAS call, verify output
#   bash scripts/stage-eas-build.sh --strict-freshness           # abort if key source files are stale
#   bash scripts/stage-eas-build.sh --max-age-hours=48           # change staleness threshold (default 24h)
#
# Freshness check:
#   Before staging, the script checks the modification time of key source files
#   (app.json, app.config.js, app/_layout.tsx, app/index.tsx).  If any file is
#   older than MAX_AGE_HOURS (default 24), a warning is printed listing each
#   stale file and its age.  Pass --strict-freshness to abort instead of warn.
#   Override the threshold: --max-age-hours=N  or  FRESHNESS_WARN_HOURS=N (env).
#   To pull the latest code from Replit before staging, run:
#     bash scripts/sync-from-replit.sh
#
# Native dependency version drift check:
#   Before staging, the script compares locally-installed versions of
#   expo, react-native, @clerk/expo, and expo-notifications against the
#   known-good baseline in scripts/native-deps-baseline.json.
#   By default a warning is printed; pass --strict-versions to abort.
#   To update the baseline after an intentional upgrade, edit that file.
# ────────────────────────────────────────────────────────────────────────────
#
# Why staging + pinning is required:
#   This app lives in a pnpm monorepo, so there is no lockfile inside
#   artifacts/bill-splitter. When the project is uploaded to EAS, the worker
#   resolves every semver range fresh — which once silently installed
#   @clerk/expo 3.7.4 instead of the local 3.2.16 and broke the native build
#   (missing ClerkExpo pod, spm.rb crashes). Pinning every dependency to the
#   exact locally-installed version guarantees the worker builds the same
#   native code we develop against.
#
# Why eas.json env vars are expanded here:
#   eas env:list/create fail due to an EAS project slug mismatch (project slug
#   is "invite" on EAS but app.config.js uses "owmo"). EAS builds still succeed
#   via EAS_NO_VCS=1. To ensure EXPO_PUBLIC_DOMAIN and other $VAR_NAME
#   references in eas.json are resolved, this script expands them from the
#   local shell environment before upload, producing hardcoded values in the
#   staged eas.json that the EAS worker uses as-is.
set -euo pipefail

# ── Argument parsing ────────────────────────────────────────────────────────
LOCAL_BUILD=false
PROFILE="production"
PLATFORM="ios"
STRICT_VERSIONS=false
STRICT_FRESHNESS=false
DRY_RUN=false
MAX_AGE_HOURS="${FRESHNESS_WARN_HOURS:-24}"

for arg in "$@"; do
  case "$arg" in
    --local)               LOCAL_BUILD=true ;;
    --strict-versions)     STRICT_VERSIONS=true ;;
    --strict-freshness)    STRICT_FRESHNESS=true ;;
    --dry-run)             DRY_RUN=true ;;
    --platform)            ;;
    --platform=*)          PLATFORM="${arg#--platform=}" ;;
    --max-age-hours=*)     MAX_AGE_HOURS="${arg#--max-age-hours=}" ;;
    android|ios|all)       PLATFORM="$arg" ;;
    *)                     PROFILE="$arg" ;;
  esac
done

# Handle "--platform <value>" as two separate args
ARGS=("$@")
for i in "${!ARGS[@]}"; do
  if [ "${ARGS[$i]}" = "--platform" ]; then
    next_i=$((i + 1))
    if [ $next_i -lt ${#ARGS[@]} ]; then
      PLATFORM="${ARGS[$next_i]}"
    fi
  fi
done

echo "==> Platform: $PLATFORM | Profile: $PROFILE"
if [ "$DRY_RUN" = true ]; then
  echo "==> DRY-RUN MODE: all staging steps will run; EAS CLI call will be skipped"
fi

if [ "$LOCAL_BUILD" = true ]; then
  echo "==> LOCAL BUILD MODE: build will run on this machine (no EAS quota consumed)"
  if [ "$PLATFORM" = "android" ]; then
    echo "    WARNING: Android local builds require a local JDK + Android SDK."
  else
    echo "    Requires: macOS + Xcode. Do not run this on Linux/Replit."
  fi
  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo ""
    echo "ERROR: --local requires macOS (this machine is $(uname -s))." >&2
    echo "  Run this script on your Mac, or omit --local to use EAS cloud workers." >&2
    exit 1
  fi
else
  echo "==> CLOUD BUILD MODE: build will run on EAS workers (counts against monthly quota)"
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE_DIR="$(mktemp -d /tmp/eas_stage.XXXXXX)"

# ── Capture git HEAD SHA ─────────────────────────────────────────────────────
# Used to stamp app.config.js extra.buildCommit so every build is traceable
# back to the exact source commit.
BUILD_COMMIT="$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")"
export BUILD_COMMIT
echo "==> Build commit: $BUILD_COMMIT"

# ── Pre-flight: verify main has been fully pushed to origin/build8-sync ──────
# Task agents merge their work into 'main' on Replit. The Mac build script
# (sync-from-replit.sh) pulls from origin/build8-sync. If commits exist in
# 'main' that have not been pushed to build8-sync, the Mac build ships without
# those changes — the failure mode that caused Build 28 to miss task #485.
#
# This check is only meaningful when running on Replit (current branch = main).
# On the Mac the current branch is build8-sync, so the check skips automatically.
_CURRENT_GIT_BRANCH="$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
_BUILD_SYNC_BRANCH="build8-sync"
_BUILD_SYNC_REMOTE="origin"
_BUILD_SYNC_REF="$_BUILD_SYNC_REMOTE/$_BUILD_SYNC_BRANCH"

if [ "$_CURRENT_GIT_BRANCH" = "main" ] && [ "$DRY_RUN" = false ]; then
  # ── Push-state guard ─────────────────────────────────────────────────────
  # Only runs on an actual build (not --dry-run) because:
  #  - In --dry-run mode (run on Replit to validate the staging pipeline),
  #    main is always ahead of build8-sync until the operator explicitly
  #    pushes before triggering the Mac build.  Blocking dry-run would prevent
  #    all CI validation.
  #  - On the Mac (where build8-sync is checked out), this branch is never
  #    "main", so the check skips automatically.
  echo "==> Pre-flight: verifying main has been pushed to $_BUILD_SYNC_REF..."
  # Fetch so our view of origin/build8-sync is current; non-fatal if network is down.
  set +e
  git -C "$APP_DIR" fetch "$_BUILD_SYNC_REMOTE" "$_BUILD_SYNC_BRANCH" 2>&1 | sed 's/^/  /'
  _FETCH_EXIT=$?
  set -e

  if [ $_FETCH_EXIT -ne 0 ]; then
    echo "" >&2
    echo "  ERROR: could not fetch $_BUILD_SYNC_REF (exit $_FETCH_EXIT)." >&2
    echo "  Cannot verify that main has been pushed before building." >&2
    echo "  Check your network connection and that '$_BUILD_SYNC_REMOTE' is configured:" >&2
    echo "    git -C \"$APP_DIR\" remote -v" >&2
    echo "" >&2
    echo "  Aborting. Fix the fetch error and re-run." >&2
    exit 1
  fi

  _SYNC_HEAD="$(git -C "$APP_DIR" rev-parse "$_BUILD_SYNC_REF" 2>/dev/null || echo "")"

  if [ -z "$_SYNC_HEAD" ]; then
    echo "" >&2
    echo "  ERROR: could not resolve $_BUILD_SYNC_REF after a successful fetch." >&2
    echo "  This should not happen — inspect the remote branch manually:" >&2
    echo "    git -C \"$APP_DIR\" branch -r | grep $_BUILD_SYNC_BRANCH" >&2
    echo "" >&2
    echo "  Aborting. Fix the branch resolution error and re-run." >&2
    exit 1
  fi

  _UNPUSHED="$(git -C "$APP_DIR" rev-list --count "${_BUILD_SYNC_REF}..HEAD" 2>/dev/null || echo "?")"

  if [ "$_UNPUSHED" = "?" ]; then
    echo "" >&2
    echo "  ERROR: could not count commits between $_BUILD_SYNC_REF and HEAD." >&2
    echo "  Cannot verify push state. Aborting." >&2
    exit 1
  fi

  if [ "$_UNPUSHED" != "0" ]; then
        echo ""
        echo "  ╔══════════════════════════════════════════════════════════════════════╗"
        echo "  ║  BUILD BLOCKED: $_UNPUSHED commit(s) in main not yet in $_BUILD_SYNC_BRANCH  "
        echo "  ╚══════════════════════════════════════════════════════════════════════╝"
        echo ""
        echo "  These commits are on local 'main' but NOT yet pushed to $_BUILD_SYNC_REF."
        echo "  The Mac pulls from $_BUILD_SYNC_REF — building now would ship without"
        echo "  these changes:"
        echo ""
        # Use set +e around the pipe so SIGPIPE from head -20 does not abort the script.
        set +e
        git -C "$APP_DIR" log --oneline "${_BUILD_SYNC_REF}..HEAD" 2>/dev/null | head -20 | sed 's/^/    /'
        set -e
        echo ""
        echo "  ── How to fix ──────────────────────────────────────────────────────"
        echo "  Push main to $_BUILD_SYNC_BRANCH, then re-run this script:"
        echo "    git push $_BUILD_SYNC_REMOTE HEAD:refs/heads/$_BUILD_SYNC_BRANCH"
        echo ""
        echo "  Aborting. Re-run after pushing."
        exit 1
  else
    echo "  main is fully pushed to $_BUILD_SYNC_REF. ✓"
    echo ""
    echo "  ┌─ Build SHA ────────────────────────────────────────────────────────┐"
    printf   "  │  $_BUILD_SYNC_REF: %s  │\n" "$_SYNC_HEAD"
    echo "  └────────────────────────────────────────────────────────────────────┘"
  fi
  echo ""
fi

# Resolve EAS binary path before cd-ing away from APP_DIR.
# Use python3 for cross-platform symlink resolution (macOS BSD readlink
# does not support -f; GNU readlink on Linux does, but python3 works on both).
EAS_BIN="$(python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$APP_DIR/node_modules/.bin/eas")"

# ── Pre-flight: source freshness check ──────────────────────────────────────
# Checks modification times of key source files.  If any file is older than
# MAX_AGE_HOURS hours, a warning is printed.  Pass --strict-freshness to abort.
# This prevents wasted builds from stale Mac-side copies of Replit source files.
# Run scripts/sync-from-replit.sh first to pull the latest code.
echo "==> Pre-flight: checking source file freshness (threshold: ${MAX_AGE_HOURS}h)..."
python3 "$APP_DIR/scripts/freshness_check.py" "$APP_DIR" "$MAX_AGE_HOURS" "$STRICT_FRESHNESS"

echo ""

# ── Pre-flight: native dependency version drift check ───────────────────────
# Compares the locally-installed versions of ALL native dependencies listed in
# scripts/native-deps-baseline.json against the known-good baseline versions.
# The baseline covers every package that has an active patch in
# plugins/withPodfileSpmFix.js (expo, react-native, @clerk/expo,
# expo-notifications, @sentry/react-native, expo-store-review, expo-image,
# expo-camera, expo-contacts, expo-location, expo-image-picker,
# react-native-view-shot).  All keys in the baseline file are checked
# dynamically — there is no hardcoded subset here.
#
# Pass --strict-versions to treat any drift as a hard error (exit 1).
# Without that flag the check prints a warning and continues.
echo "==> Pre-flight: checking native dependency versions against baseline..."
python3 - "$APP_DIR" "$STRICT_VERSIONS" << 'PREFLIGHT'
import json, os, sys

app_dir      = sys.argv[1]
strict       = sys.argv[2].lower() == "true"
baseline_path = os.path.join(app_dir, 'scripts', 'native-deps-baseline.json')
local_nm     = os.path.join(app_dir, 'node_modules')

if not os.path.exists(baseline_path):
    print(f"  WARNING: baseline file not found at {baseline_path}")
    print(f"  Create it by running: scripts/update-native-deps-baseline.sh")
    print(f"  Skipping version drift check.")
    sys.exit(0)

baseline = json.load(open(baseline_path))
# Strip metadata keys that start with _
baseline = {k: v for k, v in baseline.items() if not k.startswith('_')}

# Check ALL packages listed in the baseline (not a hardcoded subset).
# To add a new package to the drift check, add it to native-deps-baseline.json.
drifted = []
checked = []
for name, expected in baseline.items():
    pkg_json = os.path.join(local_nm, name, 'package.json')
    if not os.path.exists(pkg_json):
        print(f"  WARNING: {name} is not installed locally — cannot verify version")
        continue
    installed = json.load(open(pkg_json))['version']
    if installed != expected:
        drifted.append((name, installed, expected))
    else:
        checked.append((name, installed))

# Print summary table
print(f"  {'Package':<30} {'Installed':<15} {'Baseline':<15} Status")
print(f"  {'-'*30} {'-'*15} {'-'*15} ------")
for name, ver in checked:
    print(f"  {name:<30} {ver:<15} {ver:<15} OK")
for name, installed, expected in drifted:
    print(f"  {name:<30} {installed:<15} {expected:<15} *** DRIFT ***")

if drifted:
    print("")
    print("  NATIVE DEPENDENCY VERSION DRIFT DETECTED")
    print("  =========================================")
    for name, installed, expected in drifted:
        print(f"  {name}: installed={installed}, baseline={expected}")
    print("")
    print("  This may cause EAS worker builds to fail or produce a broken native app.")
    print("  To resolve:")
    print("    1. If the new version is intentional, update the baseline:")
    print(f"          edit {baseline_path}")
    print("    2. If the version bump was accidental, reinstall the baseline version:")
    print(f"          pnpm add <pkg>@<baseline-version>  (from the monorepo root)")
    print("")
    if strict:
        print("  --strict-versions is set: aborting build.")
        sys.exit(1)
    else:
        print("  Continuing anyway (pass --strict-versions to abort on drift).")
else:
    print(f"  All {len(checked)} key native dependencies match baseline. ✓")
PREFLIGHT

echo ""

# ── Pre-flight: OAuth redirect scheme consistency check ──────────────────────
# Extracts the scheme declared in app.config.js, then scans every auth screen
# for makeRedirectUri({ scheme: "..." }) calls.  Any hardcoded string that
# differs from the declared scheme aborts the build (this was the root cause of
# the TestFlight OAuth breakage when the app was renamed from bill-splitter to
# owmo).  Using the shared APP_SCHEME constant is always preferred; this check
# is a belt-and-suspenders guard against future copy-paste mistakes.
echo "==> Pre-flight: checking OAuth redirect scheme consistency..."
python3 - "$APP_DIR" << 'SCHEMECHECK'
import os, re, sys

app_dir = sys.argv[1]

# ── Step 1: extract declared scheme from app.config.js ──────────────────────
cfg_path = os.path.join(app_dir, 'app.config.js')
declared_scheme = None
if os.path.exists(cfg_path):
    for line in open(cfg_path):
        # Match:  scheme: "owmo",  or  scheme: 'owmo',
        m = re.search(r'''^\s*scheme:\s*['"]([^'"]+)['"]''', line)
        if m:
            declared_scheme = m.group(1)
            break

if declared_scheme is None:
    print("  WARNING: could not extract scheme from app.config.js — skipping scheme check")
    sys.exit(0)

print(f"  Declared scheme in app.config.js: {declared_scheme}")

# ── Step 2: scan auth screens for makeRedirectUri({ scheme: "..." }) ─────────
auth_dir = os.path.join(app_dir, 'app', '(auth)')
mismatches = []
hardcoded = []

if not os.path.isdir(auth_dir):
    print(f"  WARNING: {auth_dir} not found — no auth screens to check")
    sys.exit(0)

for fname in sorted(os.listdir(auth_dir)):
    if not fname.endswith(('.tsx', '.ts', '.jsx', '.js')):
        continue
    fpath = os.path.join(auth_dir, fname)
    for lineno, line in enumerate(open(fpath), 1):
        # Look for makeRedirectUri with a literal string scheme argument
        m = re.search(r'''makeRedirectUri\s*\(\s*\{[^}]*scheme\s*:\s*['"]([^'"]+)['"]''', line)
        if m:
            found_scheme = m.group(1)
            hardcoded.append((fname, lineno, found_scheme))
            if found_scheme != declared_scheme:
                mismatches.append((fname, lineno, found_scheme, declared_scheme))

if hardcoded:
    print(f"  Found {len(hardcoded)} hardcoded scheme string(s) in auth screens:")
    for fname, lineno, scheme in hardcoded:
        status = "OK" if scheme == declared_scheme else "*** MISMATCH ***"
        print(f"    {fname}:{lineno}  scheme=\"{scheme}\"  [{status}]")
    print(f"  Tip: import APP_SCHEME from @/constants/appScheme instead of hardcoding.")
else:
    print(f"  No hardcoded scheme strings found — all calls use the shared constant. ✓")

if mismatches:
    print("")
    print("  OAUTH REDIRECT SCHEME MISMATCH DETECTED")
    print("  ========================================")
    for fname, lineno, found, expected in mismatches:
        print(f"  {fname}:{lineno}: scheme=\"{found}\" but app.config.js declares scheme=\"{expected}\"")
    print("")
    print("  This will cause Clerk to reject the OAuth redirect at runtime.")
    print("  Fix: replace the hardcoded string with APP_SCHEME from @/constants/appScheme.")
    sys.exit(1)
else:
    print(f"  Scheme consistency check passed. ✓")
SCHEMECHECK

echo ""
echo "Staging $APP_DIR -> $STAGE_DIR (profile: $PROFILE, platform: $PLATFORM)"
tar -C "$APP_DIR" \
  --exclude='./node_modules' \
  --exclude='./.expo' \
  --exclude='./ios' \
  --exclude='./android' \
  --exclude='./.git' \
  --exclude='./dist' \
  -cf - . | (cd "$STAGE_DIR" && tar -xf -)

# ── Fresh-copy critical plugin and script files ──────────────────────────────
# Belt-and-suspenders: explicitly overwrite these files from the Replit source
# after the tar copy so the staged dir always reflects the canonical version.
# This prevents stale Mac-side edits (manual patches applied to a previous
# staged dir) from persisting when the script is re-run.
echo "Re-copying critical plugin and script files from source..."
CRITICAL_FILES=(
  "plugins/withPodfileSpmFix.js"
  "scripts/stage-eas-build.sh"
)
for f in "${CRITICAL_FILES[@]}"; do
  src="$APP_DIR/$f"
  dst="$STAGE_DIR/$f"
  if [ -f "$src" ]; then
    mkdir -p "$(dirname "$dst")"
    cp -f "$src" "$dst"
    echo "  ✓ $f"
  else
    echo "  ⚠ $f not found in source — skipping"
  fi
done

# ── Idempotency check: print checksums of critical files ────────────────────
# Running the script twice should produce identical checksums. If they differ,
# a file in the source was modified between runs (expected) or something is
# injecting changes after staging (unexpected).
echo "Checksums of staged critical files:"
for f in "${CRITICAL_FILES[@]}"; do
  dst="$STAGE_DIR/$f"
  if [ -f "$dst" ]; then
    cksum=$(sha256sum "$dst" 2>/dev/null || shasum -a 256 "$dst")
    echo "  $cksum  ($f)"
  fi
done

python3 - "$APP_DIR" "$STAGE_DIR" << 'EOF'
import json, os, sys

app_dir, stage_dir = sys.argv[1], sys.argv[2]
local_nm = os.path.join(app_dir, 'node_modules')
pkg_path = os.path.join(stage_dir, 'package.json')
pkg = json.load(open(pkg_path))

pinned = missing = 0
for section in ('dependencies', 'devDependencies'):
    for name in list(pkg.get(section, {}).keys()):
        p = os.path.join(local_nm, name, 'package.json')
        if os.path.exists(p):
            pkg[section][name] = json.load(open(p))['version']
            pinned += 1
        else:
            missing += 1
            print(f'  warning: {name} not installed locally, keeping range')

json.dump(pkg, open(pkg_path, 'w'), indent=2)
print(f'Pinned {pinned} deps to exact local versions ({missing} kept as ranges)')

# Ensure expo-dev-client is present in devDependencies.
# expo-updates' pod install script unconditionally requires('expo-dev-client/package.json')
# to detect dev-client builds. If it's absent the EAS worker's npm ci won't install it
# and pod install crashes with MODULE_NOT_FOUND before xcodebuild even starts.
import json, os
pkg_path2 = os.path.join(sys.argv[2], 'package.json')
pkg2 = json.load(open(pkg_path2))
if 'expo-dev-client' not in pkg2.get('devDependencies', {}):
    pkg2.setdefault('devDependencies', {})['expo-dev-client'] = '57.0.10'
    json.dump(pkg2, open(pkg_path2, 'w'), indent=2)
    print('  Injected expo-dev-client 57.0.10 into staged devDependencies')
else:
    print(f'  expo-dev-client already present ({pkg2["devDependencies"]["expo-dev-client"]})')
EOF

# Expand $VAR_NAME references in eas.json env sections from the local shell
# environment so the EAS worker receives hardcoded values. This is necessary
# because `eas env:create` is blocked by an EAS project slug mismatch that
# prevents managing EAS-stored environment variables via CLI.
python3 - "$STAGE_DIR" "$PROFILE" << 'PYEOF'
import json, os, sys, re

stage_dir, profile = sys.argv[1], sys.argv[2]
eas_path = os.path.join(stage_dir, 'eas.json')
eas = json.load(open(eas_path))

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
            print(f'  expanded {key} = {shell_val[:8]}...' if len(shell_val) > 8 else f'  expanded {key} = {shell_val}')
        else:
            print(f'  warning: ${var_name} not set in shell, leaving as-is')

profile_cfg['env'] = env
build_section[profile] = profile_cfg
eas['build'] = build_section
json.dump(eas, open(eas_path, 'w'), indent=2)
print(f'Expanded {expanded} env var references in eas.json [{profile}] profile')
PYEOF

# ── Stamp git commit SHA into staged app.config.js ──────────────────────────
# Replaces `process.env.BUILD_COMMIT ?? null` with the captured git HEAD SHA so
# every build carries a permanent record of which source commit it was built from.
# Accessible at runtime via Constants.expoConfig.extra.buildCommit.
echo "Stamping build commit into staged app.config.js..."
python3 - "$STAGE_DIR" "$BUILD_COMMIT" << 'COMMITEOF'
import os, sys

stage_dir, commit = sys.argv[1], sys.argv[2]
cfg_path = os.path.join(stage_dir, 'app.config.js')

if not os.path.exists(cfg_path):
    print(f'  ERROR: {cfg_path} not found — cannot stamp commit', file=sys.stderr)
    sys.exit(1)

content = open(cfg_path).read()
needle = 'process.env.BUILD_COMMIT ?? null'
if needle not in content:
    print(f'  WARNING: could not find "{needle}" in app.config.js — skipping stamp')
    print(f'  (The placeholder was already replaced or the file differs from expected.)')
    sys.exit(0)

patched = content.replace(needle, f'"{commit}"', 1)
open(cfg_path, 'w').write(patched)
short = commit[:8] if commit != 'unknown' else 'unknown'
print(f'  Stamped buildCommit: {short}... ({commit})')
COMMITEOF

echo ""
# Generate a lockfile so transitive dependencies are also frozen on the EAS worker.
# Direct deps are now exact versions; running npm install --package-lock-only resolves
# and records every transitive dep at its current registry version, locking the full tree.
# The EAS worker will then use `npm ci` instead of fresh resolution.
echo "Generating package-lock.json for transitive dependency freeze..."
(cd "$STAGE_DIR" && npm install --package-lock-only --ignore-scripts --legacy-peer-deps 2>&1)
echo "Lockfile generated ($(wc -l < "$STAGE_DIR/package-lock.json") lines)"

if [ "$DRY_RUN" = false ]; then
  if [ -z "${EXPO_TOKEN:-}" ]; then
    echo "ERROR: EXPO_TOKEN is not set" >&2
    exit 1
  fi

  if [ -z "${EXPO_PUBLIC_DOMAIN:-}" ]; then
    echo "ERROR: EXPO_PUBLIC_DOMAIN is not set" >&2
    exit 1
  fi

  # ── Pre-flight: verify Clerk proxy URL responds like Clerk ─────────────────
  # Hits /v1/client and checks for a Clerk-shaped JSON response (2xx or 4xx
  # with a Clerk error body). A wrong proxy URL — the failure mode that caused
  # Build 21's "Connection issue" crash on every device — passes an HTTP-only
  # check silently. This catch runs before the domain check so a bad Clerk URL
  # is flagged immediately rather than buried in a later timeout.
  if [ -z "${EXPO_PUBLIC_CLERK_PROXY_URL:-}" ]; then
    echo "ERROR: EXPO_PUBLIC_CLERK_PROXY_URL is not set" >&2
    echo "  Without this, Clerk can't initialize through the Replit proxy — the app shows a" >&2
    echo "  permanent dark screen (ClerkLoading never resolves)." >&2
    exit 1
  fi

  # ── Pre-flight: validate EXPO_PUBLIC_CLERK_PROXY_URL format ─────────────────
  # A missing https:// prefix, a trailing slash, or a bare hostname would cause
  # a confusing curl failure instead of a clear actionable message.  Catch these
  # before the liveness check so the developer knows exactly what to fix.
  echo "==> Pre-flight: validating EXPO_PUBLIC_CLERK_PROXY_URL format..."
  CLERK_PROXY_VAL="${EXPO_PUBLIC_CLERK_PROXY_URL}"

  # Must start with https://
  if [[ "$CLERK_PROXY_VAL" != https://* ]]; then
    echo "ERROR: EXPO_PUBLIC_CLERK_PROXY_URL must start with 'https://'." >&2
    echo "  Current value: EXPO_PUBLIC_CLERK_PROXY_URL=${CLERK_PROXY_VAL}" >&2
    echo "  Fix: provide a full HTTPS URL, e.g.  export EXPO_PUBLIC_CLERK_PROXY_URL=https://invite-9bwgw.replit.app/api/clerk-proxy" >&2
    exit 1
  fi

  # Must not end with a trailing slash
  if [[ "$CLERK_PROXY_VAL" == */ ]]; then
    echo "ERROR: EXPO_PUBLIC_CLERK_PROXY_URL must not end with a trailing slash." >&2
    echo "  Current value: EXPO_PUBLIC_CLERK_PROXY_URL=${CLERK_PROXY_VAL}" >&2
    echo "  Fix: remove the trailing slash, e.g.  export EXPO_PUBLIC_CLERK_PROXY_URL=https://invite-9bwgw.replit.app/api/clerk-proxy" >&2
    exit 1
  fi

  # Must contain at least one dot (bare hostname with no TLD is almost certainly a typo)
  if [[ "$CLERK_PROXY_VAL" != *.* ]]; then
    echo "ERROR: EXPO_PUBLIC_CLERK_PROXY_URL does not look like a valid URL (no dot found in host)." >&2
    echo "  Current value: EXPO_PUBLIC_CLERK_PROXY_URL=${CLERK_PROXY_VAL}" >&2
    echo "  Fix: provide a fully-qualified URL, e.g.  export EXPO_PUBLIC_CLERK_PROXY_URL=https://invite-9bwgw.replit.app/api/clerk-proxy" >&2
    exit 1
  fi

  # Must include a non-empty path segment beyond "/" (e.g. /api/clerk-proxy).
  # A bare https://invite-9bwgw.replit.app or https://invite-9bwgw.replit.app/
  # passes the checks above but silently breaks Clerk sign-in because the root
  # path does not proxy to Clerk.
  CLERK_PROXY_PATH="${CLERK_PROXY_VAL#https://}"   # strip scheme
  CLERK_PROXY_PATH="${CLERK_PROXY_PATH#*/}"        # strip up to and including first /
  # If the original URL had no "/" after the host, CLERK_PROXY_PATH equals the host (no change)
  # Re-extract properly: everything after the host
  CLERK_PROXY_HOST_AND_PATH="${CLERK_PROXY_VAL#https://}"
  if [[ "$CLERK_PROXY_HOST_AND_PATH" == */* ]]; then
    CLERK_PROXY_PATH_ONLY="/${CLERK_PROXY_HOST_AND_PATH#*/}"
  else
    CLERK_PROXY_PATH_ONLY="/"
  fi
  # Strip trailing slash for comparison (already checked above that it doesn't end with /)
  if [[ "$CLERK_PROXY_PATH_ONLY" == "/" || -z "$CLERK_PROXY_PATH_ONLY" ]]; then
    echo "ERROR: EXPO_PUBLIC_CLERK_PROXY_URL must include a path segment beyond '/' (e.g. /api/clerk-proxy)." >&2
    echo "  Current value: EXPO_PUBLIC_CLERK_PROXY_URL=${CLERK_PROXY_VAL}" >&2
    echo "  A bare hostname routes to the app root, not the Clerk proxy endpoint — sign-in will fail at runtime." >&2
    echo "  Fix: append the proxy path, e.g.  export EXPO_PUBLIC_CLERK_PROXY_URL=https://invite-9bwgw.replit.app/api/clerk-proxy" >&2
    exit 1
  fi

  echo "  ✓ EXPO_PUBLIC_CLERK_PROXY_URL format looks valid (${CLERK_PROXY_VAL})"

  echo "==> Pre-flight: verifying EXPO_PUBLIC_CLERK_PROXY_URL responds like Clerk..."
  CLERK_PROXY_STATUS=$(curl -s -o /tmp/clerk_proxy_resp.json -w "%{http_code}" \
    --max-time 10 "${EXPO_PUBLIC_CLERK_PROXY_URL}/v1/client" 2>/dev/null || echo "000")
  CLERK_PROXY_BODY=$(cat /tmp/clerk_proxy_resp.json 2>/dev/null || echo "")

  if [ "$CLERK_PROXY_STATUS" = "000" ]; then
    echo "ERROR: ${EXPO_PUBLIC_CLERK_PROXY_URL}/v1/client timed out or DNS failed." >&2
    echo "  The Clerk proxy must be reachable before staging a build." >&2
    echo "  Current value: EXPO_PUBLIC_CLERK_PROXY_URL=${EXPO_PUBLIC_CLERK_PROXY_URL}" >&2
    exit 1
  fi

  # Clerk always returns JSON with at least one of: errors, client, clerk_trace_id, response.
  # A wrong proxy URL (dead server, HTML error page, unrelated service) fails this check.
  if echo "$CLERK_PROXY_BODY" | python3 -c "
import json, sys
body = sys.stdin.read()
try:
    data = json.loads(body)
    if any(k in data for k in ('errors', 'client', 'clerk_trace_id', 'response')):
        sys.exit(0)
    sys.exit(1)
except (json.JSONDecodeError, Exception):
    sys.exit(1)
" 2>/dev/null; then
    echo "  ✓ ${EXPO_PUBLIC_CLERK_PROXY_URL} looks like Clerk (HTTP ${CLERK_PROXY_STATUS})"
  else
    echo "ERROR: ${EXPO_PUBLIC_CLERK_PROXY_URL}/v1/client returned a non-Clerk response." >&2
    echo "  HTTP status: ${CLERK_PROXY_STATUS}" >&2
    echo "  Response (first 200 chars): ${CLERK_PROXY_BODY:0:200}" >&2
    echo "" >&2
    echo "  Expected: JSON body containing Clerk fields (errors, client, clerk_trace_id)." >&2
    echo "  A 2xx or 4xx is acceptable — only the body shape matters." >&2
    echo "  This usually means EXPO_PUBLIC_CLERK_PROXY_URL points to the wrong server." >&2
    echo "  Current value: EXPO_PUBLIC_CLERK_PROXY_URL=${EXPO_PUBLIC_CLERK_PROXY_URL}" >&2
    exit 1
  fi

  # ── Pre-flight: validate EXPO_PUBLIC_DOMAIN format ───────────────────────────
  # A typo (missing TLD, extra slash, http:// prefix) causes a confusing
  # DNS/SSL error from curl rather than a clear actionable message.  Catch
  # common format mistakes before the curl so the developer knows exactly
  # what to fix.
  echo "==> Pre-flight: validating EXPO_PUBLIC_DOMAIN format..."
  DOMAIN_VAL="${EXPO_PUBLIC_DOMAIN}"

  # Must not start with http:// or https://
  if [[ "$DOMAIN_VAL" == http://* ]] || [[ "$DOMAIN_VAL" == https://* ]]; then
    echo "ERROR: EXPO_PUBLIC_DOMAIN must be a bare hostname — do not include a protocol prefix." >&2
    echo "  Current value: EXPO_PUBLIC_DOMAIN=${DOMAIN_VAL}" >&2
    echo "  Fix: strip the 'http(s)://' prefix, e.g.  export EXPO_PUBLIC_DOMAIN=invite-9bwgw.replit.app" >&2
    exit 1
  fi

  # Must not end with a slash
  if [[ "$DOMAIN_VAL" == */ ]]; then
    echo "ERROR: EXPO_PUBLIC_DOMAIN must not end with a trailing slash." >&2
    echo "  Current value: EXPO_PUBLIC_DOMAIN=${DOMAIN_VAL}" >&2
    echo "  Fix: remove the trailing slash, e.g.  export EXPO_PUBLIC_DOMAIN=invite-9bwgw.replit.app" >&2
    exit 1
  fi

  # Must contain at least one dot (bare hostname with no TLD is almost certainly a typo)
  if [[ "$DOMAIN_VAL" != *.* ]]; then
    echo "ERROR: EXPO_PUBLIC_DOMAIN does not look like a valid hostname (no dot found)." >&2
    echo "  Current value: EXPO_PUBLIC_DOMAIN=${DOMAIN_VAL}" >&2
    echo "  Fix: provide a fully-qualified domain, e.g.  export EXPO_PUBLIC_DOMAIN=invite-9bwgw.replit.app" >&2
    exit 1
  fi

  echo "  ✓ EXPO_PUBLIC_DOMAIN format looks valid (${DOMAIN_VAL})"

  # Verify the production domain is actually live before baking it into the
  # build. A dead domain causes 100% Clerk timeout on every device.
  # IMPORTANT: check the response body, not just the HTTP status — dead Replit
  # deployments return HTTP 200 with an HTML "This app isn't live yet" page,
  # which fooled an HTTP-status-only check in earlier versions of this script.
  echo "==> Pre-flight: verifying EXPO_PUBLIC_DOMAIN is live..."
  DOMAIN_RESPONSE=$(curl -s --max-time 10 "https://${EXPO_PUBLIC_DOMAIN}/api/ping" 2>/dev/null || echo "")
  if echo "$DOMAIN_RESPONSE" | grep -q '"ok":true'; then
    echo "  ✓ ${EXPO_PUBLIC_DOMAIN} is live (API responded correctly)"
  elif [ -z "$DOMAIN_RESPONSE" ]; then
    echo "ERROR: https://${EXPO_PUBLIC_DOMAIN}/api/ping timed out or DNS failed." >&2
    echo "  The production server must be live before staging a build." >&2
    echo "  Publish the Replit app first, then re-run this script." >&2
    exit 1
  else
    echo "ERROR: https://${EXPO_PUBLIC_DOMAIN}/api/ping returned an unexpected response:" >&2
    echo "  ${DOMAIN_RESPONSE:0:120}" >&2
    echo "" >&2
    echo "  Expected: {\"ok\":true,...}" >&2
    echo "  This usually means EXPO_PUBLIC_DOMAIN is set to the wrong value in your shell." >&2
    echo "  Current value: EXPO_PUBLIC_DOMAIN=${EXPO_PUBLIC_DOMAIN}" >&2
    echo "  Fix: export EXPO_PUBLIC_DOMAIN=invite-9bwgw.replit.app" >&2
    exit 1
  fi

  if [ -z "${EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:-}" ]; then
    echo "ERROR: EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set" >&2
    echo "  Without this, ClerkProvider throws before React mounts — the app crashes on launch." >&2
    exit 1
  fi

  # ── Pre-flight: validate Clerk publishable key format and environment ────────
  # An empty-string check above passes even when the key is from the wrong Clerk
  # instance or environment (e.g. a pk_test_ key baked into a production build).
  # ClerkProvider throws before React mounts on any format mismatch, crashing
  # the app on every device.  Validate both the prefix shape and the profile match.
  CLERK_KEY="${EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}"
  if [[ "$CLERK_KEY" != pk_live_* ]] && [[ "$CLERK_KEY" != pk_test_* ]]; then
    echo "ERROR: EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY does not look like a valid Clerk publishable key." >&2
    echo "  Expected a key starting with 'pk_live_' (production) or 'pk_test_' (staging/dev)." >&2
    echo "  Value prefix (first 12 chars): ${CLERK_KEY:0:12}..." >&2
    echo "  Obtain the correct key from your Clerk dashboard → API Keys." >&2
    exit 1
  fi

  if [ "$PROFILE" = "production" ] && [[ "$CLERK_KEY" != pk_live_* ]]; then
    echo "ERROR: Production build requires a live Clerk key (pk_live_...) but got a test key (pk_test_...)." >&2
    echo "  A pk_test_ key in a production build will cause ClerkProvider to throw at runtime." >&2
    echo "  Fix: export EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... (from Clerk dashboard → API Keys → Production instance)" >&2
    exit 1
  fi

  if [ "$PROFILE" != "production" ] && [[ "$CLERK_KEY" != pk_test_* ]]; then
    echo "WARNING: Non-production build (profile: $PROFILE) is using a live Clerk key (pk_live_...)." >&2
    echo "  This will hit your production Clerk instance during staging/dev builds." >&2
    echo "  If this is intentional, you can ignore this warning." >&2
    echo "  To use a test key: export EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_... (from Clerk dashboard → API Keys → Development instance)" >&2
  else
    echo "==> Clerk publishable key format and environment match build profile ($PROFILE). ✓"
  fi

  if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "all" ]; then
    if [ -z "${EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID:-}" ]; then
      echo "WARNING: EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID is not set." >&2
      echo "  Android Google Sign-In (native Credential Manager) will fail at runtime." >&2
      echo "  Set this to the Web OAuth 2.0 client ID from Google Cloud Console." >&2
    fi
  fi

  # Sentry DSN — hard error by default. A missing or malformed DSN means native
  # crashes and unhandled JS errors are completely invisible in production.
  # An invalid DSN also crashes the JS runtime before React mounts (Build 3 vector).
  # To bypass (not recommended): SKIP_SENTRY_CHECK=1 bash scripts/stage-eas-build.sh
  if [ -z "${SKIP_SENTRY_CHECK:-}" ] && [ "$DRY_RUN" != "true" ]; then
    if [ -z "${EXPO_PUBLIC_SENTRY_DSN:-}" ]; then
      echo "ERROR: EXPO_PUBLIC_SENTRY_DSN is not set — aborting." >&2
      echo "  Crash reports will NOT reach Sentry for this build." >&2
      echo "  Set it in your shell and re-run:" >&2
      echo "    export EXPO_PUBLIC_SENTRY_DSN=https://..." >&2
      echo "  To skip this check: SKIP_SENTRY_CHECK=1 bash scripts/stage-eas-build.sh" >&2
      exit 1
    elif [[ "${EXPO_PUBLIC_SENTRY_DSN}" != https://* ]]; then
      echo "ERROR: EXPO_PUBLIC_SENTRY_DSN does not start with https:// — aborting." >&2
      echo "  Sentry 8.x validates the DSN synchronously — an invalid value will" >&2
      echo "  crash the JS runtime before React mounts (same vector as Build 3)." >&2
      echo "  Value (first 30 chars): ${EXPO_PUBLIC_SENTRY_DSN:0:30}..." >&2
      exit 1
    else
      echo "==> Sentry DSN present and looks valid. ✓"
    fi
  else
    echo "==> Sentry DSN check skipped (SKIP_SENTRY_CHECK=1)."
  fi
fi

cd "$STAGE_DIR"

# Symlink the original node_modules so EAS CLI can resolve config plugins
# (expo-router, etc.) locally before uploading. EAS workers do their own
# fresh install on the server side and ignore this symlink.
ln -sfn "$APP_DIR/node_modules" "$STAGE_DIR/node_modules"

# ── Dry-run verification ─────────────────────────────────────────────────────
# When --dry-run is passed, verify the staged directory is correct and exit
# without invoking the EAS CLI.  Exit non-zero on any failure so this can be
# wired into a CI / Replit validation step.
if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "==> DRY-RUN: verifying staged directory..."
  DRY_RUN_ERRORS=0

  # 1. node_modules symlink must exist and resolve to the source node_modules
  NM_LINK="$STAGE_DIR/node_modules"
  NM_TARGET=$(python3 -c "import os,sys; p=sys.argv[1]; print(os.path.realpath(p) if os.path.islink(p) else '')" "$NM_LINK")
  EXPECTED_NM="$APP_DIR/node_modules"
  if [ -L "$NM_LINK" ] && [ "$NM_TARGET" = "$EXPECTED_NM" ]; then
    echo "  ✓ node_modules symlink → $NM_TARGET"
  elif [ -L "$NM_LINK" ]; then
    echo "  ✗ node_modules symlink resolves to '$NM_TARGET', expected '$EXPECTED_NM'" >&2
    DRY_RUN_ERRORS=$((DRY_RUN_ERRORS + 1))
  else
    echo "  ✗ node_modules symlink missing at $NM_LINK" >&2
    DRY_RUN_ERRORS=$((DRY_RUN_ERRORS + 1))
  fi

  # 2. Critical files must exist in the staged dir AND their checksums must
  #    match the source files (guards against stale-file injection).
  echo "  Verifying critical file checksums..."
  for f in "${CRITICAL_FILES[@]}"; do
    src="$APP_DIR/$f"
    dst="$STAGE_DIR/$f"
    if [ ! -f "$dst" ]; then
      echo "  ✗ $f missing from staged dir" >&2
      DRY_RUN_ERRORS=$((DRY_RUN_ERRORS + 1))
      continue
    fi
    SRC_SUM=$(sha256sum "$src" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$src" | awk '{print $1}')
    DST_SUM=$(sha256sum "$dst" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$dst" | awk '{print $1}')
    if [ "$SRC_SUM" = "$DST_SUM" ]; then
      echo "  ✓ $f checksum matches source"
    else
      echo "  ✗ $f checksum MISMATCH (src=$SRC_SUM, staged=$DST_SUM)" >&2
      DRY_RUN_ERRORS=$((DRY_RUN_ERRORS + 1))
    fi
  done

  # 3. package-lock.json must exist and be non-trivial (>10 lines)
  LOCKFILE="$STAGE_DIR/package-lock.json"
  if [ ! -f "$LOCKFILE" ]; then
    echo "  ✗ package-lock.json missing from staged dir" >&2
    DRY_RUN_ERRORS=$((DRY_RUN_ERRORS + 1))
  else
    LOCK_LINES=$(wc -l < "$LOCKFILE")
    if [ "$LOCK_LINES" -gt 10 ]; then
      echo "  ✓ package-lock.json present ($LOCK_LINES lines)"
    else
      echo "  ✗ package-lock.json exists but looks empty ($LOCK_LINES lines)" >&2
      DRY_RUN_ERRORS=$((DRY_RUN_ERRORS + 1))
    fi
  fi

  # 4. package.json must exist in staged dir
  if [ -f "$STAGE_DIR/package.json" ]; then
    echo "  ✓ package.json present"
  else
    echo "  ✗ package.json missing from staged dir" >&2
    DRY_RUN_ERRORS=$((DRY_RUN_ERRORS + 1))
  fi

  # 5. eas.json must exist in staged dir
  if [ -f "$STAGE_DIR/eas.json" ]; then
    echo "  ✓ eas.json present"
  else
    echo "  ✗ eas.json missing from staged dir" >&2
    DRY_RUN_ERRORS=$((DRY_RUN_ERRORS + 1))
  fi

  # 6. buildCommit must be stamped in staged app.config.js (placeholder replaced)
  APP_CFG="$STAGE_DIR/app.config.js"
  if [ ! -f "$APP_CFG" ]; then
    echo "  ✗ app.config.js missing from staged dir" >&2
    DRY_RUN_ERRORS=$((DRY_RUN_ERRORS + 1))
  elif grep -q 'process.env.BUILD_COMMIT' "$APP_CFG"; then
    echo "  ✗ app.config.js still contains BUILD_COMMIT placeholder — stamp failed" >&2
    DRY_RUN_ERRORS=$((DRY_RUN_ERRORS + 1))
  elif grep -q 'buildCommit:' "$APP_CFG"; then
    STAMPED_COMMIT=$(grep 'buildCommit:' "$APP_CFG" | head -1 | sed 's/.*"\([0-9a-f]*\)".*/\1/')
    echo "  ✓ buildCommit stamped in app.config.js (${STAMPED_COMMIT:0:8}...)"
  else
    echo "  ✗ buildCommit key not found in staged app.config.js" >&2
    DRY_RUN_ERRORS=$((DRY_RUN_ERRORS + 1))
  fi

  # 7. --strict-freshness smoke-test: create a fixture directory with
  #    artificially old files and confirm freshness_check.py exits non-zero.
  #    On Replit, real source-file mtimes are always recent, so this is the
  #    only way to exercise the stale-abort code path in CI.
  echo "  Running --strict-freshness smoke-test (artificially old files)..."
  FRESHCHECK_FIXTURE="$(mktemp -d /tmp/freshcheck_fixture.XXXXXX)"
  # Create stub key files in the fixture dir
  for kf in "app.json" "app.config.js" "app/_layout.tsx" "app/index.tsx"; do
    mkdir -p "$FRESHCHECK_FIXTURE/$(dirname "$kf")"
    echo "{}" > "$FRESHCHECK_FIXTURE/$kf"
  done
  # Back-date all fixture files to 48 hours ago so they are definitely stale
  python3 -c "
import os, time
fixture = '$FRESHCHECK_FIXTURE'
old_time = time.time() - 48 * 3600
for dirpath, _, files in os.walk(fixture):
    for fname in files:
        fp = os.path.join(dirpath, fname)
        os.utime(fp, (old_time, old_time))
"
  # Run freshness_check.py in strict mode (threshold=1h) against the fixture.
  # Suppress its output — we only care about the exit code.
  # Exit 1 from the checker  → smoke-test PASSES (stale files were detected).
  # Exit 0 from the checker  → smoke-test FAILS  (stale-abort path is broken).
  if python3 "$APP_DIR/scripts/freshness_check.py" "$FRESHCHECK_FIXTURE" "1" "true" > /dev/null 2>&1; then
    echo "  ✗ --strict-freshness smoke-test FAILED: stale files were NOT detected (exit 0)" >&2
    DRY_RUN_ERRORS=$((DRY_RUN_ERRORS + 1))
  else
    echo "  ✓ --strict-freshness correctly exits non-zero on stale files"
  fi
  rm -rf "$FRESHCHECK_FIXTURE"

  echo ""
  if [ "$DRY_RUN_ERRORS" -eq 0 ]; then
    echo "==> DRY-RUN PASSED: staged directory looks correct. ($STAGE_DIR)"
    echo "    (EAS build was NOT submitted — this was a dry run)"
    exit 0
  else
    echo "==> DRY-RUN FAILED: $DRY_RUN_ERRORS check(s) failed. See errors above." >&2
    echo "    Staged directory left at: $STAGE_DIR"
    exit 1
  fi
fi

# ── Live build ───────────────────────────────────────────────────────────────
echo "Building with EXPO_PUBLIC_DOMAIN=$EXPO_PUBLIC_DOMAIN"

if [ "$LOCAL_BUILD" = true ]; then
  # Local build: runs on this machine, zero EAS quota consumed.
  EAS_BUILD_SKIP_LOCKFILE_CHECK=1 EAS_NO_VCS=1 EXPO_TOKEN="$EXPO_TOKEN" \
    "$EAS_BIN" build --platform "$PLATFORM" --profile "$PROFILE" --local --non-interactive
  echo ""
  if [ "$PLATFORM" = "android" ]; then
    echo "Local build complete. Look for a *.aab in: $STAGE_DIR"
  else
    echo "Local build complete. Look for a build-*.tar.gz or *.ipa in: $STAGE_DIR"
    echo "To submit to App Store, run stage-eas-submit.sh (it picks the --latest EAS build)"
    echo "NOTE: local builds produce the archive locally but are NOT automatically uploaded"
    echo "      to EAS. Upload manually with: eas build:version:set + eas submit --path <ipa>"
  fi
else
  # Cloud build: runs on EAS workers, counted against the monthly quota.
  if ! EAS_BUILD_SKIP_LOCKFILE_CHECK=1 EAS_NO_VCS=1 EXPO_TOKEN="$EXPO_TOKEN" \
    "$EAS_BIN" build --platform "$PLATFORM" --profile "$PROFILE" --non-interactive --no-wait; then
    echo "" >&2
    echo "ERROR: eas build failed — the build was NOT queued on EAS." >&2
    echo "  Check the output above for details." >&2
    echo "  The staged directory is still at: $STAGE_DIR" >&2
    echo "  You can retry manually from there:" >&2
    echo "    cd $STAGE_DIR && EXPO_TOKEN=\"\$EXPO_TOKEN\" eas build --platform $PLATFORM --profile $PROFILE --non-interactive --no-wait" >&2
    exit 1
  fi
  echo ""
  echo "==> Build queued on EAS. ✓"
  echo "Staged project kept at: $STAGE_DIR (poll status from there with 'eas build:list')"
  if [ "$PLATFORM" = "android" ]; then
    echo "The .aab artifact will be available for download once the build finishes."
    echo "To submit to Google Play, run: eas submit --platform android --latest"
  fi
fi
