import React, { memo, useState, useRef, useEffect } from 'react';
import { SearchIcon, XIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';
import type { Transaction } from '../../types';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: (query: string) => void;
  recentSearches: string[];
  showSearchDropdown: boolean;
  setShowSearchDropdown: (show: boolean) => void;
  getSuggestedSearches: (transactions: Transaction[]) => string[];
  transactions: Transaction[];
}

export const SearchBar = memo(function SearchBar({ searchQuery,
  onSearchChange,
  onSearch,
  recentSearches,
  showSearchDropdown,
  setShowSearchDropdown,
  getSuggestedSearches,
  transactions
 }: SearchBarProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SearchBar component initialized', {
      componentName: 'SearchBar'
    });
  }, []);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localQuery, setLocalQuery] = useState(searchQuery);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setShowSearchDropdown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(localQuery);
    setShowSearchDropdown(false);
  };

  const handleClear = () => {
    setLocalQuery('');
    onSearchChange('');
    onSearch('');
    inputRef.current?.focus();
  };

  const suggestedSearches = getSuggestedSearches(transactions);
  const allSuggestions = [...new Set([...recentSearches, ...suggestedSearches])].slice(0, 8);

  return (
    <div ref={searchRef} className="relative flex-1 max-w-md">
      <form onSubmit={handleSubmit} className="relative">
        <SearchIcon 
          size={18} 
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          ref={inputRef}
          type="text"
          value={localQuery}
          onChange={(e) => {
            setLocalQuery(e.target.value);
            onSearchChange(e.target.value);
          }}
          onFocus={() => setShowSearchDropdown(true)}
          placeholder="Search transactions..."
          className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 
                   rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                   focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
        {localQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 
                     hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XIcon size={18} />
          </button>
        )}
      </form>

      {/* Search suggestions dropdown */}
      {showSearchDropdown && allSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 
                      border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg 
                      overflow-hidden z-50">
          <div className="max-h-64 overflow-y-auto">
            {recentSearches.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 
                              bg-gray-50 dark:bg-gray-900">
                  Recent Searches
                </div>
                {recentSearches.slice(0, 5).map((search, index) => (
                  <button
                    key={`recent-${index}`}
                    onClick={() => {
                      setLocalQuery(search);
                      onSearch(search);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 
                             dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <SearchIcon size={14} className="text-gray-400" />
                    {search}
                  </button>
                ))}
              </>
            )}
            
            {suggestedSearches.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 
                              bg-gray-50 dark:bg-gray-900">
                  Suggested
                </div>
                {suggestedSearches.slice(0, 3).map((search, index) => (
                  <button
                    key={`suggested-${index}`}
                    onClick={() => {
                      setLocalQuery(search);
                      onSearch(search);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 
                             dark:hover:bg-gray-700"
                  >
                    {search}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});