/**
 * Tag Picker Component
 * Modal for selecting and adding tags
 */

import React, { useEffect, useState, useCallback, memo } from 'react';
import { XIcon } from '../icons';
import { Button } from '../common/Button';
import { batchOperationsToolbarService } from '../../services/batchOperationsToolbarService';
import { useLogger } from '../services/ServiceProvider';

interface TagPickerProps {
  onSelect: (tags: string[]) => void;
  onClose: () => void;
}

export const TagPicker = memo(function TagPicker({ onSelect, 
  onClose 
 }: TagPickerProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('TagPicker component initialized', {
      componentName: 'TagPicker'
    });
  }, []);

  const [inputValue, setInputValue] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const commonTags = batchOperationsToolbarService.getCommonTags();

  const handleAddTag = useCallback(() => {
    if (batchOperationsToolbarService.validateTag(inputValue, selectedTags)) {
      setSelectedTags([...selectedTags, inputValue.trim()]);
      setInputValue('');
    }
  }, [inputValue, selectedTags]);

  const handleToggleTag = useCallback((tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  }, [selectedTags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  }, [selectedTags]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTag();
    }
  }, [handleAddTag]);

  const handleApply = useCallback(() => {
    onSelect(selectedTags);
  }, [selectedTags, onSelect]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Tags
          </h3>
        </div>
        <div className="p-4 space-y-4">
          {/* Common Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Common Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {commonTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleToggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-100 text-blue-800 dark:bg-gray-900/30 dark:text-blue-200'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Tag Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Tag
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter tag name"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <Button onClick={handleAddTag} size="sm">
                Add
              </Button>
            </div>
          </div>

          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Selected Tags ({selectedTags.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-gray-900/30 dark:text-blue-200 rounded-full text-sm flex items-center gap-1"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
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
        
        {/* Footer Actions */}
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
            onClick={handleApply}
            disabled={selectedTags.length === 0}
          >
            Apply Tags
          </Button>
        </div>
      </div>
    </div>
  );
});