/**
 * Virtualized Dropdown Component
 * Dropdown with virtualization for large item lists
 */

import React, { memo, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { TanstackVirtualList } from '../VirtualizedListSystem';
import { VirtualizedListService } from '../../services/virtualizedListService';
import { logger } from '../../services/loggingService';

interface VirtualizedDropdownProps<T> {
  items: T[];
  value: T | null;
  onChange: (value: T) => void;
  renderOption: (item: T) => React.ReactNode;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
}

const DropdownContainer = memo(React.forwardRef<HTMLDivElement, any>(function DropdownContainer(
  { className, isOpen, value, placeholder, searchable, search, filteredItems, renderOption, onToggle, onSearchChange, onSelect },
  ref
) {
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500"
      >
        {value ? renderOption(value) : <span className="text-gray-500">{placeholder}</span>}
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
          {searchable && (
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="w-full px-4 py-2 border-b border-gray-200 dark:border-gray-700"
              autoFocus
            />
          )}
          <div style={{ height: '300px' }}>
            <TanstackVirtualList
              items={filteredItems}
              renderItem={(item) => (
                <div
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => onSelect(item)}
                >
                  {renderOption(item)}
                </div>
              )}
              estimatedItemSize={40}
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}));

export function VirtualizedDropdown<T>({
  items,
  value,
  onChange,
  renderOption,
  placeholder = 'Select...',
  searchable = true,
  className = ''
}: VirtualizedDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => 
    VirtualizedListService.filterItems(
      items,
      search,
      (item) => {
        const text = renderOption(item);
        return typeof text === 'string' ? text : '';
      }
    ),
    [items, search, renderOption]
  );

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

  const handleSelect = useCallback((item: T) => {
    onChange(item);
    setIsOpen(false);
    setSearch('');
  }, [onChange]);

  return (
    <DropdownContainer
      ref={dropdownRef}
      className={className}
      isOpen={isOpen}
      value={value}
      placeholder={placeholder}
      searchable={searchable}
      search={search}
      filteredItems={filteredItems}
      renderOption={renderOption}
      onToggle={() => setIsOpen(!isOpen)}
      onSearchChange={setSearch}
      onSelect={handleSelect}
    />
  );
}

export default memo(VirtualizedDropdown) as typeof VirtualizedDropdown;