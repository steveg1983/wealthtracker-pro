import React, { useEffect, memo } from 'react';
import { TagIcon, PlusIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface CategorySelectorProps {
  subCategory: string;
  category: string;
  availableSubCategories: Array<{ id: string; name: string }>;
  detailCategories: Array<{ id: string; name: string }>;
  onSubCategoryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onCreateNew: () => void;
}

export const CategorySelector = memo(function CategorySelector({ subCategory,
  category,
  availableSubCategories,
  detailCategories,
  onSubCategoryChange,
  onCategoryChange,
  onCreateNew
 }: CategorySelectorProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('CategorySelector component initialized', {
      componentName: 'CategorySelector'
    });
  }, []);

  return (
    <div className="md:col-span-12 space-y-3">
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <TagIcon size={16} />
            Category
          </label>
          <button
            type="button"
            onClick={onCreateNew}
            className="text-sm text-primary hover:text-secondary flex items-center gap-1"
          >
            <PlusIcon size={14} />
            Create new category
          </button>
        </div>
        <select
          value={subCategory}
          onChange={(e) => {
            onSubCategoryChange(e.target.value);
            onCategoryChange('');
          }}
          className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
          required
        >
          <option value="">Select category</option>
          {availableSubCategories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {subCategory && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <div className="w-4 h-4"></div>
            Sub-category
          </label>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
            required
          >
            <option value="">Select sub-category</option>
            {detailCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
});