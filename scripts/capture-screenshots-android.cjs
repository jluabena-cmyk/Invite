#!/usr/bin/env node
/**
 * capture-screenshots-android.cjs
 *
 * Renders each ScreenshotAndroid component (ScreenshotAndroid1–5) in a real
 * Chromium browser at native 1080×1920 px (Android phone portrait) via Playwright.
 *
 * Strategy
 * --------
 * The components are authored at 390×693 CSS px (9:16 aspect ratio at iPhone logical width).
 * The Play Store target is 1080×1920 px.
 *
 * We set Playwright's viewport to 360×640 logical px + deviceScaleFactor=3:
 *   360 × 3 = 1080 px  (width)
 *   640 × 3 = 1920 px  (height)
 *
 * A CSS zoom of (360/390 ≈ 0.9231) is injected so the 390×693 component
 * scales down to fill the 360×640 viewport before Playwright rasterises at 3×
 * density. This gives true sub-pixel font rendering at native resolution.
 *
 * Emoji rendering
 * ---------------
 * NixOS headless Chromium has no emoji font installed, causing glyphs to render
 * as tofu boxes. We inject Twemoji (Twitter emoji) after page load — it replaces
 * every emoji character with a <img> tag pointing to a CDN SVG, giving identical
 * rendering to any app or platform.
 *
 * Usage:
 *   node scripts/capture-screenshots-android.cjs
 *
 * Outputs: screenshots/android/Screenshot1.png through Screenshot5.png
 */

"use strict";

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = "http://localhost:80/__mockup/preview";

const SCREENSHOTS = [
  { name: "ScreenshotAndroid1", file: "Screenshot1.png" },
  { name: "ScreenshotAndroid2", file: "Screenshot2.png" },
  { name: "ScreenshotAndroid3", file: "Screenshot3.png" },
  { name: "ScreenshotAndroid4", file: "Screenshot4.png" },
  { name: "ScreenshotAndroid5", file: "Screenshot5.png" },
];

const OUT_DIR = path.resolve(__dirname, "../screenshots/android");

// Logical viewport dimensions that give 1080×1920 at 3× DPR
const LOGICAL_W = 360;
const LOGICAL_H = 640;
const DPR = 3;

// The components are fixed at 390×693. Scale them to fill 360×640.
const ZOOM = LOGICAL_W / 390; // 360/390 ≈ 0.9231

// Twemoji CDN — loaded as a script tag so it can run twemoji.parse()
const TWEMOJI_CDN = "https://cdn.jsdelivr.net/npm/@twemoji/api@latest/dist/twemoji.min.js";
const TWEMOJI_ASSETS_BASE = "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/";

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

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

    // Wait for Google Fonts to load
    await page.waitForTimeout(1500);

    // Inject Twemoji to replace emoji characters with <img> tags so they render
    // correctly in headless Chromium (which has no emoji font installed)
    await page.addScriptTag({ url: TWEMOJI_CDN });
    await page.waitForTimeout(500);
    await page.evaluate((base) => {
      // @ts-ignore
      twemoji.parse(document.body, {
        folder: "svg",
        ext: ".svg",
        base,
        // Keep emoji images inline with text — match line-height
        callback: (icon, options) => `${options.base}${options.size}/${icon}${options.ext}`,
        attributes: () => ({ style: "height:1em;width:1em;margin:0 .05em;vertical-align:-0.1em;" }),
      });
    }, TWEMOJI_ASSETS_BASE);

    // Wait for SVG images to load (they come from CDN)
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Apply zoom so 390px component fills the 360px logical viewport
    await page.evaluate((zoom) => {
      document.documentElement.style.margin = "0";
      document.documentElement.style.padding = "0";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.overflow = "hidden";
      document.body.style.zoom = String(zoom);
    }, ZOOM);

    // Allow layout to settle after zoom
    await page.waitForTimeout(300);

    // Capture exactly the 360×640 logical viewport (= 1080×1920 physical px)
    const buffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: LOGICAL_W, height: LOGICAL_H },
    });

    fs.writeFileSync(outPath, buffer);
    console.log(`  ✓ saved ${outPath} (${buffer.length} bytes)`);

    await context.close();
  }

  await browser.close();
  console.log("\nAll 5 Android screenshots captured at 1080×1920 px.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
