import React, { memo } from 'react';
import { CalendarIcon, TagIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface AdjustmentFormProps {
  adjustmentDate: string;
  description: string;
  notes: string;
  subCategory: string;
  category: string;
  availableSubCategories: Array<{ id: string; name: string }>;
  getDetailCategories: (parentId: string) => Array<{ id: string; name: string }>;
  onDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDescriptionChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNotesChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubCategoryChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onCategoryChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onShowCategoryModal: () => void;
}

/**
 * Form fields for balance adjustment details
 * Handles date, description, categories and notes input
 */
export const AdjustmentForm = memo(function AdjustmentForm({ adjustmentDate,
  description,
  notes,
  subCategory,
  category,
  availableSubCategories,
  getDetailCategories,
  onDateChange,
  onDescriptionChange,
  onNotesChange,
  onSubCategoryChange,
  onCategoryChange,
  onShowCategoryModal
 }: AdjustmentFormProps): React.JSX.Element {
  const logger = useLogger();
  try {
    return (
      <div className="space-y-4">
        {/* Date */}
        <div>
          <label htmlFor="adjustment-date" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <CalendarIcon size={16} />
            Date
          </label>
          <input
            id="adjustment-date"
            type="date"
            value={adjustmentDate}
            onChange={onDateChange}
            className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
            required
          />
        </div>
        
        {/* Description */}
        <div>
          <label htmlFor="adjustment-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <input
            id="adjustment-description"
            type="text"
            value={description}
            onChange={onDescriptionChange}
            className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
            required
          />
        </div>
        
        {/* Category Selection */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="adjustment-category" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <TagIcon size={16} />
                Category
              </label>
              <button
                type="button"
                onClick={onShowCategoryModal}
                className="text-sm text-primary hover:text-secondary"
              >
                Create new
              </button>
            </div>
            <select
              id="adjustment-category"
              value={subCategory}
              onChange={onSubCategoryChange}
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select category</option>
              {availableSubCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          
          {/* Detail category */}
          {subCategory && (
            <div>
              <label htmlFor="adjustment-subcategory" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sub-category
              </label>
              <select
                id="adjustment-subcategory"
                value={category}
                onChange={onCategoryChange}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
              >
                <option value="cat-blank">Blank (No category)</option>
                {getDetailCategories(subCategory).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        {/* Notes */}
        <div>
          <label htmlFor="adjustment-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes (optional)
          </label>
          <textarea
            id="adjustment-notes"
            value={notes}
            onChange={onNotesChange}
            rows={3}
            placeholder="Add any notes about this adjustment..."
            className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>
    );
  } catch (error) {
    logger.error('AdjustmentForm render error:', error);
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400 text-sm">
          Error loading adjustment form
        </p>
      </div>
    );
  }
});