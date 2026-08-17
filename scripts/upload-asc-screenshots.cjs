#!/usr/bin/env node
/**
 * upload-asc-screenshots.js
 *
 * Uploads App Store screenshots to App Store Connect via the REST API.
 *
 * Required env vars:
 *   ASC_KEY_ID      — API Key ID (e.g. XKFJ37U826)
 *   ASC_ISSUER_ID   — API Issuer ID (UUID)
 *   ASC_API_KEY_P8  — Full content of the AuthKey_<KeyID>.p8 file
 *   ASC_APP_ID      — Numeric App ID from App Store Connect (e.g. 6790176677)
 *
 * Usage:
 *   node scripts/upload-asc-screenshots.js [--display 6.7|6.5] [--locale en-US]
 *
 * Display sizes supported:
 *   6.7  → 1290×2796 px  (IPHONE_67) — screenshots/hires-1290x2796/
 *   6.5  → 1284×2778 px  (IPHONE_65) — screenshots/hires-1284x2778/
 */

const crypto = require("crypto");
const https = require("https");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
// Normalize the private key: secrets may be stored as a single line with spaces
// (no newlines) or with literal \n. Reconstruct proper PEM with 64-char lines.
function normalizePem(raw) {
  if (!raw) return "";
  const s = raw.replace(/\\n/g, "\n").trim();
  // If it already has real newlines it's fine
  if (s.includes("\n")) return s;
  // Single-line: reconstruct PEM from the base64 body
  const headerMatch = s.match(/-----BEGIN ([^-]+)-----\s*([\s\S]*?)\s*-----END [^-]+-----/);
  if (headerMatch) {
    const type = headerMatch[1];
    const b64 = headerMatch[2].replace(/\s+/g, "");
    const lines = b64.match(/.{1,64}/g).join("\n");
    return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
  }
  return s;
}
const PRIVATE_KEY_PEM = normalizePem(process.env.ASC_API_KEY_P8);
const APP_ID = process.env.ASC_APP_ID || "6790176677";

const _displayIdx = process.argv.indexOf("--display");
const _displayEq = process.argv.find((a) => a.startsWith("--display="));
const DISPLAY_ARG = _displayEq
  ? _displayEq.split("=")[1]
  : _displayIdx !== -1
  ? process.argv[_displayIdx + 1]
  : null;
if (!DISPLAY_ARG) {
  console.error("Error: --display is required. Use --display 6.7 or --display 6.5");
  process.exit(1);
}

const LOCALE_ARG = process.argv.find((a) => a.startsWith("--locale="))
  ? process.argv.find((a) => a.startsWith("--locale=")).split("=")[1]
  : process.argv[process.argv.indexOf("--locale") + 1] || "en-US";

const DISPLAY_CONFIG = {
  "6.7": { type: "APP_IPHONE_67", dir: "screenshots/hires-1290x2796", w: 1290, h: 2796 },
  "6.5": { type: "APP_IPHONE_65", dir: "screenshots/hires-1284x2778", w: 1284, h: 2778 },
};

const ASC_BASE = "api.appstoreconnect.apple.com";

// ---------------------------------------------------------------------------
// Preflight checks
// ---------------------------------------------------------------------------
function preflight() {
  const missing = [];
  if (!KEY_ID) missing.push("ASC_KEY_ID");
  if (!ISSUER_ID) missing.push("ASC_ISSUER_ID");
  if (!PRIVATE_KEY_PEM) missing.push("ASC_API_KEY_P8");
  if (!APP_ID) missing.push("ASC_APP_ID");
  if (missing.length) {
    console.error("Missing required environment variables:", missing.join(", "));
    process.exit(1);
  }
  if (!DISPLAY_CONFIG[DISPLAY_ARG]) {
    console.error(`Unknown --display "${DISPLAY_ARG}". Use 6.7 or 6.5.`);
    process.exit(1);
  }
  const { dir, w, h } = DISPLAY_CONFIG[DISPLAY_ARG];
  if (!fs.existsSync(dir)) {
    console.error(`Screenshot directory not found: ${dir}`);
    console.error("Run the scaling step first, or verify the path.");
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jpg") || f.endsWith(".png"));
  if (files.length === 0) {
    console.error(`No .jpg or .png files found in ${dir}`);
    process.exit(1);
  }
  console.log(`Display: ${DISPLAY_ARG}" (${w}×${h}) — type ${DISPLAY_CONFIG[DISPLAY_ARG].type}`);
  console.log(`Locale:  ${LOCALE_ARG}`);
  console.log(`Files:   ${files.join(", ")}`);
  return files.sort();
}

// ---------------------------------------------------------------------------
// JWT generation (ES256, ASC requirement)
// ---------------------------------------------------------------------------
function generateJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" })).toString("base64url");
  const data = `${header}.${payload}`;
  const sign = crypto.createSign("SHA256");
  sign.update(data);
  sign.end();
  const sig = sign.sign({ key: PRIVATE_KEY_PEM, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${data}.${sig}`;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function ascRequest(method, path, body, jwt) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: ASC_BASE,
      path,
      method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`ASC API ${method} ${path} → HTTP ${res.statusCode}\n${data}`));
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

function uploadBytes(uploadUrl, fileBuffer, contentType) {
  return new Promise((resolve, reject) => {
    const url = new URL(uploadUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length,
      },
    };
    const mod = url.protocol === "https:" ? https : require("http");
    const req = mod.request(options, (res) => {
      res.resume();
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Upload PUT → HTTP ${res.statusCode}`));
        } else {
          resolve();
        }
      });
    });
    req.on("error", reject);
    req.write(fileBuffer);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const files = preflight();
  const { type: screenshotType, dir } = DISPLAY_CONFIG[DISPLAY_ARG];

  console.log("\n==> Generating JWT...");
  const jwt = generateJwt();

  // 1. Find the correct editable iOS version.
  // Priority: PREPARE_FOR_SUBMISSION > DEVELOPER_REJECTED > WAITING_FOR_REVIEW/IN_REVIEW.
  // We sort by createdDate descending to always pick the newest when multiple exist.
  console.log("\n==> Fetching app store versions...");
  const versionsRes = await ascRequest(
    "GET",
    `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&filter[appStoreState]=PREPARE_FOR_SUBMISSION,DEVELOPER_REJECTED,WAITING_FOR_REVIEW,IN_REVIEW&fields[appStoreVersions]=versionString,appStoreState,createdDate`,
    null,
    jwt
  );
  let versions = (versionsRes.data || []);

  // Prefer PREPARE_FOR_SUBMISSION over any other state
  const STATE_PRIORITY = ["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "WAITING_FOR_REVIEW", "IN_REVIEW"];
  versions.sort((a, b) => {
    const pa = STATE_PRIORITY.indexOf(a.attributes.appStoreState);
    const pb = STATE_PRIORITY.indexOf(b.attributes.appStoreState);
    if (pa !== pb) return pa - pb;
    // Same priority: newest first
    return new Date(b.attributes.createdDate) - new Date(a.attributes.createdDate);
  });

  if (versions.length === 0) {
    throw new Error(
      "No editable iOS App Store version found in PREPARE_FOR_SUBMISSION or DEVELOPER_REJECTED state. " +
      "Create or re-open a version in App Store Connect first."
    );
  }
  const version = versions[0];
  console.log(`   Version: ${version.attributes.versionString} (${version.attributes.appStoreState}) — id: ${version.id}`);

  // 2. Find the localization
  console.log(`\n==> Fetching localizations for version ${version.id}...`);
  const locsRes = await ascRequest("GET", `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`, null, jwt);
  const localizations = locsRes.data;
  let localization = localizations.find((l) => l.attributes.locale === LOCALE_ARG);
  if (!localization) {
    console.log(`   Locale ${LOCALE_ARG} not found. Available: ${localizations.map((l) => l.attributes.locale).join(", ")}`);
    localization = localizations[0];
    console.log(`   Falling back to: ${localization.attributes.locale}`);
  }
  console.log(`   Localization: ${localization.attributes.locale} (${localization.id})`);

  // 3. Find or create the screenshot set
  console.log(`\n==> Fetching screenshot sets...`);
  const setsRes = await ascRequest("GET", `/v1/appStoreVersionLocalizations/${localization.id}/appScreenshotSets`, null, jwt);
  let screenshotSet = setsRes.data.find((s) => s.attributes.screenshotDisplayType === screenshotType);

  if (!screenshotSet) {
    console.log(`   Creating ${screenshotType} screenshot set...`);
    const createRes = await ascRequest(
      "POST",
      "/v1/appScreenshotSets",
      {
        data: {
          type: "appScreenshotSets",
          attributes: { screenshotDisplayType: screenshotType },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: "appStoreVersionLocalizations", id: localization.id },
            },
          },
        },
      },
      jwt
    );
    screenshotSet = createRes.data;
    console.log(`   Created screenshot set: ${screenshotSet.id}`);
  } else {
    console.log(`   Found existing screenshot set: ${screenshotSet.id}`);
  }

  // 4. Upload each screenshot
  console.log(`\n==> Uploading ${files.length} screenshots...`);
  const uploadedIds = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filepath = path.join(dir, filename);
    const fileBuffer = fs.readFileSync(filepath);
    const fileSize = fileBuffer.length;
    const mimeType = filename.endsWith(".png") ? "image/png" : "image/jpeg";

    console.log(`\n   [${i + 1}/${files.length}] ${filename} (${(fileSize / 1024).toFixed(0)} KB)`);

    // Reserve
    const reserveRes = await ascRequest(
      "POST",
      "/v1/appScreenshots",
      {
        data: {
          type: "appScreenshots",
          attributes: { fileName: filename, fileSize },
          relationships: {
            appScreenshotSet: {
              data: { type: "appScreenshotSets", id: screenshotSet.id },
            },
          },
        },
      },
      jwt
    );
    const screenshot = reserveRes.data;
    console.log(`   Reserved: ${screenshot.id}`);

    // Upload parts
    const uploadOps = screenshot.attributes.uploadOperations;
    for (const op of uploadOps) {
      const chunk = fileBuffer.slice(op.offset, op.offset + op.length);
      const headers = {};
      for (const h of op.requestHeaders) {
        headers[h.name] = h.value;
      }
      await new Promise((resolve, reject) => {
        const url = new URL(op.url);
        const reqOptions = {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: op.method,
          headers: { ...headers, "Content-Length": chunk.length },
        };
        const mod = url.protocol === "https:" ? https : require("http");
        const req = mod.request(reqOptions, (res) => {
          res.resume();
          res.on("end", () => {
            if (res.statusCode >= 400) {
              reject(new Error(`Upload part → HTTP ${res.statusCode}`));
            } else {
              resolve();
            }
          });
        });
        req.on("error", reject);
        req.write(chunk);
        req.end();
      });
      console.log(`   Uploaded part (offset=${op.offset}, length=${op.length})`);
    }

    // Commit
    const commitRes = await ascRequest(
      "PATCH",
      `/v1/appScreenshots/${screenshot.id}`,
      {
        data: {
          type: "appScreenshots",
          id: screenshot.id,
          attributes: { uploaded: true, sourceFileChecksum: md5hex(fileBuffer) },
        },
      },
      jwt
    );
    const state = commitRes.data.attributes.assetDeliveryState;
    console.log(`   Committed. Delivery state: ${JSON.stringify(state)}`);
    uploadedIds.push(screenshot.id);
  }

  console.log(`\n✓ All ${uploadedIds.length} screenshots uploaded successfully.`);
  console.log("  Check App Store Connect → Previews and Screenshots to confirm.");
  console.log(`  App: https://appstoreconnect.apple.com/apps/${APP_ID}/distribution/info`);
}

function md5hex(buf) {
  return crypto.createHash("md5").update(buf).digest("hex");
}

main().catch((err) => {
  console.error("\n✗ Upload failed:", err.message || err);
  process.exit(1);
});
