/**
 * Custom Hook for Enhanced Search Bar
 * Manages search bar state and keyboard navigation
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { enhancedSearchBarService } from '../services/enhancedSearchBarService';
import type { SearchOptions } from '../services/searchService';

export interface UseEnhancedSearchBarReturn {
  showFilters: boolean;
  showSuggestions: boolean;
  selectedSuggestion: number;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  inputRef: React.RefObject<HTMLInputElement>;
  setShowFilters: (show: boolean) => void;
  handleDateChange: (field: 'dateFrom' | 'dateTo', value: string) => void;
  handleAmountChange: (field: 'amountMin' | 'amountMax', value: string) => void;
  handleQueryChange: (value: string) => void;
  handleSuggestionSelect: (suggestion: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleInputFocus: () => void;
  handleInputBlur: () => void;
  resetFilters: () => void;
}

export function useEnhancedSearchBar(
  query: string,
  onQueryChange: (query: string) => void,
  options: SearchOptions,
  onOptionsChange: (options: Partial<SearchOptions>) => void,
  suggestions: string[] = []
): UseEnhancedSearchBarReturn {
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasActiveFilters = enhancedSearchBarService.hasActiveFilters(options);
  const activeFilterCount = enhancedSearchBarService.getActiveFilterCount(options);

  // Handle date change
  const handleDateChange = useCallback((field: 'dateFrom' | 'dateTo', value: string) => {
    onOptionsChange({ [field]: value });
  }, [onOptionsChange]);

  // Handle amount change
  const handleAmountChange = useCallback((field: 'amountMin' | 'amountMax', value: string) => {
    const numValue = enhancedSearchBarService.parseAmountInput(value);
    onOptionsChange({ [field]: numValue });
  }, [onOptionsChange]);

  // Handle query change
  const handleQueryChange = useCallback((value: string) => {
    onQueryChange(value);
    setShowSuggestions(true);
    setSelectedSuggestion(-1);
  }, [onQueryChange]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: string) => {
    onQueryChange(suggestion);
    setShowSuggestions(false);
    setSelectedSuggestion(-1);
    inputRef.current?.blur();
  }, [onQueryChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestion(prev => 
          enhancedSearchBarService.getNextSuggestionIndex(prev, 'down', suggestions.length)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestion(prev => 
          enhancedSearchBarService.getNextSuggestionIndex(prev, 'up', suggestions.length)
        );
        break;
      case 'Enter':
        if (selectedSuggestion >= 0) {
          e.preventDefault();
          handleSuggestionSelect(suggestions[selectedSuggestion]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestion(-1);
        break;
    }
  }, [showSuggestions, suggestions, selectedSuggestion, handleSuggestionSelect]);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    if (query.length > 0 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [query, suggestions]);

  // Handle input blur
  const handleInputBlur = useCallback(() => {
    // Delay to allow click on suggestion
    setTimeout(() => setShowSuggestions(false), 200);
  }, []);

  // Reset filters
  const resetFilters = useCallback(() => {
    onOptionsChange(enhancedSearchBarService.getDefaultFilters());
    setShowFilters(false);
  }, [onOptionsChange]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return {
    showFilters,
    showSuggestions,
    selectedSuggestion,
    hasActiveFilters,
    activeFilterCount,
    inputRef,
    setShowFilters,
    handleDateChange,
    handleAmountChange,
    handleQueryChange,
    handleSuggestionSelect,
    handleKeyDown,
    handleInputFocus,
    handleInputBlur,
    resetFilters
  };
}