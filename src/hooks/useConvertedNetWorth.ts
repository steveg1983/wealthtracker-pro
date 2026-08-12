import { useEffect, useMemo, useState } from 'react';
import { Decimal, toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../utils/decimal';
import {
  convertMultipleCurrenciesWithProvenance,
  type RatesProvenance,
} from '../utils/currency-decimal';

/**
 * Net worth, assets and liabilities summed ACROSS currencies — properly.
 *
 * ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
 *
 * The net-worth card's three figures were a raw sum of every account's balance
 * with no conversion anywhere in the path (`calculateTotalBalance` adds the
 * numbers; `toDecimal` changes their TYPE, not their currency), and the result
 * was then formatted in the DISPLAY currency. A dollar balance was therefore
 * added to sterling balances one-for-one and the answer was printed with a "£".
 *
 * The app had already written down why that is not allowed, in
 * `calculations-decimal.ts`: adding two currencies "would report a number that
 * is true in no currency at all". Budgets obey it by setting foreign rows aside
 * and disclosing them. The net-worth card did not.
 *
 * ── A SINGLE-CURRENCY USER PAYS NOTHING ─────────────────────────────────────
 *
 * When every account is already in the display currency there is no rate to
 * fetch and nothing to disclose, so this hook computes the three figures
 * SYNCHRONOUSLY on the first render and reports `provenance: null`. No request,
 * no effect, no loading state, no flicker from a raw total to a converted one —
 * and `ConvertedTotalNote` renders nothing at all. That is the common case and
 * it must stay free.
 */

export interface AccountBalanceEntry {
  /** The account's balance, already computed by the caller's own rules. */
  balance: number | DecimalInstance;
  /** The currency that balance is held in. */
  currency: string;
}

export interface ConvertedNetWorth {
  netWorth: DecimalInstance;
  assets: DecimalInstance;
  liabilities: DecimalInstance;
  /** Null when no conversion was needed. See {@link ConvertedTotalNote}. */
  provenance: RatesProvenance | null;
  /** Currencies with no rate; their amounts are in the totals unconverted. */
  unconverted: readonly string[];
  /**
   * False only while a genuine cross-currency conversion is in flight. Never
   * false for a single-currency ledger, which resolves on the first render.
   */
  isReady: boolean;
}

/** Assets are the positive balances, liabilities the magnitude of the negative. */
function split(entries: readonly AccountBalanceEntry[]) {
  const assets: Array<{ amount: DecimalInstance; currency: string }> = [];
  const liabilities: Array<{ amount: DecimalInstance; currency: string }> = [];

  for (const { balance, currency } of entries) {
    const amount = toDecimal(balance);
    // A zero balance is neither an asset nor a liability, and is skipped by
    // both branches rather than counted as one.
    if (amount.isZero()) continue;
    if (amount.isNegative()) {
      liabilities.push({ amount: amount.abs(), currency });
    } else {
      assets.push({ amount, currency });
    }
  }

  return { assets, liabilities };
}

const sum = (amounts: ReadonlyArray<{ amount: DecimalInstance }>): DecimalInstance =>
  amounts.reduce((total, { amount }) => total.plus(amount), new Decimal(0));

export function useConvertedNetWorth(
  entries: readonly AccountBalanceEntry[],
  displayCurrency: string
): ConvertedNetWorth {
  const { assets, liabilities } = useMemo(() => split(entries), [entries]);

  /**
   * The whole ledger already reads in one currency. Nothing to convert, so the
   * answer is arithmetic and is available now — see the header.
   */
  const isSingleCurrency = useMemo(
    () => entries.every(entry => entry.currency === displayCurrency),
    [entries, displayCurrency]
  );

  const synchronous = useMemo<ConvertedNetWorth>(() => {
    const assetTotal = sum(assets);
    const liabilityTotal = sum(liabilities);
    return {
      netWorth: assetTotal.minus(liabilityTotal),
      assets: assetTotal,
      liabilities: liabilityTotal,
      provenance: null,
      unconverted: [],
      isReady: true,
    };
  }, [assets, liabilities]);

  const [converted, setConverted] = useState<ConvertedNetWorth | null>(null);

  useEffect(() => {
    if (isSingleCurrency) {
      setConverted(null);
      return;
    }

    // Guards against a slow response landing after the accounts changed and
    // overwriting the newer figures with older ones.
    let cancelled = false;

    const run = async (): Promise<void> => {
      const [assetResult, liabilityResult] = await Promise.all([
        convertMultipleCurrenciesWithProvenance(assets, displayCurrency),
        convertMultipleCurrenciesWithProvenance(liabilities, displayCurrency),
      ]);
      if (cancelled) return;

      // One list may be empty (a ledger with no debts), and an empty list
      // reports no provenance — so the disclosure comes from whichever side
      // actually used rates.
      const provenance = assetResult.provenance ?? liabilityResult.provenance;
      const unconverted = [
        ...new Set([...assetResult.unconverted, ...liabilityResult.unconverted]),
      ];

      setConverted({
        netWorth: assetResult.total.minus(liabilityResult.total),
        assets: assetResult.total,
        liabilities: liabilityResult.total,
        provenance,
        unconverted,
        isReady: true,
      });
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [assets, liabilities, displayCurrency, isSingleCurrency]);

  if (isSingleCurrency) return synchronous;

  /**
   * Mixed currencies, conversion still in flight.
   *
   * The totals read ZERO rather than the raw cross-currency sum. Showing the
   * unconverted figure first would put a number on screen that is true in no
   * currency — briefly, and then correct itself, which is the worst of both:
   * long enough to be read, short enough not to be questioned.
   */
  return (
    converted ?? {
      netWorth: new Decimal(0),
      assets: new Decimal(0),
      liabilities: new Decimal(0),
      provenance: null,
      unconverted: [],
      isReady: false,
    }
  );
}
