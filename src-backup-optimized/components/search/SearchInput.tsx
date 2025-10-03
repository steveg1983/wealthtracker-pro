/**
 * Search Input Component
 * Main search input field with suggestions
 */

import React, { useEffect } from 'react';
import { SearchIcon } from '../icons';
import { enhancedSearchBarService } from '../../services/enhancedSearchBarService';
import { useLogger } from '../services/ServiceProvider';

interface SearchInputProps {
  query: string;
  naturalLanguageMode: boolean;
  isSearching: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onQueryChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const SearchInput = React.memo(({
  query,
  naturalLanguageMode,
  isSearching,
  inputRef,
  onQueryChange,
  onFocus,
  onBlur,
  onKeyDown
}: SearchInputProps) => {
  const placeholder = enhancedSearchBarService.getSearchPlaceholder(naturalLanguageMode);
  const inputClasses = enhancedSearchBarService.getSearchInputClasses(naturalLanguageMode);

  return (
    <div className="flex-1 relative">
      <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={inputClasses}
        aria-label="Search"
      />
      {isSearching && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;