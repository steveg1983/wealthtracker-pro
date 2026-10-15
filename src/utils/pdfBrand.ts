/**
 * The Reckley lockup in a PDF footer — drawn as vector paths, never as text.
 *
 * Identity handover §5: "Printed statements and PDF exports — horizontal, navy,
 * footer left." jsPDF has no SVG import worth trusting and no IBM Plex, so the
 * lockup is drawn the only way that cannot fall back to another typeface: the
 * outlined geometry in `design-system/brandIdentity.ts`, replayed as PDF path
 * operators. The glyph outlines are quadratic (TrueType) and PDF paths are
 * cubic, so each `Q` is raised to the cubic with the same curve — exact, not
 * an approximation.
 *
 * Filled even-odd: a glyph's counter (the hole in the R, the e) is its own
 * contour, and even-odd cuts it out whatever direction the font wound it.
 */

import {
  BRAND_NAVY,
  LOCKUP_HORIZONTAL,
  MARK_R_PATH,
  MARK_RULES
} from '../design-system/brandIdentity';

/** The slice of jsPDF this needs — so a test can record the calls. */
export interface PdfPathSurface {
  setFillColor(r: number, g: number, b: number): unknown;
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): unknown;
  close(): unknown;
  fillEvenOdd(): unknown;
  rect(x: number, y: number, w: number, h: number, style?: string | null): unknown;
}

type Point = readonly [number, number];

/** In mm: 25.4mm is the handover's 96px minimum at 96dpi, with a hair to spare. */
export const PDF_LOCKUP_WIDTH_MM = 26;

/** The lockup's word sits on the mark's baseline, y=32 in mark units. */
const MARK_BASELINE = 32;
/** The mark's ink starts at the rules' left end, x=13. */
const INK_LEFT = MARK_RULES[0].x;

const hexToRgb = (hex: string): readonly [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};

/**
 * Replay generated path data (absolute M, L, Q, C, Z — the only commands the
 * generator writes) through `map` onto the surface.
 */
function tracePath(surface: PdfPathSurface, d: string, map: (p: Point) => Point): void {
  let pen: Point = [0, 0];
  let start: Point = [0, 0];
  for (const [, op, args] of d.matchAll(/([MLQCZ])([^MLQCZ]*)/g)) {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (op === 'M') {
      pen = [n[0], n[1]];
      start = pen;
      surface.moveTo(...map(pen));
    } else if (op === 'L') {
      pen = [n[0], n[1]];
      surface.lineTo(...map(pen));
    } else if (op === 'Q') {
      const q: Point = [n[0], n[1]];
      const end: Point = [n[2], n[3]];
      const c1: Point = [pen[0] + (2 / 3) * (q[0] - pen[0]), pen[1] + (2 / 3) * (q[1] - pen[1])];
      const c2: Point = [end[0] + (2 / 3) * (q[0] - end[0]), end[1] + (2 / 3) * (q[1] - end[1])];
      surface.curveTo(...map(c1), ...map(c2), ...map(end));
      pen = end;
    } else if (op === 'C') {
      const end: Point = [n[4], n[5]];
      surface.curveTo(...map([n[0], n[1]]), ...map([n[2], n[3]]), ...map(end));
      pen = end;
    } else {
      surface.close();
      pen = start;
    }
  }
}

/**
 * Draw the horizontal lockup with its ink starting at `left` and its word on
 * `baseline` (both mm) — so it lines up with a footer's line of text.
 */
export function drawPdfLockup(
  surface: PdfPathSurface,
  left: number,
  baseline: number,
  widthMm: number = PDF_LOCKUP_WIDTH_MM
): void {
  const k = widthMm / LOCKUP_HORIZONTAL.viewBox.width;
  const map = ([x, y]: Point): Point => [left + (x - INK_LEFT) * k, baseline + (y - MARK_BASELINE) * k];
  const [r, g, b] = hexToRgb(BRAND_NAVY);
  surface.setFillColor(r, g, b);

  tracePath(surface, MARK_R_PATH, map);
  tracePath(surface, LOCKUP_HORIZONTAL.wordPath, map);
  surface.fillEvenOdd();

  for (const rule of MARK_RULES) {
    const [x, y] = map([rule.x, rule.y]);
    surface.rect(x, y, rule.width * k, rule.height * k, 'F');
  }
}
