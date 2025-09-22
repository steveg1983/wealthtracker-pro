/**
 * CategorySelect Component - Category selection dropdown
 *
 * Features:
 * - Predefined and custom categories
 * - Icon support for categories
 * - Search/filter functionality
 * - Add new category option
 */

import React, { useState, useRef, useEffect } from 'react';

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  type: 'income' | 'expense' | 'transfer';
}

interface CategorySelectProps {
  value?: string;
  onChange: (categoryId: string) => void;
  categories?: Category[];
  type?: 'income' | 'expense' | 'transfer';
  placeholder?: string;
  allowCustom?: boolean;
  onAddCategory?: (category: Omit<Category, 'id'>) => void;
  className?: string;
  disabled?: boolean;
}

// Default categories
const defaultCategories: Category[] = [
  // Expense categories
  { id: 'groceries', name: 'Groceries', icon: '🛒', color: '#10B981', type: 'expense' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#3B82F6', type: 'expense' },
  { id: 'utilities', name: 'Utilities', icon: '⚡', color: '#F59E0B', type: 'expense' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#8B5CF6', type: 'expense' },
  { id: 'healthcare', name: 'Healthcare', icon: '🏥', color: '#EF4444', type: 'expense' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#EC4899', type: 'expense' },
  { id: 'dining', name: 'Dining Out', icon: '🍽️', color: '#F97316', type: 'expense' },
  { id: 'education', name: 'Education', icon: '📚', color: '#6366F1', type: 'expense' },

  // Income categories
  { id: 'salary', name: 'Salary', icon: '💼', color: '#10B981', type: 'income' },
  { id: 'freelance', name: 'Freelance', icon: '💻', color: '#3B82F6', type: 'income' },
  { id: 'investment', name: 'Investment', icon: '📈', color: '#8B5CF6', type: 'income' },
  { id: 'gift', name: 'Gift', icon: '🎁', color: '#EC4899', type: 'income' },
  { id: 'refund', name: 'Refund', icon: '💰', color: '#10B981', type: 'income' },

  // Transfer categories
  { id: 'transfer', name: 'Account Transfer', icon: '🔄', color: '#6B7280', type: 'transfer' },
  { id: 'payment', name: 'Payment', icon: '💳', color: '#374151', type: 'transfer' }
];

export default function CategorySelect({
  value,
  onChange,
  categories = defaultCategories,
  type,
  placeholder = 'Select category',
  allowCustom = false,
  onAddCategory,
  className = '',
  disabled = false
}: CategorySelectProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter categories by type and search term
  const filteredCategories = categories.filter(category => {
    const matchesType = !type || category.type === type;
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

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

  const handleCategorySelect = (categoryId: string) => {
    onChange(categoryId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim() || !onAddCategory || !type) return;

    const newCategory: Omit<Category, 'id'> = {
      name: newCategoryName.trim(),
      type,
      icon: '📁',
      color: '#6B7280'
    };

    onAddCategory(newCategory);
    setNewCategoryName('');
    setShowAddForm(false);
    setIsOpen(false);
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
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search categories..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Categories list */}
          <div className="py-1">
            {filteredCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleCategorySelect(category.id)}
                className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center ${
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
              </button>
            ))}

            {/* No results message */}
            {filteredCategories.length === 0 && !showAddForm && (
              <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                No categories found
                {allowCustom && onAddCategory && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="block mx-auto mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                  >
                    Add "{searchTerm}" as new category
                  </button>
                )}
              </div>
            )}

            {/* Add new category option */}
            {allowCustom && onAddCategory && !showAddForm && searchTerm === '' && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="w-full px-4 py-2 text-left text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
              >
                <span className="mr-3 text-lg">➕</span>
                Add new category
              </button>
            )}

            {/* Add category form */}
            {showAddForm && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 mb-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCategory();
                    } else if (e.key === 'Escape') {
                      setShowAddForm(false);
                      setNewCategoryName('');
                    }
                  }}
                />
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={!newCategoryName.trim()}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors duration-200"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewCategoryName('');
                    }}
                    className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}