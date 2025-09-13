import React, { useEffect, memo } from 'react';
import { useAdvancedSearch } from './useAdvancedSearch';
import { SearchBar } from './SearchBar';
import { AdvancedFilters } from './AdvancedFilters';
import { SavedSearchesModal } from './SavedSearchesModal';
import type { AdvancedSearchProps } from './types';
import { logger } from '../../services/loggingService';

const AdvancedSearch = memo(function AdvancedSearch({
  transactions,
  accounts,
  categories,
  onResults,
  className = ''
}: AdvancedSearchProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AdvancedSearch component initialized', {
      componentName: 'AdvancedSearch'
    });
  }, []);

  const {
    isExpanded,
    setIsExpanded,
    searchTerm,
    setSearchTerm,
    showSavedSearches,
    setShowSavedSearches,
    savedSearches,
    searchName,
    setSearchName,
    filters,
    filteredTransactions,
    updateFilter,
    clearFilters,
    saveCurrentSearch,
    loadSavedSearch,
    deleteSavedSearch,
    hasActiveFilters
  } = useAdvancedSearch(transactions, accounts, categories, onResults);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        filteredCount={filteredTransactions.length}
        totalCount={transactions.length}
        savedSearchesCount={savedSearches.length}
        onShowSavedSearches={() => setShowSavedSearches(true)}
      />

      {isExpanded && (
        <AdvancedFilters
          filters={filters}
          onUpdateFilter={updateFilter}
          searchName={searchName}
          onSearchNameChange={setSearchName}
          onSaveSearch={saveCurrentSearch}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      <SavedSearchesModal
        isOpen={showSavedSearches}
        onClose={() => setShowSavedSearches(false)}
        savedSearches={savedSearches}
        onLoad={loadSavedSearch}
        onDelete={deleteSavedSearch}
      />
    </div>
  );
});

export default AdvancedSearch;