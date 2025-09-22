import React, { useEffect, memo } from 'react';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import { CheckIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  level: 'type' | 'sub' | 'detail';
  parentId?: string;
}

interface CategoryExclusionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  excludedCategories: string[];
  onToggleCategory: (categoryId: string) => void;
}

export const CategoryExclusionModal = memo(function CategoryExclusionModal({ isOpen,
  onClose,
  categories,
  excludedCategories,
  onToggleCategory
 }: CategoryExclusionModalProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('CategoryExclusionModal component initialized', {
      componentName: 'CategoryExclusionModal'
    });
  }, []);

  const getCategoryHierarchy = () => {
    const typeCategories = categories.filter(c => c.level === 'type');
    const result: Array<{ category: Category; children: Category[] }> = [];
    
    typeCategories.forEach(typeCategory => {
      const children = categories.filter(c => c.parentId === typeCategory.id);
      result.push({ category: typeCategory, children });
    });
    
    return result;
  };

  const hierarchy = getCategoryHierarchy();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Categories" size="md">
      <ModalBody>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select categories to include in the report. Unchecked categories will be excluded.
        </p>
        
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {hierarchy.map(({ category: parent, children }) => (
            <div key={parent.id} className="space-y-2">
              {/* Parent Category */}
              <label className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={!excludedCategories.includes(parent.id)}
                    onChange={() => onToggleCategory(parent.id)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 ${
                    !excludedCategories.includes(parent.id)
                      ? 'bg-primary border-primary'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {!excludedCategories.includes(parent.id) && (
                      <CheckIcon size={16} className="text-white" />
                    )}
                  </div>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {parent.name}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  parent.type === 'income' 
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                }`}>
                  {parent.type}
                </span>
              </label>
              
              {/* Child Categories */}
              {children.length > 0 && (
                <div className="ml-6 space-y-1">
                  {children.map(child => (
                    <label 
                      key={child.id}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={!excludedCategories.includes(child.id)}
                          onChange={() => onToggleCategory(child.id)}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded border-2 ${
                          !excludedCategories.includes(child.id)
                            ? 'bg-primary border-primary'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {!excludedCategories.includes(child.id) && (
                            <CheckIcon size={16} className="text-white" />
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {child.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </ModalBody>
      
      <ModalFooter>
        <button
          onClick={() => {
            // Select all
            categories.forEach(c => {
              if (excludedCategories.includes(c.id)) {
                onToggleCategory(c.id);
              }
            });
          }}
          className="px-4 py-2 text-sm text-primary hover:underline"
        >
          Select All
        </button>
        <button
          onClick={() => {
            // Deselect all
            categories.forEach(c => {
              if (!excludedCategories.includes(c.id)) {
                onToggleCategory(c.id);
              }
            });
          }}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:underline"
        >
          Deselect All
        </button>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
        >
          Done
        </button>
      </ModalFooter>
    </Modal>
  );
});