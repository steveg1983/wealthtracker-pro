import { memo, useEffect } from 'react';
import { DownloadIcon } from '../icons';
import { DataImportExportService, type ExportOptions } from '../../services/dataImportExportService';
import { logger } from '../../services/loggingService';

interface ExportTabProps {
  exportOptions: ExportOptions;
  onExportOptionsChange: (options: ExportOptions) => void;
  onExport: () => void;
  accounts: any[];
  transactions: any[];
  categories: any[];
  budgets: any[];
}

/**
 * Export tab component
 * Handles data export configuration and execution
 */
export const ExportTab = memo(function ExportTab({
  exportOptions,
  onExportOptionsChange,
  onExport,
  accounts,
  transactions,
  categories,
  budgets
}: ExportTabProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ExportTab component initialized', {
      componentName: 'ExportTab'
    });
  }, []);

  const exportCounts = DataImportExportService.countExportItems(
    exportOptions,
    accounts,
    transactions,
    categories,
    budgets
  );

  return (
    <div className="space-y-6">
      {/* Export Options */}
      <ExportOptionsSection
        exportOptions={exportOptions}
        onExportOptionsChange={onExportOptionsChange}
      />

      {/* Export Summary */}
      <ExportSummary
        counts={exportCounts}
        onExport={onExport}
      />
    </div>
  );
});

/**
 * Export options section component
 */
const ExportOptionsSection = memo(function ExportOptionsSection({
  exportOptions,
  onExportOptionsChange
}: {
  exportOptions: ExportOptions;
  onExportOptionsChange: (options: ExportOptions) => void;
}) {
  const dataTypes = [
    { key: 'includeAccounts', label: 'Accounts' },
    { key: 'includeTransactions', label: 'Transactions' },
    { key: 'includeCategories', label: 'Categories' },
    { key: 'includeBudgets', label: 'Budgets' }
  ];

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Export Options
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Export Format
          </label>
          <select
            value={exportOptions.format}
            onChange={(e) => onExportOptionsChange({
              ...exportOptions,
              format: e.target.value as 'csv' | 'json' | 'excel'
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="excel">Excel (XLSX)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Data to Include
          </label>
          <div className="space-y-2">
            {dataTypes.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={exportOptions[key as keyof ExportOptions] as boolean}
                  onChange={(e) => onExportOptionsChange({
                    ...exportOptions,
                    [key]: e.target.checked
                  })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      
      <DateRangeSelector
        dateRange={exportOptions.dateRange}
        onDateRangeChange={(dateRange) => onExportOptionsChange({
          ...exportOptions,
          dateRange
        })}
      />
    </div>
  );
});

/**
 * Date range selector component
 */
const DateRangeSelector = memo(function DateRangeSelector({
  dateRange,
  onDateRangeChange
}: {
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
}) {
  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Start Date
        </label>
        <input
          type="date"
          value={dateRange.start}
          onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          End Date
        </label>
        <input
          type="date"
          value={dateRange.end}
          onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
    </div>
  );
});

/**
 * Export summary component
 */
const ExportSummary = memo(function ExportSummary({
  counts,
  onExport
}: {
  counts: {
    accounts: number;
    transactions: number;
    categories: number;
    budgets: number;
  };
  onExport: () => void;
}) {
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Export Summary
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Accounts" count={counts.accounts} />
        <SummaryCard label="Transactions" count={counts.transactions} />
        <SummaryCard label="Categories" count={counts.categories} />
        <SummaryCard label="Budgets" count={counts.budgets} />
      </div>
      
      <div className="flex justify-end mt-6">
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
        >
          <DownloadIcon size={16} />
          Export Data
        </button>
      </div>
    </div>
  );
});

/**
 * Summary card component
 */
const SummaryCard = memo(function SummaryCard({
  label,
  count
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-gray-900 dark:text-white">
        {count}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
    </div>
  );
});