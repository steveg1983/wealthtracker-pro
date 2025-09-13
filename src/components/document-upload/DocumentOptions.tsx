import { memo } from 'react';
import { TagIcon, XIcon } from '../icons';
import { DocumentUploadService } from '../../services/documentUploadService';
import type { DocumentOptions } from '../../services/documentUploadService';
import { logger } from '../../services/loggingService';

interface DocumentOptionsProps {
  options: DocumentOptions;
  tagInput: string;
  onOptionsChange: (options: DocumentOptions) => void;
  onTagInputChange: (value: string) => void;
  onAddTag: () => void;
}

/**
 * Document options configuration component
 */
export const DocumentOptionsComponent = memo(function DocumentOptionsComponent({
  options,
  tagInput,
  onOptionsChange,
  onTagInputChange,
  onAddTag
}: DocumentOptionsProps) {
  const documentTypes = DocumentUploadService.getDocumentTypes();

  const removeTag = (tag: string) => {
    onOptionsChange({
      ...options,
      tags: options.tags.filter(t => t !== tag)
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAddTag();
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
      {/* Document Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Document Type
        </label>
        <select
          value={options.type}
          onChange={(e) => onOptionsChange({ ...options, type: e.target.value as any })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {documentTypes.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tags
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {options.tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-gray-900/20 text-blue-700 dark:text-gray-300 rounded-full text-sm"
            >
              <TagIcon size={12} />
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="hover:text-red-600"
              >
                <XIcon size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add tag..."
            value={tagInput}
            onChange={(e) => onTagInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          <button
            onClick={onAddTag}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500"
          >
            Add
          </button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notes
        </label>
        <textarea
          value={options.notes}
          onChange={(e) => onOptionsChange({ ...options, notes: e.target.value })}
          placeholder="Add any notes about these documents..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          rows={2}
        />
      </div>

      {/* Extract Data Checkbox */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={options.extractData}
          onChange={(e) => onOptionsChange({ ...options, extractData: e.target.checked })}
          className="rounded"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Extract data from documents (OCR)
        </span>
      </label>
    </div>
  );
});