import { useMemo } from 'react';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal, type DecimalInstance } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import { RefreshCwIcon, AlertCircleIcon, InfoIcon } from './icons';
import type { InvestmentHolding } from '../services/api/investmentService';

/**
 * What the holdings are worth AT THE LAST PRICE WE FETCHED.
 *
 * ── THIS IS NOT THE PORTFOLIO VALUE ─────────────────────────────────────────
 * The Investments page's headline "Portfolio Value" comes from the LEDGER —
 * opening balance plus every transaction across the investment↔cash pair
 * (utils/portfolioSummary). That is the figure that agrees with the Accounts
 * page and the net-worth report to the penny, and it is the page's source of
 * truth.
 *
 * This panel is a second, independent opinion: quantity × last price, per
 * symbol. It exists because a ledger says what went in and out, not what the
 * market thinks today. The two must NEVER be added together — the shares and
 * the cash that bought them are the same money — so this view is labelled as
 * market values throughout and is never summed into a headline tile.
 *
 * ── EVERY FIGURE SAYS WHEN IT WAS TRUE ──────────────────────────────────────
 * A price with no date is a claim about now that may be a month old. Each row
 * carries its own as-of date, and a holding that has never been priced says so
 * instead of showing £0.00 — which would read as "this is worthless".
 */

interface InvestmentMarketViewProps {
  holdings: readonly InvestmentHolding[];
  /** Account currency, used when a holding does not name its own. */
  fallbackCurrency: string;
  onUpdateQuotes: () => void;
  isUpdating: boolean;
  /** Shown above the table when the last update failed. */
  updateError?: string | null;
  /** Per-symbol reasons from the last update, for rows that could not price. */
  symbolErrors?: ReadonlyMap<string, string>;
}

const ZERO = toDecimal(0);

/** Rows sharing one currency, so a total is only shown when it means something. */
interface CurrencyGroup {
  currency: string;
  marketValue: DecimalInstance;
  costBasis: DecimalInstance;
  /** Rows in this currency that have never been priced. */
  unpriced: number;
}

export default function InvestmentMarketView({
  holdings,
  fallbackCurrency,
  onUpdateQuotes,
  isUpdating,
  updateError = null,
  symbolErrors
}: InvestmentMarketViewProps): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();

  /**
   * Totals are grouped BY CURRENCY and never converted here. A single "total"
   * across GBP and USD holdings would need an exchange rate, and quietly
   * applying one turns two honest numbers into one number nobody can check.
   */
  const groups = useMemo<CurrencyGroup[]>(() => {
    const byCurrency = new Map<string, CurrencyGroup>();
    for (const holding of holdings) {
      const currency = holding.currency || fallbackCurrency;
      const group = byCurrency.get(currency) ?? {
        currency,
        marketValue: ZERO,
        costBasis: ZERO,
        unpriced: 0
      };
      group.costBasis = group.costBasis.plus(holding.costBasis);
      if (holding.marketValue === null) {
        group.unpriced += 1;
      } else {
        group.marketValue = group.marketValue.plus(holding.marketValue);
      }
      byCurrency.set(currency, group);
    }
    return [...byCurrency.values()];
  }, [holdings, fallbackCurrency]);

  /** The oldest price on the page — the age of the whole picture. */
  const oldestPrice = useMemo(() => {
    const dates = holdings
      .map((h) => h.lastUpdated)
      .filter((d): d is Date => d !== null)
      .map((d) => d.getTime());
    return dates.length > 0 ? new Date(Math.min(...dates)) : null;
  }, [holdings]);

  if (holdings.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">
          No holdings recorded for this account. Add them on the Manage tab to see market values.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Market value</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Units held × last fetched price.
            {oldestPrice
              ? ` Oldest price on this list: ${oldestPrice.toLocaleDateString()}.`
              : ' Nothing here has been priced yet.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onUpdateQuotes}
          disabled={isUpdating}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCwIcon size={16} className={isUpdating ? 'animate-spin' : ''} aria-hidden="true" />
          {isUpdating ? 'Updating…' : 'Update quotes'}
        </button>
      </div>

      {/* The double-counting warning is part of the feature, not decoration:
          without it a reader has two "portfolio" numbers and no idea which. */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
        <InfoIcon size={16} className="mt-0.5 shrink-0 text-blue-700 dark:text-blue-400" aria-hidden="true" />
        <p className="text-sm text-blue-800 dark:text-blue-200">
          These are market values, shown alongside the account&rsquo;s ledger balance — not added
          to it. Portfolio Value on the Overview tab is the ledger figure, and it already includes
          the money these holdings were bought with.
        </p>
      </div>

      {updateError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
          <AlertCircleIcon size={16} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
          <p className="text-sm text-red-700 dark:text-red-300">{updateError}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th scope="col" className="py-2 pr-3 font-medium">Holding</th>
              <th scope="col" className="py-2 px-3 font-medium text-right">Units</th>
              <th scope="col" className="py-2 px-3 font-medium text-right">Avg cost</th>
              <th scope="col" className="py-2 px-3 font-medium text-right">Price</th>
              <th scope="col" className="py-2 px-3 font-medium text-right">Market value</th>
              <th scope="col" className="py-2 pl-3 font-medium text-right">Gain / loss</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => {
              const currency = holding.currency || fallbackCurrency;
              const gain =
                holding.marketValue === null ? null : holding.marketValue.minus(holding.costBasis);
              const gainPercent =
                gain === null || holding.costBasis.isZero()
                  ? null
                  : gain.dividedBy(holding.costBasis).times(100);
              const failure = symbolErrors?.get(holding.symbol);

              return (
                <tr
                  key={holding.id}
                  className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                >
                  <td className="py-3 pr-3">
                    <span className="block font-medium text-gray-900 dark:text-white">
                      {holding.symbol}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate max-w-[16rem]">
                      {holding.name}
                    </span>
                    {failure && (
                      <span className="block text-xs text-red-600 dark:text-red-400">
                        Couldn&rsquo;t fetch {holding.symbol} — {failure}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-gray-900 dark:text-white">
                    {formatDecimal(holding.quantity, 4)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-gray-900 dark:text-white">
                    {formatCurrency(holding.averageCost, currency)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {holding.currentPrice === null ? (
                      <span className="text-gray-400 dark:text-gray-500">Not priced</span>
                    ) : (
                      <>
                        <span className="block text-gray-900 dark:text-white">
                          {formatCurrency(holding.currentPrice, currency)}
                        </span>
                        {holding.lastUpdated && (
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {holding.lastUpdated.toLocaleDateString()}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-gray-900 dark:text-white">
                    {/* Never £0.00 for "we do not know" — that reads as worthless. */}
                    {holding.marketValue === null
                      ? <span className="text-gray-400 dark:text-gray-500">—</span>
                      : formatCurrency(holding.marketValue, currency)}
                  </td>
                  <td className="py-3 pl-3 text-right tabular-nums">
                    {gain === null ? (
                      <span className="text-gray-400 dark:text-gray-500">—</span>
                    ) : (
                      <>
                        <span
                          className={
                            gain.greaterThanOrEqualTo(0)
                              ? 'block text-green-600 dark:text-green-400'
                              : 'block text-red-600 dark:text-red-400'
                          }
                        >
                          {gain.greaterThanOrEqualTo(0) ? '+' : ''}
                          {formatCurrency(gain, currency)}
                        </span>
                        {gainPercent && (
                          <span
                            className={
                              gain.greaterThanOrEqualTo(0)
                                ? 'block text-xs text-green-600 dark:text-green-400'
                                : 'block text-xs text-red-600 dark:text-red-400'
                            }
                          >
                            {gain.greaterThanOrEqualTo(0) ? '+' : ''}
                            {formatDecimal(gainPercent, 2)}%
                          </span>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 border-t border-gray-200 dark:border-gray-700 pt-3">
        {groups.map((group) => (
          <div key={group.currency} className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Market value ({group.currency})
              {group.unpriced > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {' '}
                  — excludes {group.unpriced} holding{group.unpriced === 1 ? '' : 's'} with no price
                </span>
              )}
            </span>
            <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
              {formatCurrency(group.marketValue, group.currency)}
            </span>
          </div>
        ))}
        {groups.length > 1 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Totalled per currency. Combining them would need an exchange rate that is not part of
            this figure.
          </p>
        )}
      </div>
    </div>
  );
}
