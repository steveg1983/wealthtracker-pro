import React from 'react';
import { SearchIcon, PlusIcon } from '../icons';
import { CategorySections } from './CategorySections';
import type { Category } from '../../types';

interface CategoryDropdownProps {
  search: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showCreateOption: boolean;
  onCreateCategory?: () => void;
  processedCategories: Category[];
  categorySections: Array<{ title: string; items: Category[] }>;
  onCategorySelect: (categoryId: string) => void;
  recentCategories: string[];
  frequentCategories: Map<string, number>;
  showAll: boolean;
  onShowAll: () => void;
}

export function CategoryDropdown({
  search,
  onSearchChange,
  showCreateOption,
  onCreateCategory,
  processedCategories,
  categorySections,
  onCategorySelect,
  recentCategories,
  frequentCategories,
  showAll,
  onShowAll
}: CategoryDropdownProps): React.JSX.Element {
  return (
    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Search input */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={onSearchChange}
            placeholder="Search categories..."
            className="w-full pl-10 pr-3 py-2 bg-blue-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            autoFocus
          />
        </div>
      </div>

      {/* Quick actions */}
      {showCreateOption && search && processedCategories.length === 0 && onCreateCategory && (
        <button
          onClick={onCreateCategory}
          className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
        >
          <PlusIcon size={18} className="text-primary" />
          <span>Create "{search}"</span>
        </button>
      )}

      {/* Category list */}
      <div style={{ maxHeight: '400px', overflow: 'auto' }}>
        <CategorySections
          sections={categorySections}
          onCategorySelect={onCategorySelect}
          recentCategories={recentCategories}
          frequentCategories={frequentCategories}
        />
        
        {/* Show all button */}
        {!showAll && !search && processedCategories.length > 20 && (
          <button
            onClick={onShowAll}
            className="w-full px-4 py-3 text-center text-primary hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-sm font-medium"
          >
            Show all {processedCategories.length} categories
          </button>
        )}
      </div>

      {/* Footer with stats */}
      <div className="px-4 py-2 bg-blue-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
        {processedCategories.length} categories • {recentCategories.length} recent
      </div>
    </div>
  );
}