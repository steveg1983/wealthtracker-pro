import React, { useState } from 'react';
import { CheckSquareIcon, XIcon, TagIcon, FolderIcon, TrashIcon, DownloadIcon, CheckCircleIcon, XCircleIcon, MoreVerticalIcon } from './icons';
import { Button } from './common/Button';
import { formatCurrency } from '../utils/formatters';
import type { BatchOperation } from '../hooks/useBatchOperations';

interface BatchOperationsToolbarProps {
  selectedCount: number;
  isAllSelected: boolean;
  isPartiallySelected: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onInvertSelection: () => void;
  operations: BatchOperation[];
  isProcessing: boolean;
  selectionStats?: {
    count: number;
    totalAmount: number;
    income: number;
    expenses: number;
  };
  onCategorySelect?: (categoryId: string) => void;
  onTagsSelect?: (tags: string[]) => void;
  categories?: { id: string; name: string }[];
  className?: string;
}

export function BatchOperationsToolbar({
  selectedCount,
  isAllSelected,
  isPartiallySelected,
  onSelectAll,
  onClearSelection,
  onInvertSelection,
  operations,
  isProcessing,
  selectionStats,
  onCategorySelect,
  onTagsSelect,
  categories = [],
  className = ''
}: BatchOperationsToolbarProps): React.JSX.Element | null {
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  const handleOperation = async (operation: BatchOperation) => {
    if (operation.id === 'categorize') {
      setShowCategoryPicker(true);
      return;
    }
    if (operation.id === 'tag') {
      setShowTagPicker(true);
      return;
    }
    
    if (operation.requiresConfirmation && operation.confirmMessage) {
      const confirmed = confirm(operation.confirmMessage(selectedCount));
      if (!confirmed) return;
    }
    
    await operation.action([]);
  };

  // Primary operations to show in toolbar
  const primaryOps = operations.filter(op => 
    ['categorize', 'tag', 'clear', 'delete'].includes(op.id)
  );
  const secondaryOps = operations.filter(op => 
    !['categorize', 'tag', 'clear', 'delete'].includes(op.id)
  );

  return (
    <div className={`bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 shadow-md border-l-4 border-amber-400 dark:border-amber-600 ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Selection Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={isAllSelected ? onClearSelection : onSelectAll}
              className="p-2 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded transition-colors"
              title={isAllSelected ? 'Clear selection' : 'Select all'}
            >
              <CheckSquareIcon 
                className={`h-5 w-5 ${
                  isAllSelected ? 'text-blue-600' : 
                  isPartiallySelected ? 'text-blue-400' : 
                  'text-gray-400'
                }`} 
              />
            </button>
            <span className="font-medium text-gray-900 dark:text-white">
              {selectedCount} selected
            </span>
            <button
              onClick={onClearSelection}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded transition-colors"
              title="Clear selection"
            >
              <XIcon className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          {/* Selection Stats */}
          {selectionStats && (
            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-3">
              <span>Total: {formatCurrency(Math.abs(selectionStats.totalAmount))}</span>
              {selectionStats.income > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  +{formatCurrency(selectionStats.income)}
                </span>
              )}
              {selectionStats.expenses > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  -{formatCurrency(selectionStats.expenses)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {primaryOps.map(operation => (
            <Button
              key={operation.id}
              variant={operation.variant || 'secondary'}
              size="sm"
              onClick={() => handleOperation(operation)}
              disabled={isProcessing}
              leftIcon={
                operation.id === 'categorize' ? FolderIcon :
                operation.id === 'tag' ? TagIcon :
                operation.id === 'clear' ? CheckCircleIcon :
                operation.id === 'delete' ? TrashIcon :
                undefined
              }
            >
              {operation.label}
            </Button>
          ))}

          {/* More Menu */}
          {secondaryOps.length > 0 && (
            <div className="relative">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                leftIcon={MoreVerticalIcon}
              >
                More
              </Button>
              
              {showMoreMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMoreMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                    <div className="py-1">
                      {secondaryOps.map(operation => (
                        <button
                          key={operation.id}
                          onClick={() => {
                            handleOperation(operation);
                            setShowMoreMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                          disabled={isProcessing}
                        >
                          {operation.label}
                        </button>
                      ))}
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      <button
                        onClick={() => {
                          onInvertSelection();
                          setShowMoreMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        Invert Selection
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Category Picker Modal */}
      {showCategoryPicker && onCategorySelect && (
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
                    onClick={() => {
                      onCategorySelect(category.id);
                      setShowCategoryPicker(false);
                    }}
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
                onClick={() => setShowCategoryPicker(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Picker Modal */}
      {showTagPicker && onTagsSelect && (
        <TagPicker
          onSelect={(tags) => {
            onTagsSelect(tags);
            setShowTagPicker(false);
          }}
          onClose={() => setShowTagPicker(false)}
        />
      )}
    </div>
  );
}

// Simple tag picker component
function TagPicker({ 
  onSelect, 
  onClose 
}: { 
  onSelect: (tags: string[]) => void; 
  onClose: () => void;
}): React.JSX.Element {
  const [inputValue, setInputValue] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const commonTags = ['Recurring', 'Business', 'Personal', 'Tax Deductible', 'Review Later'];

  const handleAddTag = () => {
    if (inputValue.trim() && !selectedTags.includes(inputValue.trim())) {
      setSelectedTags([...selectedTags, inputValue.trim()]);
      setInputValue('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Tags
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Common Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {commonTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    if (!selectedTags.includes(tag)) {
                      setSelectedTags([...selectedTags, tag]);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Tag
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Enter tag name"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <Button onClick={handleAddTag} size="sm">
                Add
              </Button>
            </div>
          </div>

          {selectedTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Selected Tags ({selectedTags.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded-full text-sm flex items-center gap-1"
                  >
                    {tag}
                    <button
                      onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                      className="hover:text-blue-900 dark:hover:text-blue-100"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={() => onSelect(selectedTags)}
            disabled={selectedTags.length === 0}
          >
            Apply Tags
          </Button>
        </div>
      </div>
    </div>
  );
}