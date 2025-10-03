import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from './useCurrencyDecimal';
import { useNotifications } from '../contexts/NotificationContext';
import { generatePDFReport } from '../utils/pdfExport';
import { exportTransactionsToCSV } from '../utils/csvExport';
import { useLogger } from '../services/ServiceProvider';
import type { ScheduledReport } from '../components/reports/ReportListItem';
import type { Transaction, Account, Category } from '../types';

export function useScheduledReports() {
  const logger = useLogger();
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

  const [generatedReport, setGeneratedReport] = useState<{
    content: string;
    format: 'pdf' | 'csv' | 'summary';
    filename: string;
  } | null>(null);

  // Save reports to localStorage
  useEffect(() => {
    localStorage.setItem('money_management_scheduled_reports', JSON.stringify(reports));
  }, [reports]);

  const calculateNextRun = useCallback((report: ScheduledReport, fromDate: Date = new Date()): Date => {
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
  }, []);

  const updateNextRunTime = useCallback((reportId: string) => {
    setReports(prev => prev.map(report => {
      if (report.id === reportId) {
        const lastRun = new Date();
        const nextRun = calculateNextRun(report, lastRun);
        return { ...report, lastRun, nextRun };
      }
      return report;
    }));
  }, [calculateNextRun]);

  const generateReport = useCallback(async (report: ScheduledReport) => {
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
  }, [transactions, accounts, categories, formatCurrency, addNotification]);

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
  }, [reports, generateReport, updateNextRunTime]);

  const handleAddReport = useCallback((reportData: Partial<ScheduledReport>) => {
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
  }, [calculateNextRun]);

  const handleUpdateReport = useCallback((reportId: string, updates: Partial<ScheduledReport>) => {
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
  }, [calculateNextRun]);

  const handleDeleteReport = useCallback((reportId: string) => {
    setReports(prev => prev.filter(report => report.id !== reportId));
  }, []);

  const downloadReport = useCallback(() => {
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
  }, [generatedReport]);

  const copyReportToClipboard = useCallback(() => {
    if (!generatedReport) return;
    
    navigator.clipboard.writeText(generatedReport.content).then(() => {
      addNotification({
        type: 'success',
        title: 'Report Copied',
        message: 'Report content copied to clipboard'
      });
    });
  }, [generatedReport, addNotification]);

  return {
    reports,
    generatedReport,
    setGeneratedReport,
    generateReport,
    handleAddReport,
    handleUpdateReport,
    handleDeleteReport,
    downloadReport,
    copyReportToClipboard
  };
}