/**
 * CategorySelector Component - Enhanced category selection with search and management
 *
 * Features:
 * - Category search and filtering
 * - Custom category creation
 * - Category management (edit, delete)
 * - Recent categories
 * - Category grouping
 */

import React, { useState, useRef, useEffect } from 'react';
import { lazyLogger as logger } from '../services/serviceFactory';

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  type: 'income' | 'expense' | 'transfer';
  parentId?: string;
  isCustom?: boolean;
  lastUsed?: Date;
}

interface CategorySelectorProps {
  value?: string;
  onChange: (categoryId: string) => void;
  onCategoryChange?: (category: Category) => void;
  categories?: Category[];
  type?: 'income' | 'expense' | 'transfer';
  placeholder?: string;
  allowCustom?: boolean;
  allowManagement?: boolean;
  showRecent?: boolean;
  recentLimit?: number;
  className?: string;
  disabled?: boolean;
}

// Enhanced default categories with more options
const defaultCategories: Category[] = [
  // Expense categories
  { id: 'groceries', name: 'Groceries', icon: '🛒', color: '#10B981', type: 'expense' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#3B82F6', type: 'expense' },
  { id: 'fuel', name: 'Fuel', icon: '⛽', color: '#3B82F6', type: 'expense', parentId: 'transport' },
  { id: 'public_transport', name: 'Public Transport', icon: '🚌', color: '#3B82F6', type: 'expense', parentId: 'transport' },
  { id: 'utilities', name: 'Utilities', icon: '⚡', color: '#F59E0B', type: 'expense' },
  { id: 'electricity', name: 'Electricity', icon: '💡', color: '#F59E0B', type: 'expense', parentId: 'utilities' },
  { id: 'water', name: 'Water', icon: '💧', color: '#F59E0B', type: 'expense', parentId: 'utilities' },
  { id: 'internet', name: 'Internet', icon: '🌐', color: '#F59E0B', type: 'expense', parentId: 'utilities' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#8B5CF6', type: 'expense' },
  { id: 'streaming', name: 'Streaming Services', icon: '📺', color: '#8B5CF6', type: 'expense', parentId: 'entertainment' },
  { id: 'gaming', name: 'Gaming', icon: '🎮', color: '#8B5CF6', type: 'expense', parentId: 'entertainment' },
  { id: 'healthcare', name: 'Healthcare', icon: '🏥', color: '#EF4444', type: 'expense' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#EC4899', type: 'expense' },
  { id: 'clothing', name: 'Clothing', icon: '👕', color: '#EC4899', type: 'expense', parentId: 'shopping' },
  { id: 'electronics', name: 'Electronics', icon: '📱', color: '#EC4899', type: 'expense', parentId: 'shopping' },
  { id: 'dining', name: 'Dining Out', icon: '🍽️', color: '#F97316', type: 'expense' },
  { id: 'education', name: 'Education', icon: '📚', color: '#6366F1', type: 'expense' },
  { id: 'insurance', name: 'Insurance', icon: '🛡️', color: '#64748B', type: 'expense' },
  { id: 'rent', name: 'Rent/Mortgage', icon: '🏠', color: '#374151', type: 'expense' },

  // Income categories
  { id: 'salary', name: 'Salary', icon: '💼', color: '#10B981', type: 'income' },
  { id: 'freelance', name: 'Freelance', icon: '💻', color: '#3B82F6', type: 'income' },
  { id: 'investment', name: 'Investment', icon: '📈', color: '#8B5CF6', type: 'income' },
  { id: 'dividend', name: 'Dividends', icon: '💰', color: '#8B5CF6', type: 'income', parentId: 'investment' },
  { id: 'capital_gains', name: 'Capital Gains', icon: '📊', color: '#8B5CF6', type: 'income', parentId: 'investment' },
  { id: 'gift', name: 'Gift', icon: '🎁', color: '#EC4899', type: 'income' },
  { id: 'refund', name: 'Refund', icon: '💰', color: '#10B981', type: 'income' },
  { id: 'bonus', name: 'Bonus', icon: '🎯', color: '#F59E0B', type: 'income' },

  // Transfer categories
  { id: 'transfer', name: 'Account Transfer', icon: '🔄', color: '#6B7280', type: 'transfer' },
  { id: 'payment', name: 'Payment', icon: '💳', color: '#374151', type: 'transfer' }
];

export default function CategorySelector({
  value,
  onChange,
  onCategoryChange,
  categories = defaultCategories,
  type,
  placeholder = 'Select category',
  allowCustom = true,
  allowManagement = false,
  showRecent = true,
  recentLimit = 5,
  className = '',
  disabled = false
}: CategorySelectorProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState<Partial<Category>>({
    type: type || 'expense',
    icon: '📁',
    color: '#6B7280'
  });
  const [recentCategories, setRecentCategories] = useState<Category[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter categories by type and search term
  const filteredCategories = categories.filter(category => {
    const matchesType = !type || category.type === type;
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (category.icon && category.icon.includes(searchTerm));
    return matchesType && matchesSearch;
  });

  // Group categories by parent
  const groupedCategories = filteredCategories.reduce((groups, category) => {
    if (!category.parentId) {
      groups.parents.push(category);
    } else {
      if (!groups.children[category.parentId]) {
        groups.children[category.parentId] = [];
      }
      groups.children[category.parentId].push(category);
    }
    return groups;
  }, { parents: [] as Category[], children: {} as Record<string, Category[]> });

  // Get recent categories
  const recentCategoriesFiltered = showRecent
    ? recentCategories
        .filter(cat => !type || cat.type === type)
        .slice(0, recentLimit)
    : [];

  // Get selected category
  const selectedCategory = categories.find(cat => cat.id === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowAddForm(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleCategorySelect = (category: Category) => {
    onChange(category.id);
    onCategoryChange?.(category);

    // Update recent categories
    if (showRecent) {
      setRecentCategories(prev => {
        const filtered = prev.filter(cat => cat.id !== category.id);
        return [{ ...category, lastUsed: new Date() }, ...filtered].slice(0, recentLimit);
      });
    }

    setIsOpen(false);
    setSearchTerm('');
    logger.debug('Category selected:', category);
  };

  const handleAddCategory = () => {
    if (!newCategory.name?.trim() || !allowCustom) return;

    const category: Category = {
      id: `custom-${Date.now()}`,
      name: newCategory.name.trim(),
      type: newCategory.type as Category['type'],
      icon: newCategory.icon || '📁',
      color: newCategory.color || '#6B7280',
      isCustom: true
    };

    // In a real implementation, this would save to the backend
    logger.debug('New category created:', category);

    handleCategorySelect(category);
    setNewCategory({
      type: type || 'expense',
      icon: '📁',
      color: '#6B7280'
    });
    setShowAddForm(false);
  };

  const handleManageCategory = (category: Category, action: 'edit' | 'delete') => {
    if (!allowManagement) return;

    // In a real implementation, this would handle category management
    logger.debug('Category management:', { category, action });
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selected value button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-left bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-800 flex items-center justify-between ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        <div className="flex items-center min-w-0 flex-1">
          {selectedCategory ? (
            <>
              {selectedCategory.icon && (
                <span className="mr-2 text-lg">{selectedCategory.icon}</span>
              )}
              <span className="truncate text-gray-900 dark:text-gray-100">
                {selectedCategory.name}
              </span>
              {selectedCategory.isCustom && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">
                  Custom
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">
              {placeholder}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-80 overflow-y-auto">
          {/* Search input */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search categories..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Recent categories */}
          {recentCategoriesFiltered.length > 0 && searchTerm === '' && (
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
                Recent
              </div>
              {recentCategoriesFiltered.map((category) => (
                <button
                  key={`recent-${category.id}`}
                  type="button"
                  onClick={() => handleCategorySelect(category)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center rounded-md"
                >
                  {category.icon && (
                    <span className="mr-2 text-sm">{category.icon}</span>
                  )}
                  <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">
                    {category.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Categories list */}
          <div className="py-1">
            {groupedCategories.parents.map((category) => (
              <div key={category.id}>
                <button
                  type="button"
                  onClick={() => handleCategorySelect(category)}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center group ${
                    value === category.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {category.icon && (
                    <span className="mr-3 text-lg">{category.icon}</span>
                  )}
                  <span className="flex-1">{category.name}</span>
                  {value === category.id && (
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {allowManagement && category.isCustom && (
                    <div className="opacity-0 group-hover:opacity-100 flex space-x-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManageCategory(category, 'edit');
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManageCategory(category, 'delete');
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </button>

                {/* Sub-categories */}
                {groupedCategories.children[category.id]?.map((subCategory) => (
                  <button
                    key={subCategory.id}
                    type="button"
                    onClick={() => handleCategorySelect(subCategory)}
                    className={`w-full px-8 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center text-sm ${
                      value === subCategory.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {subCategory.icon && (
                      <span className="mr-2">{subCategory.icon}</span>
                    )}
                    <span className="flex-1">{subCategory.name}</span>
                    {value === subCategory.id && (
                      <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            ))}

            {/* No results message */}
            {filteredCategories.length === 0 && !showAddForm && (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                No categories found
                {allowCustom && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="block mx-auto mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                  >
                    Create "{searchTerm}" as new category
                  </button>
                )}
              </div>
            )}

            {/* Add new category option */}
            {allowCustom && !showAddForm && searchTerm === '' && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="w-full px-4 py-2 text-left text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
              >
                <span className="mr-3">➕</span>
                Add new category
              </button>
            )}
          </div>

          {/* Add category form */}
          {showAddForm && allowCustom && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="space-y-3">
                <input
                  type="text"
                  value={newCategory.name || ''}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="Category name"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newCategory.icon || ''}
                    onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                    placeholder="Icon (emoji)"
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                  <input
                    type="color"
                    value={newCategory.color || '#6B7280'}
                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                    className="w-full h-8 border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={!newCategory.name?.trim()}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded transition-colors duration-200"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}