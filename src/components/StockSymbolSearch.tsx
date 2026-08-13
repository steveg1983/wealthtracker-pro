import { useEffect, useId, useState } from 'react';
import { searchSymbols, type SymbolMatch } from '../services/stockPriceService';
import { useDebounce } from '../hooks/useDebounce';
import { SearchIcon, RefreshCwIcon } from './icons';

/**
 * Find an instrument by ticker or by name.
 *
 * ── WHAT THIS REPLACES ──────────────────────────────────────────────────────
 * A hard-coded array of 28 US tickers, filtered client-side. It was the app's
 * entire idea of which instruments exist, so no LSE share, no ETF and no UK
 * fund could be added to a watchlist or a portfolio at all — and typing a real
 * one produced an empty list that read as "no such symbol".
 *
 * The list now comes from /api/quotes-search, which wraps Yahoo's own lookup
 * server-side (the browser cannot reach Yahoo — see services/stockPriceService).
 *
 * A FAILED LOOKUP AND AN EMPTY RESULT ARE DIFFERENT ANSWERS and are shown
 * differently. Telling someone their real ticker does not exist, because our
 * search was down, is the worse of the two mistakes.
 */

interface StockSymbolSearchProps {
  onSelect: (symbol: string, match: SymbolMatch) => void;
  placeholder?: string;
  /** Rendered under the field; use for "already on your watchlist" etc. */
  hint?: string;
  autoFocus?: boolean;
}

/** Long enough that a two-letter ticker still searches, short enough to be cheap. */
const MIN_QUERY_LENGTH = 1;
const DEBOUNCE_MS = 300;

export default function StockSymbolSearch({
  onSelect,
  placeholder = 'Search by ticker or name (SHEL.L, Vanguard, AAPL…)',
  hint,
  autoFocus = false
}: StockSymbolSearchProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<SymbolMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const debounced = useDebounce(query.trim(), DEBOUNCE_MS);
  const listId = useId();

  useEffect(() => {
    if (debounced.length < MIN_QUERY_LENGTH) {
      setMatches([]);
      setError(null);
      setHasSearched(false);
      return;
    }

    // An in-flight search whose query is no longer the current one must not
    // overwrite the newer results — a fast typist would otherwise see the
    // answer to a prefix of what they typed.
    let current = true;
    setIsSearching(true);
    setError(null);

    searchSymbols(debounced)
      .then((found) => {
        if (!current) return;
        setMatches(found);
        setHasSearched(true);
      })
      .catch((cause: unknown) => {
        if (!current) return;
        setMatches([]);
        setHasSearched(true);
        setError(cause instanceof Error ? cause.message : 'Symbol lookup is unavailable');
      })
      .finally(() => {
        if (current) setIsSearching(false);
      });

    return () => {
      current = false;
    };
  }, [debounced]);

  const handleSelect = (match: SymbolMatch): void => {
    onSelect(match.symbol, match);
    setQuery('');
    setMatches([]);
    setHasSearched(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <SearchIcon
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={20}
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search for a stock, fund or ETF"
          aria-controls={listId}
          aria-expanded={matches.length > 0}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:border-transparent"
        />
        {isSearching && (
          <RefreshCwIcon
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
            aria-hidden="true"
          />
        )}
      </div>

      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error} — try again in a moment.
        </p>
      )}

      {/* "Nothing matched" is only said once a search has actually completed
          without error, so a dead lookup never reads as a missing instrument. */}
      {!error && hasSearched && !isSearching && matches.length === 0 && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Nothing matched “{debounced}”.
        </p>
      )}

      {matches.length > 0 && (
        <ul
          id={listId}
          className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-72 overflow-y-auto"
        >
          {matches.map((match) => (
            <li key={`${match.symbol}-${match.exchange}`}>
              <button
                type="button"
                onClick={() => handleSelect(match)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 focus:bg-gray-100 dark:focus:bg-gray-600 focus:outline-none"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-gray-900 dark:text-white">{match.symbol}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                    {[match.exchange, match.type].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="block text-sm text-gray-600 dark:text-gray-300 truncate">
                  {match.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
