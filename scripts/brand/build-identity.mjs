#!/usr/bin/env node
/**
 * THE RECKLEY IDENTITY, OUTLINED — every logo file, from the font, in one pass.
 *
 *   node scripts/brand/build-identity.mjs          write every asset
 *   node scripts/brand/build-identity.mjs --check  write nothing; exit 1 if a
 *                                                  committed vector asset differs
 *
 * ── WHY A SCRIPT AND NOT A DRAWING ────────────────────────────────────────────
 *
 * The identity handover (Claude Design, 16 Sep 2026) settled the mark — a
 * capital R in IBM Plex Sans 600 ruled off with a double underline — and named
 * exactly one blocking task: the R was live `<text>`, so on any machine where
 * the webfont failed to fetch the letter silently became another typeface. A
 * logo whose shape depends on the reader's font cache is not a logo.
 *
 * Outlining by hand in an editor would have fixed that once. This file fixes it
 * reproducibly: the glyph outlines come out of the font at build time, the
 * geometry below is the handover's §2 verbatim, and every derived file — the
 * three SVGs, the favicons, the app tiles, the iOS icon and splash, the desktop
 * master, and the TypeScript the app draws from — is a function of those
 * numbers. Change a number, rerun, commit what changed. Nothing is pasted.
 *
 * ── WHAT IS ON DISK BESIDE IT ─────────────────────────────────────────────────
 *
 * `IBMPlexSans-SemiBold.woff` is IBM's own build (npm `@ibm/plex-sans` 1.1.0,
 * font version 3.005), committed with `IBMPlexSans-OFL.txt`. The SIL Open Font
 * Licence permits redistributing the font with its licence, and artwork made
 * from outlined glyphs is not Font Software under it — the logo carries no
 * licence obligation. Only six glyphs are ever read: R e c k l y.
 *
 * ── DECISIONS THE HANDOVER LEFT OPEN, MADE HERE AND NAMED ─────────────────────
 *
 *  - Optical centre. §2 warns that Plex's R has a splayed leg, so the text
 *    anchor does not centre it. Measured: anchored at x=24 with the -0.04em
 *    tracking, the ink centres at 25.25. The path is nudged so the ink BOUNDING
 *    BOX centres on 24 — the rules are a 22-unit bar centred on 24, so this is
 *    the reading in which the letter sits square over its underline. The rules
 *    are never moved (§2: "nudge the path, not the rules").
 *  - Wordmark size. The handover names the face, not the size. The word is set
 *    at the mark's own size (34 in mark units), so the R of "Reckley" and the R
 *    of the mark are the same letter at the same height, and the word shares
 *    the mark's baseline in the horizontal lockup. Tracking -0.01em with the
 *    font's own kerning, the same tracking the landing page already set the
 *    name in.
 *  - "Gap = 0.45 × mark height" is measured INK TO INK: from the rules' right
 *    end to the left edge of the word's R, with mark height = the 48-unit box
 *    (the size CSS sets). Measured from the box edge it would add the box's
 *    13-unit side margin and float the word off the mark. Stacked: 0.21 × 48
 *    from the second rule's foot to the tallest ascender (k, l).
 *  - Lockup files are cropped to their ink plus one rule stroke (3 units) on
 *    every side — §4's clear space, built in, so a lockup dropped anywhere
 *    cannot crowd its neighbour. The mark alone keeps §2's 48×48 box.
 *  - Tiles (favicon, app icons, splash, OG) centre the INK, not the box. The
 *    48-box puts 8.3 units above the R and 2.6 below the rules; centring the
 *    box would sit the mark visibly low in every square it lands in.
 *  - The favicon's .ico sizes are hinted: at 16/32/48 the rules and the gap are
 *    snapped to whole pixels, because §4's minimum-size rule exists precisely
 *    because two sub-pixel rules smear into one thick line, and a one-pixel
 *    rule straddling two pixel rows is that smear. favicon.svg stays exact.
 */

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';

const require = createRequire(import.meta.url);
const opentype = require('opentype.js');
const { Resvg } = require('@resvg/resvg-js');

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const CHECK = process.argv.includes('--check');

// ── §2, verbatim ──────────────────────────────────────────────────────────────
const BOX = 48;
const FONT_SIZE = 34;
const R_TRACKING_EM = -0.04;
const ANCHOR_X = 24;
const BASELINE = 32;
const RULES = [
  { x: 13, y: 37, width: 22, height: 3 },
  { x: 13, y: 42.4, width: 22, height: 3 },
];
const RULE_STROKE = RULES[0].height;
const RULE_GAP = RULES[1].y - (RULES[0].y + RULES[0].height); // 2.4

// ── §3 and §5 ─────────────────────────────────────────────────────────────────
const NAVY = '#1a2332'; // the app's own navy: theme-color, the top bar, --color-sidebar
const KNOCKOUT = '#ffffff';
const OG_GROUND = '#f8f9fb';
// The first thing the web view paints is index.html's .app-loading ground, so
// the native splash uses the same two grounds — no flash between them.
const SPLASH_LIGHT = '#f3f4f6';
const SPLASH_DARK = '#111827';
const HORIZONTAL_GAP = 0.45 * BOX;
const STACKED_GAP = 0.21 * BOX;
const TILE_MARK_FRACTION = 0.62; // apple-touch-icon: "mark at 62% of tile width"
const WORD_TRACKING_EM = -0.01;
const CLEAR = RULE_STROKE;

// ── The font ─────────────────────────────────────────────────────────────────
const fontBytes = readFileSync(join(HERE, 'IBMPlexSans-SemiBold.woff'));
const font = opentype.parse(
  fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength),
);
const unit = FONT_SIZE / font.unitsPerEm;

const num = (v) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};

/**
 * opentype commands → compact absolute path data (M L Q C Z only). A line to
 * the point the pen is already on is dropped: Plex's contours restart on their
 * own end points, and those zero-length segments are bytes with no ink.
 */
const pathData = (commands) => {
  let at = '';
  return commands
    .map((c) => {
      const end = 'x' in c ? `${num(c.x)} ${num(c.y)}` : at;
      const skip = c.type === 'L' && end === at;
      at = end;
      if (skip) return '';
      switch (c.type) {
        case 'M':
        case 'L':
          return `${c.type}${end}`;
        case 'Q':
          return `Q${num(c.x1)} ${num(c.y1)} ${num(c.x)} ${num(c.y)}`;
        case 'C':
          return `C${num(c.x1)} ${num(c.y1)} ${num(c.x2)} ${num(c.y2)} ${num(c.x)} ${num(c.y)}`;
        case 'Z':
          return 'Z';
        default:
          throw new Error(`Unexpected path command ${c.type}`);
      }
    })
    .join('');
};

const bounds = (commands) => {
  const p = new opentype.Path();
  p.commands = commands;
  const b = p.getBoundingBox();
  return { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 };
};

const translate = (commands, dx, dy) =>
  commands.map((c) => {
    const t = { ...c };
    for (const k of ['x', 'x1', 'x2']) if (k in t) t[k] += dx;
    for (const k of ['y', 'y1', 'y2']) if (k in t) t[k] += dy;
    return t;
  });

// ── The R ────────────────────────────────────────────────────────────────────
const glyphR = font.charToGlyph('R');
const boxR = glyphR.getBoundingBox();
const anchoredOrigin = ANCHOR_X - (glyphR.advanceWidth * unit + R_TRACKING_EM * FONT_SIZE) / 2;
const anchoredInkCentre = anchoredOrigin + ((boxR.x1 + boxR.x2) / 2) * unit;
const rOrigin = ANCHOR_X - ((boxR.x1 + boxR.x2) / 2) * unit;
const rCommands = glyphR.getPath(rOrigin, BASELINE, FONT_SIZE).commands;
const rInk = bounds(rCommands);

// ── The word ─────────────────────────────────────────────────────────────────
const setWord = (text, originX, baseline) => {
  const glyphs = font.stringToGlyphs(text);
  let x = originX;
  const commands = [];
  glyphs.forEach((g, i) => {
    commands.push(...g.getPath(x, baseline, FONT_SIZE).commands);
    x += g.advanceWidth * unit + WORD_TRACKING_EM * FONT_SIZE;
    if (i < glyphs.length - 1) x += font.getKerningValue(g, glyphs[i + 1]) * unit;
  });
  return commands;
};
const wordAtZero = setWord('Reckley', 0, 0);
const wordInkAtZero = bounds(wordAtZero);

const markInk = {
  x1: Math.min(rInk.x1, RULES[0].x),
  y1: rInk.y1,
  x2: Math.max(rInk.x2, RULES[0].x + RULES[0].width),
  y2: RULES[1].y + RULES[1].height,
};

// Horizontal: the word on the mark's baseline, its ink HORIZONTAL_GAP after the rules.
const hWord = translate(wordAtZero, markInk.x2 + HORIZONTAL_GAP - wordInkAtZero.x1, BASELINE);
const hWordInk = bounds(hWord);
// Stacked: the word centred under the mark, its tallest ink STACKED_GAP below the rules.
const sWord = translate(
  wordAtZero,
  ANCHOR_X - (wordInkAtZero.x1 + wordInkAtZero.x2) / 2,
  markInk.y2 + STACKED_GAP - wordInkAtZero.y1,
);
const sWordInk = bounds(sWord);

const cropped = (...boxes) => {
  const x1 = Math.min(...boxes.map((b) => b.x1)) - CLEAR;
  const y1 = Math.min(...boxes.map((b) => b.y1)) - CLEAR;
  const x2 = Math.max(...boxes.map((b) => b.x2)) + CLEAR;
  const y2 = Math.max(...boxes.map((b) => b.y2)) + CLEAR;
  return { x: +num(x1), y: +num(y1), width: +num(x2 - x1), height: +num(y2 - y1) };
};
const hView = cropped(markInk, hWordInk);
const sView = cropped(markInk, sWordInk);

const R_PATH = pathData(rCommands);
const H_WORD_PATH = pathData(hWord);
const S_WORD_PATH = pathData(sWord);

// ── SVG text ─────────────────────────────────────────────────────────────────
const rectEl = (r, fill = '') =>
  `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.width)}" height="${num(r.height)}"${fill}/>`;
const vb = (v) => `${num(v.x)} ${num(v.y)} ${num(v.width)} ${num(v.height)}`;
const svgDoc = (viewBox, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${extra}>${body}</svg>\n`;
const markBody = (fill = '') =>
  `<path d="${R_PATH}"${fill}/>${RULES.map((r) => rectEl(r, fill)).join('')}`;

const MARK_SVG = svgDoc(`0 0 ${BOX} ${BOX}`, markBody(), ' fill="currentColor" role="img" aria-label="Reckley"');
const H_SVG = svgDoc(vb(hView), `${markBody()}<path d="${H_WORD_PATH}"/>`, ' fill="currentColor" role="img" aria-label="Reckley"');
const S_SVG = svgDoc(vb(sView), `${markBody()}<path d="${S_WORD_PATH}"/>`, ' fill="currentColor" role="img" aria-label="Reckley"');

/**
 * A square tile with the mark's INK centred, the 48-box scaled to `fraction` of
 * the tile. `hint` snaps the rules and the gap to whole device pixels at `px`.
 */
const tileSvg = ({ size, ground, ink, fraction, radius = 0, inset = 0, hint = 0 }) => {
  const inner = size - inset * 2;
  const s = (inner * fraction) / BOX;
  const cx = (markInk.x1 + markInk.x2) / 2;
  const cy = (markInk.y1 + markInk.y2) / 2;
  const tx = size / 2 - cx * s;
  const ty = size / 2 - cy * s;
  let rules = RULES.map((r) => ({ x: r.x * s + tx, y: r.y * s + ty, width: r.width * s, height: r.height * s }));
  if (hint) {
    const k = hint / size; // device pixels per tile unit
    const h = Math.max(1, Math.round(RULE_STROKE * s * k));
    const g = Math.max(1, Math.round(RULE_GAP * s * k));
    const w = 2 * Math.round((RULES[0].width * s * k) / 2);
    const centreY = ((rules[0].y + rules[1].y + rules[1].height) / 2) * k;
    const top = Math.round(centreY - (2 * h + g) / 2);
    const left = hint / 2 - w / 2;
    rules = [
      { x: left / k, y: top / k, width: w / k, height: h / k },
      { x: left / k, y: (top + h + g) / k, width: w / k, height: h / k },
    ];
  }
  const groundEl = ground
    ? `<rect x="${num(inset)}" y="${num(inset)}" width="${num(inner)}" height="${num(inner)}"${radius ? ` rx="${num(radius)}"` : ''} fill="${ground}"/>`
    : '';
  const r = pathData(translate(rCommands.map((c) => scaleCmd(c, s)), tx, ty));
  return svgDoc(
    `0 0 ${size} ${size}`,
    `${groundEl}<path d="${r}" fill="${ink}"/>${rules.map((x) => rectEl(x, ` fill="${ink}"`)).join('')}`,
  );
};

function scaleCmd(c, s) {
  const t = { ...c };
  for (const k of ['x', 'x1', 'x2', 'y', 'y1', 'y2']) if (k in t) t[k] *= s;
  return t;
}

/** A canvas with a lockup's ink centred and scaled so the 48-box is `markPx`. */
const canvasSvg = ({ width, height, ground, ink, view, wordPath, markPx }) => {
  const s = markPx / BOX;
  const inkCx = view.x + view.width / 2;
  const inkCy = view.y + view.height / 2;
  const tx = width / 2 - inkCx * s;
  const ty = height / 2 - inkCy * s;
  return svgDoc(
    `0 0 ${width} ${height}`,
    `<rect width="${width}" height="${height}" fill="${ground}"/>` +
      `<g transform="translate(${num(tx)} ${num(ty)}) scale(${num(s)})" fill="${ink}">${markBody()}<path d="${wordPath}"/></g>`,
  );
};

// ── Raster encoders: PNG (RGB or RGBA), ICO, written by hand ───────────────────
const render = (svg, size) => {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: false } });
  const img = r.render();
  return { width: img.width, height: img.height, rgba: Buffer.from(img.pixels) };
};

const pngChunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
};

/** `alpha: false` writes colour type 2 — the App Store refuses an icon WITH an alpha channel, even an opaque one. */
const encodePng = ({ width, height, rgba }, { alpha = true } = {}) => {
  const ch = alpha ? 4 : 3;
  const raw = Buffer.alloc((width * ch + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * ch + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (width * ch + 1) + 1 + x * ch;
      raw[di] = rgba[si];
      raw[di + 1] = rgba[si + 1];
      raw[di + 2] = rgba[si + 2];
      if (alpha) raw[di + 3] = rgba[si + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

const encodeIco = (pngs) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const dir = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...dir, ...pngs.map((p) => p.data)]);
};

const png = (svg, size, opts) => encodePng(render(svg, size), opts);

// ── The TypeScript the app draws from ─────────────────────────────────────────
const TS = `/**
 * GENERATED by scripts/brand/build-identity.mjs — do not edit by hand.
 *
 * The Reckley mark and its two lockups as outlined geometry: no <text>, no
 * font-family, nothing the reader's font cache can change. Rerun the script to
 * regenerate; its header records every decision the identity handover left
 * open. Rules this geometry exists to keep (handover §4):
 *
 *  - one flat colour — currentColor in the app, never the amber, income green
 *    or expense red;
 *  - TWO rules, always. One rule is a subtotal; two is checked and final. It is
 *    the mark's entire meaning and the first thing that gets "simplified";
 *  - proportional scaling only — preserveAspectRatio is never 'none';
 *  - never smaller than ${16}px for the mark alone, ${96}px wide for a lockup.
 */

/** The 48-unit box every size below is measured in. */
export const MARK_BOX = ${BOX} as const;

/** The R, outlined from IBM Plex Sans 600 at 34, ink centred on x=24, baseline 32. */
export const MARK_R_PATH =
  '${R_PATH}';

/** The double rule. Always both. */
export const MARK_RULES = [
${RULES.map((r) => `  { x: ${num(r.x)}, y: ${num(r.y)}, width: ${num(r.width)}, height: ${num(r.height)} },`).join('\n')}
] as const;

export interface LockupGeometry {
  /** viewBox in mark units: the ink plus one rule stroke of clear space. */
  readonly viewBox: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** "Reckley", outlined, in the same units as the mark. */
  readonly wordPath: string;
}

/** Mark + word on the mark's baseline, gap 0.45 × the mark box. */
export const LOCKUP_HORIZONTAL: LockupGeometry = {
  viewBox: { x: ${hView.x}, y: ${hView.y}, width: ${hView.width}, height: ${hView.height} },
  wordPath:
    '${H_WORD_PATH}',
};

/** Mark centred above the word, gap 0.21 × the mark box. */
export const LOCKUP_STACKED: LockupGeometry = {
  viewBox: { x: ${sView.x}, y: ${sView.y}, width: ${sView.width}, height: ${sView.height} },
  wordPath:
    '${S_WORD_PATH}',
};

/** The navy every printed or fixed-colour use of the mark is drawn in. */
export const BRAND_NAVY = '${NAVY}' as const;

/** Handover §4 minimums, in CSS pixels. */
export const MIN_MARK_PX = 16 as const;
export const MIN_LOCKUP_WIDTH_PX = 96 as const;
`;

// ── Every file, in one table ──────────────────────────────────────────────────
const at = (p) => join(ROOT, p);
const favicon = (size) => tileSvg({ size, ground: NAVY, ink: KNOCKOUT, fraction: 1, hint: size });
const tile = (size) => tileSvg({ size, ground: NAVY, ink: KNOCKOUT, fraction: TILE_MARK_FRACTION });
// macOS draws an icon on its own grid: an 824-unit rounded square on a 1024
// canvas. A full-bleed square sits visibly larger than every other app in the
// Dock, so the desktop master carries the inset; iOS and the web masks
// round their own corners and get the full bleed.
const desktopMaster = tileSvg({ size: 1024, ground: NAVY, ink: KNOCKOUT, fraction: TILE_MARK_FRACTION, inset: 100, radius: 185 });
const splash = (ground, ink) =>
  canvasSvg({ width: 2732, height: 2732, ground, ink, view: sView, wordPath: S_WORD_PATH, markPx: 288 });

// The iOS launch image set. Capacitor's template lists the same 2732² image
// three times, once per scale, as three files — Xcode will not take one file
// for three scales. The dark trio rides on the asset catalogue's own
// appearance switch, so a dark-mode launch no longer opens on a white flash.
const SPLASH_DIR = 'apps/mobile/ios/App/App/Assets.xcassets/Splash.imageset';
const SPLASH_FILES = [
  ['1x', 'splash-2732x2732-2.png', 'splash-2732x2732-dark-2.png'],
  ['2x', 'splash-2732x2732-1.png', 'splash-2732x2732-dark-1.png'],
  ['3x', 'splash-2732x2732.png', 'splash-2732x2732-dark.png'],
];
const SPLASH_CONTENTS = `${JSON.stringify(
  {
    images: SPLASH_FILES.flatMap(([scale, light, dark]) => [
      { idiom: 'universal', filename: light, scale },
      { appearances: [{ appearance: 'luminosity', value: 'dark' }], idiom: 'universal', filename: dark, scale },
    ]),
    info: { version: 1, author: 'xcode' },
  },
  null,
  2,
)}\n`;

// The page shell's boot splash, between two markers in index.html. It paints
// before any stylesheet or script, so the lockup is inline and its colour comes
// from the shell's own critical CSS (.app-loading-mark).
const BOOT_START = '<!-- brand:boot-lockup (generated by scripts/brand/build-identity.mjs) -->';
const BOOT_END = '<!-- /brand:boot-lockup -->';
const BOOT_WIDTH = 128;
const bootLockup = () =>
  `<svg class="app-loading-mark" viewBox="${vb(sView)}" width="${BOOT_WIDTH}" height="${num((BOOT_WIDTH * sView.height) / sView.width)}" fill="currentColor" aria-hidden="true" focusable="false">${markBody()}<path d="${S_WORD_PATH}"/></svg>`;
const withBootLockup = (html) => {
  const a = html.indexOf(BOOT_START);
  const b = html.indexOf(BOOT_END);
  if (a < 0 || b < a) throw new Error('index.html has lost its brand:boot-lockup markers');
  const indent = html.slice(html.lastIndexOf('\n', a) + 1, a);
  return `${html.slice(0, a + BOOT_START.length)}\n${indent}${bootLockup()}\n${indent}${html.slice(b)}`;
};

const VECTOR = [
  ['public/brand/reckley-mark.svg', MARK_SVG],
  ['public/brand/reckley-lockup-horizontal.svg', H_SVG],
  ['public/brand/reckley-lockup-stacked.svg', S_SVG],
  // Drawn on a 16-unit grid with its rules snapped to it: browsers that take
  // an SVG favicon take it over the .ico, so the hinting has to live here too.
  // Integer rules at 16 stay integer at 32 and 48.
  ['public/favicon.svg', favicon(16)],
  ['src/design-system/brandIdentity.ts', TS],
  [`${SPLASH_DIR}/Contents.json`, SPLASH_CONTENTS],
  ['index.html', withBootLockup(readFileSync(at('index.html'), 'utf8'))],
];

const RASTER = () => {
  const light = png(splash(SPLASH_LIGHT, NAVY), 2732, { alpha: false });
  const dark = png(splash(SPLASH_DARK, KNOCKOUT), 2732, { alpha: false });
  return [
    ['public/favicon.ico', encodeIco([16, 32, 48].map((size) => ({ size, data: png(favicon(size), size) })))],
    ['public/apple-touch-icon.png', png(tile(180), 180, { alpha: false })],
    ['public/icon-192.png', png(tile(192), 192, { alpha: false })],
    ['public/icon-512.png', png(tile(512), 512, { alpha: false })],
    ['public/og-image.png', png(canvasSvg({ width: 1200, height: 630, ground: OG_GROUND, ink: NAVY, view: sView, wordPath: S_WORD_PATH, markPx: 168 }), 1200, { alpha: false })],
    ['apps/mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', png(tile(1024), 1024, { alpha: false })],
    ...SPLASH_FILES.flatMap(([, l, d]) => [
      [`${SPLASH_DIR}/${l}`, light],
      [`${SPLASH_DIR}/${d}`, dark],
    ]),
    // Tauri's own `tauri icon` turns this into every size the bundle lists:
    //   npm run tauri --prefix apps/desktop -- icon app-icon.png
    ['apps/desktop/app-icon.png', png(desktopMaster, 1024)],
  ];
};

// ── Report, then write or check ───────────────────────────────────────────────
console.log(`R: anchored ink centre ${num(anchoredInkCentre)} → nudged ${num(rOrigin - anchoredOrigin)} to ${num((rInk.x1 + rInk.x2) / 2)}`);
console.log(`R ink ${num(rInk.x1)}..${num(rInk.x2)} × ${num(rInk.y1)}..${num(rInk.y2)}; mark ink ${num(markInk.y2 - markInk.y1)} tall`);
console.log(`horizontal viewBox ${vb(hView)}; stacked viewBox ${vb(sView)}`);

let drift = 0;
for (const [rel, text] of VECTOR) {
  const file = at(rel);
  if (CHECK) {
    const same = existsSync(file) && readFileSync(file, 'utf8') === text;
    if (!same) {
      drift++;
      console.error(`DRIFT ${rel} — rerun node scripts/brand/build-identity.mjs`);
    }
    continue;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  console.log(`wrote ${relative(ROOT, file)}`);
}
if (CHECK) {
  console.log(drift ? `${drift} file(s) drifted` : 'every vector asset matches the font and the spec');
  process.exit(drift ? 1 : 0);
}
for (const [rel, bytes] of RASTER()) {
  const file = at(rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  console.log(`wrote ${relative(ROOT, file)} (${bytes.length} bytes)`);
}
