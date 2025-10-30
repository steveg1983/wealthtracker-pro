import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { SearchIcon, XIcon, WalletIcon, CreditCardIcon, TargetIcon, GoalIcon } from './icons';
import { useGlobalSearch, type SearchResult } from '../hooks/useGlobalSearch';
import { useDebounce } from '../hooks/useDebounce';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps): React.JSX.Element | null {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { results, hasResults, resultCount } = useGlobalSearch(debouncedQuery);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const getResultRoute = useCallback((result: SearchResult): string => {
    switch (result.type) {
      case 'account':
        return `/accounts`;
      case 'transaction':
        return `/transactions?search=${result.id}`;
      case 'budget':
        return `/budget`;
      case 'goal':
        return `/goals`;
      default:
        return '/';
    }
  }, []);

  const handleResultClick = useCallback((result: SearchResult): void => {
    // Preserve demo mode parameter if present
    const searchParams = new URLSearchParams(window.location.search);
    const isDemoMode = searchParams.get('demo') === 'true';
    
    let route = getResultRoute(result);
    if (isDemoMode) {
      // Add demo parameter to the route
      route = route.includes('?') ? `${route}&demo=true` : `${route}?demo=true`;
    }
    
    navigate(route);
    onClose();
  }, [getResultRoute, navigate, onClose]);


  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleResultClick(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResultClick, isOpen, onClose, results, selectedIndex]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

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



  const highlightText = (text: string, matches: string[]): React.JSX.Element => {
    // Handle null/undefined text
    if (!text) return <></>;
    if (!matches || !matches.length) return <>{text}</>;
    
    // Escape special regex characters in matches
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    let highlightedText = text;
    matches.forEach(match => {
      if (match) { // Ensure match is not null/undefined
        const escapedMatch = escapeRegex(match);
        const regex = new RegExp(`(${escapedMatch})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">$1</mark>');
      }
    });
    
    // Sanitize the HTML to prevent XSS
    const sanitized = DOMPurify.sanitize(highlightedText, {
      ALLOWED_TAGS: ['mark'],
      ALLOWED_ATTR: ['class']
    });
    
    return <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-start justify-center pt-20">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[70vh] overflow-hidden">
        {/* Search Input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <div className="relative">
            <SearchIcon 
              size={20} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search accounts, transactions, budgets, goals..."
              className="w-full pl-10 pr-10 py-3 bg-transparent border-0 focus:ring-0 text-gray-900 dark:text-white placeholder-gray-500 text-lg"
              autoComplete="off"
              data-search-input
            />
            <button
              onClick={onClose}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <XIcon size={20} />
            </button>
          </div>
        </div>

        {/* Search Results */}
        <div className="max-h-96 overflow-y-auto">
          {query.length < 2 && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <SearchIcon size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">Start typing to search...</p>
              <p className="text-sm mt-2">Search across accounts, transactions, budgets, and goals</p>
            </div>
          )}

          {query.length >= 2 && !hasResults && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <SearchIcon size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">No results found</p>
              <p className="text-sm mt-2">Try different keywords or check your spelling</p>
            </div>
          )}

          {hasResults && (
            <div className="p-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2">
                {resultCount} result{resultCount !== 1 ? 's' : ''}
              </div>
              
              {results.map((result, index) => {
                const Icon = getResultIcon(result.type);
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className={`w-full flex items-center p-3 rounded-lg transition-colors text-left ${
                      index === selectedIndex
                        ? 'bg-[var(--color-primary)]/10 border-l-2 border-[var(--color-primary)]'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className={`p-2 rounded-lg mr-3 ${
                      index === selectedIndex
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      <Icon size={20} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {highlightText(result.title, result.matches)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 ml-2 capitalize">
                          {result.type}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {highlightText(result.description, result.matches)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Search Tips */}
        {query.length >= 2 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div>💡 <strong>Tips:</strong> Use ↑↓ to navigate, Enter to select, Escape to close</div>
              <div>🔍 Search works across all your financial data</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
