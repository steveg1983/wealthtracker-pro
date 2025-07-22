import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TagIcon } from './icons/TagIcon';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  level: 'type' | 'sub' | 'detail';
  parentId?: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
}

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
  allowCreate = false
}: CategorySelectorProps): React.JSX.Element {
  const { categories, getSubCategories, getDetailCategories } = useApp();
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);


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
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
                  ref={inputRef}
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
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
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
            
            {/* Create New Category Option */}
            {allowCreate && searchTerm && (
              <div className="border-t border-gray-200 dark:border-gray-600">
                <div className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-green-600 dark:text-green-400">
                  <div className="flex items-center gap-2">
                    <PlusIcon size={14} />
                    <span>Create "{searchTerm}"</span>
                  </div>
                </div>
              </div>
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