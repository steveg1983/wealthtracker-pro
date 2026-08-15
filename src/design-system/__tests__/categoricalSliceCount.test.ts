/**
 * A CHART MAY NOT DRAW MORE SLICES THAN THE PALETTE CAN COLOUR.
 *
 * `categoricalColor` cycles past the end of the ramp, silently — ask for a
 * sixth series and it comes back painted exactly like the first. Nothing
 * throws, no contrast figure moves, and the only symptom is a reader who
 * cannot tell two categories apart.
 *
 * Both live charts had it. The Dashboard's expense donut sliced to six against
 * a five-colour ramp ("the pie seems to be split into 5 sections and the
 * legend is listing 6"). The Investments ring drew one slice per account —
 * twelve — so slices 1, 6 and 11 were identical and it read as one grey
 * doughnut.
 *
 * The ceiling is the palette's own arithmetic rather than a layout preference:
 * the categorical axis is ONE HUE walked, and each ground can only use the
 * half of it that clears 3:1 against that ground. A chart with more than five
 * things to say needs a grouped remainder, not a longer ramp.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { categoricalRamp, MAX_CATEGORICAL_SERIES } from '../../components/charts/chartColors';

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Comments blanked, line numbers kept — this repo names its traps in prose. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match, lead: string) => lead + ' '.repeat(match.length - lead.length));
}

describe('categorical slice count', () => {
  it('keeps both ramps and the stated ceiling in step', () => {
    expect(categoricalRamp(false)).toHaveLength(MAX_CATEGORICAL_SERIES);
    expect(categoricalRamp(true)).toHaveLength(MAX_CATEGORICAL_SERIES);
  });

  it('has no chart capping itself above the ceiling', () => {
    // FILE-LEVEL, and the window heuristic that replaced it was worse: the
    // Dashboard's cap lives in a useMemo and its Cells are ~80 lines below, so
    // "does categoricalColor appear near the slice" missed the exact bug this
    // test was written for. (Caught by reintroducing `.slice(0, 6)` and
    // watching the test stay green.)
    //
    // So the rule is the blunt one — do not hard-code a cap in a file that
    // colours through the ramp — with a marker for the genuine exceptions,
    // which are lists that are not charted at all. The marker has to be
    // written deliberately, which is the point.
    const ALLOW = 'not-a-charted-series';
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      if (file.includes('__tests__') || /\.test\.tsx?$/.test(file)) continue;
      const raw = readFileSync(file, 'utf8');
      const source = stripComments(raw);
      if (!source.includes('categoricalColor')) continue;
      const rawLines = raw.split('\n');
      source.split('\n').forEach((line, i) => {
        const match = /\.slice\(0,\s*(\d+)\)/.exec(line);
        if (!match || Number(match[1]) <= MAX_CATEGORICAL_SERIES) return;
        // The marker may sit on the line or on the two above it.
        const nearby = rawLines.slice(Math.max(0, i - 2), i + 1).join('\n');
        if (nearby.includes(ALLOW)) return;
        offenders.push(`${file.replace(SRC, 'src')}:${i + 1} — ${line.trim().slice(0, 80)}`);
      });
    }

    expect(
      offenders,
      `These colour series through the ramp but cap above it, so the extra ` +
        `slices repeat colours:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
