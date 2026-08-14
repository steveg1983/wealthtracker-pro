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
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountCountCell } from '../AccountRowColumns';

const classesFor = (count: number): string => {
  const { unmount } = render(<AccountCountCell label="Unreconciled" count={count} />);
  const figure = screen.getByText(String(count));
  const className = figure.getAttribute('class') ?? '';
  unmount();
  return className;
};

describe('a count of outstanding work', () => {
  it('is a filled pill when there IS work, and plain text when there is none', () => {
    const withWork = classesFor(3);
    const none = classesFor(0);

    expect(withWork).not.toBe(none);
    /*
     * A SHAPE, not louder text. Colour alone was missed entirely; near-black
     * and bold was "better but it needs to stand out more". Both were text
     * competing with text down a column of 130 rows — the eye finds a filled
     * disc among words without reading any of them.
     */
    expect(withWork).toContain('rounded-full');
    expect(withWork).toContain('bg-primary');
    expect(withWork).toContain('font-bold');
    // The zero gains nothing: no fill, no ring, no weight.
    expect(none).not.toContain('rounded-full');
    expect(none).not.toMatch(/\bbg-/);
    expect(none).toContain('font-normal');
  });

  it('spends no SEMANTIC colour on either state', () => {
    /*
     * The fill is the brand navy, which is a hue — so the invariant is not
     * "no colour" but "no colour that already MEANS something else". Amber
     * belongs to the one control you should touch next and this is not
     * clickable; green and red mean money in and money out, and a count is
     * neither. Navy is the app's own ink, already the fill of every primary
     * control, and it says "here" without claiming a direction or an alarm.
     */
    for (const className of [classesFor(7), classesFor(0)]) {
      expect(className).not.toMatch(/amber|yellow|text-income|text-expense|red-|green-/);
    }
  });

  it('gives the zero the quieter end of the ramp, not the louder', () => {
    // The inversion that had to be fixed once already: a row with nothing to do
    // must not shout across the page while a row with thirty murmurs.
    expect(classesFor(0)).toMatch(/text-gray-4|text-gray-5/);
    // White ON the navy fill — the count's ink, not a colour of its own.
    expect(classesFor(3)).toContain('text-white');
  });

  it('still renders the number itself, and keeps digits aligned', () => {
    // A column of counts is read down, so the figures stay tabular whatever
    // else changes about them.
    expect(classesFor(12)).toContain('tabular-nums');
    render(<AccountCountCell label="To Review" count={12} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});

/**
 * ─ THE COUNT IS ALSO A DOOR ────────────────────────────────────────────────
 * "If we click on a highlighted 'Unreconciled' figure or a 'To Review' figure,
 * that has something to reconcile, or review, it takes you to that specific
 * reconciliation page, or that specific view in the account register."
 *
 * The invariant worth guarding is not the destination — that is the caller's —
 * but WHEN the cell becomes a link at all, because the answer is not simply
 * "when a link was offered".
 */
describe('a count you can act on', () => {
  const renderLinked = (count: number) =>
    render(
      <MemoryRouter>
        <AccountCountCell
          label="Unreconciled"
          count={count}
          to="/reconciliation?account=abc&from=accounts"
          openLabel="Reconcile Current Account"
        />
      </MemoryRouter>
    );

  it('opens the work when there is work', () => {
    renderLinked(3);
    const link = screen.getByRole('link', { name: 'Reconcile Current Account' });
    expect(link).toHaveAttribute('href', '/reconciliation?account=abc&from=accounts');
    // Still the same pill — becoming clickable must not restyle it, or the
    // column strip stops lining up with the figures it names.
    expect(link.getAttribute('class')).toContain('bg-primary');
    expect(link.getAttribute('class')).toContain('rounded-full');
  });

  it('is NOT a link when the count is zero, even though one was offered', () => {
    /*
     * The whole point. A zero is not a door: there is nothing behind it, and a
     * row of 130 clickable noughts would hand the eye 130 things to consider
     * and 130 dead ends to discover. This is the same argument that keeps the
     * zero out of the pill — nothing is not something to attend to — applied
     * to behaviour rather than to colour.
     */
    renderLinked(0);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('keeps a touch target without taking any layout for it', () => {
    /*
     * The pill is 24px, under the 44px a thumb needs. The room comes from
     * `touch-target-small` — the app's OWN opt-in in index.css, a centred 44x44
     * pseudo-element that occupies no layout — rather than from padding, which
     * would drag this cell out of alignment with the parked column strip.
     */
    renderLinked(7);
    const cls = screen.getByRole('link').getAttribute('class') ?? '';
    expect(cls).toContain('touch-target-small');
    expect(cls).not.toMatch(/\bp-[3-9]\b/);
  });

  it('refuses the 44px floor that index.css puts under every link', () => {
    /*
     * THE REGRESSION THIS FILE EXISTS TO STOP HAPPENING TWICE.
     *
     * `index.css` floors every `a` at 44x44 inside
     * `@media (hover: none) and (pointer: coarse)` — right for a control,
     * ruinous for a 20px figure, and invisible on every desktop because that
     * query never matches one. Shipped: the disc came out 31 wide by 44 tall,
     * which the owner reported as "the highlighted number looks oval and not
     * round", and its inflated cell lifted "Unreconciled" 12px above "Bank Bal"
     * and "To Review" beside it.
     *
     * BOTH axes, because fixing only the height moved the problem rather than
     * solving it: min-width simply took over as the thing overriding the disc,
     * leaving a 44x24 lozenge. A `w-6` cannot beat a `min-width`.
     */
    renderLinked(7);
    const cls = screen.getByRole('link').getAttribute('class') ?? '';
    expect(cls).toContain('min-h-0');
    expect(cls).toContain('min-w-0');
  });

  it('is a circle for one and two digits, and a lozenge beyond', () => {
    // 130 does not fit in a 24px circle; squeezing it would shrink or clip the
    // type. Under 100 the disc is fixed at 24x24 so it is round rather than
    // "however wide the digits made it".
    render(
      <MemoryRouter>
        <AccountCountCell label="Unreconciled" count={38} to="/x" openLabel="a" />
      </MemoryRouter>
    );
    expect(screen.getByRole('link').getAttribute('class')).toContain('w-6');

    render(
      <MemoryRouter>
        <AccountCountCell label="Unreconciled" count={130} to="/y" openLabel="b" />
      </MemoryRouter>
    );
    const wide = screen.getByRole('link', { name: 'b' }).getAttribute('class') ?? '';
    expect(wide).not.toMatch(/\bw-6\b/);
    expect(wide).toContain('min-w-[24px]');
  });

  it('does not let opening the work also select the row behind it', () => {
    // The row is itself clickable. Without stopPropagation the click would
    // both navigate and pick out the account, so coming back would land on a
    // selection nobody made.
    //
    // The cell is rendered INSIDE the clickable row, in one React tree, because
    // that is the only arrangement that tests anything: React delivers events
    // through its own root listener, so a handler bolted onto a detached node
    // never hears them and the assertion passes for the wrong reason.
    let rowClicks = 0;
    render(
      <MemoryRouter>
        <div onClick={() => { rowClicks += 1; }}>
          <AccountCountCell
            label="Unreconciled"
            count={4}
            to="/reconciliation?account=abc&from=accounts"
            openLabel="Reconcile Current Account"
          />
        </div>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link'));
    expect(rowClicks).toBe(0);
  });
});

describe('the unlinked cell is unchanged', () => {
  it('renders without a router at all', () => {
    // Nested cash rows and any future caller that offers no destination must
    // keep working outside a Router — the Link is conditional, not universal.
    expect(() => render(<AccountCountCell label="Unreconciled" count={5} />)).not.toThrow();
    // A column of counts is read down, so the figures stay tabular whatever
    // else changes about them.
    expect(classesFor(12)).toContain('tabular-nums');
    render(<AccountCountCell label="To Review" count={12} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
