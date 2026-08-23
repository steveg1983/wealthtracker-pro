/**
 * Recharts colours each tooltip ITEM ROW with its series' own colour — it
 * promotes a series colour to TEXT. Series colours are graphics colours,
 * built for WCAG's 3:1 graphical-object bar, not the 4.5:1 text bar: on the
 * dark tooltip bubble the semantic pair measures 4.34 and 3.36, and the
 * ramp's dark-ground steps are mid navies that all but vanish there (the
 * owner's category-donut hover, 23 Aug, was unreadable in dark mode).
 *
 * The rule (chartColors.useChartTooltipItemStyle): item text wears the
 * tooltip surface's OWN text colour, every chart, no exceptions — a tooltip
 * row already NAMES its series, and "colour groups the series, the label
 * identifies it" is the standing house rule.
 *
 * Two clauses, both measured rather than remembered:
 *  1. CENSUS — every recharts <Tooltip in src passes itemStyle, so the next
 *     chart cannot silently reintroduce series-coloured text.
 *  2. CONTRAST — the pinned item colour clears 4.5:1 on its own bubble in
 *     both themes, so the pin itself can never regress.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ColorContrastChecker } from '../../../utils/color-contrast-checker';
import { TOOLTIP_SURFACE } from '../chartColors';

const SRC = resolve(process.cwd(), 'src');

function tsxFilesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') return [];
      return tsxFilesUnder(path);
    }
    return entry.endsWith('.tsx') ? [path] : [];
  });
}

interface TooltipSite {
  file: string;
  line: number;
  /** The <Tooltip …> opening tag, through its closing angle bracket. */
  tag: string;
}

/** Every recharts <Tooltip opening tag in src, with enough of the tag to inspect. */
function rechartsTooltipSites(): TooltipSite[] {
  const sites: TooltipSite[] = [];
  for (const path of tsxFilesUnder(SRC)) {
    const content = readFileSync(path, 'utf8');
    if (!/from ['"]recharts['"]/.test(content)) continue;
    let index = content.indexOf('<Tooltip');
    while (index !== -1) {
      // The character after must end the identifier — "<TooltipCard" is not
      // recharts' Tooltip.
      const next = content[index + '<Tooltip'.length];
      if (next === undefined || /[\s/>]/.test(next)) {
        // The tag runs to its self-closing `/>` — a bare `>` is not the end,
        // because attribute values hold arrow functions (`formatter={v => …}`)
        // whose `=>` would cut the tag off before later attributes.
        const close = content.indexOf('/>', index);
        sites.push({
          file: relative(process.cwd(), path),
          line: content.slice(0, index).split('\n').length,
          tag: content.slice(index, close === -1 ? undefined : close + 2),
        });
      }
      index = content.indexOf('<Tooltip', index + 1);
    }
  }
  return sites;
}

describe('every recharts tooltip pins its item text (census)', () => {
  const sites = rechartsTooltipSites();

  it('the census sees the charts it exists for', () => {
    // A refactor that moved every chart out of src/ would leave the clauses
    // below vacuously green — this line makes that impossible to miss.
    expect(sites.length).toBeGreaterThanOrEqual(10);
  });

  it('every <Tooltip passes itemStyle — series colours are never text', () => {
    const bare = sites.filter(site => !site.tag.includes('itemStyle'));
    expect(
      bare.map(site => `${site.file}:${site.line}`),
      'these tooltips let recharts colour item text with the series colour'
    ).toEqual([]);
  });

  it('every <Tooltip passes contentStyle — no bare white recharts box', () => {
    const bare = sites.filter(site => !site.tag.includes('contentStyle'));
    expect(
      bare.map(site => `${site.file}:${site.line}`),
      'these tooltips render recharts’ unthemed white card'
    ).toEqual([]);
  });
});

describe('every recharts legend neutralises its label text (census)', () => {
  // Recharts' default legend colours each LABEL with its series colour — the
  // same promotion of a graphics colour to text the tooltip items had. Two of
  // the spending donut's labels read as a second, lighter kind of text
  // (Design, 23 Aug §3). A legend must either pass `formatter={legendText}`
  // (ChartLegendText — neutral words, series-coloured swatch) or draw its own
  // `content`, which owns its text colour outright.
  it('every <Legend passes formatter or content', () => {
    const sites: string[] = [];
    for (const path of tsxFilesUnder(SRC)) {
      const content = readFileSync(path, 'utf8');
      if (!/from ['"]recharts['"]/.test(content)) continue;
      let index = content.indexOf('<Legend');
      while (index !== -1) {
        const next = content[index + '<Legend'.length];
        if (next === undefined || /[\s/>]/.test(next)) {
          const close = content.indexOf('/>', index);
          const tag = content.slice(index, close === -1 ? undefined : close + 2);
          if (!tag.includes('formatter') && !tag.includes('content')) {
            sites.push(`${relative(process.cwd(), path)}:${content.slice(0, index).split('\n').length}`);
          }
        }
        index = content.indexOf('<Legend', index + 1);
      }
    }
    expect(sites, 'these legends let recharts colour label text with the series colour').toEqual([]);
  });
});

describe('the pinned item colour is legible on its own bubble (measured)', () => {
  for (const ground of ['light', 'dark'] as const) {
    it(`${ground}: item text clears the 4.5:1 text bar on the ${ground} bubble`, () => {
      const surface = TOOLTIP_SURFACE[ground];
      const ratio = ColorContrastChecker.getContrastRatio(surface.color, surface.backgroundColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});
