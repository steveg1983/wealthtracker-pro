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

/** A currency inside a group, and everything the group holds in it. */
export interface CurrencySubtotal {
  currency: string;
  amount: DecimalInstance;
}

/**
 * One group header's total — a band on the Accounts list, or one of its
 * institution sub-bands.
 *
 * Computed in the SAME pass as net worth, from the same rate table, into the
 * same state object. That is the whole point of putting it here rather than in
 * a hook of its own: a page must never show a confident group total above a
 * degraded net worth, and the only way to guarantee "at the same moment" is for
 * the two figures to BE the same moment — one effect, one setState, one
 * provenance. Two hooks would agree almost always and disagree in exactly the
 * render that matters.
 */
export interface ConvertedGroupTotal {
  /** In the display currency, once every currency in the group had a rate. */
  total: DecimalInstance;
  /**
   * A rate was applied, so the figure is an approximation and must be marked
   * (`≈`). False for a group already whole in the display currency — that
   * figure is exact, needs no rate, and is never marked.
   */
  isConverted: boolean;
  /**
   * The group's holdings per currency, unsummed. Only rendered in the failure
   * state below, where there is no honest single figure to print.
   */
  byCurrency: readonly CurrencySubtotal[];
  /**
   * Currencies in THIS group with no available rate. Non-empty means `total` is
   * wrong by whatever those amounts are, and the caller must fall back to the
   * unsummed pair rather than print it.
   */
  unconverted: readonly string[];
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
  /** Keyed by whatever key the caller passed in `groups`. Empty when none was. */
  groupTotals: ReadonlyMap<string, ConvertedGroupTotal>;
}

/** Stable identity, so a caller with no groups never re-runs the effect. */
const NO_GROUPS: ReadonlyMap<string, readonly AccountBalanceEntry[]> = new Map();

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

/**
 * A group's holdings folded to one line per currency, in first-seen order.
 *
 * Needs no rates, so it is available on the first render — which is what lets a
 * group that CANNOT be converted print the honest unsummed pair immediately
 * instead of waiting for a rate that will never arrive.
 */
function byCurrencyOf(entries: readonly AccountBalanceEntry[]): CurrencySubtotal[] {
  const totals = new Map<string, DecimalInstance>();
  for (const { balance, currency } of entries) {
    totals.set(currency, (totals.get(currency) ?? new Decimal(0)).plus(toDecimal(balance)));
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount }));
}

export function useConvertedNetWorth(
  entries: readonly AccountBalanceEntry[],
  displayCurrency: string,
  /**
   * Optional sub-totals to convert in the same pass, keyed however the caller
   * likes. Omit it and this hook behaves exactly as it always has.
   */
  groups: ReadonlyMap<string, readonly AccountBalanceEntry[]> = NO_GROUPS
): ConvertedNetWorth {
  const { assets, liabilities } = useMemo(() => split(entries), [entries]);

  /**
   * The shape of every group — which currencies it holds and whether any of
   * them needs a rate — worked out without one.
   */
  const groupShapes = useMemo(() => {
    const shapes = new Map<string, { isConverted: boolean; byCurrency: CurrencySubtotal[] }>();
    for (const [key, groupEntries] of groups) {
      const byCurrency = byCurrencyOf(groupEntries);
      shapes.set(key, {
        isConverted: byCurrency.some(line => line.currency !== displayCurrency),
        byCurrency,
      });
    }
    return shapes;
  }, [groups, displayCurrency]);

  /**
   * The whole ledger already reads in one currency. Nothing to convert, so the
   * answer is arithmetic and is available now — see the header.
   */
  const isSingleCurrency = useMemo(
    () =>
      entries.every(entry => entry.currency === displayCurrency) &&
      [...groupShapes.values()].every(shape => !shape.isConverted),
    [entries, displayCurrency, groupShapes]
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
      // Every group is whole in the display currency here, so each total is a
      // plain sum and none of them is marked.
      groupTotals: new Map(
        [...groupShapes].map(([key, shape]) => [
          key,
          {
            ...shape,
            total: shape.byCurrency.reduce((t, line) => t.plus(line.amount), new Decimal(0)),
            unconverted: [],
          },
        ])
      ),
    };
  }, [assets, liabilities, groupShapes]);

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

      /**
       * The groups go SECOND, deliberately.
       *
       * The pair above has just populated the module-level rate cache in
       * currency-decimal, so every group below is arithmetic against a table
       * that is already in memory — one page's worth of group headers costs no
       * additional request. Fired alongside the pair instead, a cold cache
       * would see one request per group, since the fetch is not deduped while
       * in flight.
       */
      const groupKeys = [...groups.keys()];
      const groupResults = await Promise.all(
        groupKeys.map(key =>
          convertMultipleCurrenciesWithProvenance(
            (groupShapes.get(key)?.byCurrency ?? []).map(line => ({
              amount: line.amount,
              currency: line.currency,
            })),
            displayCurrency
          )
        )
      );
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
        groupTotals: new Map(
          groupKeys.map((key, index) => {
            const shape = groupShapes.get(key);
            const result = groupResults[index];
            return [
              key,
              {
                isConverted: shape?.isConverted ?? false,
                byCurrency: shape?.byCurrency ?? [],
                total: result?.total ?? new Decimal(0),
                unconverted: result?.unconverted ?? [],
              },
            ];
          })
        ),
      });
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [assets, liabilities, displayCurrency, isSingleCurrency, groups, groupShapes]);

  if (isSingleCurrency) return synchronous;

  /**
   * Mixed currencies, conversion still in flight.
   *
   * The totals read ZERO rather than the raw cross-currency sum. Showing the
   * unconverted figure first would put a number on screen that is true in no
   * currency — briefly, and then correct itself, which is the worst of both:
   * long enough to be read, short enough not to be questioned.
   *
   * Group totals hold to the same rule and for the same reason: a group that
   * needs a rate reports zero until it has one, so the account list cannot show
   * a settled-looking band total above a net worth that is still resolving.
   * They arrive together or not at all.
   */
  return (
    converted ?? {
      netWorth: new Decimal(0),
      assets: new Decimal(0),
      liabilities: new Decimal(0),
      provenance: null,
      unconverted: [],
      isReady: false,
      groupTotals: new Map(
        [...groupShapes].map(([key, shape]) => [
          key,
          { ...shape, total: new Decimal(0), unconverted: [] },
        ])
      ),
    }
  );
}
