import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import type { Category } from '../types';
import { ChevronDownIcon, TagIcon, PlusIcon, ArrowLeftIcon, CheckIcon } from './icons';

interface CategorySelectorProps {
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
  transactionType: 'income' | 'expense' | 'transfer';
  placeholder?: string;
  className?: string;
  allowCreate?: boolean;
}

export default function CategorySelector({
  selectedCategory,
  onCategoryChange,
  transactionType,
  placeholder = "Select category...",
  className = "",
}: CategorySelectorProps): React.JSX.Element {
  const { categories, addCategory, getSubCategories, getDetailCategories } = useApp();
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);

  // Get sub-categories for the transaction type
  const getSubCategoriesForType = (): Category[] => {
    const typeCategory = categories.find(cat =>
      cat.level === 'type' && (cat.type === transactionType || cat.type === 'both')
    );
    return typeCategory ? getSubCategories(typeCategory.id) : [];
  };

  // Get all detail categories for the transaction type
  const getAllDetailCategories = (): Category[] => {
    const subCategories = getSubCategoriesForType();
    const detailCategories: Category[] = [];

    subCategories.forEach(subCat => {
      const details = getDetailCategories(subCat.id);
      detailCategories.push(...details);
    });

    return detailCategories;
  };

  // Filter categories based on search term
  const getFilteredOptions = (): Category[] => {
    const allDetails = getAllDetailCategories();

    if (!searchTerm) {
      return allDetails;
    }

    return allDetails.filter(cat =>
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getParentCategoryName(cat.id).toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Get parent category name for display
  const getParentCategoryName = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    if (!category?.parentId) return '';

    const parent = categories.find(c => c.id === category.parentId);
    return parent?.name || '';
  };

  // Get full category display name
  const getCategoryDisplayName = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '';

    const parentName = getParentCategoryName(categoryId);
    return parentName ? `${parentName} > ${category.name}` : category.name;
  };

  // Get selected category display name
  const getSelectedCategoryName = (): string => {
    if (!selectedCategory) return '';
    return getCategoryDisplayName(selectedCategory);
  };

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSearchTerm('');
        setShowCreateForm(false);
        setNewCategoryName('');
        setSelectedParentId('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus the new category name input when create form opens
  useEffect(() => {
    if (showCreateForm && newCategoryInputRef.current) {
      newCategoryInputRef.current.focus();
    }
  }, [showCreateForm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
    setShowDropdown(true);
  };

  const handleInputFocus = (): void => {
    setShowDropdown(true);
  };

  const handleCategorySelect = (categoryId: string): void => {
    onCategoryChange(categoryId);
    setShowDropdown(false);
    setSearchTerm('');
  };

  const handleInputClick = (): void => {
    setShowDropdown(!showDropdown);
  };

  const handleCreateCategory = (): void => {
    if (!newCategoryName.trim() || !selectedParentId) return;

    const newId = crypto.randomUUID();
    const newCategory: Omit<Category, 'id'> = {
      name: newCategoryName.trim(),
      type: transactionType === 'transfer' ? 'both' : transactionType,
      level: 'detail',
      parentId: selectedParentId,
    };

    addCategory(newCategory);

    // The addCategory creates the ID internally, so find the newly added category
    // We need to select it after a tick so the state updates
    setTimeout(() => {
      // Find the category we just created by name and parent
      const created = categories.find(c =>
        c.name === newCategoryName.trim() && c.parentId === selectedParentId
      );
      if (created) {
        onCategoryChange(created.id);
      } else {
        // Fallback: use the id we generated (addCategory uses crypto.randomUUID internally)
        onCategoryChange(newId);
      }
    }, 50);

    // Reset and close
    setNewCategoryName('');
    setSelectedParentId('');
    setShowCreateForm(false);
    setShowDropdown(false);
    setSearchTerm('');
  };

  const subCategories = getSubCategoriesForType();
  const filteredOptions = getFilteredOptions();

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <div
          className="w-full px-3 py-2 h-[42px] bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent cursor-text flex items-center"
          onClick={handleInputClick}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {showDropdown ? (
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  placeholder={placeholder}
                  className="w-full bg-transparent text-gray-900 dark:text-white focus:outline-none"
                  autoFocus
                />
              ) : (
                <span className={`block ${selectedCategory ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  {selectedCategory ? getSelectedCategoryName() : placeholder}
                </span>
              )}
            </div>
            <ChevronDownIcon
              size={16}
              className={`text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
            {showCreateForm ? (
              /* Create New Category Form */
              <div className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Back to categories"
                  >
                    <ArrowLeftIcon size={16} className="text-gray-500" />
                  </button>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Add New Category
                  </span>
                </div>

                {/* Category Name */}
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Category Name
                  </label>
                  <input
                    ref={newCategoryInputRef}
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Gym Membership"
                    className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary dark:text-white"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateCategory();
                      }
                    }}
                  />
                </div>

                {/* Parent Category */}
                <div className="mb-2">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Add under
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {subCategories.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSelectedParentId(sub.id)}
                        className={`w-full text-left px-2.5 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                          selectedParentId === sub.id
                            ? 'bg-primary/10 text-primary border border-primary/30'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {selectedParentId === sub.id && <CheckIcon size={14} />}
                        <span>{sub.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Create Button */}
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim() || !selectedParentId}
                  className="w-full px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <PlusIcon size={14} />
                  Add Category
                </button>
              </div>
            ) : (
              <>
                {/* Category List */}
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((category) => (
                    <div
                      key={category.id}
                      className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${
                        selectedCategory === category.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onClick={() => handleCategorySelect(category.id)}
                    >
                      <div className="flex items-center gap-2">
                        <TagIcon size={14} className="text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {category.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {getParentCategoryName(category.id)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-gray-500 dark:text-gray-400 text-center">
                    {searchTerm ? 'No categories found' : 'No categories available'}
                  </div>
                )}

                {/* Add New Category Option */}
                <div className="border-t border-gray-200 dark:border-gray-600">
                  <div
                    className="px-3 py-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-primary dark:text-blue-400"
                    onClick={() => {
                      setShowCreateForm(true);
                      if (searchTerm) {
                        setNewCategoryName(searchTerm);
                        setSearchTerm('');
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <PlusIcon size={14} />
                      <span className="font-medium text-sm">Add New Category</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Helper Text */}
      {!selectedCategory && !showDropdown && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Select a category for this {transactionType} transaction
        </p>
      )}
    </div>
  );
}
