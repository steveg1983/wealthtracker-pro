import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Plus, Hash } from 'lucide-react';

interface TagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  allowNewTags?: boolean;
  className?: string;
}

export default function TagSelector({
  selectedTags,
  onTagsChange,
  placeholder = "Add tags...",
  allowNewTags = true,
  className = ""
}: TagSelectorProps) {
  const { tags, addTag, getTagUsageCount } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter available tags based on input and exclude already selected ones
  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
    !selectedTags.includes(tag.name)
  );

  // Check if input matches an existing tag exactly
  const exactMatch = tags.find(tag => tag.name.toLowerCase() === inputValue.toLowerCase());

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setShowDropdown(value.length > 0);
    setFocusedIndex(-1);
  };

  const handleInputFocus = () => {
    if (inputValue.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    const totalOptions = filteredTags.length + (allowNewTags && inputValue.trim() && !exactMatch ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev + 1) % totalOptions);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => prev <= 0 ? totalOptions - 1 : prev - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredTags.length) {
          selectTag(filteredTags[focusedIndex].name);
        } else if (focusedIndex === filteredTags.length && allowNewTags && inputValue.trim() && !exactMatch) {
          createAndSelectTag(inputValue.trim());
        } else if (inputValue.trim()) {
          if (exactMatch) {
            selectTag(exactMatch.name);
          } else if (allowNewTags) {
            createAndSelectTag(inputValue.trim());
          }
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setFocusedIndex(-1);
        break;
    }
  };

  const selectTag = (tagName: string) => {
    if (!selectedTags.includes(tagName)) {
      onTagsChange([...selectedTags, tagName]);
    }
    setInputValue('');
    setShowDropdown(false);
    setFocusedIndex(-1);
  };

  const createAndSelectTag = (tagName: string) => {
    // Create the tag in the centralized system
    addTag({
      name: tagName,
      color: '#6B7280',
      description: 'Created during transaction entry'
    });
    
    // Select the tag
    selectTag(tagName);
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const getTagColor = (tagName: string) => {
    const tag = tags.find(t => t.name === tagName);
    return tag?.color || '#6B7280';
  };


  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 text-white rounded-full text-sm font-medium"
              style={{ backgroundColor: getTagColor(tag) }}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-white/80 hover:text-white"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input Field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 h-[42px] bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
        />
        
        {/* Dropdown */}
        {showDropdown && (filteredTags.length > 0 || (allowNewTags && inputValue.trim() && !exactMatch)) && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
            {/* Existing Tags */}
            {filteredTags.map((tag, index) => {
              const usageCount = getTagUsageCount(tag.name);
              return (
                <div
                  key={tag.id}
                  className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${
                    focusedIndex === index ? 'bg-gray-100 dark:bg-gray-600' : ''
                  }`}
                  onClick={() => selectTag(tag.name)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {tag.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({usageCount} uses)
                    </span>
                  </div>
                  {tag.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-5">
                      {tag.description}
                    </p>
                  )}
                </div>
              );
            })}
            
            {/* Create New Tag Option */}
            {allowNewTags && inputValue.trim() && !exactMatch && (
              <div
                className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 border-t border-gray-200 dark:border-gray-600 ${
                  focusedIndex === filteredTags.length ? 'bg-gray-100 dark:bg-gray-600' : ''
                }`}
                onClick={() => createAndSelectTag(inputValue.trim())}
              >
                <div className="flex items-center gap-2">
                  <Plus size={14} className="text-green-600 dark:text-green-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    Create "{inputValue.trim()}"
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-5">
                  Create new tag and add to transaction
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Helper Text */}
      {selectedTags.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
          <Hash size={12} />
          Type to search existing tags or create new ones
        </p>
      )}
    </div>
  );
}