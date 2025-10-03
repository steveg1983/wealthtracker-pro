import React from 'react';
import { CalendarIcon } from './icons';

interface QuickDateFiltersProps {
  onDateRangeSelect: (from: string, to: string) => void;
  currentFrom?: string;
  currentTo?: string;
}

export default function QuickDateFilters({ onDateRangeSelect, currentFrom, currentTo }: QuickDateFiltersProps): React.JSX.Element {
  const today = new Date();
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const quickRanges = [
    {
      label: 'Today',
      getValue: () => {
        const date = formatDate(today);
        return { from: date, to: date };
      }
    },
    {
      label: 'Yesterday',
      getValue: () => {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const date = formatDate(yesterday);
        return { from: date, to: date };
      }
    },
    {
      label: 'Last 7 days',
      getValue: () => {
        const from = new Date(today);
        from.setDate(from.getDate() - 7);
        return { from: formatDate(from), to: formatDate(today) };
      }
    },
    {
      label: 'Last 30 days',
      getValue: () => {
        const from = new Date(today);
        from.setDate(from.getDate() - 30);
        return { from: formatDate(from), to: formatDate(today) };
      }
    },
    {
      label: 'Last 90 days',
      getValue: () => {
        const from = new Date(today);
        from.setDate(from.getDate() - 90);
        return { from: formatDate(from), to: formatDate(today) };
      }
    },
    {
      label: 'This month',
      getValue: () => {
        const from = new Date(today.getFullYear(), today.getMonth(), 1);
        const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { from: formatDate(from), to: formatDate(to) };
      }
    },
    {
      label: 'Last month',
      getValue: () => {
        const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const to = new Date(today.getFullYear(), today.getMonth(), 0);
        return { from: formatDate(from), to: formatDate(to) };
      }
    },
    {
      label: 'This year',
      getValue: () => {
        const from = new Date(today.getFullYear(), 0, 1);
        return { from: formatDate(from), to: formatDate(today) };
      }
    },
    {
      label: 'Last year',
      getValue: () => {
        const from = new Date(today.getFullYear() - 1, 0, 1);
        const to = new Date(today.getFullYear() - 1, 11, 31);
        return { from: formatDate(from), to: formatDate(to) };
      }
    },
    {
      label: 'All time',
      getValue: () => {
        return { from: '', to: '' };
      }
    }
  ];

  const isActive = (range: { from: string; to: string }): boolean => {
    return range.from === currentFrom && range.to === currentTo;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarIcon size={18} className="text-gray-500 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Date Filters</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {quickRanges.map((range) => {
          const value = range.getValue();
          const active = isActive(value);
          
          return (
            <button
              key={range.label}
              onClick={() => {
                const { from, to } = value;
                onDateRangeSelect(from, to);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                active
                  ? 'bg-gray-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-pressed={active}
              aria-label={`Filter by ${range.label}`}
            >
              {range.label}
            </button>
          );
        })}
      </div>
      
      {(currentFrom || currentTo) && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {currentFrom && currentTo ? (
                <>Showing: {currentFrom} to {currentTo}</>
              ) : currentFrom ? (
                <>From: {currentFrom}</>
              ) : currentTo ? (
                <>To: {currentTo}</>
              ) : null}
            </p>
            {(currentFrom || currentTo) && (
              <button
                onClick={() => onDateRangeSelect('', '')}
                className="text-xs text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300"
                aria-label="Clear date filter"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}