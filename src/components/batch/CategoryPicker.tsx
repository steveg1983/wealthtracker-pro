/**
 * Category Picker Component
 * Modal for selecting a category
 */

import React, { useEffect, memo, useCallback } from 'react';
import { Button } from '../common/Button';
import { logger } from '../../services/loggingService';

interface CategoryPickerProps {
  categories: { id: string; name: string }[];
  onSelect: (categoryId: string) => void;
  onClose: () => void;
}

export const CategoryPicker = memo(function CategoryPicker({
  categories,
  onSelect,
  onClose
}: CategoryPickerProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('CategoryPicker component initialized', {
      componentName: 'CategoryPicker'
    });
  }, []);

  
  const handleCategorySelect = useCallback((categoryId: string) => {
    onSelect(categoryId);
    onClose();
  }, [onSelect, onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[60vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Select Category
          </h3>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(60vh-120px)]">
          <div className="space-y-1">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category.id)}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-gray-900 dark:text-white">{category.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="secondary"
            fullWidth
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
});