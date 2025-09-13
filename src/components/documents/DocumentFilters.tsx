import React, { useEffect, memo } from 'react';
import { SearchIcon, FilterIcon, XIcon } from '../icons';
import type { Document } from '../../services/documentService';
import { logger } from '../../services/loggingService';

interface DocumentFiltersProps {
  searchTerm: string;
  filterType: Document['type'] | 'all';
  filterTags: string[];
  availableTags: string[];
  onSearchChange: (term: string) => void;
  onTypeChange: (type: Document['type'] | 'all') => void;
  onTagsChange: (tags: string[]) => void;
}

export const DocumentFilters = memo(function DocumentFilters({
  searchTerm,
  filterType,
  filterTags,
  availableTags,
  onSearchChange,
  onTypeChange,
  onTagsChange
}: DocumentFiltersProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('DocumentFilters component initialized', {
      componentName: 'DocumentFilters'
    });
  }, []);

  const documentTypes: Array<Document['type'] | 'all'> = [
    'all', 'receipt', 'invoice', 'statement', 'contract', 'other'
  ];

  const toggleTag = (tag: string) => {
    if (filterTags.includes(tag)) {
      onTagsChange(filterTags.filter(t => t !== tag));
    } else {
      onTagsChange([...filterTags, tag]);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <SearchIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <FilterIcon size={20} className="text-gray-500" />
          <select
            value={filterType}
            onChange={(e) => onTypeChange(e.target.value as Document['type'] | 'all')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
          >
            {documentTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tag Filters */}
      {availableTags.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tags:</span>
            {filterTags.length > 0 && (
              <button
                onClick={() => onTagsChange([])}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filterTags.includes(tag)
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});