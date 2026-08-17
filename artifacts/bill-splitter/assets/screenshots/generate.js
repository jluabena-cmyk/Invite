#!/usr/bin/env node
// Generates App Store mockup screenshots as raw PNG files using Node.js zlib only.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// iPhone sizes (logical points × device pixel ratio)
const SIZES = {
  '6.7in': { w: 1290, h: 2796, label: '6.7"' },
  '6.1in': { w: 1179, h: 2556, label: '6.1"' },
  '5.5in': { w: 1242, h: 2208, label: '5.5"' },
};

// ─── PNG encoder ─────────────────────────────────────────────────────────────

function encodePNG(width, height, pixels) {
  // pixels: Uint8Array of RGBA values, row-major
  function crc32(buf) {
    let c = 0xffffffff;
    const table = crc32.table || (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
      }
      return t;
    })());
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const crcInput = Buffer.concat([typeBytes, data]);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([len, typeBytes, data, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // bit depth 8, RGB

  // IDAT: filter type 0 per row (no filter)
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (1 + width * 3) + 1 + x * 3;
      raw[di] = pixels[si]; raw[di + 1] = pixels[si + 1]; raw[di + 2] = pixels[si + 2];
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Drawing primitives ───────────────────────────────────────────────────────

function makeCanvas(w, h, bgR = 26, bgG = 26, bgB = 45) {
  const buf = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    buf[i * 4] = bgR; buf[i * 4 + 1] = bgG; buf[i * 4 + 2] = bgB; buf[i * 4 + 3] = 255;
  }
  return buf;
}

function setPixel(buf, w, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= w) return;
  const idx = (y * w + x) * 4;
  const af = a / 255;
  buf[idx]     = Math.round(buf[idx]     * (1 - af) + r * af);
  buf[idx + 1] = Math.round(buf[idx + 1] * (1 - af) + g * af);
  buf[idx + 2] = Math.round(buf[idx + 2] * (1 - af) + b * af);
}

function fillRect(buf, w, h, x1, y1, rw, rh, r, g, b, a = 255) {
  for (let y = Math.max(0, y1); y < Math.min(h, y1 + rh); y++)
    for (let x = Math.max(0, x1); x < Math.min(w, x1 + rw); x++)
      setPixel(buf, w, x, y, r, g, b, a);
}

function circle(buf, w, h, cx, cy, radius, r, g, b, a = 255) {
  for (let y = cy - radius; y <= cy + radius; y++)
    for (let x = cx - radius; x <= cx + radius; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2)
        setPixel(buf, w, x, y, r, g, b, a);
}

function roundRect(buf, w, h, x1, y1, rw, rh, rad, r, g, b, a = 255) {
  fillRect(buf, w, h, x1 + rad, y1, rw - rad * 2, rh, r, g, b, a);
  fillRect(buf, w, h, x1, y1 + rad, rw, rh - rad * 2, r, g, b, a);
  circle(buf, w, h, x1 + rad, y1 + rad, rad, r, g, b, a);
  circle(buf, w, h, x1 + rw - rad, y1 + rad, rad, r, g, b, a);
  circle(buf, w, h, x1 + rad, y1 + rh - rad, rad, r, g, b, a);
  circle(buf, w, h, x1 + rw - rad, y1 + rh - rad, rad, r, g, b, a);
}

// Simple bitmap font — encode glyphs as 5×7 bitmaps
const GLYPHS = {
  ' ': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  'A': [0,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,1,1,1,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1],
  'B': [1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,1,1,1,0],
  'C': [0,1,1,1,1,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1,1,1,1],
  'D': [1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,1,1,1,0],
  'E': [1,1,1,1,1,1,0,0,0,0,1,0,0,0,0,1,1,1,1,0,1,0,0,0,0,1,0,0,0,0,1,1,1,1,1],
  'F': [1,1,1,1,1,1,0,0,0,0,1,0,0,0,0,1,1,1,1,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0],
  'G': [0,1,1,1,1,1,0,0,0,0,1,0,0,0,0,1,0,1,1,1,1,0,0,0,1,1,0,0,0,1,0,1,1,1,1],
  'H': [1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,1,1,1,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1],
  'I': [1,1,1,1,1,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,1,1,1,1,1],
  'J': [0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,1,0,0,0,1,0,1,1,1,0],
  'K': [1,0,0,0,1,1,0,0,1,0,1,0,1,0,0,1,1,0,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,0,1],
  'L': [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,1,1,1,1],
  'M': [1,0,0,0,1,1,1,0,1,1,1,0,1,0,1,1,0,1,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1],
  'N': [1,0,0,0,1,1,1,0,0,1,1,0,1,0,1,1,0,0,1,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1],
  'O': [0,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,0,1,1,1,0],
  'P': [1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,1,1,1,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0],
  'Q': [0,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,1,0,1,1,0,0,1,0,0,1,1,0,1],
  'R': [1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,1,1,1,0,1,0,1,0,0,1,0,0,1,0,1,0,0,0,1],
  'S': [0,1,1,1,1,1,0,0,0,0,1,0,0,0,0,0,1,1,1,0,0,0,0,0,1,0,0,0,0,1,1,1,1,1,0],
  'T': [1,1,1,1,1,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0],
  'U': [1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,0,1,1,1,0],
  'V': [1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,0,1,0,1,0,0,0,1,0,0],
  'W': [1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,1,0,1,1,0,1,0,1,1,1,0,1,1,0,1,0,1,0],
  'X': [1,0,0,0,1,1,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,1,0,0,0,1,1,0,0,0,1],
  'Y': [1,0,0,0,1,1,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0],
  'Z': [1,1,1,1,1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1,1,1,1,1],
  'a': [0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,1,0,1,1,1,1,1,0,0,0,1,0,1,1,1,1],
  'b': [1,0,0,0,0,1,0,0,0,0,1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,1,1,1,0],
  'c': [0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1,1,1,0],
  'd': [0,0,0,0,1,0,0,0,0,1,0,1,1,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,0,1,1,1,1],
  'e': [0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,1,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,0],
  'f': [0,0,1,1,0,0,1,0,0,0,1,1,1,1,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0],
  'g': [0,0,0,0,0,0,1,1,1,1,1,0,0,0,1,0,1,1,1,1,0,0,0,0,1,0,1,1,1,1,0,0,0,0,0],
  'h': [1,0,0,0,0,1,0,0,0,0,1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1],
  'i': [0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0],
  'j': [0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,1,0,0,0,1,0,1,1,1,0],
  'k': [1,0,0,0,0,1,0,0,0,0,1,0,0,1,0,1,0,1,0,0,1,1,0,0,0,1,0,1,0,0,1,0,0,1,0],
  'l': [0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,1,0],
  'm': [0,0,0,0,0,0,0,0,0,0,1,1,0,1,0,1,0,1,0,1,1,0,1,0,1,1,0,1,0,1,1,0,0,0,1],
  'n': [0,0,0,0,0,0,0,0,0,0,1,0,1,1,0,1,1,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1],
  'o': [0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,0,1,1,1,0],
  'p': [0,0,0,0,0,1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,1,1,1,0,1,0,0,0,0,1,0,0,0,0],
  'q': [0,0,0,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,0,1,0,1,1,1,1,0,0,0,0,1,0,0,0,0,1],
  'r': [0,0,0,0,0,0,0,0,0,0,1,0,1,1,0,1,1,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0],
  's': [0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,1,0,0,0,0,0,1,1,1,0,0,0,0,0,1,0,1,1,1,0],
  't': [0,0,1,0,0,0,0,1,0,0,1,1,1,1,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1,1],
  'u': [0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,0,1,1,1,1],
  'v': [0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,0,1,0,1,0,0,0,1,0,0],
  'w': [0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,0,0,0,1,1,0,1,0,1,1,1,0,1,1,0,1,0,1,0],
  'x': [0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,1,0,0,0,1],
  'y': [0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,0,0,0,1,0,1,1,1,1,0,0,0,0,1,0,1,1,1,0],
  'z': [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,1,1,1,1],
  '0': [0,1,1,1,0,1,0,0,0,1,1,0,0,1,1,1,0,1,0,1,1,1,0,0,1,1,0,0,0,1,0,1,1,1,0],
  '1': [0,0,1,0,0,0,1,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,1,1,1,1,1],
  '2': [0,1,1,1,0,1,0,0,0,1,0,0,0,0,1,0,0,1,1,0,0,1,0,0,0,1,0,0,0,0,1,1,1,1,1],
  '3': [1,1,1,1,0,0,0,0,0,1,0,0,0,0,1,0,1,1,1,0,0,0,0,0,1,0,0,0,0,1,1,1,1,1,0],
  '4': [0,0,0,1,0,0,0,1,1,0,0,1,0,1,0,1,0,0,1,0,1,1,1,1,1,0,0,0,1,0,0,0,0,1,0],
  '5': [1,1,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,1,1,1,1,0],
  '6': [0,1,1,1,0,1,0,0,0,0,1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,0,1,1,1,0],
  '7': [1,1,1,1,1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0],
  '8': [0,1,1,1,0,1,0,0,0,1,1,0,0,0,1,0,1,1,1,0,1,0,0,0,1,1,0,0,0,1,0,1,1,1,0],
  '9': [0,1,1,1,0,1,0,0,0,1,1,0,0,0,1,0,1,1,1,1,0,0,0,0,1,0,0,0,0,1,0,1,1,1,0],
  '.': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0],
  ',': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0],
  '!': [0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0],
  '?': [0,1,1,1,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0],
  ':': [0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0],
  '/': [0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0],
  '-': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  '+': [0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,1,1,1,1,1,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0],
  '$': [0,0,1,0,0,0,1,1,1,0,1,0,1,0,0,0,1,1,1,0,0,0,1,0,1,0,0,1,0,1,0,1,1,1,0],
  '#': [0,1,0,1,0,0,1,0,1,0,1,1,1,1,1,0,1,0,1,0,1,1,1,1,1,0,1,0,1,0,0,1,0,1,0],
  '%': [1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,1],
  '@': [0,1,1,1,0,1,0,0,0,1,1,0,1,1,1,1,0,1,0,1,1,0,1,1,0,1,0,0,0,0,0,1,1,1,0],
  '(': [0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0],
  ')': [0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0],
  '\'': [0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  '"': [0,1,0,1,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  '*': [0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0],
  '&': [0,1,1,0,0,1,0,0,1,0,0,1,1,0,0,1,0,0,1,0,1,0,0,0,1,1,0,0,1,0,0,1,1,0,1],
  '|': [0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0],
  '~': [0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,1,0,1,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
};

function drawText(buf, w, h, text, x, y, scale, r, g, b, a = 255) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch] || GLYPHS[' '];
    for (let gy = 0; gy < 7; gy++)
      for (let gx = 0; gx < 5; gx++)
        if (g[gy * 5 + gx])
          fillRect(buf, w, h, cx + gx * scale, y + gy * scale, scale, scale, r, g, b, a);
    cx += 6 * scale;
  }
}

function drawTextMixed(buf, w, h, text, x, y, scale, r, g, b, a = 255) {
  let cx = x;
  for (const ch of text) {
    const glyph = GLYPHS[ch.toUpperCase()] || GLYPHS[ch] || GLYPHS[' '];
    for (let gy = 0; gy < 7; gy++)
      for (let gx = 0; gx < 5; gx++)
        if (glyph[gy * 5 + gx])
          fillRect(buf, w, h, cx + gx * scale, y + gy * scale, scale, scale, r, g, b, a);
    cx += 6 * scale;
  }
}

function textWidth(text, scale) { return text.length * 6 * scale; }

// ─── Color palette ────────────────────────────────────────────────────────────
const C = {
  bg:       [15, 15, 30],
  bgCard:   [26, 30, 55],
  bgCard2:  [35, 40, 70],
  accent:   [138, 101, 255],   // purple
  accentLt: [170, 140, 255],
  gold:     [255, 196, 75],
  green:    [80, 220, 130],
  red:      [255, 90, 90],
  white:    [255, 255, 255],
  gray:     [120, 130, 160],
  grayLt:   [170, 180, 210],
  tabBar:   [18, 18, 40],
};

// ─── Shared components ────────────────────────────────────────────────────────

function drawStatusBar(buf, w, h, W) {
  // time "9:41" on left, battery/signal on right
  fillRect(buf, W, h, 0, 0, W, 130, ...C.bg);
  drawTextMixed(buf, W, h, '9:41', 80, 45, 9, ...C.white);
  // battery icon top-right
  fillRect(buf, W, h, W - 200, 50, 120, 50, ...C.gray, 120);
  fillRect(buf, W, h, W - 195, 55, 90, 40, ...C.green);
}

function drawTabBar(buf, w, h, W, H, activeTab) {
  const tabs = ['Home', 'Friends', 'Profile'];
  const icons = ['⌂', '♦', '☺'];
  fillRect(buf, W, H, 0, H - 200, W, 200, ...C.tabBar);
  // top border
  fillRect(buf, W, H, 0, H - 200, W, 2, ...C.bgCard2);
  const tw = Math.floor(W / tabs.length);
  tabs.forEach((tab, i) => {
    const tx = i * tw + tw / 2;
    const isActive = tab === activeTab;
    const col = isActive ? C.accent : C.gray;
    // dot indicator for active
    if (isActive) circle(buf, W, H, tx, H - 170, 20, ...C.accent);
    const lw = textWidth(tab, 4);
    drawTextMixed(buf, W, H, tab, tx - lw / 2, H - 110, 4, ...col);
  });
}

function drawCard(buf, W, H, x, y, cw, ch, radius = 30) {
  roundRect(buf, W, H, x, y, cw, ch, radius, ...C.bgCard);
}

// ─── Screen generators ────────────────────────────────────────────────────────

// 1. Onboarding / Login
function screenLogin(W, H) {
  const buf = makeCanvas(W, H, ...C.bg);
  // Gradient blob top
  for (let r = 0; r < 400; r++) circle(buf, W, H, W / 2, 350, r, 80, 40, 180, Math.max(0, 120 - r / 4));

  const title = 'invite';
  const tw = textWidth(title, 18);
  drawTextMixed(buf, W, H, title, (W - tw) / 2, 250, 18, ...C.accentLt);

  const sub = 'Split bills, not friendships.';
  const sw = textWidth(sub, 6);
  drawTextMixed(buf, W, H, sub, (W - sw) / 2, 410, 6, ...C.grayLt);

  // Apple sign-in button
  roundRect(buf, W, H, (W - 700) / 2, 580, 700, 110, 30, 255, 255, 255);
  const abt = 'Continue with Apple';
  const abtw = textWidth(abt, 6);
  drawTextMixed(buf, W, H, abt, (W - abtw) / 2, 615, 6, 10, 10, 10);

  // Google sign-in button
  roundRect(buf, W, H, (W - 700) / 2, 720, 700, 110, 30, ...C.bgCard2);
  const gbt = 'Continue with Google';
  const gbtw = textWidth(gbt, 6);
  drawTextMixed(buf, W, H, gbt, (W - gbtw) / 2, 755, 6, ...C.grayLt);

  // Email
  roundRect(buf, W, H, (W - 700) / 2, 860, 700, 110, 30, ...C.bgCard2);
  const ebt = 'Continue with Email';
  const ebtw = textWidth(ebt, 6);
  drawTextMixed(buf, W, H, ebt, (W - ebtw) / 2, 895, 6, ...C.grayLt);

  // Illustration dots / features
  const feats = ['Scan receipts', 'Split fairly', 'Pay instantly'];
  feats.forEach((f, i) => {
    const fy = 1100 + i * 180;
    circle(buf, W, H, 120, fy + 40, 50, ...C.accent);
    drawTextMixed(buf, W, H, f, 200, fy + 15, 7, ...C.white);
  });

  drawStatusBar(buf, W, H, W);
  return buf;
}

// 2. Home — event list
function screenHome(W, H) {
  const buf = makeCanvas(W, H, ...C.bg);
  drawStatusBar(buf, W, H, W);

  drawTextMixed(buf, W, H, 'invite', 80, 160, 10, ...C.accentLt);

  // + New Event button
  roundRect(buf, W, H, W - 280, 145, 200, 80, 20, ...C.accent);
  drawTextMixed(buf, W, H, '+ Event', W - 265, 165, 5, ...C.white);

  drawTextMixed(buf, W, H, 'Upcoming', 80, 290, 7, ...C.white);

  // Event cards
  const events = [
    { name: 'Dinner at Nobu', date: 'Sat Jun 28  7:00 PM', guests: '6 guests', amount: '$142' },
    { name: 'Sushi Night', date: 'Fri Jul 4  8:00 PM', guests: '4 guests', amount: '$89' },
  ];
  events.forEach((ev, i) => {
    const cy = 370 + i * 380;
    drawCard(buf, W, H, 80, cy, W - 160, 340, 30);
    // color accent strip
    fillRect(buf, W, H, 80, cy, 12, 340, ...C.accent);
    roundRect(buf, W, H, 80, cy, 12, 340, 6, ...C.accent);
    drawTextMixed(buf, W, H, ev.name, 130, cy + 50, 7, ...C.white);
    drawTextMixed(buf, W, H, ev.date, 130, cy + 130, 5, ...C.grayLt);
    drawTextMixed(buf, W, H, ev.guests, 130, cy + 200, 5, ...C.gray);
    // Amount badge
    roundRect(buf, W, H, W - 300, cy + 50, 180, 70, 20, ...C.bgCard2);
    drawTextMixed(buf, W, H, ev.amount, W - 290, cy + 65, 7, ...C.gold);
  });

  // Pending invite section
  drawTextMixed(buf, W, H, 'Pending Invite', 80, 1160, 6, ...C.grayLt);
  drawCard(buf, W, H, 80, 1200, W - 160, 200, 20);
  drawTextMixed(buf, W, H, 'Rooftop BBQ - Jul 12', 130, 1240, 5, ...C.white);
  roundRect(buf, W, H, 130, 1310, 150, 60, 15, ...C.green);
  drawTextMixed(buf, W, H, 'Accept', 150, 1325, 5, ...C.bg);
  roundRect(buf, W, H, 310, 1310, 150, 60, 15, ...C.bgCard2);
  drawTextMixed(buf, W, H, 'Decline', 325, 1325, 5, ...C.gray);

  drawTabBar(buf, W, H, W, H, 'Home');
  return buf;
}

// 3. Event — Bill tab with items
function screenBill(W, H) {
  const buf = makeCanvas(W, H, ...C.bg);
  drawStatusBar(buf, W, H, W);

  // Back nav
  drawTextMixed(buf, W, H, '< Dinner at Nobu', 80, 155, 6, ...C.accent);

  // Sub-tabs: Overview | Chat | Bill | Photos
  const tabs2 = ['Overview', 'Chat', 'Bill', 'Photos'];
  const tw2 = Math.floor(W / tabs2.length);
  tabs2.forEach((t, i) => {
    const isA = t === 'Bill';
    drawTextMixed(buf, W, H, t, i * tw2 + 30, 250, 5, isA ? C.accent : C.gray);
    if (isA) fillRect(buf, W, H, i * tw2, 300, tw2, 6, ...C.accent);
  });
  fillRect(buf, W, H, 0, 306, W, 2, ...C.bgCard2);

  // Scan receipt button
  roundRect(buf, W, H, (W - 700) / 2, 340, 700, 110, 30, ...C.accent);
  drawTextMixed(buf, W, H, '+ Scan Receipt', (W - textWidth('+ Scan Receipt', 6)) / 2, 375, 6, ...C.white);

  drawTextMixed(buf, W, H, 'Items', 80, 500, 7, ...C.white);

  const items = [
    { name: 'Salmon Tartare', price: '$22', who: 'Alex' },
    { name: 'Wagyu Burger', price: '$34', who: 'Jordan' },
    { name: 'Truffle Fries', price: '$16', who: 'Shared' },
    { name: 'Sparkling Water x2', price: '$12', who: 'Shared' },
  ];

  items.forEach((item, i) => {
    const iy = 570 + i * 220;
    drawCard(buf, W, H, 80, iy, W - 160, 190, 20);
    drawTextMixed(buf, W, H, item.name, 130, iy + 30, 5, ...C.white);
    drawTextMixed(buf, W, H, item.price, W - 300, iy + 30, 6, ...C.gold);
    const tagCol = item.who === 'Shared' ? C.accentLt : C.green;
    roundRect(buf, W, H, 130, iy + 110, item.who.length * 36 + 30, 55, 12, ...C.bgCard2);
    drawTextMixed(buf, W, H, item.who, 148, iy + 123, 5, ...tagCol);
  });

  // Totals
  drawCard(buf, W, H, 80, 1510, W - 160, 300, 20);
  drawTextMixed(buf, W, H, 'Subtotal', 130, 1550, 5, ...C.grayLt);
  drawTextMixed(buf, W, H, '$84.00', W - 280, 1550, 5, ...C.white);
  drawTextMixed(buf, W, H, 'Tax', 130, 1620, 5, ...C.grayLt);
  drawTextMixed(buf, W, H, '$7.14', W - 260, 1620, 5, ...C.white);
  drawTextMixed(buf, W, H, 'Tip (20%)', 130, 1690, 5, ...C.grayLt);
  drawTextMixed(buf, W, H, '$16.80', W - 275, 1690, 5, ...C.white);
  fillRect(buf, W, H, 110, 1750, W - 220, 2, ...C.bgCard2);
  drawTextMixed(buf, W, H, 'Total', 130, 1770, 6, ...C.white);
  drawTextMixed(buf, W, H, '$107.94', W - 295, 1770, 6, ...C.gold);

  return buf;
}

// 4. Receipt scanning in progress
function screenScan(W, H) {
  const buf = makeCanvas(W, H, 10, 10, 20);
  drawStatusBar(buf, W, H, W);

  drawTextMixed(buf, W, H, '< Back', 80, 155, 6, ...C.accent);
  drawTextMixed(buf, W, H, 'Scan Receipt', (W - textWidth('Scan Receipt', 8)) / 2, 230, 8, ...C.white);

  // Camera viewfinder area
  const vx = 80, vy = 330, vw = W - 160, vh = Math.floor(vw * 1.3);
  roundRect(buf, W, H, vx, vy, vw, vh, 30, 25, 30, 50);

  // Simulated receipt background in viewfinder
  fillRect(buf, W, H, vx + 60, vy + 60, vw - 120, vh - 120, 240, 235, 220);
  // Receipt lines
  for (let i = 0; i < 10; i++) {
    const ly = vy + 100 + i * 90;
    fillRect(buf, W, H, vx + 80, ly, vw - 200, 12, 180, 170, 150);
    if (i % 3 === 0) fillRect(buf, W, H, vw - 120, ly, 100, 12, 140, 130, 110);
  }

  // Corner brackets (scan frame)
  const bLen = 80, bThick = 12;
  [[vx + 30, vy + 30], [vx + vw - 30 - bLen, vy + 30], [vx + 30, vy + vh - 30 - bLen], [vx + vw - 30 - bLen, vy + vh - 30 - bLen]].forEach(([bx, by]) => {
    fillRect(buf, W, H, bx, by, bLen, bThick, ...C.accent);
    fillRect(buf, W, H, bx, by, bThick, bLen, ...C.accent);
  });

  // Scanning line animation (static)
  fillRect(buf, W, H, vx + 30, vy + vh / 2, vw - 60, 6, ...C.accent, 180);

  // Progress banner
  roundRect(buf, W, H, 80, vy + vh + 50, W - 160, 140, 25, ...C.bgCard);
  circle(buf, W, H, 140, vy + vh + 120, 35, ...C.accent);
  drawTextMixed(buf, W, H, 'Analyzing receipt...', 200, vy + vh + 90, 5, ...C.white);
  drawTextMixed(buf, W, H, 'Powered by AI', 200, vy + vh + 155, 4, ...C.gray);

  // shutter button area
  roundRect(buf, W, H, (W - 200) / 2, H - 300, 200, 200, 100, ...C.accent);
  circle(buf, W, H, W / 2, H - 200, 75, 255, 255, 255, 60);

  return buf;
}

// 5. Bill breakdown / payment request
function screenPaymentRequest(W, H) {
  const buf = makeCanvas(W, H, ...C.bg);
  drawStatusBar(buf, W, H, W);

  drawTextMixed(buf, W, H, '< Bill', 80, 155, 6, ...C.accent);
  drawTextMixed(buf, W, H, 'Request Payment', (W - textWidth('Request Payment', 7)) / 2, 230, 7, ...C.white);

  const people = [
    { name: 'Alex', items: 'Salmon Tartare, Water', total: '$31.20' },
    { name: 'Jordan', items: 'Wagyu Burger, Fries', total: '$52.40' },
    { name: 'Sam', items: 'Shared items', total: '$24.34' },
  ];

  people.forEach((p, i) => {
    const cy = 360 + i * 370;
    drawCard(buf, W, H, 80, cy, W - 160, 330, 25);
    circle(buf, W, H, 160, cy + 90, 65, ...C.accent);
    drawTextMixed(buf, W, H, p.name[0], 138, cy + 65, 9, ...C.white);
    drawTextMixed(buf, W, H, p.name, 250, cy + 40, 7, ...C.white);
    drawTextMixed(buf, W, H, p.items, 250, cy + 120, 4, ...C.gray);
    drawTextMixed(buf, W, H, p.total, W - 50 - textWidth(p.total, 8), cy + 50, 8, ...C.gold);
    // Zelle tag
    roundRect(buf, W, H, 250, cy + 240, 220, 60, 15, 90, 30, 220, 160);
    drawTextMixed(buf, W, H, 'Pay via Zelle', 265, cy + 255, 4, ...C.white);
  });

  // Send requests button
  roundRect(buf, W, H, (W - 700) / 2, H - 340, 700, 130, 30, ...C.accent);
  const bt = 'Send Payment Requests';
  drawTextMixed(buf, W, H, bt, (W - textWidth(bt, 6)) / 2, H - 305, 6, ...C.white);

  drawTabBar(buf, W, H, W, H, 'Home');
  return buf;
}

// 6. Friends tab
function screenFriends(W, H) {
  const buf = makeCanvas(W, H, ...C.bg);
  drawStatusBar(buf, W, H, W);

  drawTextMixed(buf, W, H, 'Friends', 80, 160, 10, ...C.white);

  // Search bar
  roundRect(buf, W, H, 80, 280, W - 160, 100, 25, ...C.bgCard2);
  drawTextMixed(buf, W, H, 'Search friends...', 140, 310, 5, ...C.gray);

  drawTextMixed(buf, W, H, 'My Friends', 80, 440, 6, ...C.grayLt);

  const friends = ['Alex K.', 'Jordan M.', 'Sam T.', 'Riley P.'];
  friends.forEach((f, i) => {
    const fy = 510 + i * 200;
    circle(buf, W, H, 140, fy + 70, 60, ...C.accent);
    drawTextMixed(buf, W, H, f[0], 120, fy + 45, 8, ...C.white);
    drawTextMixed(buf, W, H, f, 230, fy + 45, 6, ...C.white);
    drawTextMixed(buf, W, H, '3 events together', 230, fy + 110, 4, ...C.gray);
    // message icon
    roundRect(buf, W, H, W - 240, fy + 40, 160, 65, 15, ...C.bgCard2);
    drawTextMixed(buf, W, H, 'Invite', W - 230, fy + 55, 5, ...C.accent);
  });

  // Suggestions
  drawTextMixed(buf, W, H, 'Suggested', 80, 1330, 6, ...C.grayLt);
  drawCard(buf, W, H, 80, 1400, W - 160, 220, 20);
  circle(buf, W, H, 150, 1510, 60, ...C.bgCard2);
  drawTextMixed(buf, W, H, 'Casey B.', 240, 1455, 6, ...C.white);
  drawTextMixed(buf, W, H, '2 mutual friends', 240, 1535, 4, ...C.gray);
  roundRect(buf, W, H, W - 250, 1465, 160, 65, 15, ...C.accent);
  drawTextMixed(buf, W, H, '+ Add', W - 240, 1480, 5, ...C.white);

  drawTabBar(buf, W, H, W, H, 'Friends');
  return buf;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const screens = [
  { name: '1-login',           fn: screenLogin },
  { name: '2-home',            fn: screenHome },
  { name: '3-bill',            fn: screenBill },
  { name: '4-scan',            fn: screenScan },
  { name: '5-payment-request', fn: screenPaymentRequest },
  { name: '6-friends',         fn: screenFriends },
];

const outDir = path.join(__dirname);

for (const [sizeName, { w, h }] of Object.entries(SIZES)) {
  for (const { name, fn } of screens) {
    const pixels = fn(w, h);
    const png = encodePNG(w, h, pixels);
    const file = path.join(outDir, `${sizeName}_${name}.png`);
    fs.writeFileSync(file, png);
    console.log(`Wrote ${file} (${(png.length / 1024).toFixed(0)}KB)`);
  }
}

console.log('Done!');
