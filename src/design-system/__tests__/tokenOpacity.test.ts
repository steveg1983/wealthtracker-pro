/**
 * A colour token must survive an opacity modifier.
 *
 * ─ THE FAILURE THIS EXISTS TO CATCH ────────────────────────────────────────
 * `primary` and `secondary` were declared as bare `var(--color-primary)`.
 * Tailwind 3.4 cannot parse a bare `var()` as a colour, so it did not warn, it
 * did not fall back, and it did not error: for ANY opacity modifier it emitted
 * NO RULE AT ALL. `bg-primary` worked and `bg-primary/10` did not exist, so
 * thirteen call sites painted selected states, highlight tints and hover fills
 * that computed to transparent — a whole class of invisible UI that no type
 * checker, linter or test could see, because the class was absent from the
 * stylesheet rather than wrong in it.
 *
 * ─ WHY IT COMPILES THE REAL CONFIG ─────────────────────────────────────────
 * Asserting on the config OBJECT would only restate the fix. The bug lived in
 * what the generator does with that object, so the only honest question is
 * what CSS comes out — which is also why a probe file is compiled rather than
 * the app: it names the exact classes under test and cannot pass because
 * something else in the app happens to use them.
 *
 * Adding a token? Add it below. The cost of the check is one compile; the cost
 * of not having it was found by reading source, not by using the app.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Tokens whose opacity modifiers must resolve to a real declaration. */
const TOKENS = ['primary', 'secondary'] as const;

/** One probe class per token, plus the plain form as a control. */
const PROBE_CLASSES = TOKENS.flatMap(token => [
  `bg-${token}`,
  `bg-${token}/10`,
  `border-${token}/40`,
  `hover:bg-${token}/90`,
]);

function compileProbe(): string {
  const dir = mkdtempSync(join(tmpdir(), 'wt-token-probe-'));
  try {
    const probe = join(dir, 'probe.tsx');
    writeFileSync(probe, `export const P = () => <div className="${PROBE_CLASSES.join(' ')}" />;\n`);
    const out = join(dir, 'probe.css');
    execFileSync(
      'npx',
      ['tailwindcss', '-c', 'tailwind.config.js', '--content', probe, '-o', out],
      { cwd: process.cwd(), stdio: 'pipe' }
    );
    return readFileSync(out, 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('brand colour tokens keep their opacity modifiers', () => {
  const css = compileProbe();

  it.each(TOKENS)('%s renders at full strength', token => {
    // The control: if this is missing the probe itself is broken, not the token.
    expect(css).toContain(`.bg-${token} {`);
  });

  it.each(TOKENS)('%s survives an opacity modifier rather than vanishing', token => {
    // Tailwind escapes the slash in the selector: `.bg-primary\/10`.
    expect(css).toContain(`.bg-${token}\\/10 {`);
    expect(css).toContain(`.border-${token}\\/40 {`);
    expect(css).toContain(`.hover\\:bg-${token}\\/90:hover {`);
  });

  it.each(TOKENS)('%s resolves to an alpha the browser can paint', token => {
    // Not merely present — carrying the alpha. A rule that emitted the colour
    // and dropped the modifier would satisfy the check above and still be the
    // bug, one layer along.
    const rule = new RegExp(`\\.bg-${token}\\\\/10 \\{[^}]*\\/ 0\\.1\\)`);
    expect(css).toMatch(rule);
  });
});
