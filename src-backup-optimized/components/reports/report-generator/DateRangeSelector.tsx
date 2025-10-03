import { memo, useEffect } from 'react';
import { format } from 'date-fns';
import type { QuickRange } from '../../../services/reportGeneratorService';
import { useLogger } from '../services/ServiceProvider';

interface DateRangeSelectorProps {
  dateRange: { start: Date; end: Date };
  quickRanges: QuickRange[];
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
  onQuickRangeSelect: (rangeId: string) => void;
}

/**
 * Date range selector component
 */
export const DateRangeSelector = memo(function DateRangeSelector({ dateRange,
  quickRanges,
  onDateRangeChange,
  onQuickRangeSelect
 }: DateRangeSelectorProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('DateRangeSelector component initialized', {
      componentName: 'DateRangeSelector'
    });
  }, []);

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Date Range
      </label>
      <div className="flex gap-2 mb-3">
        {quickRanges.map(range => (
          <button
            key={range.id}
            onClick={() => onQuickRangeSelect(range.id)}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {range.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={format(dateRange.start, 'yyyy-MM-dd')}
            onChange={(e) => onDateRangeChange({
              ...dateRange,
              start: new Date(e.target.value)
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={format(dateRange.end, 'yyyy-MM-dd')}
            onChange={(e) => onDateRangeChange({
              ...dateRange,
              end: new Date(e.target.value)
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          />
        </div>
      </div>
    </div>
  );
});