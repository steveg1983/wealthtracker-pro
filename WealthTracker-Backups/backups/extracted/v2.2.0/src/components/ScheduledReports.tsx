import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useNotifications } from '../contexts/NotificationContext';
import { 
  CalendarIcon, 
  ClockIcon, 
  MailIcon, 
  DownloadIcon, 
  PlusIcon, 
  XIcon,
  EditIcon,
  PlayIcon,
  CheckIcon,
  CopyIcon,
  FileTextIcon
} from './icons';
import { generatePDFReport } from '../utils/pdfExport';
import { exportTransactionsToCSV } from '../utils/csvExport';
import type { Account, Category } from '../types';
import { logger } from '../services/loggingService';

interface ScheduledReport {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:MM format
  format: 'pdf' | 'csv' | 'summary';
  includeCharts: boolean;
  recipients?: string[]; // Email addresses for future implementation
  lastRun?: Date;
  nextRun: Date;
  enabled: boolean;
  reportConfig: {
    dateRange: 'month' | 'quarter' | 'year' | 'custom';
    customDays?: number; // For custom range - last X days
    includeAccounts: string[]; // Account IDs to include
    includeCategories?: string[]; // Category IDs to include
  };
}

export default function ScheduledReports() {
  const { transactions, accounts, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { addNotification } = useNotifications();
  
  const [reports, setReports] = useState<ScheduledReport[]>(() => {
    try {
      const saved = localStorage.getItem('money_management_scheduled_reports');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showAddReport, setShowAddReport] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);
  const [generatedReport, setGeneratedReport] = useState<{
    content: string;
    format: 'pdf' | 'csv' | 'summary';
    filename: string;
  } | null>(null);

  // Save reports to localStorage
  useEffect(() => {
    localStorage.setItem('money_management_scheduled_reports', JSON.stringify(reports));
  }, [reports]);

  // Check for due reports
  useEffect(() => {
    const checkDueReports = () => {
      const now = new Date();
      
      reports.forEach(report => {
        if (report.enabled && new Date(report.nextRun) <= now) {
          generateReport(report);
          updateNextRunTime(report.id);
        }
      });
    };

    // Check every minute
    const interval = setInterval(checkDueReports, 60000);
    checkDueReports(); // Check immediately

    return () => clearInterval(interval);
  }, [reports]);

  const calculateNextRun = (report: ScheduledReport, fromDate: Date = new Date()): Date => {
    const [hours, minutes] = report.time.split(':').map(Number);
    const nextRun = new Date(fromDate);
    nextRun.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, start from tomorrow
    if (nextRun <= fromDate) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    switch (report.frequency) {
      case 'daily':
        // Already set correctly
        break;
      
      case 'weekly': {
        const targetDay = report.dayOfWeek || 1; // Default to Monday
        while (nextRun.getDay() !== targetDay) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      }
      
      case 'monthly': {
        const targetDate = report.dayOfMonth || 1;
        nextRun.setDate(targetDate);
        // If we've passed this month's date, go to next month
        if (nextRun <= fromDate) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;
      }
      
      case 'quarterly': {
        // Find next quarter start
        const currentQuarter = Math.floor(nextRun.getMonth() / 3);
        const nextQuarter = currentQuarter + 1;
        nextRun.setMonth(nextQuarter * 3, 1);
        break;
      }
      
      case 'yearly':
        nextRun.setMonth(0, 1); // January 1st
        if (nextRun <= fromDate) {
          nextRun.setFullYear(nextRun.getFullYear() + 1);
        }
        break;
    }

    return nextRun;
  };

  const updateNextRunTime = (reportId: string) => {
    setReports(prev => prev.map(report => {
      if (report.id === reportId) {
        const lastRun = new Date();
        const nextRun = calculateNextRun(report, lastRun);
        return { ...report, lastRun, nextRun };
      }
      return report;
    }));
  };

  const generateReport = async (report: ScheduledReport) => {
    try {
      // Filter transactions based on report config
      const now = new Date();
      const startDate = new Date();
      
      switch (report.reportConfig.dateRange) {
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        case 'custom':
          startDate.setDate(now.getDate() - (report.reportConfig.customDays || 30));
          break;
      }

      const filteredTransactions = transactions.filter(t => {
        const transDate = new Date(t.date);
        const dateMatch = transDate >= startDate;
        const accountMatch = report.reportConfig.includeAccounts.length === 0 || 
          report.reportConfig.includeAccounts.includes(t.accountId);
        const categoryMatch = !report.reportConfig.includeCategories || 
          report.reportConfig.includeCategories.length === 0 || 
          report.reportConfig.includeCategories.includes(t.category);
        
        return dateMatch && accountMatch && categoryMatch;
      });

      if (report.format === 'summary') {
        // Generate text summary
        const income = filteredTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        
        const expenses = filteredTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);

        const summary = `
Financial Report: ${report.name}
Generated: ${new Date().toLocaleString()}
Period: ${report.reportConfig.dateRange === 'custom' ? `Last ${report.reportConfig.customDays} days` : `Last ${report.reportConfig.dateRange}`}

Summary:
- Total Income: ${formatCurrency(income)}
- Total Expenses: ${formatCurrency(expenses)}
- Net Income: ${formatCurrency(income - expenses)}
- Transactions: ${filteredTransactions.length}

Top Expenses by Category:
${Object.entries(
  filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const category = categories.find(c => c.id === t.category)?.name || 'Uncategorized';
      acc[category] = (acc[category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>)
)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 5)
  .map(([cat, amount]) => `- ${cat}: ${formatCurrency(amount)}`)
  .join('\n')}
`;

        setGeneratedReport({
          content: summary,
          format: 'summary',
          filename: `${report.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`
        });

      } else if (report.format === 'csv') {
        const csv = exportTransactionsToCSV(filteredTransactions, accounts);
        
        setGeneratedReport({
          content: csv,
          format: 'csv',
          filename: `${report.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`
        });

      } else if (report.format === 'pdf') {
        // For PDF, we'll show a notification to download
        addNotification({
          type: 'info',
          title: 'Report Ready',
          action: {
            label: 'Download PDF',
            onClick: async () => {
              const reportData = {
                title: report.name,
                dateRange: `Last ${report.reportConfig.dateRange}`,
                summary: {
                  income: filteredTransactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + t.amount, 0),
                  expenses: filteredTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + t.amount, 0),
                  netIncome: 0,
                  savingsRate: 0
                },
                categoryBreakdown: [],
                topTransactions: filteredTransactions.slice(0, 10)
              };
              
              reportData.summary.netIncome = reportData.summary.income - reportData.summary.expenses;
              reportData.summary.savingsRate = reportData.summary.income > 0 
                ? (reportData.summary.netIncome / reportData.summary.income) * 100 
                : 0;

              await generatePDFReport(reportData, accounts);
            }
          }
        });
      }

      // Send notification
      addNotification({
        type: 'success',
        title: `Report Generated: ${report.name}`,
        action: report.format !== 'pdf' ? {
          label: 'View Report',
          onClick: () => {}
        } : undefined
      });

    } catch (error) {
      logger.error('Error generating report:', error);
      addNotification({
        type: 'error',
        title: 'Report Generation Failed',
        message: `Failed to generate ${report.name}`
      });
    }
  };

  const handleAddReport = (reportData: Partial<ScheduledReport>) => {
    const newReport: ScheduledReport = {
      id: Date.now().toString(),
      name: reportData.name || 'New Report',
      frequency: reportData.frequency || 'monthly',
      dayOfWeek: reportData.dayOfWeek,
      dayOfMonth: reportData.dayOfMonth,
      time: reportData.time || '09:00',
      format: reportData.format || 'summary',
      includeCharts: reportData.includeCharts || false,
      recipients: reportData.recipients || [],
      enabled: true,
      nextRun: new Date(),
      reportConfig: reportData.reportConfig || {
        dateRange: 'month',
        includeAccounts: []
      }
    };

    newReport.nextRun = calculateNextRun(newReport);
    setReports(prev => [...prev, newReport]);
    setShowAddReport(false);
  };

  const handleUpdateReport = (reportId: string, updates: Partial<ScheduledReport>) => {
    setReports(prev => prev.map(report => {
      if (report.id === reportId) {
        const updated = { ...report, ...updates };
        if (updates.frequency || updates.time || updates.dayOfWeek || updates.dayOfMonth) {
          updated.nextRun = calculateNextRun(updated);
        }
        return updated;
      }
      return report;
    }));
  };

  const handleDeleteReport = (reportId: string) => {
    setReports(prev => prev.filter(report => report.id !== reportId));
  };

  const downloadReport = () => {
    if (!generatedReport) return;

    const blob = new Blob([generatedReport.content], { 
      type: generatedReport.format === 'csv' ? 'text/csv' : 'text/plain' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generatedReport.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyReportToClipboard = () => {
    if (!generatedReport) return;
    
    navigator.clipboard.writeText(generatedReport.content).then(() => {
      addNotification({
        type: 'success',
        title: 'Report Copied',
        message: 'Report content copied to clipboard'
      });
    });
  };

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarIcon size={24} className="text-primary" />
          <h2 className="text-xl font-semibold text-theme-heading dark:text-white">Scheduled Reports</h2>
        </div>
        <button
          onClick={() => setShowAddReport(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <PlusIcon size={16} />
          Add Report
        </button>
      </div>

      {/* Instructions */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Schedule automated reports to be generated at specific times. Reports will be ready for download or copying when generated.
          For email delivery, copy the report and paste it into your email client.
        </p>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="text-center py-8">
          <ClockIcon size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No scheduled reports yet</p>
          <button
            onClick={() => setShowAddReport(true)}
            className="mt-4 text-primary hover:underline"
          >
            Create your first scheduled report
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(report => (
            <div
              key={report.id}
              className={`p-4 rounded-lg border ${
                report.enabled 
                  ? 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600' 
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">{report.name}</h3>
                    {!report.enabled && (
                      <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                        Disabled
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <ClockIcon size={16} />
                      <span>
                        {report.frequency === 'daily' && 'Daily'}
                        {report.frequency === 'weekly' && `Weekly on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][report.dayOfWeek || 1]}`}
                        {report.frequency === 'monthly' && `Monthly on day ${report.dayOfMonth || 1}`}
                        {report.frequency === 'quarterly' && 'Quarterly'}
                        {report.frequency === 'yearly' && 'Yearly'}
                        {' at '}{report.time}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <FileTextIcon size={16} />
                      <span>{report.format.toUpperCase()}</span>
                    </div>
                    
                    <div>
                      Next run: {new Date(report.nextRun).toLocaleString()}
                    </div>
                    
                    {report.lastRun && (
                      <div>
                        Last run: {new Date(report.lastRun).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => generateReport(report)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary"
                    title="Run now"
                  >
                    <PlayIcon size={16} />
                  </button>
                  
                  <button
                    onClick={() => setEditingReport(report)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary"
                  >
                    <EditIcon size={16} />
                  </button>
                  
                  <button
                    onClick={() => handleUpdateReport(report.id, { enabled: !report.enabled })}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary"
                  >
                    {report.enabled ? <CheckIcon size={16} /> : <XIcon size={16} />}
                  </button>
                  
                  <button
                    onClick={() => handleDeleteReport(report.id)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <XIcon size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Report Modal */}
      {(showAddReport || editingReport) && (
        <ReportFormModal
          report={editingReport}
          accounts={accounts}
          categories={categories}
          onSave={(data) => {
            if (editingReport) {
              handleUpdateReport(editingReport.id, data);
              setEditingReport(null);
            } else {
              handleAddReport(data);
            }
          }}
          onClose={() => {
            setShowAddReport(false);
            setEditingReport(null);
          }}
        />
      )}

      {/* Generated Report Modal */}
      {generatedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Generated Report
                </h3>
                <button
                  onClick={() => setGeneratedReport(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XIcon size={20} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono">
                {generatedReport.content}
              </pre>
            </div>
            
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={copyReportToClipboard}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <CopyIcon size={16} />
                Copy to Clipboard
              </button>
              <button
                onClick={downloadReport}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                <DownloadIcon size={16} />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Report Form Modal Component
interface ReportFormModalProps {
  report: ScheduledReport | null;
  accounts: Account[];
  categories: Category[];
  onSave: (data: Partial<ScheduledReport>) => void;
  onClose: () => void;
}

function ReportFormModal({ report, accounts, categories, onSave, onClose }: ReportFormModalProps) {
  const [formData, setFormData] = useState<Partial<ScheduledReport>>({
    name: report?.name || '',
    frequency: report?.frequency || 'monthly',
    dayOfWeek: report?.dayOfWeek || 1,
    dayOfMonth: report?.dayOfMonth || 1,
    time: report?.time || '09:00',
    format: report?.format || 'summary',
    includeCharts: report?.includeCharts || false,
    reportConfig: report?.reportConfig || {
      dateRange: 'month',
      includeAccounts: [],
      includeCategories: []
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {report ? 'Edit Report' : 'New Scheduled Report'}
            </h3>
          </div>
          
          <div className="p-6 space-y-4">
            {/* Report Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Report Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>

            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Frequency
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as ScheduledReport['frequency'] })}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {/* Day of Week (for weekly) */}
            {formData.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Day of Week
                </label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </div>
            )}

            {/* Day of Month (for monthly) */}
            {formData.frequency === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Day of Month
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dayOfMonth}
                  onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            )}

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Report Format
              </label>
              <select
                value={formData.format}
                onChange={(e) => setFormData({ ...formData, format: e.target.value as ScheduledReport['format'] })}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="summary">Text Summary</option>
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Report Period
              </label>
              <select
                value={formData.reportConfig?.dateRange}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  reportConfig: { 
                    ...formData.reportConfig!, 
                    dateRange: e.target.value as ScheduledReport['dateRange'] 
                  }
                })}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="month">Last Month</option>
                <option value="quarter">Last Quarter</option>
                <option value="year">Last Year</option>
                <option value="custom">Custom (Last X Days)</option>
              </select>
            </div>

            {/* Custom Days */}
            {formData.reportConfig?.dateRange === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Number of Days
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={formData.reportConfig.customDays || 30}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    reportConfig: { 
                      ...formData.reportConfig!, 
                      customDays: parseInt(e.target.value) 
                    }
                  })}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            )}
          </div>
          
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              {report ? 'Save Changes' : 'Create Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}