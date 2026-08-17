#!/usr/bin/env node
// push-to-github.js — Push Replit's main branch → build8-sync on GitHub
// using the Replit GitHub integration (no GITHUB_TOKEN secret needed).
//
// WHY THIS EXISTS
// ───────────────
// Replit commits to 'main'. The Mac's sync-from-replit.sh pulls from
// 'build8-sync' on jluabena-cmyk/Invite. Without this script the two
// branches drift silently: every task agent merge leaves build8-sync
// behind and the Mac sync reports "nothing to pull", producing stale
// builds with missing features or wrong build numbers.
//
// WHAT IT DOES
// ────────────
// 1. Calls GET /repos/.../git/refs/heads/main via the Replit GitHub proxy
//    to find the current commit SHA.
// 2. Calls PATCH /repos/.../git/refs/heads/build8-sync with force: true
//    to advance build8-sync to that SHA.
// 3. Exits 0 on success (or when already in sync), 1 on any failure.
//
// USAGE
// ─────
//   node scripts/push-to-github.js               # push main → build8-sync
//   node scripts/push-to-github.js --dry-run     # show what would be pushed
//   node scripts/push-to-github.js --force       # skip divergence guard
//
// REQUIREMENTS
// ────────────
// • Replit's GitHub integration must be connected (it already is).
// • @replit/connectors-sdk must be installed (pnpm add -w @replit/connectors-sdk).
// • Run from within the Replit environment (not on Mac — this is a Replit-side script).
// ─────────────────────────────────────────────────────────────────────────────

const REPO  = "jluabena-cmyk/Invite";
const SRC   = "main";
const DST   = "build8-sync";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE   = args.includes("--force");

async function main() {
  console.log("==> Owmo — push Replit main → GitHub build8-sync");
  console.log(`    Repo   : ${REPO}`);
  console.log(`    Source : ${SRC}`);
  console.log(`    Target : ${DST}`);
  if (DRY_RUN) console.log("    Mode   : DRY-RUN (no push will be made)");
  console.log("");

  // ── Load the Replit GitHub integration ────────────────────────────────────
  let connectors;
  try {
    const { ReplitConnectors } = require("@replit/connectors-sdk");
    connectors = new ReplitConnectors();
  } catch (e) {
    console.error("ERROR: Could not load @replit/connectors-sdk:", e.message);
    console.error("  Run: pnpm add -w @replit/connectors-sdk");
    process.exit(1);
  }

  async function ghFetch(path, init = {}) {
    const res = await connectors.proxy("github", path, init);
    if (!res) throw new Error(`No response for ${path}`);
    return res;
  }

  // ── Get SHA of source branch (main) ──────────────────────────────────────
  console.log(`==> Fetching ${SRC} ref...`);
  const srcRes = await ghFetch(`/repos/${REPO}/git/refs/heads/${SRC}`);
  if (!srcRes.ok) {
    const body = await srcRes.text();
    console.error(`ERROR: Failed to get ${SRC} ref (HTTP ${srcRes.status}):`, body.slice(0, 200));
    process.exit(1);
  }
  const srcData = await srcRes.json();
  const srcSha  = srcData.object?.sha;
  if (!srcSha) {
    console.error("ERROR: Could not extract SHA from", SRC, "ref:", JSON.stringify(srcData));
    process.exit(1);
  }
  console.log(`    ${SRC} SHA: ${srcSha}`);

  // ── Get current SHA of target branch (build8-sync) ───────────────────────
  const dstRes  = await ghFetch(`/repos/${REPO}/git/refs/heads/${DST}`);
  let   dstSha  = null;
  if (dstRes.ok) {
    const dstData = await dstRes.json();
    dstSha = dstData.object?.sha ?? null;
  }
  console.log(`    ${DST} SHA: ${dstSha ?? "(branch does not exist yet)"}`);
  console.log("");

  // ── Already in sync? ──────────────────────────────────────────────────────
  if (srcSha === dstSha) {
    console.log("==> Already up to date.");
    console.log(`    ${DST} is already at the same commit as ${SRC}.`);
    console.log("    The Mac's sync-from-replit.sh will find nothing to pull — that is correct.");
    console.log("");
    console.log("==> Nothing to push. ✓");
    process.exit(0);
  }

  // ── Divergence guard ──────────────────────────────────────────────────────
  // We can't do a local git rev-list via this API path, but we can check via
  // the compare endpoint: if build8-sync has commits not in main, that's unexpected.
  if (dstSha && !FORCE) {
    const cmpRes = await ghFetch(`/repos/${REPO}/compare/${SRC}...${DST}`);
    if (cmpRes.ok) {
      const cmp = await cmpRes.json();
      if (cmp.ahead_by && cmp.ahead_by > 0) {
        console.error(`WARNING: ${DST} is ${cmp.ahead_by} commit(s) ahead of ${SRC}.`);
        console.error(`  This is unexpected — ${DST} should be a pure mirror of ${SRC}.`);
        console.error("  Pushing now would overwrite those commits (force-push).");
        console.error("  If you are sure, rerun with --force to skip this guard.");
        process.exit(1);
      }
    }
  }

  // ── Dry-run output ────────────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log(`==> DRY-RUN: would push ${SRC} → ${DST}`);
    console.log(`    Old SHA: ${dstSha ?? "(new branch)"}`);
    console.log(`    New SHA: ${srcSha}`);
    console.log("");
    console.log("==> DRY-RUN complete. No changes were made.");
    process.exit(0);
  }

  // ── Push: PATCH the target branch ref ────────────────────────────────────
  console.log(`==> Pushing ${SRC} → ${DST}...`);
  const patchBody = JSON.stringify({ sha: srcSha, force: true });
  let   patchRes;

  if (dstSha) {
    // Branch exists — update it
    patchRes = await ghFetch(`/repos/${REPO}/git/refs/heads/${DST}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: patchBody,
    });
  } else {
    // Branch doesn't exist — create it
    patchRes = await ghFetch(`/repos/${REPO}/git/refs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${DST}`, sha: srcSha }),
    });
  }

  const patchData = await patchRes.json();
  if (!patchRes.ok) {
    console.error(`ERROR: Push failed (HTTP ${patchRes.status}):`, JSON.stringify(patchData));
    process.exit(1);
  }

  const newSha = patchData.object?.sha ?? srcSha;
  const short  = newSha.slice(0, 8);

  console.log("");
  console.log("==> Pushed successfully. ✓");
  console.log(`    ${DST} is now at: ${newSha} (${short}...)`);
  console.log(`    Old SHA was   : ${dstSha ?? "(new branch)"}`);
  console.log("");
  console.log("==> Next step on Mac:");
  console.log("    bash scripts/sync-from-replit.sh");
  console.log("    bash scripts/stage-eas-build.sh");
}

main().catch(e => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
