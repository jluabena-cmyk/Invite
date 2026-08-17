#!/usr/bin/env node
/**
 * capture-screenshots-tablet.cjs
 *
 * Renders each ScreenshotTablet component (ScreenshotTablet1–5) in a real
 * Chromium browser at 1200×1920 px (Android 7-inch tablet portrait) via Playwright.
 *
 * Strategy
 * --------
 * Components are authored at 600×960 CSS px (5:8 aspect ratio, ~7" tablet portrait).
 * The Play Store target is 1200×1920 px (same ratio).
 *
 * Playwright viewport: 600×960 logical px, deviceScaleFactor=2:
 *   600 × 2 = 1200 px  (width)
 *   960 × 2 = 1920 px  (height)
 *
 * No CSS zoom needed — the component exactly matches the logical viewport.
 *
 * Emoji rendering
 * ---------------
 * Twemoji is injected after page load to replace emoji characters with <img> tags
 * so they render correctly in headless Chromium (no emoji font on NixOS).
 *
 * Usage:
 *   node scripts/capture-screenshots-tablet.cjs
 *
 * Outputs: screenshots/android-tablet/Screenshot1.png through Screenshot5.png
 */

"use strict";

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = "http://localhost:80/__mockup/preview";

const SCREENSHOTS = [
  { name: "ScreenshotTablet1", file: "Screenshot1.png" },
  { name: "ScreenshotTablet2", file: "Screenshot2.png" },
  { name: "ScreenshotTablet3", file: "Screenshot3.png" },
  { name: "ScreenshotTablet4", file: "Screenshot4.png" },
  { name: "ScreenshotTablet5", file: "Screenshot5.png" },
];

const OUT_DIR = path.resolve(__dirname, "../screenshots/android-tablet");

// 7-inch tablet: 1200×1920 physical px = 600×960 logical + DPR 2
const LOGICAL_W = 600;
const LOGICAL_H = 960;
const DPR = 2;

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

    await page.goto(`${BASE_URL}/${name}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Inject Twemoji for reliable emoji rendering in headless Chromium
    await page.addScriptTag({ url: TWEMOJI_CDN });
    await page.waitForTimeout(500);
    await page.evaluate((base) => {
      // @ts-ignore
      twemoji.parse(document.body, {
        folder: "svg",
        ext: ".svg",
        base,
        attributes: () => ({ style: "height:1em;width:1em;margin:0 .05em;vertical-align:-0.1em;" }),
      });
    }, TWEMOJI_ASSETS_BASE);

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      document.documentElement.style.margin = "0";
      document.documentElement.style.padding = "0";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.overflow = "hidden";
    });
    await page.waitForTimeout(200);

    const buffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: LOGICAL_W, height: LOGICAL_H },
    });

    fs.writeFileSync(outPath, buffer);
    console.log(`  ✓ saved ${outPath} (${buffer.length} bytes)`);

    await context.close();
  }

  await browser.close();
  console.log("\nAll 5 tablet screenshots captured at 1200×1920 px.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
