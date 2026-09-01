/**
 * THE SPREADSHEET WRITER IS NOT REACHABLE FROM A DESKTOP WINDOW, and this is
 * the altitude that says so without a build.
 *
 * The owner's ruling, 1 September 2026: *"Lose excel is fine as long as they
 * can keep csv."* The desktop edition's Export surfaces offer CSV and PDF; the
 * web edition is untouched. `@spreadsheet` is the seam, and this file is the
 * cheapest of the three checks behind it.
 *
 * ── WHY THREE CHECKS, AND WHAT ONLY THIS ONE CAN SAY ────────────────────────
 *
 * | `scripts/desktop-bundle-greps.mjs` | the built bundle | needs a build; names the FILE the word landed in |
 * | `scripts/desktop-bundle-size.mjs`  | its weight       | needs a build; catches a return of ANY 488 KiB library, named or not |
 * | this                               | the import graph | runs in every test run on any machine, and names the CHAIN |
 *
 * The chain is the thing a person actually needs. A grep says
 * *"ExportManager's chunk contains xlsx"*; this says which component imported
 * what, in order, which is where the fix goes. It is also the only one of the
 * three that runs before a pull request has built anything.
 *
 * ── AND WHY IT IS NOT A ROW IN `editionWalk.ts`'s FORBIDDEN LISTS ───────────
 *
 * Those lists answer one question — *does this bundle reach a network, a login
 * or a second copy of the ledger?* — and every entry is a promise about the
 * user's MONEY. This is a promise about their DISK: `xlsx` is a perfectly local
 * library that leaks nothing and would be entirely welcome here if the product
 * offered the format. Filing it under "cloudFree" would make that list mean two
 * things, and the first time somebody ships a large library on purpose the
 * argument would be had against the wrong rule.
 */

import { describe, expect, it } from 'vitest';
import { chainTo, walkFrom } from '../../services/local/__tests__/importGraph';
import { CLOUD_ALIAS, DEVICE_ALIAS } from './editionWalk';

/** The one package the ruling is about. */
const SPREADSHEET_WRITER = 'xlsx';

/** The modal that was its only dedicated caller, and is now the seam's. */
const EXCEL_MODAL = 'components/ExcelExport.tsx';

describe('the desktop edition sheds the spreadsheet writer', () => {
  const device = walkFrom(['desktop/main'], DEVICE_ALIAS);

  it('reaches the Export surfaces, so the absence below is about them', () => {
    // Checked before it is trusted, for the walker's own reason: a walk that
    // resolved nothing would pass every assertion in this file. Both consumers
    // of the seam are in the graph — the page and the report builder — which is
    // what makes "and not the library" a statement about this feature rather
    // than about a route the window does not serve.
    expect(device.modules.has('pages/ExportManager.tsx')).toBe(true);
    expect(device.modules.has('components/EnhancedExportManager.tsx')).toBe(true);
    expect(device.modules.has('desktop/editions/spreadsheet.ts')).toBe(true);
  });

  it('does not reach xlsx', () => {
    const chain = chainTo(device, SPREADSHEET_WRITER);
    expect(
      chain === null,
      chain === null
        ? ''
        : 'A desktop build would embed 488 KiB of SheetJS for a format this edition does not '
          + `write (owner, 1 Sep 2026).\n  ${chain}`
    ).toBe(true);
  });

  it('does not reach the Excel modal either, so no chunk is built to defer', () => {
    // The library is the 488 KiB, but the modal is what makes the library
    // reachable, and a build that contained the modal would be a build one
    // careless import away from containing both.
    const chain = chainTo(device, EXCEL_MODAL);
    expect(chain === null, chain === null ? '' : `${EXCEL_MODAL} is in the window's graph.\n  ${chain}`)
      .toBe(true);
  });

  it('would notice — the same walk with the seam pointed at the web half finds both', () => {
    // The proof this instrument can fail, and the specific failure it is for:
    // the eviction rests entirely on `apps/desktop/vite.config.ts` resolving
    // `@spreadsheet` to the device half. Lose that one mapping and the specifier
    // falls through to the web half, the renderer silently regains its largest
    // chunk, and NOTHING IN THE SOURCE LOOKS DIFFERENT. So the same walk is run
    // with the alias pointed the wrong way and is required to find what the
    // right way must not.
    const misaliased = walkFrom(['desktop/main'], { ...DEVICE_ALIAS, '@spreadsheet': 'editions/cloud/spreadsheet' });

    expect(misaliased.packages.has(SPREADSHEET_WRITER)).toBe(true);
    expect(misaliased.modules.has(EXCEL_MODAL)).toBe(true);
  });

  it('leaves the WEB edition carrying both, because nothing was taken from it', () => {
    // The other half of the ruling, and the one a regression would be quietest
    // about: a browser keeps the Excel button, the modal and the lazy chunk
    // exactly as before. An "optimisation" that shed the format from both
    // editions would pass every desktop check in this repository.
    const web = walkFrom(['main'], CLOUD_ALIAS);

    expect(web.packages.has(SPREADSHEET_WRITER)).toBe(true);
    expect(web.modules.has(EXCEL_MODAL)).toBe(true);
  });

  it('keeps the PDF writer on both sides — the ruling was about one format', () => {
    // jspdf is 355.7 KiB and is now the desktop renderer's largest chunk. It
    // stays: PDF is a format this edition offers, and a size gate is not a
    // licence to remove features until the number is pleasing.
    expect(device.packages.has('jspdf')).toBe(true);
  });
});
