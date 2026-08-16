import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchQuotes, type StockQuote } from '../services/stockPriceService';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useLocalStorage } from '../hooks/useLocalStorage';
import StockSymbolSearch from './StockSymbolSearch';
import { PlusIcon, XIcon, RefreshCwIcon, AlertCircleIcon } from './icons';
import { formatDecimal } from '../utils/decimal-format';
import { createScopedLogger } from '../loggers/scopedLogger';

/**
 * A watchlist that tells the truth about what it could not fetch.
 *
 * Three things were wrong before, and all three were invisible:
 *
 *   1. Every quote failed (the browser cannot reach Yahoo — see
 *      services/stockPriceService) and failures were swallowed, so a card sat
 *      on "Loading…" forever with no way to tell a slow fetch from a dead one.
 *   2. `lastUpdated` was stamped unconditionally, so the header claimed a fresh
 *      update at the exact moment nothing had been updated.
 *   3. The list polled every 60 seconds, forever, re-failing silently.
 *
 * Now: a card that failed says so and names the symbol; "Last updated" is set
 * ONLY when at least one quote actually arrived; and refresh is a button the
 * person presses (daily closes are the product — see api/cron/quotes.ts).
 */

export default function StockWatchlist(): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();
  const [watchlist, setWatchlist] = useLocalStorage<string[]>('stock-watchlist', []);
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const logger = useMemo(() => createScopedLogger('StockWatchlist'), []);

  const fetchAll = useCallback(async () => {
    if (watchlist.length === 0) {
      setQuotes(new Map());
      setErrors(new Map());
      return;
    }

    setIsLoading(true);
    try {
      const batch = await fetchQuotes(watchlist);
      setQuotes(batch.quotes);
      setErrors(batch.errors);
      // ONLY on a real arrival. A timestamp is a claim about the data, and a
      // batch where everything failed updated nothing.
      if (batch.quotes.size > 0) {
        setLastUpdated(new Date());
      }
    } catch (error) {
      // fetchQuotes reports per symbol rather than throwing, so reaching here
      // means something unexpected — say so on every card rather than nowhere.
      logger.error('Watchlist refresh failed', error);
      setQuotes(new Map());
      setErrors(new Map(watchlist.map((symbol) => [symbol, `Couldn't fetch ${symbol}`])));
    } finally {
      setIsLoading(false);
    }
  }, [watchlist, logger]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const addToWatchlist = (symbol: string): void => {
    const upper = symbol.toUpperCase();
    if (!watchlist.includes(upper)) {
      setWatchlist([...watchlist, upper]);
    }
    setShowAddStock(false);
  };

  const removeFromWatchlist = (symbol: string): void => {
    setWatchlist(watchlist.filter((s) => s !== symbol));
    setQuotes((current) => {
      const next = new Map(current);
      next.delete(symbol);
      return next;
    });
    setErrors((current) => {
      const next = new Map(current);
      next.delete(symbol);
      return next;
    });
  };

  const addPanel = (
    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
        Add to watchlist
      </h3>
      <StockSymbolSearch onSelect={addToWatchlist} autoFocus />
      <button
        type="button"
        onClick={() => setShowAddStock(false)}
        className="mt-3 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        Cancel
      </button>
    </div>
  );

  if (watchlist.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        {/* NO HEADER BUTTON ON AN EMPTY LIST. It sat in the corner offering
            "Add Stock" while the empty state below offered "Add Your First
            Stock" — two controls, one action, and the reader has to work out
            whether they differ. The empty state's is the better of the two: it
            is where the eye already is, and its words say which press this is.

            From one stock onwards the header button is the right control and
            the only one, because by then the list is the content and an
            invitation in the middle of it would be in the way. */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Stock Watchlist</h2>
        </div>

        {showAddStock ? (
          addPanel
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Stocks in Watchlist
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Add shares, funds or ETFs to follow their closing prices.
            </p>
            <button
              type="button"
              onClick={() => setShowAddStock(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              <PlusIcon size={16} />
              Add Your First Stock
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Stock Watchlist</h2>
          {lastUpdated ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          ) : (
            !isLoading && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Not updated yet</p>
            )
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchAll()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
          >
            <RefreshCwIcon size={16} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowAddStock(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            <PlusIcon size={16} />
            Add Stock
          </button>
        </div>
      </div>

      {showAddStock && addPanel}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {watchlist.map((symbol) => {
          const quote = quotes.get(symbol);
          const failure = errors.get(symbol);

          return (
            <div key={symbol} className="relative">
              <button
                type="button"
                onClick={() => removeFromWatchlist(symbol)}
                aria-label={`Remove ${symbol} from watchlist`}
                className="absolute -top-2 -right-2 z-10 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <XIcon size={12} aria-hidden="true" />
              </button>

              {quote ? (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{quote.symbol}</h3>
                    {isLoading && (
                      <RefreshCwIcon size={14} className="animate-spin text-gray-400" aria-hidden="true" />
                    )}
                  </div>

                  {quote.name && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 truncate">{quote.name}</p>
                  )}

                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(quote.price, quote.currency)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{quote.currency}</span>
                  </div>

                  {/* A move needs a previous close to be a move. Without one we
                      say nothing rather than print a confident "+0.00 (0.00%)". */}
                  {quote.change && quote.changePercent ? (
                    <div
                      className={`flex items-center gap-1 text-sm ${
                        quote.change.greaterThanOrEqualTo(0)
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      <span>
                        {quote.change.greaterThanOrEqualTo(0) ? '+' : ''}
                        {formatCurrency(quote.change, quote.currency)}
                      </span>
                      <span>
                        ({quote.change.greaterThanOrEqualTo(0) ? '+' : ''}
                        {formatDecimal(quote.changePercent, 2)}%)
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No previous close to compare
                    </p>
                  )}
                </div>
              ) : failure ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{symbol}</h3>
                    <AlertCircleIcon size={16} className="text-red-500" aria-hidden="true" />
                  </div>
                  {/* THE MESSAGE AS THE SERVER WROTE IT, not wrapped in a
                      second copy of itself. `fetchQuote` already returns a
                      whole sentence — "Couldn't fetch AAPL — upstream returned
                      429" — and this printed "Couldn't fetch AAPL — " in front
                      of it, so the card read the symbol and the apology twice.

                      The card's own heading already says WHICH symbol, so the
                      prefix was saying that a third time. */}
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {failure}. Try Refresh.
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{symbol}</h3>
                    <RefreshCwIcon size={14} className="animate-spin text-gray-400" aria-hidden="true" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
