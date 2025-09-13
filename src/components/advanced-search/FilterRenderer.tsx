import React, { useEffect, memo } from 'react';
import type { SearchFilter } from './types';
import { logger } from '../../services/loggingService';

interface FilterRendererProps {
  filter: SearchFilter;
  onUpdate: (filterId: string, value: string | string[] | number | boolean | null) => void;
}

export const FilterRenderer = memo(function FilterRenderer({ filter, onUpdate }: FilterRendererProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('FilterRenderer component initialized', {
      componentName: 'FilterRenderer'
    });
  }, []);

  switch (filter.type) {
    case 'text':
      return (
        <input
          type="text"
          value={typeof filter.value === 'string' ? filter.value : ''}
          onChange={(e) => onUpdate(filter.id, e.target.value)}
          placeholder={`Enter ${filter.label.toLowerCase()}`}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={typeof filter.value === 'string' ? filter.value : ''}
          onChange={(e) => onUpdate(filter.id, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      );

    case 'amount':
      return (
        <input
          type="number"
          step="0.01"
          value={typeof filter.value === 'string' || typeof filter.value === 'number' ? filter.value : ''}
          onChange={(e) => onUpdate(filter.id, e.target.value)}
          placeholder="0.00"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      );

    case 'select':
      return (
        <select
          value={typeof filter.value === 'string' ? filter.value : ''}
          onChange={(e) => onUpdate(filter.id, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {filter.options?.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'multiselect':
      return (
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {filter.options?.map(option => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Array.isArray(filter.value) && filter.value.includes(option.value)}
                onChange={(e) => {
                  const currentValue = Array.isArray(filter.value) ? filter.value : [];
                  const newValue = e.target.checked
                    ? [...currentValue, option.value]
                    : currentValue.filter((v: string) => v !== option.value);
                  onUpdate(filter.id, newValue);
                }}
                className="rounded text-primary focus:ring-primary"
              />
              <span className="text-gray-700 dark:text-gray-300">{option.label}</span>
            </label>
          ))}
        </div>
      );

    default:
      return null;
  }
});
