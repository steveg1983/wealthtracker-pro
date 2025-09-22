/**
 * TagSelector Component - Tag selection and management interface
 *
 * Features:
 * - Multi-select tags
 * - Create new tags
 * - Tag filtering and searching
 * - Tag color coding
 * - Keyboard navigation
 * - Accessible interface
 */

import React, { useState, useEffect, useRef } from 'react';

const logger = lazyLogger.getLogger('TagSelector');

export interface Tag {
  id: string;
  name: string;
  color: string;
  count?: number;
  created_at?: string;
}

interface TagSelectorProps {
  selectedTags?: Tag[];
  availableTags?: Tag[];
  onTagsChange?: (tags: Tag[]) => void;
  onCreateTag?: (tagName: string) => Promise<Tag>;
  placeholder?: string;
  maxTags?: number;
  allowCreate?: boolean;
  className?: string;
  disabled?: boolean;
}

const DEFAULT_TAG_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
];

export function TagSelector({
  selectedTags = [],
  availableTags = [],
  onTagsChange,
  onCreateTag,
  placeholder = 'Type to search or add tags...',
  maxTags,
  allowCreate = true,
  className = '',
  disabled = false
}: TagSelectorProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter available tags based on search term and exclude selected tags
  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedTags.some(selected => selected.id === tag.id)
  );

  // Check if we can create a new tag
  const canCreateNewTag = allowCreate &&
    searchTerm.trim() &&
    !availableTags.some(tag =>
      tag.name.toLowerCase() === searchTerm.toLowerCase()
    ) &&
    (!maxTags || selectedTags.length < maxTags);

  // All selectable options (filtered tags + create option)
  const selectableOptions = [
    ...filteredTags,
    ...(canCreateNewTag ? [{
      id: 'create-new',
      name: searchTerm.trim(),
      color: DEFAULT_TAG_COLORS[selectedTags.length % DEFAULT_TAG_COLORS.length],
      isNew: true
    }] : [])
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTagSelect = async (tag: Tag & { isNew?: boolean }): Promise<void> => {
    if (disabled || (maxTags && selectedTags.length >= maxTags)) {
      return;
    }

    let tagToAdd = tag;

    // Create new tag if it's a new one
    if (tag.isNew && onCreateTag) {
      try {
        tagToAdd = await onCreateTag(tag.name);
      } catch (error) {
        return;
      }
    }

    const newSelectedTags = [...selectedTags, tagToAdd];
    onTagsChange?.(newSelectedTags);

    // Clear search and close dropdown
    setSearchTerm('');
    setIsOpen(false);
    setFocusedIndex(-1);

    // Focus back on input
    inputRef.current?.focus();
  };

  const handleTagRemove = (tagToRemove: Tag): void => {
    if (disabled) return;

    const newSelectedTags = selectedTags.filter(tag => tag.id !== tagToRemove.id);
    onTagsChange?.(newSelectedTags);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent): void => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(prev =>
          prev < selectableOptions.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setFocusedIndex(prev => prev > 0 ? prev - 1 : selectableOptions.length - 1);
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (isOpen && focusedIndex >= 0 && selectableOptions[focusedIndex]) {
          handleTagSelect(selectableOptions[focusedIndex] as Tag & { isNew?: boolean });
        } else if (!isOpen) {
          setIsOpen(true);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        setSearchTerm('');
        break;

      case 'Backspace':
        if (!searchTerm && selectedTags.length > 0) {
          e.preventDefault();
          handleTagRemove(selectedTags[selectedTags.length - 1]);
        }
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsOpen(true);
    setFocusedIndex(-1);
  };

  const handleInputFocus = (): void => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Selected Tags + Input */}
      <div className={`
        flex flex-wrap items-center gap-1 p-2 min-h-[42px]
        border border-gray-300 dark:border-gray-600 rounded-md
        bg-white dark:bg-gray-800
        focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}
      `}>
        {/* Selected Tags */}
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            <span>{tag.name}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => handleTagRemove(tag)}
                className="ml-1 hover:bg-white hover:bg-opacity-20 rounded-full p-0.5 focus:outline-none focus:ring-1 focus:ring-white"
                aria-label={`Remove ${tag.name} tag`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </span>
        ))}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={handleInputFocus}
          placeholder={selectedTags.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        />

        {/* Max tags indicator */}
        {maxTags && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
            {selectedTags.length}/{maxTags}
          </span>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {selectableOptions.length === 0 ? (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              {searchTerm ? 'No tags found' : 'No available tags'}
            </div>
          ) : (
            selectableOptions.map((option, index) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleTagSelect(option as Tag & { isNew?: boolean })}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 text-left text-sm
                  hover:bg-gray-50 dark:hover:bg-gray-700
                  focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700
                  ${index === focusedIndex ? 'bg-gray-50 dark:bg-gray-700' : ''}
                `}
              >
                {/* Tag Color */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: option.color }}
                />

                {/* Tag Name */}
                <span className="flex-1 text-gray-900 dark:text-white">
                  {(option as any).isNew ? (
                    <>
                      Create "<strong>{option.name}</strong>"
                    </>
                  ) : (
                    option.name
                  )}
                </span>

                {/* Tag Count */}
                {option.count !== undefined && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {option.count}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default TagSelector;