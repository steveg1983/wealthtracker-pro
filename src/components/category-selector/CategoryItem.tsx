import React, { useCallback } from 'react';
import { FolderIcon } from '../icons';
import type { Category } from '../../types';
import { logger } from '../../services/loggingService';

interface CategoryItemProps {
  category: Category;
  isRecent: boolean;
  frequency: number;
  onSelect: (categoryId: string) => void;
}

export function CategoryItem({ 
  category, 
  isRecent, 
  frequency, 
  onSelect 
}: CategoryItemProps): React.JSX.Element {
  const isFrequent = frequency > 5;
  
  const handleClick = useCallback(() => {
    try {
      logger.debug('Category selected', { categoryId: category.id, name: category.name });
      onSelect(category.id);
    } catch (error) {
      logger.error('Error selecting category:', error);
    }
  }, [category.id, category.name, onSelect]);

  return (
    <div
      className="flex items-center justify-between px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
      onClick={handleClick}
    >
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded ${
          category.color ? '' : 'bg-gray-100 dark:bg-gray-700'
        }`} style={{ backgroundColor: category.color }}>
          {category.icon ? (
            <span className="text-lg">{category.icon}</span>
          ) : (
            <FolderIcon size={16} className="text-gray-600 dark:text-gray-400" />
          )}
        </div>
        
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {category.name}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isRecent && (
          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-500 rounded">
            Recent
          </span>
        )}
        {isFrequent && (
          <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
            {frequency}x
          </span>
        )}
      </div>
    </div>
  );
}
