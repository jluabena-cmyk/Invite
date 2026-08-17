# GitHub build sync — branch strategy for jluabena-cmyk/Invite

This document explains how source code flows from Replit to the Mac that runs
EAS iOS builds, and how to recover the build environment from scratch.

## Branches

| Branch | Contents | Use |
| --- | --- | --- |
| `build8-sync` | **The real code.** Full monorepo history, kept in sync with Replit `main`. | The Mac clones and pulls this branch. Always build from it. |
| `main` (GitHub) | Orphan "init" commit (README only). No shared history with the code. | **Never pull, reset to, or build from it.** |

Flow: Replit `main` → (push) → GitHub `origin/build8-sync` → (sync script) → Mac working copy.

- On Replit, pushing is done with the internal GitHub integration:
  `gitPush({ branch: "build8-sync" })` (plain `git push origin ...` has no credentials).
- The stage script (`stage-eas-build.sh`) blocks real builds on Replit if `main`
  has commits not yet pushed to `origin/build8-sync`.
- On the Mac, `sync-from-replit.sh` pulls `origin/build8-sync` (its default) and
  refuses to fast-forward or hard-reset to any ref that does not contain the app
  source (guards against the orphan `main` branch wiping the working copy).

## Recovering the Mac build environment from scratch

If the Mac folder is lost, corrupted, or wiped:

```bash
git clone --branch build8-sync https://github.com/jluabena-cmyk/Invite owmo-build
cd owmo-build/artifacts/bill-splitter
npm ci            # package-lock.json is committed and pinned to known-good versions
cd ../..
bash artifacts/bill-splitter/scripts/stage-eas-build.sh --dry-run   # verify staging works
```

Notes:
- Use `npm ci`, **not** `npm install --legacy-peer-deps`, after a fresh clone or
  reset. `npm ci` installs the exact versions in the committed
  `artifacts/bill-splitter/package-lock.json`, which match
  `scripts/native-deps-baseline.json`. `npm install` re-resolves ranges and can
  pull newer packages that break the native (Xcode) build.
- Environment variables (`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`,
  `EXPO_PUBLIC_CLERK_PROXY_URL`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_TOKEN`) live in
  the Mac shell profile, not in git — restore them separately.
- Full Mac workflow and known pitfalls: `.agents/memory/eas-ios-build.md`.

## Keeping the lockfile up to date

Whenever `artifacts/bill-splitter/package.json` dependencies change, regenerate
the standalone lockfile from the pinned installed versions (the same pinning the
stage script performs) and commit it. A lockfile that references the pnpm
workspace store (`../../node_modules/.pnpm/...`) is broken for standalone
clones — the lockfile must resolve from the npm registry.

## Sync script behavior on divergence

`sync-from-replit.sh` fast-forwards only. If local history has diverged it
**stops with an error** and prints the divergent commits — it never silently
hard-resets. A hard reset requires the explicit `--hard` flag, and even then the
remote-sanity guard refuses to reset to a branch missing the app source.
