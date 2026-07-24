import React, { useState, useEffect, lazy, Suspense } from 'react';
import { exportService } from '../services/exportService';
import type { ExportOptions, ExportTemplate } from '../services/exportService';
import { useApp } from '../contexts/AppContextSupabase';
import {
  DownloadIcon,
  CalendarIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  PlusIcon,
  TrashIcon,
  PlayIcon,
  RefreshCwIcon,
  CheckIcon
} from '../components/icons';
import PageWrapper from '../components/PageWrapper';
import PageTip from '../components/PageTip';
import { LoadingState } from '../components/loading/LoadingState';
import type { Investment } from '../types';
import { createScopedLogger } from '../loggers/scopedLogger';

// The advanced report builder (templated PDF/Excel/CSV) and the dedicated Excel
// exporter both used to live under Settings ▸ Data Management. They move here so
// every way OUT of the app is on one page. Kept lazy — moving a component must
// not turn its chunk into an always-loaded static import.
const EnhancedExportManager = lazy(() => import('../components/EnhancedExportManager'));
const ExcelExport = lazy(() => import('../components/ExcelExport'));

const exportManagerLogger = createScopedLogger('ExportManagerPage');

// Scheduled exports were removed. The "Schedule Report" control only wrote a row
// to localStorage — nothing server-side ever ran, so no report was ever
// delivered. A control that pretends to schedule erodes trust in the controls
// that DO work, so it was cut rather than carried across, and the orphaned
// scheduled-report methods were deleted from exportService with it.
type ActiveTab = 'export' | 'templates' | 'history';

export default function ExportManager() {
  const { transactions, accounts, budgets, goals, categories, tags, recurringTransactions } = useApp();
  const investments: Investment[] = []; // TODO: Add investments to AppContext
  const [activeTab, setActiveTab] = useState<ActiveTab>('export');
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showExcelExport, setShowExcelExport] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(),
    format: 'pdf',
    includeCharts: true,
    includeTransactions: true,
    includeAccounts: true,
    includeInvestments: true,
    includeBudgets: true,
    groupBy: 'category'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setTemplates(exportService.getTemplates());
  };

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const data = {
        transactions: exportOptions.includeTransactions ? transactions : undefined,
        accounts: exportOptions.includeAccounts ? accounts : undefined,
        investments: exportOptions.includeInvestments ? investments : undefined
      };

      if (exportOptions.format === 'pdf') {
        const pdfData = await exportService.exportToPDF(data, exportOptions);
        const blob = new Blob([new Uint8Array(pdfData)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `financial-report-${exportOptions.startDate.toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportOptions.format === 'csv') {
        const csvData = await exportService.exportToCSV(
          exportOptions.includeTransactions ? transactions : accounts,
          exportOptions
        );
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
    } catch (error) {
      exportManagerLogger.error('Export failed', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // GDPR Art. 20 (portability) / Art. 15 (access): one click exports EVERY
  // entity the app holds for the user as machine-readable JSON — unlike the
  // configurable export above, nothing is filtered or optional.
  const handleExportEverything = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      application: 'WealthTracker',
      format: 'wealthtracker-complete-export-v1',
      data: {
        accounts,
        transactions,
        budgets,
        goals,
        categories,
        tags,
        recurringTransactions
      }
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wealthtracker-complete-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUseTemplate = (template: ExportTemplate) => {
    setExportOptions({
      ...template.options,
      // Update dates to current period if using relative dates
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      endDate: new Date()
    });
    setActiveTab('export');
  };

  const handleSaveAsTemplate = () => {
    const name = prompt('Enter template name:');
    if (!name) return;

    const description = prompt('Enter template description (optional):') || '';

    exportService.createTemplate({
      name,
      description,
      options: exportOptions,
      isDefault: false
    });

    loadData();
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      exportService.deleteTemplate(id);
      loadData();
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <PageWrapper title="Export Data">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-[#1a2332] dark:bg-gray-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Export Data</h1>
              <p className="text-white/70">
                Generate reports, export to Excel, and save reusable export templates
              </p>
            </div>
            <DownloadIcon size={48} className="text-white/80" />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('export')}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'export'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <DownloadIcon size={16} />
                  Quick Export
                </div>
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'templates'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileTextIcon size={16} />
                  Templates ({templates.length})
                </div>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} />
                  History
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Quick Export Tab */}
        {activeTab === 'export' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Export Options */}
            <div className="lg:col-span-2 space-y-6">
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
                      aria-label="Start date"
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
                      aria-label="End date"
                      value={exportOptions.endDate.toISOString().split('T')[0]}
                      onChange={(e) => setExportOptions({
                        ...exportOptions,
                        endDate: new Date(e.target.value)
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Format and Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Format
                    </label>
                    {/* Only the formats this quick export actually produces. Excel
                        lives in the Excel Export / Advanced Report tools below, and
                        full JSON in "Export everything" — offering dead xlsx/json
                        options here would be the same broken-control problem as the
                        removed scheduler. */}
                    <select
                      aria-label="Export format"
                      value={exportOptions.format}
                      onChange={(e) => setExportOptions({
                        ...exportOptions,
                        format: e.target.value as ExportOptions['format']
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="pdf">PDF Report</option>
                      <option value="csv">CSV Data</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Group By
                    </label>
                    <select
                      aria-label="Group by"
                      value={exportOptions.groupBy || 'none'}
                      onChange={(e) => setExportOptions({
                        ...exportOptions,
                        groupBy: e.target.value as ExportOptions['groupBy']
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="none">No Grouping</option>
                      <option value="category">Category</option>
                      <option value="account">Account</option>
                      <option value="month">Month</option>
                    </select>
                  </div>
                </div>

                {/* Include Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Include in Export
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {([
                      { key: 'includeTransactions' as const, label: 'Transactions' },
                      { key: 'includeAccounts' as const, label: 'Accounts' },
                      { key: 'includeInvestments' as const, label: 'Investments' },
                      { key: 'includeBudgets' as const, label: 'Budgets' },
                      { key: 'includeCharts' as const, label: 'Charts', disabled: exportOptions.format !== 'pdf' },
                    ]).map(({ key, label, disabled }) => {
                      const checked = exportOptions[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => !disabled && setExportOptions({ ...exportOptions, [key]: !checked })}
                          disabled={disabled}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                            disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                          } ${
                            checked
                              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                              : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-650'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                            checked ? 'bg-[#1a2332] text-white' : 'border border-gray-300 dark:border-gray-500'
                          }`}>
                            {checked && <CheckIcon size={12} />}
                          </div>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleExport}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
                >
                  {isLoading ? <RefreshCwIcon size={16} className="animate-spin" /> : <DownloadIcon size={16} />}
                  {isLoading ? 'Generating...' : 'Export Now'}
                </button>

                {/* Advanced, templated reports (Monthly Statement, Tax Summary,
                    Net Worth, …) as PDF/Excel/CSV — the richer builder ExportManager
                    lacked. Self-contained trigger + modal. */}
                <Suspense fallback={<LoadingState />}>
                  <EnhancedExportManager />
                </Suspense>

                <button
                  onClick={() => setShowExcelExport(true)}
                  className="flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FileSpreadsheetIcon size={16} />
                  Excel Export
                </button>

                <button
                  onClick={handleSaveAsTemplate}
                  className="flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FileTextIcon size={16} />
                  Save as Template
                </button>

                <button
                  onClick={handleExportEverything}
                  title="Download every record we hold for you as machine-readable JSON (GDPR data portability)"
                  className="flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <DownloadIcon size={16} />
                  Export everything (JSON)
                </button>
                {/* NOTE: no "Schedule Report" button here by design — see the
                    scheduled-exports comment at the top of this file. */}
              </div>
            </div>

            {/* Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Preview</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Period:</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatDate(exportOptions.startDate)} - {formatDate(exportOptions.endDate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Format:</span>
                  <span className="text-gray-900 dark:text-white uppercase">{exportOptions.format}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Transactions:</span>
                  <span className="text-gray-900 dark:text-white">
                    {exportOptions.includeTransactions ? transactions.length : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Accounts:</span>
                  <span className="text-gray-900 dark:text-white">
                    {exportOptions.includeAccounts ? accounts.length : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Investments:</span>
                  <span className="text-gray-900 dark:text-white">
                    {exportOptions.includeInvestments ? investments.length : 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Export Templates</h3>
                <button
                  onClick={() => setActiveTab('export')}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
                >
                  <PlusIcon size={16} />
                  Create Template
                </button>
              </div>
            </div>

            <div className="p-6">
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <FileTextIcon size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400">No templates created yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <div key={template.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {template.name}
                          {template.isDefault && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200 px-2 py-1 rounded">
                              Default
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUseTemplate(template)}
                            className="p-1 text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                            title="Use template"
                          >
                            <PlayIcon size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-1 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            title="Delete template"
                            disabled={template.isDefault}
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {template.description}
                      </p>
                      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <div>Format: {template.options.format.toUpperCase()}</div>
                        <div>
                          Includes: {[
                            template.options.includeTransactions && 'Transactions',
                            template.options.includeAccounts && 'Accounts',
                            template.options.includeInvestments && 'Investments',
                            template.options.includeBudgets && 'Budgets',
                            template.options.includeCharts && 'Charts'
                          ].filter(Boolean).join(', ')}
                        </div>
                        <div>Created: {formatDate(template.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Export History</h3>
            <div className="text-center py-8">
              <CalendarIcon size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 dark:text-gray-400">Export history will be displayed here</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                This feature will track all generated exports
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dedicated Excel exporter (rich formatting, multiple entity sheets).
          Mounted only while open so its XLSX chunk stays deferred until used. */}
      {showExcelExport && (
        <Suspense fallback={<LoadingState />}>
          <ExcelExport
            isOpen={showExcelExport}
            onClose={() => setShowExcelExport(false)}
          />
        </Suspense>
      )}

      <PageTip id="export-intro" title="Export your data" description="Download your transactions, accounts, and reports in PDF, Excel, or CSV format. Perfect for backups or analysis in spreadsheets." />
    </PageWrapper>
  );
}
