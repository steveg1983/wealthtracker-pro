import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchQuotes, type StockQuote } from '../services/stockPriceService';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useLocalStorage } from '../hooks/useLocalStorage';
import StockSymbolSearch from './StockSymbolSearch';
import { PlusIcon, XIcon, RefreshCwIcon, AlertCircleIcon } from './icons';
import { formatDecimal } from '../utils/decimal-format';
import { createScopedLogger } from '../loggers/scopedLogger';
import { normaliseWatchlist, positionMetrics, type WatchedItem } from '../utils/watchlistPositions';

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
  /**
   * SAME KEY, RICHER SHAPE. The list stored plain symbol strings until 16
   * August; it now stores {symbol, shares?, startPrice?} so a watched share
   * can carry a dummy position (the owner: "almost use it as a dummy
   * portfolio"). `normaliseWatchlist` reads all three generations — old
   * strings, new objects, hand-edited junk — so nobody's list empties on the
   * day the shape changes. Every write goes back normalised.
   */
  const [storedWatchlist, setStoredWatchlist] = useLocalStorage<(string | WatchedItem)[]>('stock-watchlist', []);
  /**
   * Arrangement (owner, 16 August): sort by name or by position value, each
   * direction toggleable, and a list view beside the grid. Persisted like the
   * Accounts and Holdings arrangements are. Sorting reads the DISPLAYED list
   * only — mutations key by symbol, so reordering cannot misdirect a save.
   */
  const [watchlistSort, setWatchlistSort] = useLocalStorage<'default' | 'name-asc' | 'name-desc' | 'value-desc' | 'value-asc'>('wt_watchlist_sort', 'default');
  const [watchlistView, setWatchlistView] = useLocalStorage<'grid' | 'list'>('wt_watchlist_view', 'grid');
  const items = useMemo(() => normaliseWatchlist(storedWatchlist), [storedWatchlist]);
  const watchlist = useMemo(() => items.map(i => i.symbol), [items]);

  /** Which card's position form is open, if any. */
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [sharesDraft, setSharesDraft] = useState('');
  const [startPriceDraft, setStartPriceDraft] = useState('');
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const displayedItems = useMemo(() => {
    if (watchlistSort === 'default') return items;
    const sorted = [...items];
    if (watchlistSort === 'name-asc' || watchlistSort === 'name-desc') {
      sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
      if (watchlistSort === 'name-desc') sorted.reverse();
      return sorted;
    }
    // Value = the dummy position's worth. A card with no position has no
    // value to rank by, so it sorts after every card that has one — in both
    // directions, because "no position" is not "worth nothing".
    const valueOf = (item: WatchedItem): number | null => {
      const quote = quotes.get(item.symbol);
      if (!quote) return null;
      const metrics = positionMetrics(item, quote.price.toString());
      return metrics === null ? null : metrics.value.toNumber();
    };
    sorted.sort((a, b) => {
      const va = valueOf(a);
      const vb = valueOf(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return watchlistSort === 'value-desc' ? vb - va : va - vb;
    });
    return sorted;
  }, [items, watchlistSort, quotes]);
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
    if (!items.some((i) => i.symbol === upper)) {
      setStoredWatchlist([...items, { symbol: upper }]);
    }
    setShowAddStock(false);
  };

  /**
   * Both fields or neither — a position missing one of the two answers half
   * the question it was configured for, so Save requires both and Clear
   * removes both. Strings straight from the inputs; `normaliseWatchlist`
   * drops anything non-numeric on the way back in.
   */
  const savePosition = (symbol: string, shares: string, startPrice: string): void => {
    setStoredWatchlist(items.map((i) => {
      if (i.symbol !== symbol) return i;
      const s = shares.trim();
      const p = startPrice.trim();
      if (s === '' && p === '') return { symbol: i.symbol };
      return { symbol: i.symbol, shares: s, startPrice: p };
    }));
    setEditingSymbol(null);
  };

  const openPositionForm = (item: WatchedItem): void => {
    setEditingSymbol(item.symbol);
    setSharesDraft(item.shares ?? '');
    setStartPriceDraft(item.startPrice ?? '');
  };

  const removeFromWatchlist = (symbol: string): void => {
    setStoredWatchlist(items.filter((i) => i.symbol !== symbol));
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

      {/* The arrangement controls, from two cards up — the same pills every
          other list in the app wears, with both directions on each axis. */}
      {items.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
            <button
              type="button"
              onClick={() => setWatchlistSort('default')}
              aria-pressed={watchlistSort === 'default'}
              className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                watchlistSort === 'default'
                  ? 'bg-[#1a2332] dark:bg-[#2d3a4d] text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Default
            </button>
            <button
              type="button"
              onClick={() => setWatchlistSort(watchlistSort === 'name-asc' ? 'name-desc' : 'name-asc')}
              aria-pressed={watchlistSort === 'name-asc' || watchlistSort === 'name-desc'}
              className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                watchlistSort === 'name-asc' || watchlistSort === 'name-desc'
                  ? 'bg-[#1a2332] dark:bg-[#2d3a4d] text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Name {watchlistSort === 'name-desc' ? 'Z–A' : 'A–Z'}
            </button>
            <button
              type="button"
              onClick={() => setWatchlistSort(watchlistSort === 'value-desc' ? 'value-asc' : 'value-desc')}
              aria-pressed={watchlistSort === 'value-desc' || watchlistSort === 'value-asc'}
              className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                watchlistSort === 'value-desc' || watchlistSort === 'value-asc'
                  ? 'bg-[#1a2332] dark:bg-[#2d3a4d] text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Value {watchlistSort === 'value-asc' ? '↑' : '↓'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setWatchlistView(watchlistView === 'grid' ? 'list' : 'grid')}
            className="ml-auto px-3 py-1.5 text-sm font-medium rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors border border-gray-200 dark:border-gray-700"
          >
            {watchlistView === 'grid' ? 'List view' : 'Grid view'}
          </button>
        </div>
      )}

      <div className={watchlistView === 'list'
        ? 'space-y-3'
        : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
        {displayedItems.map((item) => {
          const symbol = item.symbol;
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

                  {/* ─ THE DUMMY POSITION ────────────────────────────────────
                      Owner, 16 August: shares and a starting price, "almost a
                      dummy portfolio". It touches nothing real — no account,
                      no transaction, no total; the arithmetic lives in
                      utils/watchlistPositions with its own tests, because a
                      gain is money and a units slip here shows a fake profit.

                      The gain wears the hues because it has a DIRECTION,
                      which is what the hues are for; the value beside it is a
                      magnitude and stays neutral. */}
                  {editingSymbol === symbol ? (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
                      <label className="block text-xs text-gray-500 dark:text-gray-400">
                        Shares
                        <input
                          type="text"
                          inputMode="decimal"
                          value={sharesDraft}
                          onChange={(e) => setSharesDraft(e.target.value)}
                          className="mt-0.5 w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </label>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">
                        Starting price ({quote.currency})
                        <input
                          type="text"
                          inputMode="decimal"
                          value={startPriceDraft}
                          onChange={(e) => setStartPriceDraft(e.target.value)}
                          className="mt-0.5 w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </label>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => savePosition(symbol, sharesDraft, startPriceDraft)}
                          disabled={(sharesDraft.trim() === '') !== (startPriceDraft.trim() === '')}
                          className="px-3 py-1 text-sm font-medium rounded bg-[#1a2332] dark:bg-[#2d3a4d] text-white disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSymbol(null)}
                          className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Cancel
                        </button>
                        {(item.shares !== undefined || item.startPrice !== undefined) && (
                          <button
                            type="button"
                            onClick={() => savePosition(symbol, '', '')}
                            className="ml-auto px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (() => {
                    const metrics = positionMetrics(item, quote.price.toString());
                    if (metrics === null) {
                      return (
                        // Opens the form below, in place — it navigates nowhere,
                        // so it is not a link (stock-blue ruling, 28 Aug 2026).
                        // The hover is the same darkening the Cancel button
                        // above already uses.
                        <button
                          type="button"
                          onClick={() => openPositionForm(item)}
                          className="mt-3 text-xs text-gray-500 dark:text-gray-400 underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Track a position
                        </button>
                      );
                    }
                    const gaining = metrics.gain.greaterThanOrEqualTo(0);
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {item.shares} shares @ {item.startPrice}
                          </p>
                          <button
                            type="button"
                            onClick={() => openPositionForm(item)}
                            className="text-xs text-gray-400 dark:text-gray-500 underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            Edit
                          </button>
                        </div>
                        {/* Cost, then current value, then the gain — the
                            identity in reading order: cost + gain = value,
                            checkable by eye. Cost and value are magnitudes and
                            stay neutral; the gain carries the direction. */}
                        <p className="flex justify-between text-sm mt-1">
                          <span className="text-gray-500 dark:text-gray-400">Cost</span>
                          <span className="tabular-nums text-gray-700 dark:text-gray-300">
                            {formatCurrency(metrics.cost, quote.currency)}
                          </span>
                        </p>
                        <p className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Current value</span>
                          <span className="tabular-nums font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(metrics.value, quote.currency)}
                          </span>
                        </p>
                        <p className={`flex justify-between text-sm ${
                          gaining ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          <span>Gain</span>
                          <span className="tabular-nums">
                            {gaining ? '+' : ''}{formatCurrency(metrics.gain, quote.currency)}
                            {metrics.gainPercent !== null && (
                              <> ({gaining ? '+' : ''}{formatDecimal(metrics.gainPercent, 2)}%)</>
                            )}
                          </span>
                        </p>
                      </div>
                    );
                  })()}
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
