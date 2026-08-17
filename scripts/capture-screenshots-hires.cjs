#!/usr/bin/env node
/**
 * capture-screenshots-hires.cjs
 *
 * Renders each Screenshot component (Screenshot1–5) in a real Chromium browser
 * at native 1290×2796 px resolution via Playwright.
 *
 * Strategy
 * --------
 * The components are authored at 390×844 CSS px (iPhone 14 Pro logical size).
 * The App Store target is 1290×2796 px (iPhone 16 Pro Max physical pixels).
 *
 * We set Playwright's viewport to 430×932 logical px + deviceScaleFactor=3:
 *   430 × 3 = 1290 px  (width)
 *   932 × 3 = 2796 px  (height)
 *
 * A CSS zoom of (430/390 ≈ 1.1026) is injected into the page so the 390×844
 * component expands to fill the 430×932 viewport before Playwright rasterises
 * at 3× density. This gives true sub-pixel font rendering at native resolution
 * rather than post-hoc ImageMagick upscaling.
 *
 * Usage:
 *   node scripts/capture-screenshots-hires.cjs
 *
 * Outputs: screenshots/hires-1290x2796/owmo-sc{1-5}.jpg
 */

"use strict";

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = "http://localhost:80/__mockup/preview";

const SCREENSHOTS = [
  { name: "Screenshot1", file: "owmo-sc1.jpg" },
  { name: "Screenshot2", file: "owmo-sc2.jpg" },
  { name: "Screenshot3", file: "owmo-sc3.jpg" },
  { name: "Screenshot4", file: "owmo-sc4.jpg" },
  { name: "Screenshot5", file: "owmo-sc5.jpg" },
];

const OUT_DIR = path.resolve(__dirname, "../screenshots/hires-1290x2796");

// Logical viewport dimensions that give 1290×2796 at 3× DPR
const LOGICAL_W = 430;
const LOGICAL_H = 932;
const DPR = 3;

// The components are fixed at 390×844. Scale them to fill 430×932.
const ZOOM = LOGICAL_W / 390; // ≈ 1.10256

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Use the system Chromium installed via Nix (has all required shared libs)
  const executablePath = process.env.CHROMIUM_PATH ||
    require("child_process").execSync("which chromium 2>/dev/null || which chromium-browser 2>/dev/null").toString().trim();

  const browser = await chromium.launch({ headless: true, executablePath });

  for (const { name, file } of SCREENSHOTS) {
    const outPath = path.join(OUT_DIR, file);
    console.log(`Capturing ${name} → ${file} …`);

    const context = await browser.newContext({
      viewport: { width: LOGICAL_W, height: LOGICAL_H },
      deviceScaleFactor: DPR,
    });

    const page = await context.newPage();

    // Load the component preview
    await page.goto(`${BASE_URL}/${name}`, { waitUntil: "networkidle" });

    // Wait for Google Fonts to load (the components link them inline)
    await page.waitForTimeout(1500);

    // Apply zoom so 390px component fills the 430px logical viewport
    await page.evaluate((zoom) => {
      document.documentElement.style.margin = "0";
      document.documentElement.style.padding = "0";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.overflow = "hidden";
      document.body.style.zoom = String(zoom);
    }, ZOOM);

    // Allow layout to settle after zoom
    await page.waitForTimeout(200);

    // Capture exactly the 430×932 logical viewport (= 1290×2796 physical px)
    const buffer = await page.screenshot({
      type: "jpeg",
      quality: 95,
      clip: { x: 0, y: 0, width: LOGICAL_W, height: LOGICAL_H },
    });

    fs.writeFileSync(outPath, buffer);
    console.log(`  ✓ saved ${outPath} (${buffer.length} bytes)`);

    await context.close();
  }

  await browser.close();
  console.log("\nAll screenshots captured at 1290×2796 px.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
