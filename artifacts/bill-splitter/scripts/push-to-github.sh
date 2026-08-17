#!/usr/bin/env bash
# push-to-github.sh — Push Replit's main branch → build8-sync on GitHub.
#
# WHY THIS EXISTS
# ───────────────
# Replit commits to 'main'. The Mac's sync-from-replit.sh pulls from
# 'build8-sync' on jluabena-cmyk/Invite. Without this script the two
# branches drift silently: every task agent merge leaves build8-sync
# behind and the Mac sync reports "nothing to pull" — producing stale
# builds with missing features, wrong build numbers, or broken patches.
#
# Run this from Replit (or any CI step) after merging a task to keep the
# Mac always one fast-forward pull away from the latest code.
#
# WHAT IT DOES
# ────────────
# Uses the Replit GitHub integration (already connected, no extra token
# needed) to force-push main's commit SHA to the build8-sync branch via
# the GitHub REST API.
#
# USAGE
# ─────
#   bash scripts/push-to-github.sh              # push main → build8-sync
#   bash scripts/push-to-github.sh --dry-run    # show what would be pushed, don't push
#   bash scripts/push-to-github.sh --force      # skip the divergence guard
#
# REQUIREMENTS
# ────────────
# • Replit's GitHub integration must be connected (already is for this project).
# • @replit/connectors-sdk must be installed (already installed in the monorepo).
# • Run from within the Replit environment — this is NOT a Mac-side script.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Forward all arguments to the Node.js implementation
exec node "$SCRIPT_DIR/push-to-github.js" "$@"
