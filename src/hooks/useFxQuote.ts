import { useEffect, useState } from 'react';
import { Decimal, type DecimalInstance } from '../utils/decimal';
import { RATE_DP } from '../utils/fx';
import {
  RATES_PROVIDER,
  getExchangeRatesWithProvenance,
  type RatesSource,
} from '../utils/currency-decimal';
import { createScopedLogger } from '../loggers/scopedLogger';

const logger = createScopedLogger('useFxQuote');

/**
 * What the rate box opens with, and how much the app is prepared to say for it.
 *
 * ── THE STATE THAT MATTERS IS `unavailable`, NOT `ready` ────────────────────
 *
 * The desktop edition opens a ledger file with no network behind it, and a
 * transfer between two of the owner's own accounts is not a thing that should
 * wait on a rates provider in another country. So a failed quote is a NORMAL
 * state here, not an error path: the dialog stays open, the manual box is the
 * one control that always works, and nothing about the flow is blocked. That is
 * the whole reason this is a discriminated union rather than
 * `rate: Decimal | null` — "we have not asked yet" and "we asked and there is
 * no answer" want different sentences on screen, and `null` cannot tell them
 * apart.
 */
export type FxQuote =
  /** The request is in flight. Nothing is shown but the manual box. */
  | { status: 'loading' }
  /** A figure, and enough provenance to account for it. */
  | {
      status: 'ready';
      rate: DecimalInstance;
      /** Where the underlying table came from — see {@link RatesSource}. */
      source: RatesSource;
      /** When the rate was true. */
      asOf: Date;
      /** Who quoted it, for the sentence under the box. */
      provider: string;
    }
  /**
   * No usable figure. Either the provider could not be reached and the fallback
   * table does not carry the pair, or one of the two codes is not in it at all.
   * The person types the rate; the flow continues.
   */
  | { status: 'unavailable' };

/**
 * A live-ish quote for one currency pair, or an honest admission that there
 * isn't one.
 *
 * ── WHY THE DIVISION HAPPENS HERE AND NOT IN `fx.ts` ────────────────────────
 *
 * `fx.ts` is deliberately "the arithmetic of one cross-currency transfer, and
 * nothing else" — it knows about two amounts and a rate. This knows about the
 * rates TABLE, which is a different fact: `getExchangeRates` returns units of
 * each currency per one GBP, so the rate from A to B is `rates[B] / rates[A]`
 * and GBP is only the pivot. Putting that in `fx.ts` would give that file a
 * base currency, which is exactly the thing it has no opinion about.
 *
 * The provider's numbers arrive as JSON, so they are IEEE doubles by the time
 * any parser has seen them — there is no representation to preserve, only one
 * to stop losing. They become Decimals at the first opportunity, before the
 * division, and the quotient is rounded once to {@link RATE_DP}. Every
 * subsequent figure in this feature is exact decimal arithmetic from here.
 *
 * @param from source currency code, or `null` to ask nothing
 * @param to destination currency code, or `null` to ask nothing
 */
export function useFxQuote(from: string | null, to: string | null): FxQuote {
  const [quote, setQuote] = useState<FxQuote>({ status: 'loading' });

  useEffect(() => {
    if (!from || !to || from === to) {
      setQuote({ status: 'unavailable' });
      return;
    }

    // Guards the two awaits below: a dialog closed mid-flight, or a pair
    // changed under it, must not have its answer written into the new state.
    let live = true;
    setQuote({ status: 'loading' });

    void (async () => {
      try {
        const { rates, provenance } = await getExchangeRatesWithProvenance();
        if (!live) return;

        const fromRate = rates[from];
        const toRate = rates[to];
        // A pair the table does not carry is `unavailable`, not an error and
        // not a rate of 1. Silently treating a missing code as parity is how a
        // transfer gets written at the wrong figure with nobody told.
        if (!fromRate || !toRate) {
          setQuote({ status: 'unavailable' });
          return;
        }

        const rate = new Decimal(toRate)
          .dividedBy(new Decimal(fromRate))
          .toDecimalPlaces(RATE_DP, Decimal.ROUND_HALF_UP);
        if (!rate.isFinite() || rate.isZero() || rate.isNegative()) {
          // A non-positive rate would be refused by the local schema's
          // `fx_rate_e10 > 0` CHECK if it ever reached storage. Refused here
          // instead, where there is still a person to ask.
          setQuote({ status: 'unavailable' });
          return;
        }

        setQuote({
          status: 'ready',
          rate,
          source: provenance.source,
          asOf: provenance.asOf,
          provider: RATES_PROVIDER,
        });
      } catch (error) {
        if (!live) return;
        // Not rethrown and not shown as a failure: see the type's header. The
        // logger is so an offline desktop is diagnosable, not so anybody is
        // interrupted.
        logger.warn('No exchange-rate quote available; the rate will be typed', error);
        setQuote({ status: 'unavailable' });
      }
    })();

    return () => {
      live = false;
    };
  }, [from, to]);

  return quote;
}
