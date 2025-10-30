import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { SearchIcon, PlusIcon, FolderIcon } from './icons';
import type { Category } from '../types';

interface VirtualizedCategorySelectorProps {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string) => void;
  showCreateOption?: boolean;
  onCreateCategory?: (name: string) => void;
  recentCategories?: string[];
  frequentCategories?: Map<string, number>;
  className?: string;
  placeholder?: string;
}

/**
 * High-performance category selector for large category lists
 * Features smart sorting, search, and quick access to frequent categories
 */
export function VirtualizedCategorySelector({
  categories,
  value,
  onChange,
  showCreateOption = true,
  onCreateCategory,
  recentCategories = [],
  frequentCategories = new Map(),
  className = '',
  placeholder = 'Select category...'
}: VirtualizedCategorySelectorProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Process and sort categories
  const processedCategories = useMemo(() => {
    let result = [...categories];
    
    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(cat => 
        cat.name.toLowerCase().includes(searchLower) ||
        cat.description?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by frequency and recency if not searching
    if (!search && !showAll) {
      result.sort((a, b) => {
        // Recent categories first
        const aRecent = recentCategories.indexOf(a.id);
        const bRecent = recentCategories.indexOf(b.id);
        if (aRecent !== -1 && bRecent !== -1) {
          return aRecent - bRecent;
        }
        if (aRecent !== -1) return -1;
        if (bRecent !== -1) return 1;
        
        // Then by frequency
        const aFreq = frequentCategories.get(a.id) || 0;
        const bFreq = frequentCategories.get(b.id) || 0;
        if (aFreq !== bFreq) return bFreq - aFreq;
        
        // Finally alphabetically
        return a.name.localeCompare(b.name);
      });
    }

    return result;
  }, [categories, search, showAll, recentCategories, frequentCategories]);

  // Separate into sections
  const categorySections = useMemo(() => {
    if (search || showAll) {
      return [{ title: 'All Categories', items: processedCategories }];
    }

    const sections = [];
    const recentItems = processedCategories.filter(cat => 
      recentCategories.includes(cat.id)
    ).slice(0, 5);
    
    const frequentItems = processedCategories.filter(cat => 
      !recentCategories.includes(cat.id) && frequentCategories.get(cat.id)! > 5
    ).slice(0, 5);
    
    const otherItems = processedCategories.filter(cat =>
      !recentCategories.includes(cat.id) && (!frequentCategories.has(cat.id) || frequentCategories.get(cat.id)! <= 5)
    );

    if (recentItems.length > 0) {
      sections.push({ title: 'Recent', items: recentItems });
    }
    if (frequentItems.length > 0) {
      sections.push({ title: 'Frequent', items: frequentItems });
    }
    if (otherItems.length > 0) {
      sections.push({ title: 'All Categories', items: otherItems.slice(0, 10) });
    }

    return sections;
  }, [processedCategories, search, showAll, recentCategories, frequentCategories]);

  // Get selected category
  const selectedCategory = categories.find(cat => cat.id === value);

  // Render category option
  const renderCategory = useCallback((category: Category) => {
    const isRecent = recentCategories.includes(category.id);
    const frequency = frequentCategories.get(category.id) || 0;
    const isFrequent = frequency > 5;

    return (
      <div
        className="flex items-center justify-between px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
        onClick={() => {
          onChange(category.id);
          setIsOpen(false);
          setSearch('');
        }}
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded ${
            category.color ? '' : 'bg-gray-100 dark:bg-gray-700'
          }`} style={{ backgroundColor: category.color }}>
            {category.icon ? (
              <span className="text-lg">{category.icon}</span>
            ) : (
              <FolderIcon size={16} className="text-gray-600 dark:text-gray-400" />
            )}
          </div>
          
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {category.name}
            </div>
            {category.description && (
              <div className="text-xs text-gray-500">
                {category.description}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isRecent && (
            <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-500 rounded">
              Recent
            </span>
          )}
          {isFrequent && (
            <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
              {frequency}x
            </span>
          )}
        </div>
      </div>
    );
  }, [onChange, recentCategories, frequentCategories]);

  // Render section with items
  const renderSection = useCallback((section: { title: string; items: Category[] }) => {
    type SectionItem = { kind: 'header'; title: string } | { kind: 'category'; category: Category };
    const items: SectionItem[] = [
      { kind: 'header', title: section.title },
      ...section.items.map(category => ({ kind: 'category' as const, category }))
    ];

    return items.map(item => {
      if (item.kind === 'header') {
        return (
          <div
            key={`header-${item.title}`}
            className="px-4 py-2 bg-gray-50 dark:bg-gray-800 font-semibold text-sm text-gray-600 dark:text-gray-400 sticky top-0 z-10"
          >
            {item.title}
          </div>
        );
      }

      const { category } = item;
      return (
        <div key={category.id}>
          {renderCategory(category)}
        </div>
      );
    });
  }, [renderCategory]);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Selected value display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors text-left"
      >
        {selectedCategory ? (
          <div className="flex items-center gap-3">
            <div 
              className="p-1 rounded"
              style={{ backgroundColor: selectedCategory.color || '#e5e7eb' }}
            >
              {selectedCategory.icon ? (
                <span className="text-sm">{selectedCategory.icon}</span>
              ) : (
                <FolderIcon size={14} />
              )}
            </div>
            <span className="text-gray-900 dark:text-white">
              {selectedCategory.name}
            </span>
          </div>
        ) : (
          <span className="text-gray-500">{placeholder}</span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Search input */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories..."
                className="w-full pl-10 pr-3 py-2 bg-blue-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                autoFocus
              />
            </div>
          </div>

          {/* Quick actions */}
          {showCreateOption && search && processedCategories.length === 0 && (
            <button
              onClick={() => {
                onCreateCategory?.(search);
                setIsOpen(false);
                setSearch('');
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
            >
              <PlusIcon size={18} className="text-primary" />
              <span>Create "{search}"</span>
            </button>
          )}

          {/* Category list */}
          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            {categorySections.map((section, idx) => (
              <div key={idx}>
                {renderSection(section)}
              </div>
            ))}
            
            {/* Show all button */}
            {!showAll && !search && processedCategories.length > 20 && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full px-4 py-3 text-center text-primary hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-sm font-medium"
              >
                Show all {processedCategories.length} categories
              </button>
            )}
          </div>

          {/* Footer with stats */}
          <div className="px-4 py-2 bg-blue-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
            {processedCategories.length} categories • {recentCategories.length} recent
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Inline category selector for transaction rows
 * Optimized for performance in virtualized lists
 */
export function InlineCategorySelector({
  categories,
  value,
  onChange,
  className = ''
}: {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string) => void;
  className?: string;
}): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const selectedCategory = categories.find(cat => cat.id === value);

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${className}`}
      >
        {selectedCategory ? (
          <>
            {selectedCategory.icon && <span className="text-sm">{selectedCategory.icon}</span>}
            <span className="text-sm font-medium">{selectedCategory.name}</span>
          </>
        ) : (
          <span className="text-sm text-gray-500">No category</span>
        )}
      </button>
    );
  }

  return (
    <VirtualizedCategorySelector
      categories={categories}
      value={value}
      onChange={(categoryId) => {
        onChange(categoryId);
        setIsEditing(false);
      }}
      className={className}
    />
  );
}
