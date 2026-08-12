import { useCallback, useEffect, useState } from 'react';
import { Decimal } from '../utils/decimal';
import { RATE_DP } from '../utils/fx';
import { getExchangeRatesWithProvenance } from '../utils/currency-decimal';
import type { CrossCurrencyRateLookup } from '../utils/crossCurrencyMatch';
import { createScopedLogger } from '../loggers/scopedLogger';

const logger = createScopedLogger('useReferenceRates');

/**
 * The rate table's own shape, read off the function that produces it rather
 * than re-declared. `ExchangeRates` is private to currency-decimal, and a
 * hand-written copy here would be a second declaration free to drift from the
 * one that is actually returned.
 */
type RateTable = Awaited<ReturnType<typeof getExchangeRatesWithProvenance>>['rates'];

/**
 * A whole rate TABLE, for sorting cross-currency suggestions — not for judging
 * any one of them.
 *
 * `useFxQuote` answers one pair because a dialog asks about one transfer. The
 * bulk sweep asks about a list, and each row may cross a different boundary, so
 * what it needs is a lookup rather than a quote. What both share is the pivot
 * arithmetic: `getExchangeRates` returns units of each currency per one GBP, so
 * the rate from A to B is `rates[B] / rates[A]` and GBP is only the pivot.
 *
 * ── THIS RESULT CAN NEVER REMOVE A ROW FROM THE LIST ────────────────────────
 *
 * The only consumer is `compareCrossCurrencyCandidates`, which SORTS. That is a
 * deliberate ceiling and the reason this hook returns a lookup rather than, say,
 * a filter predicate: a real bank conversion on a volatile day, or one with a
 * large fee, implies a rate that a mid-market table disagrees with — and the
 * pair is still real. If this hook is offline, wrong, or never resolves, the
 * suggestions are identical in membership and merely ordered by date and
 * wording alone. Nothing the user can act on depends on a rate having arrived.
 *
 * @param enabled false to ask nothing at all — a closed modal has no list to sort
 */
export function useReferenceRates(enabled: boolean): CrossCurrencyRateLookup | undefined {
  const [rates, setRates] = useState<RateTable | null>(null);

  useEffect(() => {
    if (!enabled || rates) return;

    // Guards the await: a modal closed mid-flight must not set state.
    let live = true;
    void (async () => {
      try {
        const { rates: table } = await getExchangeRatesWithProvenance();
        if (live) setRates(table);
      } catch (error) {
        // Not surfaced. There is nothing for the user to do about it and
        // nothing they lose: see the header. The log is so an offline desktop
        // is diagnosable.
        logger.warn('No exchange-rate table; cross-currency suggestions will sort by date alone', error);
      }
    })();

    return () => {
      live = false;
    };
  }, [enabled, rates]);

  const lookup = useCallback<CrossCurrencyRateLookup>((from, to) => {
    if (!rates) return null;
    const fromRate = rates[from];
    const toRate = rates[to];
    // A pair the table does not carry is `null`, never a rate of 1. Treating a
    // missing code as parity would rank every pair in that currency as though
    // it converted one-for-one, which is an opinion the app does not hold.
    if (!fromRate || !toRate) return null;

    const rate = new Decimal(toRate)
      .dividedBy(new Decimal(fromRate))
      .toDecimalPlaces(RATE_DP, Decimal.ROUND_HALF_UP);
    return rate.isFinite() && !rate.isZero() && !rate.isNegative() ? rate : null;
  }, [rates]);

  // `undefined` until a table exists, which is what the matchers read as "no
  // quote available" — distinct from a lookup that answers null for one pair.
  return rates ? lookup : undefined;
}
