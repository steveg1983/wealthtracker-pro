/**
 * CategoryCreationModal Component - Modal for creating new transaction categories
 *
 * Features:
 * - Category name input
 * - Color picker
 * - Icon selection
 * - Parent category selection
 * - Category type (income/expense)
 * - Validation and error handling
 */

import React, { useState } from 'react';
import { lazyLogger } from '../services/serviceFactory';

const logger = lazyLogger.getLogger('CategoryCreationModal');

export interface CategoryCreationData {
  name: string;
  description?: string;
  color: string;
  icon: string;
  type: 'income' | 'expense';
  parent_id?: string;
  is_subcategory: boolean;
  budget_limit?: number;
  is_system: boolean;
  sort_order: number;
}

export interface CategoryOption {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: 'income' | 'expense';
  children?: CategoryOption[];
}

interface CategoryCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCategory: (categoryData: CategoryCreationData) => Promise<void>;
  existingCategories?: CategoryOption[];
  defaultType?: 'income' | 'expense';
  parentCategory?: CategoryOption;
  className?: string;
}

const PREDEFINED_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1',
  '#14B8A6', '#FACC15', '#DC2626', '#9333EA', '#0EA5E9',
  '#22C55E', '#EA580C', '#DB2777', '#7C3AED', '#0891B2'
];

const PREDEFINED_ICONS = [
  '🏠', '🚗', '🍔', '🛒', '⚡', '📱', '🎬', '🏥', '🎓', '✈️',
  '💰', '📊', '🎯', '🔧', '🎵', '📚', '🏋️', '🍽️', '👔', '🎨',
  '💡', '🔑', '🌟', '📝', '🎁', '🚀', '⭐', '🌈', '🔥', '💎'
];

export function CategoryCreationModal({
  isOpen,
  onClose,
  onCreateCategory,
  existingCategories = [],
  defaultType = 'expense',
  parentCategory,
  className = ''
}: CategoryCreationModalProps): React.JSX.Element {
  const [formData, setFormData] = useState<Partial<CategoryCreationData>>({
    name: '',
    description: '',
    color: PREDEFINED_COLORS[0],
    icon: PREDEFINED_ICONS[0],
    type: defaultType,
    parent_id: parentCategory?.id,
    is_subcategory: !!parentCategory,
    budget_limit: undefined,
    is_system: false,
    sort_order: 0
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({
        name: '',
        description: '',
        color: PREDEFINED_COLORS[0],
        icon: PREDEFINED_ICONS[0],
        type: defaultType,
        parent_id: parentCategory?.id,
        is_subcategory: !!parentCategory,
        budget_limit: undefined,
        is_system: false,
        sort_order: 0
      });
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, defaultType, parentCategory]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Category name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Category name must be at least 2 characters';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Category name must be less than 50 characters';
    }

    // Check for duplicate names
    const existingNames = existingCategories.map(cat => cat.name.toLowerCase());
    if (formData.name && existingNames.includes(formData.name.toLowerCase())) {
      newErrors.name = 'A category with this name already exists';
    }

    if (!formData.color) {
      newErrors.color = 'Please select a color';
    }

    if (!formData.icon) {
      newErrors.icon = 'Please select an icon';
    }

    if (formData.budget_limit && formData.budget_limit <= 0) {
      newErrors.budget_limit = 'Budget limit must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const categoryData: CategoryCreationData = {
        name: formData.name!.trim(),
        description: formData.description?.trim() || undefined,
        color: formData.color!,
        icon: formData.icon!,
        type: formData.type!,
        parent_id: formData.parent_id,
        is_subcategory: formData.is_subcategory!,
        budget_limit: formData.budget_limit,
        is_system: false,
        sort_order: existingCategories.length
      };

      await onCreateCategory(categoryData);

      logger.info('Category created successfully', {
        name: categoryData.name,
        type: categoryData.type
      });

      onClose();
    } catch (error) {
      logger.error('Error creating category:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to create category'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CategoryCreationData, value: any): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const getAvailableParentCategories = (): CategoryOption[] => {
    return existingCategories.filter(cat =>
      cat.type === formData.type &&
      !cat.children?.length // Only show categories that aren't already parents
    );
  };

  if (!isOpen) return <></>;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {parentCategory ? 'Create Subcategory' : 'Create Category'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Parent Category Info */}
          {parentCategory && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400">Parent Category:</div>
              <div className="flex items-center mt-1">
                <span className="text-lg mr-2">{parentCategory.icon}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {parentCategory.name}
                </span>
                <div
                  className="w-3 h-3 rounded-full ml-2"
                  style={{ backgroundColor: parentCategory.color }}
                />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category Name *
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                  errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Enter category name"
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Optional description"
                rows={2}
                disabled={isSubmitting}
              />
            </div>

            {/* Category Type (only if not a subcategory) */}
            {!parentCategory && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category Type *
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="expense"
                      checked={formData.type === 'expense'}
                      onChange={(e) => handleInputChange('type', e.target.value)}
                      className="mr-2"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Expense</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="income"
                      checked={formData.type === 'income'}
                      onChange={(e) => handleInputChange('type', e.target.value)}
                      className="mr-2"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Income</span>
                  </label>
                </div>
              </div>
            )}

            {/* Color Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color *
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="w-8 h-8 rounded-full border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: formData.color }}
                  disabled={isSubmitting}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {formData.color}
                </span>
              </div>

              {showColorPicker && (
                <div className="mt-2 p-2 border border-gray-200 dark:border-gray-600 rounded-md">
                  <div className="grid grid-cols-5 gap-2">
                    {PREDEFINED_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          handleInputChange('color', color);
                          setShowColorPicker(false);
                        }}
                        className={`w-8 h-8 rounded-full border-2 ${
                          formData.color === color
                            ? 'border-gray-800 dark:border-white'
                            : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                        disabled={isSubmitting}
                      />
                    ))}
                  </div>
                </div>
              )}

              {errors.color && (
                <p className="text-red-500 text-sm mt-1">{errors.color}</p>
              )}
            </div>

            {/* Icon Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Icon *
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="w-10 h-10 flex items-center justify-center border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  disabled={isSubmitting}
                >
                  {formData.icon}
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Click to change icon
                </span>
              </div>

              {showIconPicker && (
                <div className="mt-2 p-2 border border-gray-200 dark:border-gray-600 rounded-md">
                  <div className="grid grid-cols-6 gap-2">
                    {PREDEFINED_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => {
                          handleInputChange('icon', icon);
                          setShowIconPicker(false);
                        }}
                        className={`w-8 h-8 flex items-center justify-center border rounded ${
                          formData.icon === icon
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        disabled={isSubmitting}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {errors.icon && (
                <p className="text-red-500 text-sm mt-1">{errors.icon}</p>
              )}
            </div>

            {/* Budget Limit (for expense categories) */}
            {formData.type === 'expense' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Monthly Budget Limit (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.budget_limit || ''}
                    onChange={(e) => handleInputChange('budget_limit', e.target.value ? parseFloat(e.target.value) : undefined)}
                    className={`w-full pl-8 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                      errors.budget_limit ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="0.00"
                    disabled={isSubmitting}
                  />
                </div>
                {errors.budget_limit && (
                  <p className="text-red-500 text-sm mt-1">{errors.budget_limit}</p>
                )}
              </div>
            )}

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                <p className="text-red-600 dark:text-red-400 text-sm">{errors.submit}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Category'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CategoryCreationModal;