import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * NO MONEY FIGURE IS HAND-BUILT. Every amount a user reads goes through the
 * house formatter, because the formatter is where the app-wide convention
 * lives: a negative wears red and its brackets — (£417.54), never -£417.54
 * (Claude Design's ruling of 15 Aug; utils/currency-decimal is the one
 * definition).
 *
 * This guard exists because the convention decayed one surface at a time:
 * the calendar's own expenditure tile shipped red WITHOUT its brackets (the
 * owner caught it, 18 Aug), and the 19 Aug audit behind this file found the
 * same shape in the QIF preview and the notification bell — each a
 * `formatCurrency(Math.abs(x))` beside a hand-rolled sign colour — plus one
 * raw `£${…}` template that bypassed the formatter entirely.
 *
 * What is BANNED here is the mechanically detectable half: interpolating a
 * literal pound sign next to a computed value. There is no legitimate use —
 * a magnitude in prose still goes through formatCurrency, which brings the
 * locale, the rounding discipline and the negative-zero clamp with it. The
 * colour half of the convention cannot be greppped (it lives in Tailwind
 * classes whose correctness depends on the value's sign) and is verified
 * visually — flagged for Claude Design's capture passes.
 *
 * Scanned: every runtime module under src/. Not scanned: tests and mocks
 * (their invented figures never reach a user) and this file itself.
 */

const SRC = path.resolve(__dirname, '..');

/** A literal £ immediately followed by an interpolation — the formatter bypass. */
const RAW_POUND_INTERPOLATION = /£\$\{/;

const isRuntimeModule = (filePath: string): boolean => {
  if (!/\.(ts|tsx)$/.test(filePath)) return false;
  if (/\.(test|spec)\.(ts|tsx)$/.test(filePath)) return false;
  const relative = path.relative(SRC, filePath);
  if (relative.startsWith(`test${path.sep}`)) return false;
  if (relative.split(path.sep).includes('__tests__')) return false;
  if (relative.split(path.sep).includes('mocks')) return false;
  return true;
};

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (isRuntimeModule(full)) out.push(full);
  }
  return out;
};

describe('money figures go through the house formatter', () => {
  it('no runtime module interpolates a raw £ next to a value', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const source = readFileSync(file, 'utf8');
      if (!RAW_POUND_INTERPOLATION.test(source)) continue;
      source.split('\n').forEach((line, index) => {
        // A comment MENTIONING the banned shape is documentation, not a
        // rendering — several files explain this very rule in their margins.
        const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
        if (RAW_POUND_INTERPOLATION.test(code)) {
          offenders.push(`${path.relative(SRC, file)}:${index + 1} — ${line.trim()}`);
        }
      });
    }

    // Named, so the failure tells the author what to do: route the figure
    // through formatCurrency (utils/currency-decimal, or the
    // useCurrencyDecimal hook in a component) rather than building it by
    // hand. If a genuine exception ever exists, it is argued here, in this
    // file, where the rule is — not silently in the rendering.
    expect(offenders).toEqual([]);
  });
});
