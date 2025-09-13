import React, { useEffect, memo } from 'react';
import { Settings2Icon, PlusIcon, XIcon, DeleteIcon } from '../icons';
import { IconButton } from '../icons/IconButton';
import { logger } from '../../services/loggingService';

interface CategoryHeaderProps {
  isEditMode: boolean;
  isDeleteMode: boolean;
  categoryCount: number;
  onToggleEditMode: () => void;
  onToggleDeleteMode: () => void;
  onAddCategory: () => void;
}

export const CategoryHeader = memo(function CategoryHeader({
  isEditMode,
  isDeleteMode,
  categoryCount,
  onToggleEditMode,
  onToggleDeleteMode,
  onAddCategory
}: CategoryHeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('CategoryHeader component initialized', {
      componentName: 'CategoryHeader'
    });
  }, []);

  
  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm rounded-full">
          {categoryCount} total
        </span>
      </div>
      
      <div className="flex gap-2">
        {!isEditMode && !isDeleteMode && (
          <IconButton
            onClick={onAddCategory}
            icon={<PlusIcon className="w-4 h-4" />}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            title="Add Category"
            aria-label="Add Category"
          />
        )}
        
        {isEditMode && (
          <IconButton
            onClick={onAddCategory}
            icon={<PlusIcon className="w-4 h-4" />}
            variant="secondary"
            title="Add"
            aria-label="Add"
          />
        )}
        
        {!isDeleteMode && (
          <IconButton
            onClick={onToggleEditMode}
            icon={isEditMode ? <XIcon className="w-4 h-4" /> : <Settings2Icon className="w-4 h-4" />}
            variant={isEditMode ? "secondary" : "ghost"}
            title={isEditMode ? 'Done' : 'Edit'}
            aria-label={isEditMode ? 'Done' : 'Edit'}
          />
        )}
        
        {!isEditMode && (
          <IconButton
            onClick={onToggleDeleteMode}
            icon={isDeleteMode ? <XIcon className="w-4 h-4" /> : <DeleteIcon className="w-4 h-4" />}
            variant={isDeleteMode ? "danger" : "ghost"}
            title={isDeleteMode ? 'Cancel' : 'Delete'}
            aria-label={isDeleteMode ? 'Cancel' : 'Delete'}
          />
        )}
      </div>
    </div>
  );
});
