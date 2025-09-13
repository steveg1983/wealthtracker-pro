import React, { useEffect, memo } from 'react';
import { CalendarIcon, FilterIcon } from '../icons';
import type { DateRange } from '../../services/reportsPageService';
import type { Account } from '../../types';
import { logger } from '../../services/loggingService';

interface ReportFiltersProps {
  dateRange: DateRange;
  selectedAccount: string;
  customStartDate: string;
  customEndDate: string;
  accounts: Account[];
  onDateRangeChange: (range: DateRange) => void;
  onAccountChange: (accountId: string) => void;
  onCustomStartDateChange: (date: string) => void;
  onCustomEndDateChange: (date: string) => void;
}

const ReportFilters = memo(function ReportFilters({
  dateRange,
  selectedAccount,
  customStartDate,
  customEndDate,
  accounts,
  onDateRangeChange,
  onAccountChange,
  onCustomStartDateChange,
  onCustomEndDateChange
}: ReportFiltersProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ReportFilters component initialized', {
      componentName: 'ReportFilters'
    });
  }, []);
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4 mb-6">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-gray-500" size={20} />
          <select
            value={dateRange}
            onChange={(e) => onDateRangeChange(e.target.value as DateRange)}
            className="px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
          >
            <option value="month">Last Month</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Last Year</option>
            <option value="all">All Time</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <FilterIcon className="text-gray-500" size={20} />
          <select
            value={selectedAccount}
            onChange={(e) => onAccountChange(e.target.value)}
            className="px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
          >
            <option value="all">All Accounts</option>
            {accounts.map(account => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        </div>

        {dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">From:</label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => onCustomStartDateChange(e.target.value)}
              className="px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            />
            <label className="text-sm text-gray-600 dark:text-gray-400">To:</label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => onCustomEndDateChange(e.target.value)}
              className="px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            />
          </div>
        )}
      </div>
    </div>
  );
});

export default ReportFilters;