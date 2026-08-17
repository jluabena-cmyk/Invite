#!/usr/bin/env bash
# sync-from-replit.sh — Pull the latest Owmo source from Replit before staging.
#
# WHY THIS EXISTS
# ───────────────
# The EAS build Mac folder ("owmo-build 2") drifts silently from Replit because
# files changed in Replit are never automatically copied over.  Multiple builds
# were wasted because of stale app.json build numbers, missing fixes, and wrong
# app.config.js values.  Run this script before every build.
#
# WHAT IT DOES
# ────────────
# 1. Detects the git remote for this repo (origin by default).
# 2. Fetches the latest commits from the remote.
# 3. Shows which key files have changed since your local HEAD.
# 4. Asks for confirmation, then fast-forwards (git pull --ff-only) or resets
#    (--hard) to the remote branch.
# 5. Reminds you to re-run stage-eas-build.sh once the sync is done.
#
# USAGE
# ─────
#   bash scripts/sync-from-replit.sh              # interactive (recommended)
#   bash scripts/sync-from-replit.sh --hard       # reset --hard to origin/HEAD (no prompt)
#   bash scripts/sync-from-replit.sh --dry-run    # show what would change, don't pull
#   bash scripts/sync-from-replit.sh --branch main  # pull a specific branch
#
# REQUIREMENTS
# ────────────
# • git must be installed and the repo must have a remote (origin) pointing to
#   the Replit git URL (or GitHub mirror).
# • Run from inside the bill-splitter directory or the monorepo root — the
#   script resolves paths relative to its own location.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Argument parsing ──────────────────────────────────────────────────────────
HARD_RESET=false
DRY_RUN=false
REMOTE="origin"
BRANCH=""

for arg in "$@"; do
  case "$arg" in
    --hard)          HARD_RESET=true ;;
    --dry-run)       DRY_RUN=true ;;
    --remote=*)      REMOTE="${arg#--remote=}" ;;
    --branch=*)      BRANCH="${arg#--branch=}" ;;
    *)               ;;
  esac
done

echo "==> Owmo — sync from Replit"
echo "    Repo root : $REPO_ROOT"
echo "    App dir   : $APP_DIR"
if [ "$DRY_RUN" = true ]; then
  echo "    Mode      : DRY-RUN (no changes will be made)"
elif [ "$HARD_RESET" = true ]; then
  echo "    Mode      : HARD RESET (git reset --hard)"
else
  echo "    Mode      : fast-forward pull (git pull --ff-only)"
fi
echo ""

# ── Verify we are inside a git repo ──────────────────────────────────────────
if ! git -C "$REPO_ROOT" rev-parse --git-dir > /dev/null 2>&1; then
  echo "ERROR: $REPO_ROOT is not a git repository." >&2
  echo "  Make sure you cloned the Replit repo before running this script." >&2
  echo ""
  echo "  To clone from Replit:" >&2
  echo "    git clone <replit-git-url> owmo-build" >&2
  echo "  To add Replit as a remote to an existing folder:" >&2
  echo "    git remote add origin <replit-git-url>" >&2
  exit 1
fi

# ── Check the remote exists ───────────────────────────────────────────────────
if ! git -C "$REPO_ROOT" remote get-url "$REMOTE" > /dev/null 2>&1; then
  echo "ERROR: git remote '$REMOTE' not found." >&2
  echo ""
  echo "  Available remotes:"
  git -C "$REPO_ROOT" remote -v | sed 's/^/    /'
  echo ""
  echo "  To add the Replit remote:"
  echo "    git -C \"$REPO_ROOT\" remote add origin <replit-git-url>"
  exit 1
fi

REMOTE_URL="$(git -C "$REPO_ROOT" remote get-url "$REMOTE")"
echo "Remote '$REMOTE': $REMOTE_URL"

# ── Detect current branch ─────────────────────────────────────────────────────
CURRENT_BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD")"
if [ -z "$BRANCH" ]; then
  # Default to build8-sync — this is the branch Replit pushes production-ready
  # code to on jluabena-cmyk/Invite. GitHub's 'main' is an unrelated orphan branch
  # ("init" commit) and is not used for builds.
  BRANCH="build8-sync"
fi
echo "Branch: $BRANCH"
echo ""

# ── Fetch ─────────────────────────────────────────────────────────────────────
echo "==> Fetching from $REMOTE..."
git -C "$REPO_ROOT" fetch "$REMOTE" "$BRANCH" 2>&1 | sed 's/^/  /'
echo ""

# ── Show what has changed ─────────────────────────────────────────────────────
LOCAL_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
REMOTE_REF="$REMOTE/$BRANCH"
REMOTE_HEAD="$(git -C "$REPO_ROOT" rev-parse "$REMOTE_REF" 2>/dev/null || echo "")"

if [ -z "$REMOTE_HEAD" ]; then
  echo "WARNING: Could not resolve $REMOTE_REF — nothing to sync." >&2
  exit 1
fi

# ── Remote sanity guard ───────────────────────────────────────────────────────
# Never sync (fast-forward OR hard reset) to a remote ref that does not contain
# the app source. This protects against the orphan-branch failure mode: GitHub
# 'main' (and historically an early 'build8-sync') held only an "init" README
# commit — resetting to it wipes the entire working build environment.
SANITY_FILES=(
  "artifacts/bill-splitter/package.json"
  "artifacts/bill-splitter/app.config.js"
)
for sf in "${SANITY_FILES[@]}"; do
  if ! git -C "$REPO_ROOT" cat-file -e "$REMOTE_HEAD:$sf" 2>/dev/null; then
    echo "" >&2
    echo "ERROR: $REMOTE_REF does not contain '$sf'." >&2
    echo "  This remote ref looks like an orphan/empty branch (e.g. the README-only" >&2
    echo "  'init' commit). Syncing to it would DESTROY the local build environment." >&2
    echo "" >&2
    echo "  Refusing to pull or reset. Check that you are targeting the right branch:" >&2
    echo "    git -C \"$REPO_ROOT\" ls-remote $REMOTE" >&2
    echo "  The build branch is 'build8-sync' — see docs/github-build-sync.md." >&2
    exit 1
  fi
done

if [ "$LOCAL_HEAD" = "$REMOTE_HEAD" ]; then
  echo "==> Already up to date. No changes to pull."
  echo ""
  echo "  ┌─ Build SHA ──────────────────────────────────────────────────────────┐"
  printf   "  │  %s/%s  │\n" "$REMOTE" "$BRANCH"
  printf   "  │  %s  │\n" "$LOCAL_HEAD"
  echo "  └──────────────────────────────────────────────────────────────────────┘"
  echo ""
  echo "All key source files are already at the latest Replit version."
  echo "You can safely run: bash scripts/stage-eas-build.sh"
  exit 0
fi

# Count commits behind / ahead
BEHIND=$(git -C "$REPO_ROOT" rev-list --count HEAD.."$REMOTE_REF" 2>/dev/null || echo "?")
AHEAD=$(git -C "$REPO_ROOT" rev-list --count "$REMOTE_REF"..HEAD 2>/dev/null || echo "?")
echo "==> Changes detected:"
echo "    Local  : $LOCAL_HEAD"
echo "    Remote : $REMOTE_HEAD"
echo "    Behind : $BEHIND commit(s)  |  Ahead: $AHEAD commit(s)"
echo ""

# ── Show key-file diffs ───────────────────────────────────────────────────────
KEY_FILES=(
  "artifacts/bill-splitter/app.json"
  "artifacts/bill-splitter/app.config.js"
  "artifacts/bill-splitter/app/_layout.tsx"
  "artifacts/bill-splitter/app/index.tsx"
)

echo "==> Key source file status:"
STALE_COUNT=0
for rel in "${KEY_FILES[@]}"; do
  abs="$REPO_ROOT/$rel"
  # Check if the file differs between local HEAD and remote HEAD
  if git -C "$REPO_ROOT" diff --quiet HEAD "$REMOTE_REF" -- "$rel" 2>/dev/null; then
    echo "  = $rel  (no change)"
  else
    echo "  * $rel  *** CHANGED ON REMOTE ***"
    STALE_COUNT=$((STALE_COUNT + 1))
  fi
done
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "==> DRY-RUN: would pull $BEHIND commit(s) from $REMOTE/$BRANCH"
  if [ "$STALE_COUNT" -gt 0 ]; then
    echo "    $STALE_COUNT key source file(s) would be updated."
  fi
  echo "    (No changes were made — this was a dry run)"
  exit 0
fi

# ── Warn if there are local uncommitted changes ───────────────────────────────
if ! git -C "$REPO_ROOT" diff --quiet || ! git -C "$REPO_ROOT" diff --cached --quiet; then
  echo "WARNING: You have uncommitted local changes."
  echo "  These will be preserved by --ff-only pull, but lost by --hard reset."
  echo ""
  git -C "$REPO_ROOT" status --short | head -20 | sed 's/^/  /'
  echo ""
fi

# ── Confirm (interactive mode) ────────────────────────────────────────────────
if [ "$HARD_RESET" = false ] && [ -t 0 ]; then
  # Only prompt when stdin is a terminal
  read -r -p "Pull $BEHIND commit(s) from $REMOTE/$BRANCH? [Y/n] " REPLY
  REPLY="${REPLY:-Y}"
  case "$REPLY" in
    [Yy]*)  ;;
    *)
      echo "Aborted. No changes made."
      exit 0
      ;;
  esac
fi

# ── Apply the sync ────────────────────────────────────────────────────────────
if [ "$HARD_RESET" = true ]; then
  echo "==> Resetting to $REMOTE_REF (git reset --hard)..."
  git -C "$REPO_ROOT" reset --hard "$REMOTE_REF" 2>&1 | sed 's/^/  /'
else
  echo "==> Fast-forward pulling from $REMOTE/$BRANCH..."
  # Attempt fast-forward; if it fails due to divergence, fall back to reset --hard.
  # This folder is a build-only mirror — it should never have local-only commits.
  # Divergence means the Mac was initialised from a different branch (e.g. build8-sync)
  # or had manual commits that were never pushed; a hard reset is always correct here.
  #
  # set -e is temporarily disabled so we can capture the exit code before deciding
  # whether to fall back; re-enabled immediately after.
  set +e
  FF_OUTPUT="$(git -C "$REPO_ROOT" pull --ff-only "$REMOTE" "$BRANCH" 2>&1)"
  FF_EXIT=$?
  set -e
  echo "$FF_OUTPUT" | sed 's/^/  /'
  if [ $FF_EXIT -ne 0 ]; then
    if echo "$FF_OUTPUT" | grep -q "Not possible to fast-forward\|diverging\|diverged"; then
      echo ""
      echo "  Fast-forward failed because local history has diverged from $REMOTE/$BRANCH."
      if [ "$AHEAD" != "?" ] && [ "$AHEAD" -gt 0 ]; then
        echo "  Local has $AHEAD commit(s) not present on the remote."
      fi
      echo ""
      echo "  This folder is a build-only mirror — local-only commits should not exist."
      echo "  If you are certain it is safe to discard local-only commits, re-run with:"
      echo "    bash scripts/sync-from-replit.sh --hard"
      echo ""
      echo "  Otherwise, inspect the divergence with:"
      echo "    git -C \"$REPO_ROOT\" log --oneline $REMOTE_REF..HEAD"
      exit 1
    else
      echo "" >&2
      echo "ERROR: git pull failed for an unexpected reason (exit $FF_EXIT). See above." >&2
      exit 1
    fi
  fi
fi

NEW_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
echo ""
echo "==> Sync complete."
echo ""
echo "  ┌─ Build SHA ──────────────────────────────────────────────────────────┐"
printf   "  │  %s/%s  │\n" "$REMOTE" "$BRANCH"
printf   "  │  %s  │\n" "$NEW_HEAD"
echo "  └──────────────────────────────────────────────────────────────────────┘"
echo ""

if [ "$STALE_COUNT" -gt 0 ]; then
  echo "  Updated $STALE_COUNT key source file(s):"
  for rel in "${KEY_FILES[@]}"; do
    if git -C "$REPO_ROOT" diff --quiet "$LOCAL_HEAD" HEAD -- "$rel" 2>/dev/null; then
      :
    else
      echo "    ✓ $rel"
    fi
  done
  echo ""
fi

# ── Remind to update node_modules if package.json changed ────────────────────
PKG_CHANGED=false
if ! git -C "$REPO_ROOT" diff --quiet "$LOCAL_HEAD" HEAD -- "artifacts/bill-splitter/package.json" 2>/dev/null; then
  PKG_CHANGED=true
fi

echo "==> Next steps:"
if [ "$PKG_CHANGED" = true ]; then
  echo ""
  echo "  ⚠  package.json changed — update node_modules before building:"
  echo "     cd artifacts/bill-splitter && npm ci && cd -"
  echo ""
  echo "     Use npm ci (NOT npm install --legacy-peer-deps): it installs the exact"
  echo "     versions pinned in the committed package-lock.json. npm install"
  echo "     re-resolves ranges and can pull newer packages that break the native build."
  echo "     (The lockfile is regenerated and committed on Replit when deps change —"
  echo "     see docs/github-build-sync.md.)"
  echo ""
fi
echo "  Run the stage script to build with the latest code:"
echo "     bash scripts/stage-eas-build.sh"
echo ""
echo "  Tip: add --strict-freshness to abort the build if files are still stale:"
echo "     bash scripts/stage-eas-build.sh --strict-freshness"
