import { memo, useEffect } from 'react';
import { CalendarIcon } from '../../icons';
import type { Query, FieldOption } from '../../../services/queryBuilderService';
import { useLogger } from '../services/ServiceProvider';

interface DateRangeFilterProps {
  dateRange?: Query['dateRange'];
  fields: FieldOption[];
  onDateRangeChange: (dateRange: Query['dateRange'] | undefined) => void;
}

/**
 * Date range filter component
 * Handles date range filtering for queries
 */
export const DateRangeFilter = memo(function DateRangeFilter({ dateRange,
  fields,
  onDateRangeChange
 }: DateRangeFilterProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('DateRangeFilter component initialized', {
      componentName: 'DateRangeFilter'
    });
  }, []);

  const dateFields = fields.filter(f => f.type === 'date');

  return (
    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <CalendarIcon size={20} className="text-gray-600 dark:text-gray-400" />
        <h3 className="font-medium text-gray-900 dark:text-white">Date Range</h3>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <select
          value={dateRange?.field || ''}
          onChange={(e) => onDateRangeChange(
            e.target.value 
              ? { field: e.target.value, start: dateRange?.start || '', end: dateRange?.end || '' }
              : undefined
          )}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
        >
          <option value="">No date filter</option>
          {dateFields.map(field => (
            <option key={field.value} value={field.value}>{field.label}</option>
          ))}
        </select>
        {dateRange && (
          <>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
            />
          </>
        )}
      </div>
    </div>
  );
});
