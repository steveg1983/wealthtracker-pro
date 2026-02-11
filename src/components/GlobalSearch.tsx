import React, {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback
} from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  SearchIcon,
  WalletIcon,
  CreditCardIcon,
  TargetIcon,
  GoalIcon
} from './icons';
import { useGlobalSearch, type SearchResult } from '../hooks/useGlobalSearch';
import { useDebounce } from '../hooks/useDebounce';
import { isDemoModeRuntimeAllowed } from '../utils/runtimeMode';

export interface GlobalSearchHandle {
  focusInput: () => void;
}

interface GlobalSearchProps {
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onResultSelect?: () => void;
}

const getResultIcon = (type: SearchResult['type']): React.ElementType => {
  switch (type) {
    case 'account':
      return WalletIcon;
    case 'transaction':
      return CreditCardIcon;
    case 'budget':
      return TargetIcon;
    case 'goal':
      return GoalIcon;
    default:
      return SearchIcon;
  }
};

const getResultRoute = (result: SearchResult): string => {
  switch (result.type) {
    case 'account':
      return '/accounts';
    case 'transaction':
      return `/transactions?search=${result.id}`;
    case 'budget':
      return '/budget';
    case 'goal':
      return '/goals';
    default:
      return '/';
  }
};

const highlightText = (text: string, matches: string[]): React.JSX.Element => {
  if (!text) return <></>;
  if (!matches || matches.length === 0) return <>{text}</>;

  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let highlightedText = text;

  matches.forEach((match) => {
    if (!match) return;
    const escapedMatch = escapeRegex(match);
    const regex = new RegExp(`(${escapedMatch})`, 'gi');
    highlightedText = highlightedText.replace(
      regex,
      '<mark class="bg-yellow-200/80 dark:bg-yellow-800/70 px-1 rounded">$1</mark>'
    );
  });

  const sanitized = DOMPurify.sanitize(highlightedText, {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: ['class']
  });

  return <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
};

const GlobalSearch = forwardRef<GlobalSearchHandle, GlobalSearchProps>(
  ({
    placeholder = 'Search transactions, accounts, budgets...',
    className = '',
    autoFocus = false,
    onResultSelect,
  }, ref) => {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(autoFocus);
    const [isHoveringResults, setIsHoveringResults] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const debouncedQuery = useDebounce(query, 250);
    const { results, hasResults, resultCount } = useGlobalSearch(debouncedQuery);
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const showHelperPanel = isFocused && debouncedQuery.length < 2;
    const showResultsPanel = debouncedQuery.length >= 2 && hasResults && (isFocused || isHoveringResults);
    const showNoResultsPanel = debouncedQuery.length >= 2 && !hasResults && (isFocused || isHoveringResults);
    const shouldShowPanel = showHelperPanel || showResultsPanel || showNoResultsPanel;

    useImperativeHandle(ref, () => ({
      focusInput() {
        if (inputRef.current) {
          inputRef.current.focus();
          setIsFocused(true);
        }
      }
    }), []);

    useEffect(() => {
      if (autoFocus && inputRef.current) {
        inputRef.current.focus();
        setIsFocused(true);
      }
    }, [autoFocus]);

    useEffect(() => {
      setSelectedIndex(0);
    }, [results]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsFocused(false);
          setIsHoveringResults(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleResultNavigate = useCallback((result: SearchResult) => {
      const searchParams = new URLSearchParams(window.location.search);
      const isDemoMode =
        isDemoModeRuntimeAllowed(import.meta.env) &&
        searchParams.get('demo') === 'true';

      let route = getResultRoute(result);
      if (isDemoMode) {
        route = route.includes('?') ? `${route}&demo=true` : `${route}?demo=true`;
      }

      navigate(route);
      setQuery('');
      setIsFocused(false);
      setIsHoveringResults(false);
      setSelectedIndex(0);
      inputRef.current?.blur();
      onResultSelect?.();
    }, [navigate, onResultSelect]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!results || results.length === 0) {
        if (event.key === 'Escape') {
          setIsFocused(false);
          inputRef.current?.blur();
        }
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        setIsHoveringResults(true);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        setIsHoveringResults(true);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const selectedResult = results[selectedIndex];
        if (selectedResult) {
          handleResultNavigate(selectedResult);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setIsFocused(false);
        setIsHoveringResults(false);
        inputRef.current?.blur();
      }
    };

    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <div className="relative bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-300/70 dark:border-gray-600 focus-within:border-gray-400 dark:focus-within:border-gray-500 transition-colors">
          <SearchIcon
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-300"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onFocus={() => setIsFocused(true)}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-3 bg-transparent border-0 text-gray-900 dark:text-white placeholder-gray-500"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={shouldShowPanel}
            aria-controls="global-search-results"
          />
        </div>

        {shouldShowPanel && (
          <div
            id="global-search-results"
            className="absolute left-0 right-0 mt-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-40"
            onMouseEnter={() => setIsHoveringResults(true)}
            onMouseLeave={() => setIsHoveringResults(false)}
          >
            {showHelperPanel && (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                <SearchIcon size={32} className="mx-auto mb-3 opacity-60" />
                <p className="text-base font-medium">Start typing to search…</p>
                <p className="text-sm mt-1">Search across accounts, transactions, budgets, and goals</p>
              </div>
            )}

            {showNoResultsPanel && (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                <SearchIcon size={32} className="mx-auto mb-3 opacity-60" />
                <p className="text-base font-medium">No results found</p>
                <p className="text-sm mt-1">Try different keywords or check your spelling</p>
              </div>
            )}

            {showResultsPanel && (
              <div className="py-2">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 px-4 pb-2">
                  {resultCount} result{resultCount !== 1 ? 's' : ''}
                </div>
                <ul role="listbox" aria-label="Search results" className="max-h-80 overflow-y-auto">
                  {results.map((result, index) => {
                    const Icon = getResultIcon(result.type);
                    const isSelected = index === selectedIndex;
                    return (
                      <li key={`${result.type}-${result.id}`} role="option" aria-selected={isSelected}>
                        <button
                          type="button"
                          onClick={() => handleResultNavigate(result)}
                          className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                            isSelected
                              ? 'bg-card-bg-light dark:bg-gray-700 text-gray-900 dark:text-white'
                              : 'hover:bg-[#c5cfdf] dark:hover:bg-gray-700/70 text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            <Icon size={18} className="opacity-80" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {highlightText(result.title, result.matches || [])}
                            </div>
                            {result.description && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {highlightText(result.description, result.matches || [])}
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

GlobalSearch.displayName = 'GlobalSearch';

export default GlobalSearch;
