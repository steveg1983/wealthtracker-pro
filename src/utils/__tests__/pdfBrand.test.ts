/**
 * The PDF footer's lockup is vector paths in navy, never text — so a printed
 * statement shows the mark even though no PDF reader has IBM Plex.
 *
 * Two altitudes: a recording surface proves the geometry (where every point
 * lands, that each quadratic became exactly one cubic, both rules), and the
 * real jsPDF proves the operators it writes are the ones a reader will fill.
 */
import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import { drawPdfLockup, PDF_LOCKUP_WIDTH_MM, type PdfPathSurface } from '../pdfBrand';
import { LOCKUP_HORIZONTAL, MARK_R_PATH } from '../../design-system/brandIdentity';

interface Call {
  op: keyof PdfPathSurface;
  args: unknown[];
}

const recorder = (): { surface: PdfPathSurface; calls: Call[] } => {
  const calls: Call[] = [];
  const record =
    (op: keyof PdfPathSurface) =>
    (...args: unknown[]) => {
      calls.push({ op, args });
    };
  return {
    calls,
    surface: {
      setFillColor: record('setFillColor'),
      moveTo: record('moveTo'),
      lineTo: record('lineTo'),
      curveTo: record('curveTo'),
      close: record('close'),
      fillEvenOdd: record('fillEvenOdd'),
      rect: record('rect')
    }
  };
};

describe('drawPdfLockup', () => {
  const LEFT = 20;
  const BASELINE = 287;

  it('fills the navy, once even-odd, then the two rules', () => {
    const { surface, calls } = recorder();
    drawPdfLockup(surface, LEFT, BASELINE);
    expect(calls[0]).toEqual({ op: 'setFillColor', args: [26, 35, 50] });
    expect(calls.filter((c) => c.op === 'fillEvenOdd')).toHaveLength(1);
    const rects = calls.filter((c) => c.op === 'rect');
    expect(rects).toHaveLength(2);
    for (const r of rects) expect(r.args[4]).toBe('F');
  });

  it('raises every quadratic to exactly one cubic, and closes every contour', () => {
    const { surface, calls } = recorder();
    drawPdfLockup(surface, LEFT, BASELINE);
    const d = MARK_R_PATH + LOCKUP_HORIZONTAL.wordPath;
    const count = (re: RegExp): number => d.match(re)?.length ?? 0;
    expect(calls.filter((c) => c.op === 'curveTo')).toHaveLength(count(/[QC]/g));
    expect(calls.filter((c) => c.op === 'moveTo')).toHaveLength(count(/M/g));
    expect(calls.filter((c) => c.op === 'close')).toHaveLength(count(/Z/g));
  });

  it('starts its ink at the margin, puts its word on the footer baseline, and keeps to its width', () => {
    const { surface, calls } = recorder();
    drawPdfLockup(surface, LEFT, BASELINE);
    const xs: number[] = [];
    const ys: number[] = [];
    for (const c of calls) {
      if (c.op === 'moveTo' || c.op === 'lineTo' || c.op === 'curveTo') {
        const a = c.args as number[];
        for (let i = 0; i < a.length; i += 2) {
          xs.push(a[i]);
          ys.push(a[i + 1]);
        }
      }
    }
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(LEFT - 0.01);
    expect(Math.max(...xs)).toBeLessThanOrEqual(LEFT + PDF_LOCKUP_WIDTH_MM);
    // Glyph ink rises above the baseline and only the y's descender dips below it.
    expect(Math.max(...ys)).toBeGreaterThan(BASELINE);
    expect(Math.min(...ys)).toBeLessThan(BASELINE - 3);
    // The rules hang under the baseline, like a total's.
    for (const r of calls.filter((c) => c.op === 'rect')) {
      expect(r.args[1] as number).toBeGreaterThan(BASELINE);
    }
  });

  it('writes fill operators a PDF reader will paint, in the navy, with no text', () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
    drawPdfLockup(pdf, LEFT, BASELINE);
    const out = pdf.output();
    // jsPDF writes colours to two decimal places: #1a2332 becomes (0.1, 0.14, 0.2).
    expect(out).toMatch(/^0\.1 0\.14 0\.2 rg$/m);
    expect(out).toMatch(/^f\*$/m);
    expect(out.match(/ re$/gm)?.length ?? 0).toBe(2);
    expect(out).not.toMatch(/\/F\d+ \d+ Tf/);
  });
});
