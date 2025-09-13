/**
 * Date Range Selector Component
 * Handles date range selection for export
 */

import React, { useEffect } from 'react';
import type { DateRange } from '../../services/exportModalService';
import { logger } from '../../services/loggingService';

interface DateRangeSelectorProps {
  dateRange: DateRange;
  startDate: string;
  endDate: string;
  onDateRangeChange: (range: DateRange) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

const DateRangeSelector = React.memo(({
  dateRange,
  startDate,
  endDate,
  onDateRangeChange,
  onStartDateChange,
  onEndDateChange
}: DateRangeSelectorProps) => {
  const ranges: { value: DateRange; label: string }[] = [
    { value: 'all', label: 'All Time' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom' }
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Date Range
      </label>
      <div className="flex flex-wrap gap-2 mb-3">
        {ranges.map(range => (
          <button
            key={range.value}
            onClick={() => onDateRangeChange(range.value)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              dateRange === range.value
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>
      
      {dateRange === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      )}
    </div>
  );
});

DateRangeSelector.displayName = 'DateRangeSelector';

export default DateRangeSelector;