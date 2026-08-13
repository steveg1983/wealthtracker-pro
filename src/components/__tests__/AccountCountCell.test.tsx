/**
 * A count with work in it has to be findable down a long list.
 *
 * ─ THE REPORT ──────────────────────────────────────────────────────────────
 * "When there are transactions to review in the register and to reconcile, I
 * miss them because when there are these things to do, they dont stand out vs
 * all the other accounts with zero's '0' in their rows."
 *
 * He had 130-odd rows of `0` and four rows of `3`, rendered at the same size,
 * the same weight, and two steps apart on the grey ramp.
 *
 * ─ WHY THIS DOES NOT BREAK THE RULINGS IT LOOKS LIKE IT BREAKS ─────────────
 * DESIGN_RULINGS_2026-08-12 ruling A took AMBER off this count, because amber
 * marks the one CONTROL you should touch next and a count is not clickable. A
 * later correction stopped the ZERO being the loud one, because nothing is not
 * something to attend to. Neither says a count with work must whisper — the
 * ruling's own argument is that colour marks what needs attention, and this is
 * the thing that needs it.
 *
 * So the separation is by SIZE and WEIGHT, which is how this app carries
 * hierarchy everywhere else (the summary card's three figures make the same
 * move), and no hue is spent. The yellow thread keeps its monopoly on "do this
 * next".
 *
 * These assertions are about the DIFFERENCE, not about specific values: a
 * future restyle may pick other tokens, and should still fail here if it
 * flattens the two states back together.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountCountCell } from '../AccountRowColumns';

const classesFor = (count: number): string => {
  const { unmount } = render(<AccountCountCell label="Unreconciled" count={count} />);
  const figure = screen.getByText(String(count));
  const className = figure.getAttribute('class') ?? '';
  unmount();
  return className;
};

describe('a count of outstanding work', () => {
  it('is bigger and bolder when there IS work than when there is none', () => {
    const withWork = classesFor(3);
    const none = classesFor(0);

    expect(withWork).not.toBe(none);
    // Two independent signals, so neither a font stack that flattens weights
    // nor a colour-blind reader is left with one.
    expect(withWork).toContain('text-base');
    expect(withWork).toContain('font-bold');
    expect(none).toContain('text-sm');
    expect(none).toContain('font-normal');
  });

  it('spends no hue on either state', () => {
    // Amber belongs to the next-action control; green and red mean money in
    // and money out. A count is a quantity and gets the neutral ramp.
    for (const className of [classesFor(7), classesFor(0)]) {
      expect(className).not.toMatch(/amber|yellow|text-income|text-expense|red-|green-/);
    }
  });

  it('gives the zero the quieter end of the ramp, not the louder', () => {
    // The inversion that had to be fixed once already: a row with nothing to do
    // must not shout across the page while a row with thirty murmurs.
    expect(classesFor(0)).toMatch(/text-gray-4|text-gray-5/);
    expect(classesFor(3)).toMatch(/text-gray-900|text-white/);
  });

  it('still renders the number itself, and keeps digits aligned', () => {
    // A column of counts is read down, so the figures stay tabular whatever
    // else changes about them.
    expect(classesFor(12)).toContain('tabular-nums');
    render(<AccountCountCell label="To Review" count={12} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
