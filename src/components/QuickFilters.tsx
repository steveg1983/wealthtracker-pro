import React from 'react';
import { FilterIcon, XIcon } from './icons';
import { IconButton } from './icons/IconButton';

interface QuickFilter {
  id: string;
  label: string;
  count: number;
}

interface QuickFiltersProps {
  filters: QuickFilter[];
  onFilterSelect: (filterId: string) => void;
  onClearFilters: () => void;
  isSearchActive: boolean;
  className?: string;
}

export default function QuickFilters({
  filters,
  onFilterSelect,
  onClearFilters,
  isSearchActive,
  className = ''
}: QuickFiltersProps): React.JSX.Element {
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
        <FilterIcon size={16} />
        <span>Quick filters:</span>
      </div>
      
      {filters.map(filter => (
        <button
          key={filter.id}
          onClick={() => onFilterSelect(filter.id)}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full text-sm transition-colors"
          disabled={filter.count === 0}
        >
          <span>{filter.label}</span>
          <span className="bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full text-xs">
            {filter.count}
          </span>
        </button>
      ))}
      
      {isSearchActive && (
        <IconButton
          onClick={onClearFilters}
          icon={<XIcon size={16} />}
          variant="ghost"
          size="sm"
          className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 ml-2"
          title="Clear all filters"
        />
      )}
    </div>
  );
}