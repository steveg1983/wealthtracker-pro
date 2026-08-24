/**
 * A CHECKBOX GETS A 44px TARGET WITHOUT BEING DRAWN 44px WIDE.
 *
 * index.css states the intent plainly: "a 24px box with 10px on each side is
 * the 44px target, which is the one way to give a checkbox a finger-sized
 * region without drawing a finger-sized checkbox." The cascade delivered the
 * opposite, because `min-width`/`min-height` CLAMP the used value and
 * therefore beat the `width: 24px; height: 24px` that follows them. Measured
 * on a phone-width viewport in the mobile sweep (24 Aug): every checkbox in
 * the app rendered as a 44px empty square beside its label — most visibly on
 * the calendar's "Hide decimals" and "Daily net worth" toggles.
 *
 * What made it survive is the reason this guard exists: the touch-target
 * rule is written out THREE TIMES, in three languages of the same codebase —
 * a stylesheet, a runtime-injected <style>, and the critical CSS inlined in
 * index.html. Fixing one leaves the other two winning, and which one wins
 * depends on load order and media-query shape (two are pointer-based, the
 * inline one is width-based, so it catches narrow DESKTOP windows too).
 *
 * This reads the source of all three and requires each to exempt checkboxes
 * and radios. A fourth copy would need adding here, which is the point: the
 * census fails loudly rather than the app quietly drawing thumb-sized boxes
 * again.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf8');

/** Every place the minimum-touch-target rule is declared. */
const DECLARATIONS = [
  { file: 'src/index.css', what: 'the stylesheet' },
  { file: 'src/components/layout/AccessibilityImprovements.tsx', what: 'the runtime-injected copy' },
  { file: 'index.html', what: 'the inlined critical CSS' },
] as const;

/**
 * A block that applies a 44px minimum to a bare `input` selector — i.e. one
 * that would clamp a checkbox. Matches the selector list, not the whole
 * rule, so formatting differences between the three copies do not matter.
 */
const claimsBareInput = (source: string): boolean => {
  // Strip comments first: all three files DISCUSS the bare-input problem in
  // prose, and a census that matched its own explanation would never pass.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
  // A selector list containing `input` with no attribute qualifier, in a
  // rule that sets a 44px minimum.
  const blocks = code.match(/[^{}]*\{[^{}]*min-(?:width|height)\s*:\s*44px[^{}]*\}/g) ?? [];
  return blocks.some(block => {
    const selector = block.slice(0, block.indexOf('{'));
    // `input` that is NOT followed by an attribute selector (`input[type=…]`)
    // and NOT carrying the exemption (`input:not(…)`). Those two are the only
    // qualified forms in the codebase, and both are safe.
    return /(^|[,\s])input(?!\s*(?:\[|:not\())/.test(selector);
  });
};

describe('the touch-target floor exempts checkboxes and radios', () => {
  it('the census sees every declaration it exists for', () => {
    for (const { file } of DECLARATIONS) {
      const source = read(file);
      expect(source, `${file} no longer contains a 44px touch-target rule`).toMatch(/min-(width|height)\s*:\s*44px/);
    }
  });

  for (const { file, what } of DECLARATIONS) {
    it(`${what} (${file}) does not clamp a bare input`, () => {
      expect(
        claimsBareInput(read(file)),
        `${file} applies a 44px minimum to a bare \`input\` selector, which clamps ` +
        `checkboxes and radios to a finger-sized BOX instead of a finger-sized ` +
        `TARGET. Qualify it: input:not([type="checkbox"]):not([type="radio"]).`
      ).toBe(false);
    });
  }

  it('the 24px box and its 10px margin are still what makes the 44px target', () => {
    // If this pair ever changes, the exemption above stops being correct and
    // the reasoning has to be redone rather than the numbers nudged.
    const css = read('src/index.css');
    const rule = css.match(/input\[type="checkbox"\][\s\S]{0,120}?\{[\s\S]*?\}/);
    expect(rule, 'the checkbox sizing rule has moved or gone').not.toBeNull();
    expect(rule?.[0]).toMatch(/width:\s*24px/);
    expect(rule?.[0]).toMatch(/height:\s*24px/);
    expect(rule?.[0]).toMatch(/margin:\s*10px/);
  });
});
