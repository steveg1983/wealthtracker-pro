import React, { useCallback, useMemo, useState, useRef, useEffect, memo } from 'react';
import { CategorySelectorButton } from './CategorySelectorButton';
import { CategoryDropdown } from './CategoryDropdown';
import { useCategoryProcessor } from './useCategoryProcessor';
import type { Category } from '../../types';
import { logger } from '../../services/loggingService';

interface VirtualizedCategorySelectorProps {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string) => void;
  showCreateOption?: boolean;
  onCreateCategory?: (name: string) => void;
  recentCategories?: string[];
  frequentCategories?: Map<string, number>;
  className?: string;
  placeholder?: string;
}

/**
 * High-performance category selector for large category lists
 * Features smart sorting, search, and quick access to frequent categories
 */
export const VirtualizedCategorySelector = memo(function VirtualizedCategorySelector({
  categories,
  value,
  onChange,
  showCreateOption = true,
  onCreateCategory,
  recentCategories = [],
  frequentCategories = new Map(),
  className = '',
  placeholder = 'Select category...'
}: VirtualizedCategorySelectorProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Component initialization logging
  useEffect(() => {
    logger.info('VirtualizedCategorySelector component initialized', {
      componentName: 'VirtualizedCategorySelector',
      categoriesCount: categories.length,
      value,
      showCreateOption,
      recentCount: recentCategories.length,
      frequentCount: frequentCategories.size
    });
    }, [categories.length, value, showCreateOption, recentCategories.length, frequentCategories.size]);

    // Use custom hook for category processing
    const { processedCategories, categorySections } = useCategoryProcessor({
      categories,
      search,
      showAll,
      recentCategories,
      frequentCategories
    });

    // Get selected category
    const selectedCategory = useMemo(() => 
      categories.find(cat => cat.id === value), 
      [categories, value]
    );

    // Close on outside click
    const handleClickOutside = useCallback((e: MouseEvent) => {
      try {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
          logger.debug('Category selector closed by outside click');
          setIsOpen(false);
        }
      } catch (error) {
        logger.error('Error in outside click handler:', error);
      }
    }, []);
    
    useEffect(() => {
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen, handleClickOutside]);
    
    // Event handlers with logging and error handling
    const handleToggleOpen = useCallback(() => {
      try {
        logger.debug('Category selector toggled', { wasOpen: isOpen });
        setIsOpen(!isOpen);
      } catch (error) {
        logger.error('Error toggling category selector:', error);
      }
    }, [isOpen]);
    
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      try {
        const newSearch = e.target.value;
        logger.debug('Category search changed', { search: newSearch });
        setSearch(newSearch);
      } catch (error) {
        logger.error('Error handling search change:', error);
      }
    }, []);
    
    const handleCreateCategory = useCallback(() => {
      try {
        logger.info('Creating new category', { name: search });
        onCreateCategory?.(search);
        setIsOpen(false);
        setSearch('');
      } catch (error) {
        logger.error('Error creating category:', error);
      }
    }, [search, onCreateCategory]);
    
    const handleShowAll = useCallback(() => {
      try {
        logger.debug('Show all categories clicked');
        setShowAll(true);
      } catch (error) {
        logger.error('Error showing all categories:', error);
      }
    }, []);

    const handleCategorySelect = useCallback((categoryId: string) => {
      try {
        onChange(categoryId);
        setIsOpen(false);
        setSearch('');
      } catch (error) {
        logger.error('Error selecting category:', error);
      }
    }, [onChange]);

    try {
      return (
      <div ref={dropdownRef} className={`relative ${className}`}>
        <CategorySelectorButton
          selectedCategory={selectedCategory}
          placeholder={placeholder}
          onClick={handleToggleOpen}
        />

        {isOpen && (
          <CategoryDropdown
            search={search}
            onSearchChange={handleSearchChange}
            showCreateOption={showCreateOption}
            {...(onCreateCategory ? { onCreateCategory: handleCreateCategory } : {})}
            processedCategories={processedCategories}
            categorySections={categorySections}
            onCategorySelect={handleCategorySelect}
            recentCategories={recentCategories}
            frequentCategories={frequentCategories}
            showAll={showAll}
            onShowAll={handleShowAll}
          />
        )}
      </div>
    );
  } catch (error) {
    logger.error('VirtualizedCategorySelector render error:', error);
    return (
      <div className={`relative ${className}`}>
        <div className="w-full px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
          <div className="text-red-600 dark:text-red-400 text-sm">
            Category selector unavailable
          </div>
        </div>
      </div>
    );
  }
});
