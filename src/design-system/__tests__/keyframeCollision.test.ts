/**
 * No two `@keyframes` may share a name.
 *
 * ─ THE FAILURE THIS EXISTS TO CATCH ────────────────────────────────────────
 * `src/index.css` defined `@keyframes spin` for an orphaned pull-to-refresh
 * indicator — `to { transform: translate(-50%) translateY(80px) rotate(360deg) }`.
 * Tailwind defines `spin` too, for `animate-spin`, as a pure rotation.
 *
 * CSS resolves a duplicate keyframe name by taking the LAST definition, and the
 * hand-written one landed after Tailwind's in the bundle. Measured on the built
 * stylesheet before the fix: Tailwind's at byte 20,124 and the stray at 70,974.
 * So the stray won, and every one of the app's SIXTY-FOUR `animate-spin`
 * elements — the loading spinners, the refresh glyphs, the busy buttons — was
 * displacing itself 80px down and half its own width left while it turned.
 *
 * Nothing could see it. The class is correct, the element is correct, the
 * animation runs. Only the coordinates are wrong, and only because a name
 * collided with one the framework owns. Same family as `bg-primary/10` emitting
 * no rule and `rotate-90` being blamed for a hidden tab: CSS that type-checks,
 * lints, renders, and does the wrong thing.
 *
 * ─ WHY IT READS THE BUILT SHEET ────────────────────────────────────────────
 * A collision between OUR css and TAILWIND's cannot be seen in either source —
 * it exists only where the two are concatenated. So this compiles the real
 * thing, which is also the only place the winning order is decided.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Compile the app's real entry stylesheet against the real config, with a probe
 * that uses the animation utilities — so Tailwind emits its own keyframes and
 * any collision with ours is present in the output.
 */
function compileAppCss(): string {
  const dir = mkdtempSync(join(tmpdir(), 'wt-keyframes-'));
  try {
    const probe = join(dir, 'probe.tsx');
    writeFileSync(
      probe,
      'export const P = () => <div className="animate-spin animate-pulse animate-ping animate-bounce" />;\n'
    );
    const out = join(dir, 'app.css');
    execFileSync(
      'npx',
      ['tailwindcss', '-c', 'tailwind.config.js', '-i', 'src/index.css', '--content', probe, '-o', out],
      { cwd: process.cwd(), stdio: 'pipe' }
    );
    return readFileSync(out, 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('keyframe names are unique across the whole stylesheet', () => {
  const css = compileAppCss();

  it('compiled something with keyframes in it (the guard is not vacuous)', () => {
    expect(css.length).toBeGreaterThan(1000);
    expect(css).toMatch(/@keyframes\s+spin\b/);
  });

  it('defines each animation name exactly once', () => {
    const counts = new Map<string, number>();
    for (const match of css.matchAll(/@(?:-webkit-)?keyframes\s+([A-Za-z0-9_-]+)/g)) {
      const name = match[1];
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    const collisions = [...counts.entries()]
      .filter(([, n]) => n > 1)
      .map(([name, n]) => `${name} (defined ${n}×)`);

    expect(
      collisions,
      'A duplicate @keyframes name silently overrides the earlier one — including Tailwind\'s own. ' +
        'Rename the local animation rather than shadowing a framework name.'
    ).toEqual([]);
  });

  it('leaves Tailwind’s spin a pure rotation', () => {
    // The specific shape of the bug: `spin` must not translate. If a future
    // animation wants to move as it turns, it needs its own name.
    const spin = css.match(/@keyframes\s+spin\s*\{[^}]*\}[^}]*\}/)?.[0] ?? '';
    expect(spin).toMatch(/rotate\(360deg\)/);
    expect(spin).not.toMatch(/translate/);
  });
});
