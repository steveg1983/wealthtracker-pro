import React from 'react';
import { FolderIcon } from '../icons';
import type { Category } from '../../types';

interface CategorySelectorButtonProps {
  selectedCategory?: Category;
  placeholder: string;
  onClick: () => void;
  className?: string;
}

export function CategorySelectorButton({ 
  selectedCategory, 
  placeholder, 
  onClick, 
  className = '' 
}: CategorySelectorButtonProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors text-left ${className}`}
    >
      {selectedCategory ? (
        <div className="flex items-center gap-3">
          <div 
            className="p-1 rounded"
            style={{ backgroundColor: selectedCategory.color || '#e5e7eb' }}
          >
            {selectedCategory.icon ? (
              <span className="text-sm">{selectedCategory.icon}</span>
            ) : (
              <FolderIcon size={14} />
            )}
          </div>
          <span className="text-gray-900 dark:text-white">
            {selectedCategory.name}
          </span>
        </div>
      ) : (
        <span className="text-gray-500">{placeholder}</span>
      )}
    </button>
  );
}