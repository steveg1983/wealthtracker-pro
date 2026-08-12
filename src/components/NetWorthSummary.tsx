import React from 'react';
import ConvertedTotalNote from './ConvertedTotalNote';
import type { RatesProvenance } from '../utils/currency-decimal';

/**
 * Net worth and its two components, as ONE card.
 *
 * ─ WHY IT IS ONE CARD ──────────────────────────────────────────────────────
 * Both surfaces that show these three figures used to draw them as a navy slab
 * plus two white cards — one important thing and two afterthoughts, when what
 * is actually on screen is one figure and the two halves it is made of
 * (DESIGN_PASS_2026-08 §3.3, §3.4). Assets minus liabilities IS net worth, so
 * the three sit in one card, three columns, separated by hairlines rather than
 * by gaps between separate boxes.
 *
 * The dark slab went with it. A full-bleed navy panel under a navy nav bar puts
 * two heavy horizontals at the top of the page, and it forces a second
 * text-colour system (white-on-navy) to exist for one card. The figure is
 * already the largest thing on the page — per P1 it does not need a panel
 * behind it to say so.
 *
 * ─ WHY IT IS SHARED ────────────────────────────────────────────────────────
 * The Accounts list and the Dashboard show the same three numbers. Two copies
 * of this markup is two things to keep in step, and they had already drifted
 * into different colours, sizes and shapes. One definition means the two
 * surfaces cannot disagree about what net worth looks like.
 *
 * ─ CURRENCY ────────────────────────────────────────────────────────────────
 * All three values are formatted by the caller in the DISPLAY currency (the
 * preference), never in any one account's own — a total over accounts that do
 * not share a currency belongs to none of them. Individual account rows keep
 * showing their own currency; that split is deliberate and is what settles the
 * mismatch between the summary and the rows below it.
 */

export type NetWorthFigure = 'net' | 'assets' | 'liabilities';

interface NetWorthSummaryProps {
  /** Already formatted, in the display currency. */
  netWorth: string;
  assets: string;
  liabilities: string;
  /**
   * Drill-down, if this surface has one — the Accounts list opens the accounts
   * behind a figure. Omitted, the cells are plain text rather than dead
   * buttons.
   */
  onSelect?: (figure: NetWorthFigure) => void;
  /**
   * Where the rates that produced these three figures came from, or null when
   * no conversion was needed because the whole ledger is in one currency.
   *
   * Null is the common case and it renders NOTHING — see ConvertedTotalNote.
   * The card gains no height, no border and no words for the many people who
   * never touch a second currency.
   */
  provenance?: RatesProvenance | null;
  /**
   * Currencies with no available rate, whose amounts are nevertheless inside
   * these totals. Reported because it makes the figures wrong by that much.
   */
  unconverted?: readonly string[];
  /** The currency the three figures are expressed in. */
  displayCurrency?: string;
}

/** The column heading over each figure. */
const LABEL_CLASS = 'text-label uppercase font-medium text-gray-500 dark:text-gray-400';

export default function NetWorthSummary({
  netWorth,
  assets,
  liabilities,
  onSelect,
  provenance = null,
  unconverted = [],
  displayCurrency,
}: NetWorthSummaryProps): React.JSX.Element {
  const cells: ReadonlyArray<{
    figure: NetWorthFigure;
    label: string;
    value: string;
    /**
     * Net worth is the headline, at `display`; its two components read one
     * step down at `page`, which is the hierarchy the old navy slab was using
     * a background colour to state.
     */
    figureClass: string;
  }> = [
    {
      figure: 'net',
      label: 'Net worth',
      value: netWorth,
      // Navy, not green/red: net worth is the answer, not a direction of
      // travel, and the sign in front of it says which way it went (P2).
      figureClass: 'text-display font-semibold text-primary dark:text-white',
    },
    {
      figure: 'assets',
      label: 'Assets',
      value: assets,
      figureClass: 'text-page font-semibold text-income dark:text-green-400',
    },
    {
      figure: 'liabilities',
      label: 'Liabilities',
      value: liabilities,
      figureClass: 'text-page font-semibold text-expense dark:text-red-400',
    },
  ];

  return (
    <>
    <div className="overflow-hidden rounded-lg border border-line dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Hairlines between the columns, not gaps between cards: one border for
          the whole thing rather than three. They stack on a phone, where three
          eight-digit figures abreast force the page to scroll sideways. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y divide-line dark:divide-gray-700 sm:divide-y-0 sm:divide-x sm:divide-line">
        {cells.map(({ figure, label, value, figureClass }) => {
          const content = (
            <>
              <p className={LABEL_CLASS}>{label}</p>
              <p className={`mt-1 ${figureClass}`}>{value}</p>
            </>
          );

          return onSelect ? (
            <button
              key={figure}
              type="button"
              onClick={() => onSelect(figure)}
              className="flex flex-col items-start p-4 text-left transition-colors duration-state hover:bg-surface-secondary dark:hover:bg-gray-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 !shadow-none"
              title="See the accounts behind this figure"
            >
              {content}
            </button>
          ) : (
            <div key={figure} className="p-4">
              {content}
            </div>
          );
        })}
      </div>
    </div>
    {/* Directly under the figures it is about — the app's standing rule is that
        a warning belongs where the error shows, not in a banner at the top of
        the page. Renders nothing when there was nothing to convert. */}
    <ConvertedTotalNote
      provenance={provenance}
      unconverted={unconverted}
      displayCurrency={displayCurrency}
    />
    </>
  );
}
