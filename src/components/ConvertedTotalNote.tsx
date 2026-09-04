import React from 'react';
import type { RatesProvenance } from '../utils/currency-decimal';
import { RATES_PROVIDER } from '../utils/currency-decimal';
import { formatTime } from '../utils/dateFormatter';

/**
 * What a converted total was built from, said under the total itself.
 *
 * ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
 *
 * `utils/currency-decimal.ts` fetches live rates and, when the provider cannot
 * be reached, falls back to a hardcoded table of approximations — silently. A
 * net worth converted at a real quote and a net worth converted at a guess
 * printed identically. This is the line that tells them apart.
 *
 * ── IT COSTS A SINGLE-CURRENCY USER NOTHING ─────────────────────────────────
 *
 * `provenance` is null when no conversion was needed, because every amount was
 * already in the display currency (see `convertMultipleCurrenciesWithProvenance`).
 * This component then renders NOTHING — not an empty box, not a reassuring
 * "rates OK", nothing. Most people hold one currency and must never see a word
 * about exchange rates on their dashboard. That is the data-health rule the app
 * already follows for warnings: a zero count renders nothing at all.
 *
 * ── WHY THE ALARMED STATE IS NOT AMBER ──────────────────────────────────────
 *
 * DESIGN_PASS_2026-08 P3: there is ONE amber in the building and the yellow
 * thread owns it. P2 reserves green/red/amber for what a NUMBER means, and
 * "these rates are stale" is a statement about provenance, not about the
 * figure's direction. So the fallback state is made distinct by WEIGHT and a
 * hairline chip instead of by spending a colour signal — P4, weight before
 * boxes, before colour.
 *
 * ── IT SAYS THE CONSEQUENCE FIRST ───────────────────────────────────────────
 *
 * P6, and the app's standing rule for warnings: name what is WRONG WITH THE
 * NUMBER, not the machinery. "Live rates unavailable" is a fact about a server;
 * "this total is approximate" is a fact about the figure the person is reading,
 * which is the one that changes what they do next.
 */

interface ConvertedTotalNoteProps {
  /**
   * Where the rates came from, or null when no conversion was needed. Null
   * renders nothing.
   */
  provenance: RatesProvenance | null;
  /**
   * Currencies that had no rate at all. Their amounts were added to the total
   * UNCONVERTED, which makes it wrong by however much they were worth — so this
   * is the more serious of the two states and is reported even when the rates
   * themselves were live.
   */
  unconverted?: readonly string[];
  /** The currency the total is expressed in, for the unconverted sentence. */
  displayCurrency?: string;
}

/**
 * 14:02 — a wall-clock time, in the reader's own region.
 *
 * The house clock now writes it (4 Sep 2026 ruling); this shape was already
 * the right one, and is no longer written out here as well as there.
 */
function atTime(when: Date): string {
  return formatTime(when);
}

export default function ConvertedTotalNote({
  provenance,
  unconverted = [],
  displayCurrency,
}: ConvertedTotalNoteProps): React.JSX.Element | null {
  const hasUnconverted = unconverted.length > 0;

  // Nothing was converted and nothing was missed: there is nothing to say.
  if (provenance === null && !hasUnconverted) return null;

  const isApproximate = provenance?.source === 'fallback';

  // The worse of the two states wins the line. A total that silently ABSORBED
  // foreign amounts is wrong by a real quantity, where one converted at stale
  // rates is merely imprecise — so it is stated first and on its own.
  if (hasUnconverted) {
    const names = unconverted.join(', ');
    return (
      <p
        className="mt-2 text-dense font-medium text-primary dark:text-gray-200"
        data-testid="converted-total-note"
      >
        {`This total is wrong: it includes ${names} amounts added without conversion, because no rate for ${names} was available.`}
        {displayCurrency ? ` Everything else is in ${displayCurrency}.` : ''}
      </p>
    );
  }

  if (isApproximate) {
    return (
      <p
        className="mt-2 inline-flex items-center gap-2 rounded border border-line-strong dark:border-gray-600 bg-surface-tertiary dark:bg-gray-700/50 px-2 py-1 text-dense font-medium text-primary dark:text-gray-200"
        data-testid="converted-total-note"
      >
        {/* Consequence, then the reason — P6. */}
        {`Approximate — converted at stored rates, not live ones. ${RATES_PROVIDER} could not be reached.`}
      </p>
    );
  }

  // The quiet, everyday case: converted at a live figure, its source named.
  // The ECB reference rate is a DAILY figure — the one every backdated
  // conversion in the app already uses — so its line names the day's rate
  // rather than a wall-clock time that would overstate its freshness.
  return (
    <p
      className="mt-2 text-dense text-gray-500 dark:text-gray-400"
      data-testid="converted-total-note"
    >
      {provenance
        ? provenance.source === 'ecb'
          ? 'Converted at today’s ECB reference rate'
          : `Converted at rates as of ${atTime(provenance.asOf)}`
        : null}
    </p>
  );
}
