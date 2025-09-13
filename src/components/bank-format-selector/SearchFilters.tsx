import React, { memo } from 'react';
import { SearchIcon, GlobeIcon, BankIcon } from '../icons';
import { REGION_GROUPS, TYPE_GROUPS } from './bankData';
import { logger } from '../../services/loggingService';

interface SearchFiltersProps {
  searchTerm: string;
  selectedRegion: string;
  selectedType: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRegionChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onClearFilters: () => void;
}

/**
 * Search and filter controls for bank format selection
 * Handles search input and region/type filtering
 */
export const SearchFilters = memo(function SearchFilters({
  searchTerm,
  selectedRegion,
  selectedType,
  onSearchChange,
  onRegionChange,
  onTypeChange,
  onClearFilters
}: SearchFiltersProps): React.JSX.Element {
  try {
    return (
      <div className="space-y-4 mb-6">
        {/* Search Input */}
        <div className="relative">
          <SearchIcon 
            size={20} 
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
          />
          <input
            type="text"
            placeholder="Search banks, payment services, or investment platforms..."
            value={searchTerm}
            onChange={onSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
        
        {/* Filter Controls */}
        <div className="flex flex-wrap gap-4">
          {/* Region Filter */}
          <div className="flex items-center gap-2">
            <GlobeIcon size={16} className="text-gray-500" />
            <select
              value={selectedRegion}
              onChange={onRegionChange}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="all">All Regions</option>
              {Object.entries(REGION_GROUPS).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>
          
          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <BankIcon size={16} className="text-gray-500" />
            <select
              value={selectedType}
              onChange={onTypeChange}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="all">All Types</option>
              {Object.entries(TYPE_GROUPS).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters (only show if filters are active) */}
          {(searchTerm || selectedRegion !== 'all' || selectedType !== 'all') && (
            <button
              onClick={onClearFilters}
              className="px-3 py-1 text-sm text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    );
  } catch (error) {
    logger.error('SearchFilters render error:', error);
    return (
      <div className="space-y-4 mb-6">
        <div className="text-center py-4 text-red-600 dark:text-red-400">
          Error loading search filters
        </div>
      </div>
    );
  }
});