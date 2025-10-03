import { memo } from 'react';
import type { ExportOptions } from '../../services/export';

interface ExportOptionsPanelProps {
  exportOptions: ExportOptions;
  setExportOptions: React.Dispatch<React.SetStateAction<ExportOptions>>;
}

/**
 * Panel for configuring export options
 * Handles date range, format selection, and content inclusion
 */
export const ExportOptionsPanel = memo(function ExportOptionsPanel({
  exportOptions,
  setExportOptions
}: ExportOptionsPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Export Options</h3>
      
      {/* Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Start Date
          </label>
          <input
            type="date"
            value={exportOptions.startDate.toISOString().split('T')[0]}
            onChange={(e) => setExportOptions({
              ...exportOptions,
              startDate: new Date(e.target.value)
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            End Date
          </label>
          <input
            type="date"
            value={exportOptions.endDate.toISOString().split('T')[0]}
            onChange={(e) => setExportOptions({
              ...exportOptions,
              endDate: new Date(e.target.value)
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Format Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Export Format
        </label>
        <select
          value={exportOptions.format}
          onChange={(e) => setExportOptions({
            ...exportOptions,
            format: e.target.value as ExportOptions['format']
          })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="pdf">PDF Report</option>
          <option value="csv">CSV Spreadsheet</option>
          <option value="json">JSON Data</option>
          <option value="xlsx">Excel Workbook</option>
        </select>
      </div>

      {/* Include Options */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Include in Export</h4>
        
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={exportOptions.includeTransactions}
            onChange={(e) => setExportOptions({
              ...exportOptions,
              includeTransactions: e.target.checked
            })}
            className="w-4 h-4 text-[var(--color-primary)] rounded"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Transactions</span>
        </label>

        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={exportOptions.includeAccounts}
            onChange={(e) => setExportOptions({
              ...exportOptions,
              includeAccounts: e.target.checked
            })}
            className="w-4 h-4 text-[var(--color-primary)] rounded"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Account Summaries</span>
        </label>

        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={exportOptions.includeInvestments}
            onChange={(e) => setExportOptions({
              ...exportOptions,
              includeInvestments: e.target.checked
            })}
            className="w-4 h-4 text-[var(--color-primary)] rounded"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Investment Portfolio</span>
        </label>

        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={exportOptions.includeBudgets}
            onChange={(e) => setExportOptions({
              ...exportOptions,
              includeBudgets: e.target.checked
            })}
            className="w-4 h-4 text-[var(--color-primary)] rounded"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Budget Analysis</span>
        </label>

        {exportOptions.format === 'pdf' && (
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={exportOptions.includeCharts}
              onChange={(e) => setExportOptions({
                ...exportOptions,
                includeCharts: e.target.checked
              })}
              className="w-4 h-4 text-[var(--color-primary)] rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Include Charts & Visualizations</span>
          </label>
        )}
      </div>

      {/* Group By Option */}
      {exportOptions.includeTransactions && (
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Group Transactions By
          </label>
          <select
            value={exportOptions.groupBy}
            onChange={(e) => setExportOptions({
              ...exportOptions,
              groupBy: e.target.value as ExportOptions['groupBy']
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="none">No Grouping</option>
            <option value="category">Category</option>
            <option value="account">Account</option>
            <option value="date">Date</option>
            <option value="month">Month</option>
          </select>
        </div>
      )}
    </div>
  );
});