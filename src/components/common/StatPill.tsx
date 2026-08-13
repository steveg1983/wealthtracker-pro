import React from 'react';

/**
 * ONE FIGURE UNDER ONE LABEL — the smallest thing in this app that carries a
 * design decision about how a number is presented.
 *
 * ─ WHY THIS AND NOT A SHARED CARD ──────────────────────────────────────────
 *
 * The design review flagged that the register header had "opted out" of the
 * shared net-worth summary card, and the follow-up ruling withdrew that: the
 * register should NOT be converted. Its four figures are single-account
 * RECONCILIATION state in that account's own currency, where
 * `assets − liabilities = net worth` is replaced by `bank − ledger =
 * difference`, and two of the four can legitimately be unknown. A component
 * holding both would need a currency mode and a nullable mode, "at which point
 * it's two components wearing one name".
 *
 * The rule the ruling left behind, which is why this file is small:
 *
 *   Share the smallest element that carries a decision, not the largest
 *   arrangement that looks similar. Composition is cheap; a shared component
 *   with two modes is a permanent tax.
 *
 * So what is shared is the PAIR — a label and the figure under it — and the
 * decisions that pair embodies: the label's voice, the figure's weight, digits
 * that line up, one colour vocabulary, and one way of saying "not known".
 * Arrangement stays with the surface: the summary card stacks three of these in
 * a divided grid, the register lays four along a header. Neither has to ask
 * this component's permission to do that.
 *
 * ─ TABULAR FIGURES ARE NOT DECORATION HERE ─────────────────────────────────
 *
 * `tabular-nums` is app-wide on `body`, but it is named again on the figure
 * because these are the numbers most likely to be READ AS A COLUMN — four
 * balances down a phone screen, three totals across a card — and a proportional
 * digit set makes a column of money jitter. Naming it locally means a future
 * font change on `body` cannot quietly take it away from the one place it
 * matters most.
 */

/** What a figure MEANS, when it means anything. */
export type StatTone =
  /** A magnitude. Net worth, a balance, a count — most figures. */
  | 'neutral'
  /** Money in, or a balance in credit. */
  | 'positive'
  /** Money out, or a balance in the red. */
  | 'negative'
  /** Agreed, matched, nothing outstanding. */
  | 'settled';

const TONE_CLASS: Record<StatTone, string> = {
  neutral: 'text-gray-900 dark:text-white',
  positive: 'text-green-600 dark:text-green-400',
  negative: 'text-red-600 dark:text-red-400',
  settled: 'text-blue-600 dark:text-blue-400',
};

/** How large the figure is. Hierarchy is carried by SIZE, never by colour. */
export type StatSize = 'display' | 'page' | 'dense';

const SIZE_CLASS: Record<StatSize, string> = {
  display: 'text-display font-semibold',
  page: 'text-page font-semibold',
  dense: 'text-sm font-bold',
};

export interface StatPillProps {
  /** What the figure is. Sentence case; the surface decides about capitals. */
  label: string;
  /**
   * The figure, ALREADY FORMATTED by the caller — this component never sees a
   * number and so can never format one in the wrong currency.
   *
   * `null` means NOT KNOWN, and renders an em-dash. That is a different
   * statement from zero, and the distinction is load-bearing in the register:
   * an account with no bank feed has no bank balance, which is not the same as
   * a bank balance of nothing. It replaces the "N/A" the register used to
   * print — an abbreviation the rest of the app does not use.
   */
  value: string | null;
  tone?: StatTone;
  size?: StatSize;
  /**
   * `stacked` puts the label over the figure (a card cell); `inline` puts them
   * side by side with the figure at the end (a header pill). Two arrangements
   * because the app genuinely has two, and both are this pair — not two
   * components wearing one name.
   */
  layout?: 'stacked' | 'inline';
}

/** The label's voice, wherever it appears. */
const LABEL_CLASS = 'text-label text-gray-500 dark:text-gray-400';

export default function StatPill({
  label,
  value,
  tone = 'neutral',
  size = 'dense',
  layout = 'stacked',
}: StatPillProps): React.JSX.Element {
  // An unknown figure is never coloured: a tone would be a claim about a value
  // that is not there.
  const figureTone = value === null ? 'text-gray-400 dark:text-gray-500' : TONE_CLASS[tone];
  const figure = (
    <span className={`${SIZE_CLASS[size]} tabular-nums whitespace-nowrap ${figureTone}`}>
      {value ?? '—'}
    </span>
  );

  if (layout === 'inline') {
    return (
      <span className="flex items-center gap-3 justify-between lg:justify-normal">
        <span className={`${LABEL_CLASS} whitespace-nowrap`}>{label}</span>
        {figure}
      </span>
    );
  }

  return (
    <span className="flex flex-col items-start">
      <span className={`${LABEL_CLASS} uppercase font-medium`}>{label}</span>
      <span className="mt-1">{figure}</span>
    </span>
  );
}
