import React, { useState } from 'react';
import { exportService } from '../services/exportService';
import type { ExportOptions, ExportTemplate } from '../services/exportService';
import { 
  XIcon,
  DownloadIcon,
  FileTextIcon,
  RefreshCwIcon,
  PlayIcon
} from './icons';

interface EnhancedExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultOptions?: Partial<ExportOptions>;
  title?: string;
}

export default function EnhancedExportModal({ 
  isOpen, 
  onClose, 
  defaultOptions = {},
  title = "Export Data"
}: EnhancedExportModalProps) {
  const [templates] = useState<ExportTemplate[]>(exportService.getTemplates());
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(),
    format: 'pdf',
    includeCharts: true,
    includeTransactions: true,
    includeAccounts: true,
    includeInvestments: true,
    includeBudgets: true,
    groupBy: 'category',
    ...defaultOptions
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setExportOptions({
        ...template.options,
        // Keep current date range unless template specifies otherwise
        startDate: exportOptions.startDate,
        endDate: exportOptions.endDate
      });
    }
  };

  const handleQuickDateRange = (range: string) => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(now);

    switch (range) {
      case 'this-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this-quarter': {
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStart, 1);
        break;
      }
      case 'this-year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'last-year':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
        break;
      case 'last-30-days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last-90-days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
    }

    setExportOptions({ ...exportOptions, startDate, endDate });
  };

  const handleExport = async () => {
    setIsLoading(true);
    try {
      // This would integrate with your actual data
      const mockData = {
        transactions: [],
        accounts: [],
        investments: []
      };

      if (exportOptions.format === 'pdf') {
        const pdfData = await exportService.exportToPDF(mockData, exportOptions);
        const blob = new Blob([pdfData], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `export-${exportOptions.startDate.toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportOptions.format === 'csv') {
        const csvData = await exportService.exportToCSV([], exportOptions);
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `export-${exportOptions.startDate.toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Quick Templates */}
        {templates.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Quick Templates</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.slice(0, 4).map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`p-3 text-left border rounded-lg transition-colors ${
                    selectedTemplate === template.id
                      ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileTextIcon size={14} />
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {template.name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {template.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Date Ranges */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Quick Date Ranges</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { key: 'this-month', label: 'This Month' },
              { key: 'last-month', label: 'Last Month' },
              { key: 'this-quarter', label: 'This Quarter' },
              { key: 'this-year', label: 'This Year' },
              { key: 'last-30-days', label: 'Last 30 Days' },
              { key: 'last-90-days', label: 'Last 90 Days' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleQuickDateRange(key)}
                className="px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Custom Date Range</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={exportOptions.startDate.toISOString().split('T')[0]}
                onChange={(e) => setExportOptions({
                  ...exportOptions,
                  startDate: e.target.value ? new Date(e.target.value) : new Date()
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={exportOptions.endDate.toISOString().split('T')[0]}
                onChange={(e) => setExportOptions({
                  ...exportOptions,
                  endDate: e.target.value ? new Date(e.target.value) : new Date()
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Export Options */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Export Options</h4>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Format</label>
              <select
                value={exportOptions.format}
                onChange={(e) => setExportOptions({
                  ...exportOptions,
                  format: e.target.value as ExportOptions['format']
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="pdf">PDF Report</option>
                <option value="csv">CSV Data</option>
                <option value="xlsx">Excel</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Group By</label>
              <select
                value={exportOptions.groupBy || 'none'}
                onChange={(e) => setExportOptions({
                  ...exportOptions,
                  groupBy: e.target.value as ExportOptions['groupBy']
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="none">No Grouping</option>
                <option value="category">Category</option>
                <option value="account">Account</option>
                <option value="month">Month</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { key: 'includeTransactions', label: 'Transactions' },
              { key: 'includeAccounts', label: 'Accounts' },
              { key: 'includeInvestments', label: 'Investments' },
              { key: 'includeBudgets', label: 'Budgets' },
              { key: 'includeCharts', label: 'Charts', disabled: exportOptions.format !== 'pdf' }
            ].map(({ key, label, disabled }) => (
              <label key={key} className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions[key as keyof ExportOptions] as boolean}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    [key]: e.target.checked
                  })}
                  disabled={disabled}
                  className="mr-2"
                />
                <span className={`text-xs ${disabled ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.open('/export-manager', '_blank')}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
            >
              <PlayIcon size={14} />
              Advanced Options
            </button>
            
            <button
              onClick={handleExport}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
            >
              {isLoading ? <RefreshCwIcon size={16} className="animate-spin" /> : <DownloadIcon size={16} />}
              {isLoading ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
