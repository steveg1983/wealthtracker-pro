import React, { useCallback, useMemo, useState, useEffect, memo } from 'react';
import { VirtualizedCategorySelector } from './VirtualizedCategorySelector';
import type { Category } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface InlineCategorySelectorProps {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string) => void;
  className?: string;
}

/**
 * Inline category selector for transaction rows
 * Optimized for performance in virtualized lists
 */
export const InlineCategorySelector = memo(function InlineCategorySelector({ categories,
  value,
  onChange,
  className = ''
 }: InlineCategorySelectorProps): React.JSX.Element {
  const logger = useLogger();
  const [isEditing, setIsEditing] = useState(false);
  
  // Component initialization logging
  useEffect(() => {
    logger.debug('InlineCategorySelector component initialized', {
      componentName: 'InlineCategorySelector',
      categoriesCount: categories.length,
      value,
      isEditing
    });
  }, [categories.length, value, isEditing]);
  
  const selectedCategory = useMemo(() => 
    categories.find(cat => cat.id === value), 
    [categories, value]
  );

    const handleToggleEditing = useCallback(() => {
      try {
        logger.debug('Toggling inline category editor', { wasEditing: isEditing });
        setIsEditing(true);
      } catch (error) {
        logger.error('Error toggling editing mode:', error);
      }
    }, [isEditing]);

    const handleChange = useCallback((categoryId: string) => {
      try {
        logger.debug('Inline category changed', { categoryId });
        onChange(categoryId);
        setIsEditing(false);
      } catch (error) {
        logger.error('Error changing inline category:', error);
      }
    }, [onChange]);

    if (!isEditing) {
      try {
        return (
        <button
          onClick={handleToggleEditing}
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${className}`}
        >
          {selectedCategory ? (
            <>
              {selectedCategory.icon && <span className="text-sm">{selectedCategory.icon}</span>}
              <span className="text-sm font-medium">{selectedCategory.name}</span>
            </>
          ) : (
            <span className="text-sm text-gray-500">No category</span>
          )}
        </button>
      );
      } catch (error) {
        logger.error('InlineCategorySelector render error (button):', error);
        return <></>;
      }
    }

    try {
      return (
      <VirtualizedCategorySelector
        categories={categories}
        value={value}
        onChange={handleChange}
        className={className}
      />
    );
  } catch (error) {
    logger.error('InlineCategorySelector render error:', error);
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 ${className}`}>
        <span className="text-xs text-red-600 dark:text-red-400">Error loading selector</span>
      </div>
    );
  }
});