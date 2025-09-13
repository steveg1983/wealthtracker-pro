import { memo } from 'react';
import type { ReportFilters } from '../../services/customReportService';
import { logger } from '../../services/loggingService';

interface ReportFiltersProps {
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
}

/**
 * Report filters component
 */
export const ReportFiltersSection = memo(function ReportFiltersSection({
  filters,
  onFiltersChange
}: ReportFiltersProps) {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Report Filters
      </h3>
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.dateRange}
          onChange={(e) => onFiltersChange({ 
            ...filters, 
            dateRange: e.target.value as 'custom' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'thisYear' | 'lastYear'
          })}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
        >
          <option value="thisMonth">This Month</option>
          <option value="lastMonth">Last Month</option>
          <option value="thisQuarter">This Quarter</option>
          <option value="lastQuarter">Last Quarter</option>
          <option value="thisYear">This Year</option>
          <option value="lastYear">Last Year</option>
          <option value="custom">Custom Range</option>
        </select>
        
        {filters.dateRange === 'custom' && (
          <>
            <input
              type="date"
              value={filters.customStartDate || ''}
              onChange={(e) => onFiltersChange({ 
                ...filters, 
                customStartDate: e.target.value 
              })}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
            />
            <input
              type="date"
              value={filters.customEndDate || ''}
              onChange={(e) => onFiltersChange({ 
                ...filters, 
                customEndDate: e.target.value 
              })}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
            />
          </>
        )}
      </div>
    </div>
  );
});