import React, { useState, useEffect } from 'react';
import { exportService } from '../services/exportService';
import type { ExportOptions, ExportTemplate, ScheduledReport } from '../services/exportService';
import { useApp } from '../contexts/AppContextSupabase';
import { 
  DownloadIcon,
  CalendarIcon,
  ClockIcon,
  FileTextIcon,
  MailIcon,
  SettingsIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  PlayIcon,
  StopIcon,
  EyeIcon,
  CopyIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  RefreshCwIcon
} from '../components/icons';
import PageWrapper from '../components/PageWrapper';
import type { Investment } from '../types';
import { logger } from '../services/loggingService';

type ActiveTab = 'export' | 'templates' | 'scheduled' | 'history';

export default function ExportManager() {
  const { transactions, accounts, budgets, investments = [] } = useApp();
  // Investments now properly integrated from AppContext
  const [activeTab, setActiveTab] = useState<ActiveTab>('export');
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
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
    groupBy: 'category'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setTemplates(exportService.getTemplates());
    setScheduledReports(exportService.getScheduledReports());
  };

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const data: {
        transactions?: typeof transactions;
        accounts?: typeof accounts;
        investments?: typeof investments;
        budgets?: typeof budgets;
      } = {};

      if (exportOptions.includeTransactions) {
        data.transactions = transactions;
      }
      if (exportOptions.includeAccounts) {
        data.accounts = accounts;
      }
      if (exportOptions.includeInvestments) {
        data.investments = investments;
      }
      if (exportOptions.includeBudgets) {
        data.budgets = budgets;
      }

      if (exportOptions.format === 'pdf') {
        const pdfData = await exportService.exportToPDF(data, exportOptions);
        const blob = new Blob([pdfData], { type: 'application/pdf' });
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
      logger.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
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

  const handleCreateScheduledReport = () => {
    const name = prompt('Enter report name:');
    if (!name) return;

    const email = prompt('Enter email address:');
    if (!email) return;

    const frequency = prompt('Enter frequency (daily, weekly, monthly, quarterly):') as ScheduledReport['frequency'];
    if (!['daily', 'weekly', 'monthly', 'quarterly'].includes(frequency)) {
      alert('Invalid frequency');
      return;
    }

    exportService.createScheduledReport({
      name,
      email,
      frequency,
      options: exportOptions,
      isActive: true
    });

    loadData();
  };

  const handleToggleScheduledReport = (id: string) => {
    const report = scheduledReports.find(r => r.id === id);
    if (report) {
      exportService.updateScheduledReport(id, { isActive: !report.isActive });
      loadData();
    }
  };

  const handleDeleteScheduledReport = (id: string) => {
    if (confirm('Are you sure you want to delete this scheduled report?')) {
      exportService.deleteScheduledReport(id);
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

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <PageWrapper title="Export Manager">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-600 to-purple-600 dark:from-gray-800 dark:to-purple-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Export Manager</h1>
              <p className="text-blue-100">
                Generate reports, schedule exports, and manage templates
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
                onClick={() => setActiveTab('scheduled')}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'scheduled'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ClockIcon size={16} />
                  Scheduled ({scheduledReports.filter(r => r.isActive).length})
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

                {/* Format and Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Format
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
                      <option value="csv">CSV Data</option>
                      <option value="xlsx">Excel Spreadsheet</option>
                      <option value="json">JSON Data</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Group By
                    </label>
                    <select
                      value={exportOptions.groupBy || 'none'}
                      onChange={(e) => {
                        const nextGroupBy = e.target.value as NonNullable<ExportOptions['groupBy']>;
                        setExportOptions(prev => ({
                          ...prev,
                          groupBy: nextGroupBy
                        }));
                      }}
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
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exportOptions.includeTransactions}
                        onChange={(e) => setExportOptions({
                          ...exportOptions,
                          includeTransactions: e.target.checked
                        })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Transactions</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exportOptions.includeAccounts}
                        onChange={(e) => setExportOptions({
                          ...exportOptions,
                          includeAccounts: e.target.checked
                        })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Accounts</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exportOptions.includeInvestments}
                        onChange={(e) => setExportOptions({
                          ...exportOptions,
                          includeInvestments: e.target.checked
                        })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Investments</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exportOptions.includeBudgets}
                        onChange={(e) => setExportOptions({
                          ...exportOptions,
                          includeBudgets: e.target.checked
                        })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Budgets</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exportOptions.includeCharts}
                        onChange={(e) => setExportOptions({
                          ...exportOptions,
                          includeCharts: e.target.checked
                        })}
                        className="mr-2"
                        disabled={exportOptions.format !== 'pdf'}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Charts</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleExport}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
                >
                  {isLoading ? <RefreshCwIcon size={16} className="animate-spin" /> : <DownloadIcon size={16} />}
                  {isLoading ? 'Generating...' : 'Export Now'}
                </button>

                <button
                  onClick={handleSaveAsTemplate}
                  className="flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FileTextIcon size={16} />
                  Save as Template
                </button>

                <button
                  onClick={handleCreateScheduledReport}
                  className="flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ClockIcon size={16} />
                  Schedule Report
                </button>
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
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-gray-900/20 dark:text-blue-200 px-2 py-1 rounded">
                              Default
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUseTemplate(template)}
                            className="p-1 text-gray-600 dark:text-gray-500 hover:text-blue-900 dark:hover:text-gray-300"
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

        {/* Scheduled Reports Tab */}
        {activeTab === 'scheduled' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Scheduled Reports</h3>
                <button
                  onClick={() => setActiveTab('export')}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
                >
                  <PlusIcon size={16} />
                  Schedule Report
                </button>
              </div>
            </div>

            <div className="p-6">
              {scheduledReports.length === 0 ? (
                <div className="text-center py-8">
                  <ClockIcon size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400">No scheduled reports</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scheduledReports.map((report) => (
                    <div key={report.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">{report.name}</h4>
                            <span className={`text-xs px-2 py-1 rounded ${
                              report.isActive 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                            }`}>
                              {report.isActive ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <div>
                              <div className="font-medium">Email</div>
                              <div>{report.email}</div>
                            </div>
                            <div>
                              <div className="font-medium">Frequency</div>
                              <div className="capitalize">{report.frequency}</div>
                            </div>
                            <div>
                              <div className="font-medium">Next Run</div>
                              <div>{formatDateTime(report.nextRun)}</div>
                            </div>
                            <div>
                              <div className="font-medium">Last Run</div>
                              <div>{report.lastRun ? formatDateTime(report.lastRun) : 'Never'}</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleToggleScheduledReport(report.id)}
                            className={`p-2 rounded ${
                              report.isActive
                                ? 'text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300'
                                : 'text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300'
                            }`}
                            title={report.isActive ? 'Pause report' : 'Resume report'}
                          >
                            {report.isActive ? <StopIcon size={16} /> : <PlayIcon size={16} />}
                          </button>
                          <button
                            onClick={() => handleDeleteScheduledReport(report.id)}
                            className="p-2 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            title="Delete report"
                          >
                            <TrashIcon size={16} />
                          </button>
                        </div>
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
                This feature tracks all generated exports and scheduled report deliveries
              </p>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
