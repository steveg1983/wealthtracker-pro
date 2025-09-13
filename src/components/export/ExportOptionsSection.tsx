import React, { useEffect, memo } from 'react';
import {
  FileTextIcon,
  ArrowRightLeftIcon,
  WalletIcon,
  PieChartIcon,
  TagIcon,
  BarChart3Icon,
  CalendarIcon,
  SettingsIcon
} from '../icons';
import type { ExportOptions } from './types';
import { logger } from '../../services/loggingService';

interface ExportOptionsSectionProps {
  options: ExportOptions;
  setOptions: (options: ExportOptions) => void;
}

export const ExportOptionsSection = memo(function ExportOptionsSection({ 
  options, 
  setOptions 
}: ExportOptionsSectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ExportOptionsSection component initialized', {
      componentName: 'ExportOptionsSection'
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Export Options */}
      <div>
        <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
          <FileTextIcon size={20} />
          Select Data to Export
        </h3>
        <div className="space-y-2">
          {[
            { key: 'transactions', label: 'Transactions', icon: <ArrowRightLeftIcon /> },
            { key: 'accounts', label: 'Accounts', icon: <WalletIcon /> },
            { key: 'budgets', label: 'Budgets', icon: <PieChartIcon /> },
            { key: 'categories', label: 'Categories', icon: <TagIcon /> },
            { key: 'summary', label: 'Summary Report', icon: <BarChart3Icon /> }
          ].map(({ key, label, icon }) => (
            <label key={key} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 
                                      dark:hover:bg-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={options[key as keyof ExportOptions] as boolean}
                onChange={(e) => setOptions({
                  ...options,
                  [key]: e.target.checked
                })}
                className="rounded"
              />
              <span className="flex items-center gap-2">
                {icon}
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div>
        <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
          <CalendarIcon size={20} />
          Date Range (for transactions)
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={options.dateRange.start?.toISOString().split('T')[0] || ''}
              onChange={(e) => setOptions({
                ...options,
                dateRange: {
                  ...options.dateRange,
                  start: e.target.value ? new Date(e.target.value) : null
                }
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={options.dateRange.end?.toISOString().split('T')[0] || ''}
              onChange={(e) => setOptions({
                ...options,
                dateRange: {
                  ...options.dateRange,
                  end: e.target.value ? new Date(e.target.value) : null
                }
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-800"
            />
          </div>
        </div>
      </div>

      {/* Grouping Options */}
      <div>
        <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
          <SettingsIcon size={20} />
          Transaction Grouping
        </h3>
        <select
          value={options.groupBy}
          onChange={(e) => setOptions({
            ...options,
            groupBy: e.target.value as ExportOptions['groupBy']
          })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                   bg-white dark:bg-gray-800"
        >
          <option value="none">No Grouping</option>
          <option value="month">Group by Month</option>
          <option value="category">Group by Category</option>
          <option value="account">Group by Account</option>
        </select>
      </div>

      {/* Formatting Options */}
      <div>
        <h3 className="text-lg font-medium mb-3">Formatting Options</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.formatting.highlightNegative}
              onChange={(e) => setOptions({
                ...options,
                formatting: {
                  ...options.formatting,
                  highlightNegative: e.target.checked
                }
              })}
              className="rounded"
            />
            <span className="text-sm">Highlight negative values</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.formatting.zebra}
              onChange={(e) => setOptions({
                ...options,
                formatting: {
                  ...options.formatting,
                  zebra: e.target.checked
                }
              })}
              className="rounded"
            />
            <span className="text-sm">Zebra striping</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.formatting.autoFilter}
              onChange={(e) => setOptions({
                ...options,
                formatting: {
                  ...options.formatting,
                  autoFilter: e.target.checked
                }
              })}
              className="rounded"
            />
            <span className="text-sm">Enable auto-filters</span>
          </label>
        </div>
      </div>
    </div>
  );
});