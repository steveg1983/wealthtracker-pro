import React, { useEffect, memo } from 'react';
import type { FilterPreset } from './types';
import { useLogger } from '../services/ServiceProvider';

interface FilterPillsProps {
  filters: FilterPreset[];
  activeFilter: string | null;
  onFilterSelect: (filterId: string) => void;
  compact?: boolean;
}

export const FilterPills = memo(function FilterPills({ filters,
  activeFilter,
  onFilterSelect,
  compact = false
 }: FilterPillsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('FilterPills component initialized', {
      componentName: 'FilterPills'
    });
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(filter => (
        <button
          key={filter.id}
          onClick={() => onFilterSelect(filter.id)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
            transition-all duration-200
            ${activeFilter === filter.id
              ? 'bg-primary text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
            ${compact ? 'text-xs px-2 py-1' : ''}
          `}
          title={filter.description}
        >
          {filter.icon}
          <span>{filter.name}</span>
          {filter.isCustom && (
            <span className="ml-1 w-1.5 h-1.5 bg-yellow-400 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
});