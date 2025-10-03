import React, { useState, useRef, useEffect } from 'react';
import { SearchIcon, FilterIcon, XIcon, ClockIcon, TagIcon, CalendarIcon, DollarSignIcon, SparklesIcon } from './icons';
import { Button } from './common/Button';
import { formatCurrency } from '../utils/formatters';
import { searchService } from '../services/searchService';
import type { SearchOptions } from '../services/searchService';

interface EnhancedSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  options: SearchOptions;
  onOptionsChange: (options: Partial<SearchOptions>) => void;
  onClear: () => void;
  suggestions?: string[];
  isSearching?: boolean;
  naturalLanguageMode?: boolean;
  onNaturalLanguageModeChange?: (enabled: boolean) => void;
  aggregations?: {
    totalAmount?: number;
    averageAmount?: number;
    countByType?: Record<string, number>;
  };
  totalResults?: number;
  className?: string;
}

export function EnhancedSearchBar({
  query,
  onQueryChange,
  options,
  onOptionsChange,
  onClear,
  suggestions = [],
  isSearching = false,
  naturalLanguageMode = false,
  onNaturalLanguageModeChange,
  aggregations,
  totalResults = 0,
  className = ''
}: EnhancedSearchBarProps): React.JSX.Element {
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle keyboard navigation in suggestions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestion(prev => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestion(prev => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
          if (selectedSuggestion >= 0) {
            e.preventDefault();
            onQueryChange(suggestions[selectedSuggestion]);
            setShowSuggestions(false);
            setSelectedSuggestion(-1);
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          setSelectedSuggestion(-1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSuggestions, suggestions, selectedSuggestion, onQueryChange]);

  const hasActiveFilters = Object.keys(options).some(key => {
    const value = options[key as keyof SearchOptions];
    return value !== undefined && value !== '' && 
           (!Array.isArray(value) || value.length > 0);
  });

  const handleDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    onOptionsChange({ [field]: value });
  };

  const handleAmountChange = (field: 'amountMin' | 'amountMax', value: string) => {
    const numValue = value ? parseFloat(value) : undefined;
    onOptionsChange({ [field]: numValue });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Search Bar */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                onQueryChange(e.target.value);
                setShowSuggestions(true);
                setSelectedSuggestion(-1);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={naturalLanguageMode 
                ? "Try 'expenses over $100 last month' or 'income this year'"
                : "Search transactions, accounts, categories..."
              }
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors ${
                naturalLanguageMode 
                  ? 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20' 
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
              } text-gray-900 dark:text-white`}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          {/* Natural Language Toggle */}
          {onNaturalLanguageModeChange && (
            <Button
              variant={naturalLanguageMode ? 'primary' : 'secondary'}
              size="md"
              onClick={() => onNaturalLanguageModeChange(!naturalLanguageMode)}
              leftIcon={SparklesIcon}
              title="Toggle natural language search"
            >
              AI
            </Button>
          )}

          {/* Filter Button */}
          <Button
            variant={hasActiveFilters ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={FilterIcon}
            title="Advanced filters"
          >
            Filters {hasActiveFilters && `(${Object.keys(options).length})`}
          </Button>

          {/* Clear Button */}
          {(query || hasActiveFilters) && (
            <Button
              variant="ghost"
              size="md"
              onClick={onClear}
              leftIcon={XIcon}
              title="Clear search"
            />
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  onQueryChange(suggestion);
                  setShowSuggestions(false);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  index === selectedSuggestion ? 'bg-gray-100 dark:bg-gray-700' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900 dark:text-white">{suggestion}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search Results Summary */}
      {totalResults > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{totalResults} results found</span>
          {aggregations && (
            <div className="flex items-center gap-4">
              {aggregations.totalAmount !== undefined && (
                <span>
                  Total: {formatCurrency(Math.abs(aggregations.totalAmount))}
                </span>
              )}
              {aggregations.countByType && (
                <div className="flex items-center gap-2">
                  {Object.entries(aggregations.countByType).map(([type, count]) => (
                    <span key={type} className="capitalize">
                      {type}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Advanced Filters */}
      {showFilters && (
        <div className="p-4 bg-blue-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">Advanced Filters</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Date Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={options.dateFrom ? new Date(options.dateFrom).toISOString().split('T')[0] : ''}
                  onChange={(e) => handleDateChange('dateFrom', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={options.dateTo ? new Date(options.dateTo).toISOString().split('T')[0] : ''}
                  onChange={(e) => handleDateChange('dateTo', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>

            {/* Amount Range */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Amount Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Min"
                  value={options.amountMin || ''}
                  onChange={(e) => handleAmountChange('amountMin', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Max"
                  value={options.amountMax || ''}
                  onChange={(e) => handleAmountChange('amountMax', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>

            {/* Transaction Type */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Transaction Type
              </label>
              <div className="space-y-1">
                {['income', 'expense', 'transfer'].map(type => (
                  <label key={type} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.types?.includes(type as 'income' | 'expense' | 'transfer') || false}
                      onChange={(e) => {
                        const currentTypes = options.types || [];
                        const newTypes = e.target.checked
                          ? [...currentTypes, type as 'income' | 'expense' | 'transfer']
                          : currentTypes.filter(t => t !== type);
                        onOptionsChange({ types: newTypes.length > 0 ? newTypes : undefined });
                      }}
                      className="rounded text-gray-600 focus:ring-gray-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                      {type}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Status
              </label>
              <select
                value={options.cleared === true ? 'cleared' : options.cleared === false ? 'uncleared' : 'all'}
                onChange={(e) => {
                  const value = e.target.value;
                  onOptionsChange({
                    cleared: value === 'all' ? undefined : value === 'cleared'
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All</option>
                <option value="cleared">Cleared</option>
                <option value="uncleared">Uncleared</option>
              </select>
            </div>

            {/* Sort By */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Sort By
              </label>
              <select
                value={options.sortBy || 'date'}
                onChange={(e) => onOptionsChange({ sortBy: e.target.value as 'date' | 'amount' | 'description' | 'relevance' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="date">Date</option>
                <option value="amount">Amount</option>
                <option value="description">Description</option>
                <option value="relevance">Relevance</option>
              </select>
            </div>

            {/* Sort Order */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Sort Order
              </label>
              <select
                value={options.sortOrder || 'desc'}
                onChange={(e) => onOptionsChange({ sortOrder: e.target.value as 'asc' | 'desc' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Date Filters</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Today', value: 'today' },
                { label: 'This Week', value: 'this week' },
                { label: 'This Month', value: 'this month' },
                { label: 'Last Month', value: 'last month' },
                { label: 'This Year', value: 'this year' },
              ].map(preset => (
                <button
                  key={preset.value}
                  onClick={() => {
                    const parsed = searchService.parseNaturalLanguageQuery(preset.value);
                    onOptionsChange({
                      dateFrom: parsed.dateFrom,
                      dateTo: parsed.dateTo
                    });
                  }}
                  className="px-3 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}