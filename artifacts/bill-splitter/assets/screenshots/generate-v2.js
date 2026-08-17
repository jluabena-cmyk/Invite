#!/usr/bin/env node
/**
 * App Store screenshot generator — v2
 *
 * Produces 18 PNG files (6 screens × 3 iPhone sizes) that accurately reflect
 * the real invite app UI (colors, typography, layout).
 *
 * Screen 1 is built from the actual app screenshot captured from the running
 * Expo web app; screens 2-6 are high-quality SVG renders at native resolution.
 *
 * Usage:  node generate-v2.js
 * Deps:   sharp  (pnpm add -w sharp)
 */

const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

// ─── Target sizes ──────────────────────────────────────────────────────────────
const SIZES = [
  { key: '6.7in', w: 1290, h: 2796 },
  { key: '6.1in', w: 1179, h: 2556 },
  { key: '5.5in', w: 1242, h: 2208 },
];

// ─── Reference viewport (matches the Expo web capture) ───────────────────────
const VW = 390;
const VH = 844;

// ─── Design tokens (from constants/colors.ts + onboarding.tsx) ───────────────
const C = {
  bg:        '#FAF5EF',
  fg:        '#1C1917',
  card:      '#FFFFFF',
  primary:   '#C2410C',
  primaryFg: '#FFFFFF',
  secondary: '#F5F0EB',
  muted:     '#F5F0EB',
  mutedFg:   '#78716C',
  accent:    '#7C3AED',
  border:    '#F0EAE2',
  success:   '#16A34A',
  coral:     '#F97316',
  // Onboarding dark theme
  darkBg:    '#1a1f3c',
  darkFg:    '#FFFFFF',
  darkMuted: '#94A3B8',
  darkCard:  '#232848',
};

// ─── Output directory ─────────────────────────────────────────────────────────
const OUT = path.join(__dirname);
const RAW = path.join(__dirname, 'raw');

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function svg(content) {
  return `<svg viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink">
  ${content}
  </svg>`;
}

function statusBar({ dark = false } = {}) {
  const fg  = dark ? '#FFFFFF' : C.fg;
  const bg  = dark ? C.darkBg  : C.bg;
  const bat = dark ? 'rgba(255,255,255,0.8)' : C.fg;
  return `
  <rect x="0" y="0" width="${VW}" height="50" fill="${bg}"/>
  <text x="28" y="34" fill="${fg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="15" font-weight="600">9:41</text>
  <!-- signal bars -->
  <rect x="310" y="29" width="3" height="10" rx="1" fill="${bat}"/>
  <rect x="316" y="25" width="3" height="14" rx="1" fill="${bat}"/>
  <rect x="322" y="21" width="3" height="18" rx="1" fill="${bat}"/>
  <rect x="328" y="17" width="3" height="22" rx="1" fill="${bat}"/>
  <!-- wifi -->
  <path d="M341 33 a14 14 0 0 1 20 0" fill="none" stroke="${bat}" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M344 38 a9  9  0 0 1 14 0" fill="none" stroke="${bat}" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="351" cy="42" r="2.5" fill="${bat}"/>
  <!-- battery -->
  <rect x="363" y="22" width="24" height="13" rx="3" fill="none" stroke="${bat}" stroke-width="1.5"/>
  <rect x="387" y="26" width="3"  height="5"  rx="1.5" fill="${bat}"/>
  <rect x="365" y="24" width="18" height="9"  rx="2"  fill="${bat}"/>`;
}

function tabBar(active) {
  const tabs = [
    { name: 'Home',    key: 'home'    },
    { name: 'Friends', key: 'friends' },
    { name: 'Profile', key: 'profile' },
  ];
  const tw   = VW / tabs.length;
  const barY = VH - 84;
  return `
  <rect x="0" y="${barY}" width="${VW}" height="84" fill="${C.bg}"/>
  <line x1="0" y1="${barY}" x2="${VW}" y2="${barY}" stroke="${C.border}" stroke-width="0.5"/>
  ${tabs.map((t, i) => {
    const cx    = i * tw + tw / 2;
    const col   = t.key === active ? C.primary : C.mutedFg;
    const icons = { home: homeIcon, friends: friendsIcon, profile: personIcon };
    return `<g transform="translate(${cx - 12}, ${barY + 12})">${icons[t.key](col)}</g>
    <text x="${cx}" y="${barY + 68}" fill="${col}" font-family="system-ui,-apple-system,sans-serif"
          font-size="10" text-anchor="middle">${t.name}</text>`;
  }).join('\n')}`;
}

function homeIcon(color) {
  return `<path d="M12 3 L22 12 h-3 v9 h-5v-5h-4v5H5v-9H2z" fill="none"
    stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function friendsIcon(color) {
  return `<circle cx="8" cy="7" r="3.5" fill="none" stroke="${color}" stroke-width="1.8"/>
  <path d="M1 20c0-4 3-6 7-6s7 2 7 6" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
  <circle cx="17" cy="7" r="2.5" fill="none" stroke="${color}" stroke-width="1.6" opacity="0.6"/>
  <path d="M14 20c0-3 2-4.5 4.5-4.5" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>`;
}
function personIcon(color) {
  return `<circle cx="12" cy="7" r="4" fill="none" stroke="${color}" stroke-width="1.8"/>
  <path d="M4 22c0-5 4-8 8-8s8 3 8 8" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>`;
}

function card({ x, y, w, h, r = 12, fill = C.card, stroke = C.border }) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"
    fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>`;
}

function pill({ x, y, w, h, fill, text, textFill, r = 20, fontSize = 11 }) {
  const cx = x + w / 2;
  const cy = y + h / 2 + fontSize * 0.35;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>
  <text x="${cx}" y="${cy}" fill="${textFill ?? '#fff'}" font-family="system-ui,-apple-system,sans-serif"
        font-size="${fontSize}" text-anchor="middle" font-weight="600">${text}</text>`;
}

function avatar({ cx, cy, r, fill, initials, textSize = 14 }) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>
  <text x="${cx}" y="${cy + textSize * 0.35}" fill="#fff" font-family="system-ui,-apple-system,sans-serif"
        font-size="${textSize}" text-anchor="middle" font-weight="700">${initials}</text>`;
}

function label({ x, y, text, fill = C.fg, size = 14, weight = '400', anchor = 'start', opacity = 1 }) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="system-ui,-apple-system,sans-serif"
    font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" opacity="${opacity}">${text}</text>`;
}

// ─── Screen builders ──────────────────────────────────────────────────────────

/**
 * Screen 1 — Onboarding
 * Rendered from the actual Expo screenshot; this function provides the SVG
 * fallback used only if the raw screenshot is unavailable.
 */
function screenOnboarding() {
  const navH  = 84;
  const dotY  = VH - navH - 32;
  const btnY  = VH - navH - 74;
  return svg(`
  <!-- Background -->
  <defs>
    <radialGradient id="glow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#2d2060"/>
      <stop offset="100%" stop-color="${C.darkBg}"/>
    </radialGradient>
  </defs>
  <rect width="${VW}" height="${VH}" fill="url(#glow)"/>
  ${statusBar({ dark: true })}

  <!-- Wordmark -->
  <text x="${VW / 2}" y="80" fill="${C.darkFg}" font-family="Georgia,serif"
        font-size="18" text-anchor="middle" font-style="italic" letter-spacing="4">invite</text>
  <text x="${VW - 24}" y="80" fill="${C.darkMuted}" font-family="system-ui,-apple-system,sans-serif"
        font-size="13" text-anchor="end" opacity="0.7">Skip</text>

  <!-- Floating emojis (illustration area) -->
  <text x="65"  y="180" font-size="42">🍣</text>
  <text x="295" y="205" font-size="42">🍷</text>
  <text x="175" y="310" font-size="42">🥗</text>
  <text x="220" y="165" font-size="42">🍔</text>
  <text x="55"  y="370" font-size="38">🧾</text>
  <text x="285" y="355" font-size="38">👥</text>
  <text x="155" y="210" font-size="22">✨</text>
  <text x="285" y="280" font-size="22">✨</text>
  <text x="180" y="400" font-size="22">✨</text>

  <!-- Glow blob behind emojis -->
  <ellipse cx="${VW/2}" cy="275" rx="130" ry="110" fill="${C.primary}" opacity="0.12"/>

  <!-- Headline -->
  <text x="28" y="490" fill="${C.darkFg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="38" font-weight="700" letter-spacing="-0.5">Split bills,</text>
  <text x="28" y="538" fill="${C.darkFg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="38" font-weight="700" letter-spacing="-0.5">not friendships</text>
  <!-- Subtext -->
  <text x="28" y="572" fill="${C.darkMuted}" font-family="system-ui,-apple-system,sans-serif" font-size="16">Plan dinners, invite your crew,</text>
  <text x="28" y="592" fill="${C.darkMuted}" font-family="system-ui,-apple-system,sans-serif" font-size="16">and split the bill — no awkwardness, ever.</text>

  <!-- Pagination dots -->
  <circle cx="${VW/2 - 25}" cy="${dotY}" r="5" fill="${C.darkFg}"/>
  <circle cx="${VW/2 - 12}" cy="${dotY}" r="3.5" fill="${C.darkFg}" opacity="0.3"/>
  <circle cx="${VW/2 + 1}"  cy="${dotY}" r="3.5" fill="${C.darkFg}" opacity="0.3"/>
  <circle cx="${VW/2 + 14}" cy="${dotY}" r="3.5" fill="${C.darkFg}" opacity="0.3"/>
  <circle cx="${VW/2 + 27}" cy="${dotY}" r="3.5" fill="${C.darkFg}" opacity="0.3"/>

  <!-- Next button -->
  <rect x="24" y="${btnY}" width="${VW - 48}" height="54" rx="18" fill="${C.primary}"/>
  <text x="${VW/2}" y="${btnY + 33}" fill="#fff" font-family="system-ui,-apple-system,sans-serif"
        font-size="17" font-weight="600" text-anchor="middle">Next →</text>
  `);
}

/**
 * Screen 2 — Home (event list)
 */
function screenHome() {
  return svg(`
  <rect width="${VW}" height="${VH}" fill="${C.bg}"/>
  ${statusBar()}

  <!-- Header -->
  <text x="24" y="90" fill="${C.fg}" font-family="Georgia,serif"
        font-size="28" font-weight="700" font-style="italic" letter-spacing="1">invite</text>
  <rect x="${VW - 110}" y="68" width="88" height="34" rx="17" fill="${C.primary}"/>
  <text x="${VW - 66}" y="89" fill="#fff" font-family="system-ui,-apple-system,sans-serif"
        font-size="13" font-weight="600" text-anchor="middle">+ Event</text>

  <!-- Section label -->
  <text x="24" y="126" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="11" font-weight="600" letter-spacing="1.2">UPCOMING</text>

  <!-- Event card 1 -->
  ${card({ x: 24, y: 142, w: VW - 48, h: 128, r: 16, fill: C.card })}
  <!-- left accent bar -->
  <rect x="24" y="142" width="5" height="128" rx="2" fill="${C.primary}"/>
  <!-- Restaurant icon (sushi — use plate + chopstick SVG) -->
  <rect x="43" y="162" width="44" height="44" rx="12" fill="#FFF7ED"/>
  <circle cx="65" cy="184" r="12" fill="${C.primary}" opacity="0.15"/>
  <text x="65" y="188" fill="${C.primary}" font-family="system-ui,-apple-system,sans-serif"
        font-size="11" font-weight="700" text-anchor="middle">SUSHI</text>
  <!-- Title & meta -->
  <text x="100" y="180" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="15" font-weight="600">Dinner at Nobu</text>
  <text x="100" y="200" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif" font-size="12">Sat, Jun 28 · 7:00 PM</text>
  <text x="100" y="218" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif" font-size="12">6 guests</text>
  <!-- Amount chip -->
  <rect x="${VW - 90}" y="156" width="66" height="26" rx="13" fill="#FFF7ED"/>
  <text x="${VW - 57}" y="173" fill="${C.coral}" font-family="system-ui,-apple-system,sans-serif"
        font-size="13" font-weight="700" text-anchor="middle">$142</text>
  <!-- Member avatars -->
  ${avatar({ cx: 103, cy: 250, r: 10, fill: C.primary,  initials: 'A', textSize: 9 })}
  ${avatar({ cx: 119, cy: 250, r: 10, fill: '#F97316',  initials: 'J', textSize: 9 })}
  ${avatar({ cx: 135, cy: 250, r: 10, fill: '#10B981',  initials: 'S', textSize: 9 })}
  ${avatar({ cx: 151, cy: 250, r: 10, fill: '#F59E0B',  initials: 'R', textSize: 9 })}
  <text x="170" y="254" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif" font-size="11">+2</text>
  <!-- Host badge -->
  <rect x="${VW - 80}" y="240" width="56" height="22" rx="11" fill="${C.primary}" opacity="0.12"/>
  <text x="${VW - 52}" y="255" fill="${C.primary}" font-family="system-ui,-apple-system,sans-serif"
        font-size="10" font-weight="600" text-anchor="middle">Host</text>

  <!-- Event card 2 -->
  ${card({ x: 24, y: 290, w: VW - 48, h: 118, r: 16, fill: C.card })}
  <rect x="24" y="290" width="5" height="118" rx="2" fill="${C.coral}"/>
  <rect x="43" y="308" width="44" height="44" rx="12" fill="#FFF3E0"/>
  <circle cx="65" cy="330" r="12" fill="${C.coral}" opacity="0.2"/>
  <text x="65" y="334" fill="${C.coral}" font-family="system-ui,-apple-system,sans-serif"
        font-size="11" font-weight="700" text-anchor="middle">BBQ</text>
  <text x="100" y="328" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="15" font-weight="600">Rooftop BBQ</text>
  <text x="100" y="348" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif" font-size="12">Fri, Jul 4 · 8:00 PM</text>
  <text x="100" y="366" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif" font-size="12">4 guests</text>
  <rect x="${VW - 90}" y="304" width="66" height="26" rx="13" fill="#FFF7ED"/>
  <text x="${VW - 57}" y="321" fill="${C.coral}" font-family="system-ui,-apple-system,sans-serif"
        font-size="13" font-weight="700" text-anchor="middle">$89</text>
  <!-- Member role -->
  <rect x="${VW - 88}" y="388" width="64" height="22" rx="11" fill="${C.success}" opacity="0.12"/>
  <text x="${VW - 56}" y="403" fill="${C.success}" font-family="system-ui,-apple-system,sans-serif"
        font-size="10" font-weight="600" text-anchor="middle">Member</text>

  <!-- Invited section -->
  <text x="24" y="432" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="11" font-weight="600" letter-spacing="1.2">INVITED</text>
  ${card({ x: 24, y: 448, w: VW - 48, h: 98, r: 16, fill: C.card })}
  <rect x="43" y="466" width="44" height="44" rx="12" fill="#EEF2FF"/>
  <circle cx="65" cy="488" r="12" fill="${C.accent}" opacity="0.2"/>
  <text x="65" y="492" fill="${C.accent}" font-family="system-ui,-apple-system,sans-serif"
        font-size="11" font-weight="700" text-anchor="middle">WINE</text>
  <text x="100" y="482" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="15" font-weight="600">Friday Night Sushi</text>
  <text x="100" y="501" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="12">Jordan · 5 guests</text>
  <rect x="${VW - 170}" y="486" width="68" height="28" rx="14" fill="${C.success}"/>
  <text x="${VW - 136}" y="504" fill="#fff" font-family="system-ui,-apple-system,sans-serif"
        font-size="12" font-weight="600" text-anchor="middle">Accept</text>
  <rect x="${VW - 96}" y="486" width="72" height="28" rx="14" fill="${C.secondary}"/>
  <text x="${VW - 60}" y="504" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="12" font-weight="600" text-anchor="middle">Decline</text>

  <!-- Past section -->
  <text x="24" y="574" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="11" font-weight="600" letter-spacing="1.2">PAST</text>
  ${card({ x: 24, y: 590, w: VW - 48, h: 80, r: 16, fill: C.card })}
  <rect x="24" y="590" width="5" height="80" rx="2" fill="${C.mutedFg}" opacity="0.3"/>
  <text x="43" y="622" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="14" font-weight="500">Brunch at Sarma</text>
  <text x="43" y="641" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="12">Jun 14 · 4 guests · $76</text>
  <!-- settled badge -->
  <rect x="${VW - 96}" y="608" width="72" height="22" rx="11" fill="${C.success}" opacity="0.12"/>
  <text x="${VW - 60}" y="623" fill="${C.success}" font-family="system-ui,-apple-system,sans-serif"
        font-size="10" font-weight="600" text-anchor="middle">Settled</text>

  ${tabBar('home')}
  `);
}

/**
 * Screen 3 — Bill tab (items assigned to people)
 */
function screenBill() {
  return svg(`
  <rect width="${VW}" height="${VH}" fill="${C.bg}"/>
  ${statusBar()}

  <!-- Back nav -->
  <text x="24" y="74" fill="${C.primary}" font-family="system-ui,-apple-system,sans-serif"
        font-size="14" font-weight="500">‹ Dinner at Nobu</text>

  <!-- Sub-tabs -->
  ${['Overview','Chat','Bill','Photos'].map((t, i) => {
    const x = 24 + i * (VW - 48) / 4;
    const w = (VW - 48) / 4;
    const isA = t === 'Bill';
    return `<text x="${x + w/2}" y="108" fill="${isA ? C.primary : C.mutedFg}"
      font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="${isA ? '600' : '400'}"
      text-anchor="middle">${t}</text>
    ${isA ? `<rect x="${x}" y="114" width="${w}" height="2.5" rx="1" fill="${C.primary}"/>` : ''}`;
  }).join('\n')}
  <line x1="0" y1="117" x2="${VW}" y2="117" stroke="${C.border}" stroke-width="0.5"/>

  <!-- Scan receipt button -->
  <rect x="24" y="132" width="${VW - 48}" height="46" rx="16" fill="${C.primary}"/>
  <text x="${VW/2}" y="160" fill="#fff" font-family="system-ui,-apple-system,sans-serif"
        font-size="15" font-weight="600" text-anchor="middle">+ Scan Receipt</text>

  <!-- Items section label -->
  <text x="24" y="204" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="11" font-weight="600" letter-spacing="1.2">ITEMS</text>

  <!-- Item rows -->
  ${[
    { name: 'Salmon Tartare',    price: '$22', who: 'Alex',   tag: C.primary,  tagBg: '#FEF2F0' },
    { name: 'Wagyu Burger',      price: '$34', who: 'Jordan', tag: '#F97316',  tagBg: '#FFF7ED' },
    { name: 'Truffle Fries',     price: '$16', who: 'Shared', tag: C.accent,   tagBg: '#F5F3FF' },
    { name: 'Sparkling Water ×2',price: '$12', who: 'Shared', tag: C.accent,   tagBg: '#F5F3FF' },
    { name: 'Edamame',           price: '$8',  who: 'Riley',  tag: C.success,  tagBg: '#F0FDF4' },
  ].map((item, i) => {
    const y = 220 + i * 74;
    return `${card({ x: 24, y, w: VW - 48, h: 64, r: 12, fill: C.card })}
    <text x="44" y="${y + 25}" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
          font-size="14" font-weight="500">${item.name}</text>
    <text x="${VW - 36}" y="${y + 25}" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
          font-size="14" font-weight="700" text-anchor="end">${item.price}</text>
    <rect x="44" y="${y + 36}" width="${item.who.length * 7 + 20}" height="20" rx="10"
          fill="${item.tagBg}"/>
    <text x="${54 + (item.who.length * 7)/2}" y="${y + 50}" fill="${item.tag}"
          font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="600"
          text-anchor="middle">${item.who}</text>`;
  }).join('\n')}

  <!-- Totals card -->
  ${card({ x: 24, y: 600, w: VW - 48, h: 148, r: 16, fill: C.card })}
  <text x="44" y="632" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif" font-size="13">Subtotal</text>
  <text x="${VW - 36}" y="632" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="13" text-anchor="end">$92.00</text>
  <text x="44" y="658" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif" font-size="13">Tax (8.75%)</text>
  <text x="${VW - 36}" y="658" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="13" text-anchor="end">$8.05</text>
  <text x="44" y="684" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif" font-size="13">Tip (18%)</text>
  <text x="${VW - 36}" y="684" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="13" text-anchor="end">$16.56</text>
  <line x1="44" y1="696" x2="${VW - 36}" y2="696" stroke="${C.border}" stroke-width="0.5"/>
  <text x="44" y="718" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="16" font-weight="700">Total</text>
  <text x="${VW - 36}" y="718" fill="${C.primary}" font-family="system-ui,-apple-system,sans-serif"
        font-size="16" font-weight="700" text-anchor="end">$116.61</text>

  <!-- Settle button -->
  <rect x="24" y="762" width="${VW - 48}" height="46" rx="16" fill="${C.primary}"/>
  <text x="${VW/2}" y="790" fill="#fff" font-family="system-ui,-apple-system,sans-serif"
        font-size="15" font-weight="600" text-anchor="middle">Request Payments →</text>
  `);
}

/**
 * Screen 4 — Receipt scanning in progress
 */
function screenScan() {
  const vfX = 20, vfY = 130, vfW = VW - 40, vfH = vfW * 1.28;
  const bLen = 28;
  return svg(`
  <rect width="${VW}" height="${VH}" fill="#0D0D1A"/>
  ${statusBar({ dark: true })}

  <!-- Header -->
  <text x="24" y="72" fill="#fff" font-family="system-ui,-apple-system,sans-serif"
        font-size="14">‹ Back</text>
  <text x="${VW/2}" y="72" fill="#fff" font-family="system-ui,-apple-system,sans-serif"
        font-size="17" font-weight="600" text-anchor="middle">Scan Receipt</text>

  <!-- Camera viewfinder -->
  <rect x="${vfX}" y="${vfY}" width="${vfW}" height="${vfH}" rx="20" fill="#111827"/>

  <!-- Simulated receipt paper inside viewfinder -->
  <rect x="${vfX + 30}" y="${vfY + 30}" width="${vfW - 60}" height="${vfH - 60}" rx="8" fill="#F8F4EE"/>
  <!-- Receipt header -->
  <text x="${vfX + vfW/2}" y="${vfY + 62}" fill="#374151" font-family="system-ui,-apple-system,sans-serif"
        font-size="12" font-weight="700" text-anchor="middle" letter-spacing="1">NOBU DOWNTOWN</text>
  <text x="${vfX + vfW/2}" y="${vfY + 78}" fill="#9CA3AF" font-family="system-ui,-apple-system,sans-serif"
        font-size="10" text-anchor="middle">Table 12 · Sat Jun 28</text>
  <line x1="${vfX + 50}" y1="${vfY + 88}" x2="${vfX + vfW - 50}" y2="${vfY + 88}" stroke="#E5E7EB" stroke-width="0.5"/>
  <!-- Receipt line items -->
  ${['Salmon Tartare ···· $22','Wagyu Burger ······· $34','Truffle Fries ······ $16','Edamame ············ $8','Sparkling Water ···· $12'].map((ln, i) => `
  <text x="${vfX + 50}" y="${vfY + 106 + i * 22}" fill="#374151" font-family="monospace" font-size="11">${ln}</text>`).join('')}
  <line x1="${vfX + 50}" y1="${vfY + 226}" x2="${vfX + vfW - 50}" y2="${vfY + 226}" stroke="#E5E7EB" stroke-width="0.5"/>
  <text x="${vfX + 50}" y="${vfY + 244}" fill="#111827" font-family="system-ui,-apple-system,sans-serif"
        font-size="12" font-weight="700">Total</text>
  <text x="${vfX + vfW - 50}" y="${vfY + 244}" fill="${C.primary}" font-family="system-ui,-apple-system,sans-serif"
        font-size="12" font-weight="700" text-anchor="end">$92.00</text>

  <!-- Scan frame corners (accent colored) -->
  <rect x="${vfX + 10}" y="${vfY + 10}" width="${bLen}" height="4" rx="2" fill="${C.primary}"/>
  <rect x="${vfX + 10}" y="${vfY + 10}" width="4" height="${bLen}" rx="2" fill="${C.primary}"/>
  <rect x="${vfX + vfW - 10 - bLen}" y="${vfY + 10}" width="${bLen}" height="4" rx="2" fill="${C.primary}"/>
  <rect x="${vfX + vfW - 14}" y="${vfY + 10}" width="4" height="${bLen}" rx="2" fill="${C.primary}"/>
  <rect x="${vfX + 10}" y="${vfY + vfH - 14}" width="${bLen}" height="4" rx="2" fill="${C.primary}"/>
  <rect x="${vfX + 10}" y="${vfY + vfH - 10 - bLen}" width="4" height="${bLen}" rx="2" fill="${C.primary}"/>
  <rect x="${vfX + vfW - 10 - bLen}" y="${vfY + vfH - 14}" width="${bLen}" height="4" rx="2" fill="${C.primary}"/>
  <rect x="${vfX + vfW - 14}" y="${vfY + vfH - 10 - bLen}" width="4" height="${bLen}" rx="2" fill="${C.primary}"/>

  <!-- Scan line -->
  <rect x="${vfX + 20}" y="${vfY + vfH * 0.52}" width="${vfW - 40}" height="2" rx="1"
        fill="${C.primary}" opacity="0.7"/>
  <!-- scan line glow -->
  <rect x="${vfX + 20}" y="${vfY + vfH * 0.52 - 4}" width="${vfW - 40}" height="10" rx="5"
        fill="${C.primary}" opacity="0.2"/>

  <!-- Progress / AI banner -->
  ${card({ x: 20, y: vfY + vfH + 16, w: VW - 40, h: 72, r: 16, fill: C.darkCard, stroke: 'none' })}
  <circle cx="56" cy="${vfY + vfH + 52}" r="16" fill="${C.primary}" opacity="0.25"/>
  <text x="56" y="${vfY + vfH + 57}" fill="${C.primary}" font-family="system-ui,-apple-system,sans-serif"
        font-size="13" font-weight="800" text-anchor="middle">AI</text>
  <text x="82" y="${vfY + vfH + 46}" fill="#fff" font-family="system-ui,-apple-system,sans-serif"
        font-size="14" font-weight="600">Analyzing receipt...</text>
  <text x="82" y="${vfY + vfH + 66}" fill="${C.darkMuted}" font-family="system-ui,-apple-system,sans-serif"
        font-size="12">Identifying items with AI</text>

  <!-- Shutter button area -->
  <circle cx="${VW/2}" cy="${VH - 100}" r="38" fill="#FFFFFF" opacity="0.12"/>
  <circle cx="${VW/2}" cy="${VH - 100}" r="28" fill="#FFFFFF"/>
  <circle cx="${VW/2}" cy="${VH - 100}" r="24" fill="#E5E7EB"/>

  <!-- Gallery icon (photo frame) -->
  <rect x="60" y="${VH - 120}" width="44" height="44" rx="12" fill="rgba(255,255,255,0.08)"/>
  <rect x="72" y="${VH - 112}" width="20" height="20" rx="3" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
  <circle cx="76" cy="${VH - 108}" r="2" fill="rgba(255,255,255,0.7)"/>
  <path d="M72 ${VH - 98} l5-5 4 4 3-3 6 7z" fill="rgba(255,255,255,0.5)"/>
  <!-- Flash icon (lightning) -->
  <rect x="${VW - 104}" y="${VH - 120}" width="44" height="44" rx="12" fill="rgba(255,255,255,0.08)"/>
  <path d="M${VW - 86} ${VH - 112} l-5 12 h5 l-4 12 l10-15 h-6 z" fill="rgba(255,255,255,0.7)"/>
  `);
}

/**
 * Screen 5 — Payment request breakdown (per person)
 */
function screenPayment() {
  const people = [
    { initials: 'AK', color: C.primary,  name: 'Alex K.',   items: 'Salmon Tartare, Water', total: '$31.20' },
    { initials: 'JM', color: '#F97316',  name: 'Jordan M.', items: 'Wagyu Burger, Fries',   total: '$56.62' },
    { initials: 'ST', color: '#10B981',  name: 'Sam T.',    items: 'Shared items',           total: '$28.79' },
  ];
  return svg(`
  <rect width="${VW}" height="${VH}" fill="${C.bg}"/>
  ${statusBar()}

  <!-- Back nav -->
  <text x="24" y="74" fill="${C.primary}" font-family="system-ui,-apple-system,sans-serif"
        font-size="14" font-weight="500">‹ Bill</text>
  <text x="${VW/2}" y="74" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="17" font-weight="700" text-anchor="middle">Request Payment</text>

  <!-- Subtitle -->
  <text x="${VW/2}" y="104" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="13" text-anchor="middle">Dinner at Nobu · $116.61 total</text>

  <!-- Per-person cards -->
  ${people.map((p, i) => {
    const y = 126 + i * 172;
    return `${card({ x: 24, y, w: VW - 48, h: 158, r: 16, fill: C.card })}
    ${avatar({ cx: 65, cy: y + 50, r: 28, fill: p.color, initials: p.initials, textSize: 15 })}
    <!-- Name & items -->
    <text x="106" y="${y + 38}" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
          font-size="16" font-weight="600">${p.name}</text>
    <text x="106" y="${y + 58}" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
          font-size="12">${p.items}</text>
    <!-- Total -->
    <text x="${VW - 36}" y="${y + 38}" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
          font-size="20" font-weight="700" text-anchor="end">${p.total}</text>
    <text x="${VW - 36}" y="${y + 58}" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
          font-size="11" text-anchor="end">incl. tax &amp; tip</text>
    <!-- Divider -->
    <line x1="40" y1="${y + 84}" x2="${VW - 40}" y2="${y + 84}" stroke="${C.border}" stroke-width="0.5"/>
    <!-- Payment method row -->
    <rect x="40" y="${y + 98}" width="68" height="24" rx="12" fill="#EEF2FF"/>
    <text x="74" y="${y + 114}" fill="${C.accent}" font-family="system-ui,-apple-system,sans-serif"
          font-size="11" font-weight="600" text-anchor="middle">Zelle</text>
    <rect x="${VW - 120}" y="${y + 98}" width="80" height="24" rx="12" fill="${p.color}" opacity="0.1"/>
    <text x="${VW - 80}" y="${y + 114}" fill="${p.color}" font-family="system-ui,-apple-system,sans-serif"
          font-size="11" font-weight="600" text-anchor="middle">Request →</text>
    <!-- Status -->
    <circle cx="40" cy="${y + 140}" r="5" fill="${C.success}" opacity="0.3"/>
    <text x="52" y="${y + 144}" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif" font-size="11">Pending</text>`;
  }).join('\n')}

  <!-- Send all button -->
  <rect x="24" y="660" width="${VW - 48}" height="50" rx="16" fill="${C.primary}"/>
  <text x="${VW/2}" y="690" fill="#fff" font-family="system-ui,-apple-system,sans-serif"
        font-size="15" font-weight="600" text-anchor="middle">Send All Payment Requests →</text>
  <text x="${VW/2}" y="728" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="12" text-anchor="middle">Requests will be sent via Zelle</text>
  `);
}

/**
 * Screen 6 — Friends list
 */
function screenFriends() {
  const friends = [
    { initials: 'JM', color: C.primary,  name: 'Jordan M.',  handle: '@jordanm',   mutual: '4 mutual events' },
    { initials: 'SK', color: '#F97316',  name: 'Sam K.',     handle: '@samkwon',   mutual: '2 mutual events' },
    { initials: 'AT', color: '#10B981',  name: 'Alex T.',    handle: '@alext',     mutual: '6 mutual events' },
    { initials: 'RB', color: '#F59E0B',  name: 'Riley B.',   handle: '@rileyb',    mutual: '1 mutual event'  },
  ];
  const suggestions = [
    { initials: 'MC', color: '#6366F1', name: 'Morgan C.', handle: '@morganc', reason: '3 mutual friends' },
    { initials: 'KP', color: '#EC4899', name: 'Kim P.',    handle: '@kimp',    reason: '2 mutual friends' },
  ];
  return svg(`
  <rect width="${VW}" height="${VH}" fill="${C.bg}"/>
  ${statusBar()}

  <!-- Header -->
  <text x="24" y="90" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="26" font-weight="700">Friends</text>

  <!-- Search bar -->
  <rect x="24" y="104" width="${VW - 48}" height="42" rx="14" fill="${C.card}" stroke="${C.border}" stroke-width="0.5"/>
  <!-- magnifying glass SVG path -->
  <circle cx="46" cy="125" r="8" fill="none" stroke="${C.mutedFg}" stroke-width="1.8"/>
  <line x1="51" y1="131" x2="57" y2="137" stroke="${C.mutedFg}" stroke-width="1.8" stroke-linecap="round"/>
  <text x="70" y="130" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="14">Search friends...</text>

  <!-- Friends section label -->
  <text x="24" y="168" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
        font-size="11" font-weight="600" letter-spacing="1.2">MY FRIENDS (${friends.length})</text>

  <!-- Friend rows -->
  ${friends.map((f, i) => {
    const y = 182 + i * 80;
    return `${card({ x: 24, y, w: VW - 48, h: 66, r: 12, fill: C.card })}
    ${avatar({ cx: 62, cy: y + 33, r: 22, fill: f.color, initials: f.initials, textSize: 13 })}
    <text x="96" y="${y + 26}" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
          font-size="15" font-weight="600">${f.name}</text>
    <text x="96" y="${y + 44}" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
          font-size="12">${f.handle}</text>
    <text x="${VW - 36}" y="${y + 26}" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
          font-size="11" text-anchor="end">${f.mutual}</text>
    <text x="${VW - 36}" y="${y + 44}" fill="${C.primary}" font-family="system-ui,-apple-system,sans-serif"
          font-size="11" font-weight="600" text-anchor="end">Message</text>`;
  }).join('\n')}

  <!-- Suggestions label -->
  <text x="24" y="${182 + friends.length * 80 + 28}" fill="${C.mutedFg}"
        font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="600"
        letter-spacing="1.2">SUGGESTED</text>

  ${suggestions.map((s, i) => {
    const baseY = 182 + friends.length * 80 + 44;
    const y = baseY + i * 80;
    return `${card({ x: 24, y, w: VW - 48, h: 66, r: 12, fill: C.card })}
    ${avatar({ cx: 62, cy: y + 33, r: 22, fill: s.color, initials: s.initials, textSize: 13 })}
    <text x="96" y="${y + 26}" fill="${C.fg}" font-family="system-ui,-apple-system,sans-serif"
          font-size="15" font-weight="600">${s.name}</text>
    <text x="96" y="${y + 44}" fill="${C.mutedFg}" font-family="system-ui,-apple-system,sans-serif"
          font-size="12">${s.reason}</text>
    <rect x="${VW - 112}" y="${y + 18}" width="76" height="28" rx="14" fill="${C.primary}"/>
    <text x="${VW - 74}" y="${y + 36}" fill="#fff" font-family="system-ui,-apple-system,sans-serif"
          font-size="12" font-weight="600" text-anchor="middle">+ Add</text>`;
  }).join('\n')}

  ${tabBar('friends')}
  `);
}

// ─── Main — render all screens for all sizes ──────────────────────────────────

async function processOnboardingScreenshot(size) {
  const rawPath = path.join(RAW, 'screen_onboarding.jpg');
  const altPath = path.join(__dirname, '..', '..', '..', '..', 'screenshots', 'raw_onboarding.jpg');

  let srcPath = null;
  if (fs.existsSync(rawPath)) srcPath = rawPath;
  else if (fs.existsSync(altPath)) srcPath = altPath;

  if (srcPath) {
    // Crop out the "No internet connection" banner (top ~30px) and scale
    const img = sharp(srcPath);
    const meta = await img.metadata();
    const cropTop = Math.round(meta.height * 0.035); // ~3.5% = banner height
    return img
      .extract({ left: 0, top: cropTop, width: meta.width, height: meta.height - cropTop })
      .resize(size.w, size.h, { fit: 'cover', position: 'top' })
      .png()
      .toBuffer();
  }

  // Fallback: render the SVG mockup
  return sharp(Buffer.from(screenOnboarding()))
    .resize(size.w, size.h)
    .png()
    .toBuffer();
}

async function renderSvgToSize(svgContent, size) {
  return sharp(Buffer.from(svgContent))
    .resize(size.w, size.h)
    .png()
    .toBuffer();
}

async function main() {
  const screens = [
    { key: '1-login',            svg: null,                   usePhoto: true },
    { key: '2-home',             svg: screenHome()                           },
    { key: '3-bill',             svg: screenBill()                           },
    { key: '4-scan',             svg: screenScan()                           },
    { key: '5-payment-request',  svg: screenPayment()                        },
    { key: '6-friends',          svg: screenFriends()                        },
  ];

  let generated = 0;
  for (const size of SIZES) {
    for (const screen of screens) {
      const outFile = path.join(OUT, `${size.key}_${screen.key}.png`);
      let buf;
      try {
        if (screen.usePhoto) {
          buf = await processOnboardingScreenshot(size);
        } else {
          buf = await renderSvgToSize(screen.svg, size);
        }
        fs.writeFileSync(outFile, buf);
        console.log(`✓  ${path.basename(outFile)}`);
        generated++;
      } catch (err) {
        console.error(`✗  ${path.basename(outFile)}: ${err.message}`);
      }
    }
  }
  console.log(`\nDone — ${generated}/${SIZES.length * screens.length} files written to ${OUT}`);
}

main().catch(err => { console.error(err); process.exit(1); });
