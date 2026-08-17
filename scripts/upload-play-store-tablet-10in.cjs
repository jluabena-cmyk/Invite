#!/usr/bin/env node
/**
 * upload-play-store-tablet-10in.cjs
 *
 * Uploads Android 10-inch tablet screenshots to the Google Play Store listing
 * via the Google Play Developer API (v3).
 *
 * Required env vars:
 *   PLAY_SERVICE_ACCOUNT_JSON  — Full contents of the service account key JSON
 *                                file downloaded from Google Cloud Console.
 *                                The service account must have the
 *                                "Release manager" (or higher) role granted in
 *                                Play Console → Setup → API access.
 *   PLAY_PACKAGE_NAME          — Android application ID, e.g. com.example.app
 *
 * Optional env vars:
 *   PLAY_LANGUAGE              — BCP-47 language tag for the listing to update
 *                                (default: "en-US")
 *
 * Usage:
 *   node scripts/upload-play-store-tablet-10in.cjs [--language en-US]
 *
 * What it does:
 *   1. Creates a new draft edit for the app.
 *   2. Deletes all existing tenInchScreenshots for the listing language
 *      so the new set fully replaces the old one.
 *   3. Uploads every .png file in screenshots/android-tablet-10in/ in sorted order.
 *   4. Commits the edit, making the change live in the draft listing.
 *
 * Required Google Cloud / Play Console setup:
 *   - Enable the "Google Play Android Developer API" in Google Cloud Console.
 *   - Create a service account in Google Cloud Console and download its JSON key.
 *   - In Play Console → Setup → API access, link the Cloud project and grant
 *     the service account at least the "Release manager" role.
 *
 * Screenshots directory: screenshots/android-tablet-10in/
 * Target image type:     tenInchScreenshots  (1600×2560 px)
 */

"use strict";

const crypto = require("crypto");
const https = require("https");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SERVICE_ACCOUNT_JSON = process.env.PLAY_SERVICE_ACCOUNT_JSON;
const PACKAGE_NAME = process.env.PLAY_PACKAGE_NAME;

const _langArg = process.argv.find((a) => a.startsWith("--language="));
const _langIdx = process.argv.indexOf("--language");
const LANGUAGE =
  _langArg
    ? _langArg.split("=")[1]
    : _langIdx !== -1
    ? process.argv[_langIdx + 1]
    : process.env.PLAY_LANGUAGE || "en-US";

const SCREENSHOT_DIR = path.resolve(__dirname, "../screenshots/android-tablet-10in");
const IMAGE_TYPE = "tenInchScreenshots";
const PLAY_API_HOST = "androidpublisher.googleapis.com";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = ["https://www.googleapis.com/auth/androidpublisher"];

// ---------------------------------------------------------------------------
// Preflight checks
// ---------------------------------------------------------------------------
function preflight() {
  const missing = [];
  if (!SERVICE_ACCOUNT_JSON) missing.push("PLAY_SERVICE_ACCOUNT_JSON");
  if (!PACKAGE_NAME) missing.push("PLAY_PACKAGE_NAME");
  if (missing.length) {
    console.error("Missing required environment variables:", missing.join(", "));
    console.error(
      "\nSee the script header for setup instructions.\n" +
        "Credentials must be set as Replit Secrets:\n" +
        "  PLAY_SERVICE_ACCOUNT_JSON  — contents of the service account key .json file\n" +
        "  PLAY_PACKAGE_NAME          — e.g. com.example.myapp"
    );
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
  } catch {
    console.error("PLAY_SERVICE_ACCOUNT_JSON is not valid JSON.");
    process.exit(1);
  }

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    console.error(`Screenshot directory not found: ${SCREENSHOT_DIR}`);
    console.error("Run scripts/capture-screenshots-tablet-10in.cjs first.");
    process.exit(1);
  }

  const files = fs
    .readdirSync(SCREENSHOT_DIR)
    .filter((f) => f.endsWith(".png"))
    .sort();

  if (files.length === 0) {
    console.error(`No .png files found in ${SCREENSHOT_DIR}`);
    process.exit(1);
  }

  console.log(`Package:  ${PACKAGE_NAME}`);
  console.log(`Language: ${LANGUAGE}`);
  console.log(`Files:    ${files.join(", ")}`);

  return { serviceAccount, files };
}

// ---------------------------------------------------------------------------
// JWT / OAuth2 — service account → short-lived access token
// ---------------------------------------------------------------------------
function buildServiceAccountJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: SCOPES.join(" "),
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");
  const data = `${header}.${payload}`;
  const sign = crypto.createSign("SHA256");
  sign.update(data);
  sign.end();
  const sig = sign.sign(serviceAccount.private_key, "base64url");
  return `${data}.${sig}`;
}

async function fetchAccessToken(serviceAccount) {
  const jwt = buildServiceAccountJwt(serviceAccount);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  }).toString();

  return new Promise((resolve, reject) => {
    const url = new URL(GOOGLE_TOKEN_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Token request failed HTTP ${res.statusCode}: ${data}`));
          return;
        }
        const parsed = JSON.parse(data);
        if (!parsed.access_token) {
          reject(new Error(`No access_token in response: ${data}`));
          return;
        }
        resolve(parsed.access_token);
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// HTTP helpers — Google Play Developer API
// ---------------------------------------------------------------------------
function playRequest(method, apiPath, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: PLAY_API_HOST,
      path: apiPath,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(
            new Error(
              `Play API ${method} ${apiPath} → HTTP ${res.statusCode}\n${data}`
            )
          );
          return;
        }
        resolve(data ? JSON.parse(data) : null);
      });
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function uploadImage(editId, token, filename, fileBuffer) {
  return new Promise((resolve, reject) => {
    const boundary = `boundary_${crypto.randomBytes(16).toString("hex")}`;
    const metadataPart = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{}\r\n`
    );
    const mediaPart = Buffer.from(
      `--${boundary}\r\nContent-Type: image/png\r\n\r\n`
    );
    const closingBoundary = Buffer.from(`\r\n--${boundary}--`);
    const body = Buffer.concat([metadataPart, mediaPart, fileBuffer, closingBoundary]);

    const apiPath =
      `/upload/androidpublisher/v3/applications/${PACKAGE_NAME}/edits/${editId}` +
      `/listings/${LANGUAGE}/${IMAGE_TYPE}` +
      `?uploadType=multipart`;

    const options = {
      hostname: PLAY_API_HOST,
      path: apiPath,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": body.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(
            new Error(
              `Image upload ${filename} → HTTP ${res.statusCode}\n${data}`
            )
          );
          return;
        }
        resolve(data ? JSON.parse(data) : null);
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { serviceAccount, files } = preflight();

  console.log("\n==> Fetching OAuth2 access token...");
  const token = await fetchAccessToken(serviceAccount);
  console.log("   Access token obtained.");

  // 1. Open a new edit
  console.log("\n==> Creating draft edit...");
  const editRes = await playRequest(
    "POST",
    `/androidpublisher/v3/applications/${PACKAGE_NAME}/edits`,
    token,
    {}
  );
  const editId = editRes.id;
  console.log(`   Edit ID: ${editId}`);

  try {
    // 2. Clear existing tenInchScreenshots for this language so the new set
    //    fully replaces the old one rather than appending.
    console.log(`\n==> Clearing existing ${IMAGE_TYPE} for locale ${LANGUAGE}...`);
    await playRequest(
      "DELETE",
      `/androidpublisher/v3/applications/${PACKAGE_NAME}/edits/${editId}/listings/${LANGUAGE}/${IMAGE_TYPE}`,
      token,
      null
    );
    console.log("   Existing screenshots cleared.");

    // 3. Upload each screenshot
    console.log(`\n==> Uploading ${files.length} screenshots...`);
    for (let i = 0; i < files.length; i++) {
      const filename = files[i];
      const filepath = path.join(SCREENSHOT_DIR, filename);
      const fileBuffer = fs.readFileSync(filepath);
      console.log(
        `\n   [${i + 1}/${files.length}] ${filename} (${(fileBuffer.length / 1024).toFixed(0)} KB)`
      );
      const imgRes = await uploadImage(editId, token, filename, fileBuffer);
      console.log(`   Uploaded — url: ${imgRes?.image?.url ?? "(no url returned)"}`);
    }

    // 4. Commit the edit
    console.log("\n==> Committing edit...");
    const commitRes = await playRequest(
      "POST",
      `/androidpublisher/v3/applications/${PACKAGE_NAME}/edits/${editId}:commit`,
      token,
      null
    );
    console.log(`   Committed. Edit expiry: ${commitRes?.expiryTimeSeconds ?? "n/a"}`);
  } catch (err) {
    // Attempt to delete the abandoned edit to avoid leaving dangling drafts
    console.error("\n✗ Error during upload — attempting to discard edit...");
    try {
      await playRequest(
        "DELETE",
        `/androidpublisher/v3/applications/${PACKAGE_NAME}/edits/${editId}`,
        token,
        null
      );
      console.error("   Edit discarded.");
    } catch {
      console.error("   Could not discard edit (it will expire automatically).");
    }
    throw err;
  }

  console.log(
    `\n✓ All ${files.length} 10-inch tablet screenshots uploaded to the Play Store listing.`
  );
  console.log(
    "  Open Play Console → Store presence → Store listing → Tablet screenshots to confirm."
  );
  console.log(
    `  https://play.google.com/console/u/0/developers/app/${PACKAGE_NAME}/app-content/store-listing`
  );
}

main().catch((err) => {
  console.error("\n✗ Upload failed:", err.message || err);
  process.exit(1);
});
