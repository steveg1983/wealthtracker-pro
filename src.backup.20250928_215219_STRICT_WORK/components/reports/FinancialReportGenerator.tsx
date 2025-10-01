import React, { useState, useMemo } from 'react';
import { RadioCheckbox } from '../common/RadioCheckbox';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { exportService } from '../../services/exportService';
import { toDecimal } from '../../utils/decimal';
import {
  DocumentTextIcon,
  TableCellsIcon,
  DocumentArrowDownIcon,
  ChartBarIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  PresentationChartBarIcon
} from '@heroicons/react/24/outline';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, format } from 'date-fns';

interface ReportSection {
  id: string;
  title: string;
  enabled: boolean;
  description: string;
}

type ReportFormat = 'pdf' | 'xlsx' | 'csv';

interface ReportOptions {
  title: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  sections: ReportSection[];
  format: ReportFormat;
  includeCharts: boolean;
  includeTransactions: boolean;
  groupBy: 'category' | 'account' | 'month' | 'none';
}

const DEFAULT_SECTIONS: ReportSection[] = [
  { id: 'summary', title: 'Executive Summary', enabled: true, description: 'Overview of financial position' },
  { id: 'netWorth', title: 'Net Worth Analysis', enabled: true, description: 'Assets, liabilities, and trends' },
  { id: 'cashFlow', title: 'Cash Flow Statement', enabled: true, description: 'Income and expenses breakdown' },
  { id: 'budgets', title: 'Budget Performance', enabled: true, description: 'Budget vs actual spending' },
  { id: 'investments', title: 'Investment Portfolio', enabled: true, description: 'Investment performance and allocation' },
  { id: 'goals', title: 'Financial Goals Progress', enabled: true, description: 'Goal tracking and projections' },
  { id: 'transactions', title: 'Transaction Details', enabled: false, description: 'Detailed transaction list' },
  { id: 'trends', title: 'Spending Trends', enabled: true, description: 'Category-wise spending analysis' },
  { id: 'taxes', title: 'Tax Summary', enabled: false, description: 'Tax-related transactions and deductions' },
  { id: 'recommendations', title: 'Financial Recommendations', enabled: true, description: 'AI-powered insights and suggestions' }
];

const QUICK_RANGES = [
  { id: 'thisMonth', label: 'This Month', getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
  { id: 'lastMonth', label: 'Last Month', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
  { id: 'last3Months', label: 'Last 3 Months', getValue: () => ({ start: subMonths(new Date(), 3), end: new Date() }) },
  { id: 'thisYear', label: 'This Year', getValue: () => ({ start: startOfYear(new Date()), end: endOfYear(new Date()) }) },
  { id: 'lastYear', label: 'Last Year', getValue: () => ({ start: startOfYear(subMonths(new Date(), 12)), end: endOfYear(subMonths(new Date(), 12)) }) }
];

export default function FinancialReportGenerator(): React.JSX.Element {
  const { accounts, transactions, budgets, goals } = useApp();
  const investments: any[] = []; // Not available in current AppContext
  const { formatCurrency } = useCurrencyDecimal();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportOptions, setReportOptions] = useState<ReportOptions>({
    title: `Financial Report - ${format(new Date(), 'MMMM yyyy')}`,
    dateRange: {
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date())
    },
    sections: DEFAULT_SECTIONS,
    format: 'pdf',
    includeCharts: true,
    includeTransactions: false,
    groupBy: 'category'
  });

  // Calculate report data
  const reportData = useMemo(() => {
    const { start, end } = reportOptions.dateRange;
    
    // Filter transactions by date range
    const filteredTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date >= start && date <= end;
    });

    // Calculate totals
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));

    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), toDecimal(0));

    const totalAssets = accounts
      .filter(a => a.balance > 0)
      .reduce((sum, a) => sum.plus(toDecimal(a.balance)), toDecimal(0));

    const totalLiabilities = accounts
      .filter(a => a.balance < 0)
      .reduce((sum, a) => sum.plus(toDecimal(Math.abs(a.balance))), toDecimal(0));

    const netWorth = totalAssets.minus(totalLiabilities);
    const cashFlow = income.minus(expenses);
    const savingsRate = income.greaterThan(0) ? cashFlow.dividedBy(income).times(100) : toDecimal(0);

    // Budget performance
    const budgetPerformance = budgets.map(budget => {
      const spent = toDecimal(budget.spent || 0);
      const amount = toDecimal(budget.amount);
      const remaining = amount.minus(spent);
      const percentUsed = amount.greaterThan(0) ? spent.dividedBy(amount).times(100) : toDecimal(0);
      
      return {
        ...budget,
        spent: spent.toNumber(),
        remaining: remaining.toNumber(),
        percentUsed: percentUsed.toNumber(),
        isOverBudget: spent.greaterThan(amount)
      };
    });

    // Goal progress
    const goalProgress = goals.map(goal => {
      const current = toDecimal(goal.currentAmount || 0);
      const target = toDecimal(goal.targetAmount);
      const progress = target.greaterThan(0) ? current.dividedBy(target).times(100) : toDecimal(0);
      
      return {
        ...goal,
        progress: progress.toNumber(),
        remaining: target.minus(current).toNumber(),
        isCompleted: current.greaterThanOrEqualTo(target)
      };
    });

    return {
      income: income.toNumber(),
      expenses: expenses.toNumber(),
      cashFlow: cashFlow.toNumber(),
      savingsRate: savingsRate.toNumber(),
      netWorth: netWorth.toNumber(),
      totalAssets: totalAssets.toNumber(),
      totalLiabilities: totalLiabilities.toNumber(),
      transactionCount: filteredTransactions.length,
      budgetPerformance,
      goalProgress,
      filteredTransactions
    };
  }, [accounts, transactions, budgets, goals, reportOptions.dateRange]);

  const handleSectionToggle = (sectionId: string): void => {
    setReportOptions(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId
          ? { ...section, enabled: !section.enabled }
          : section
      )
    }));
  };

  const handleQuickRange = (rangeId: string): void => {
    const range = QUICK_RANGES.find(r => r.id === rangeId);
    if (range) {
      const { start, end } = range.getValue();
      setReportOptions(prev => ({
        ...prev,
        dateRange: { start, end },
        title: `Financial Report - ${range.label}`
      }));
    }
  };

  const handleGenerateReport = async (): Promise<void> => {
    setIsGenerating(true);
    
    try {
      // Prepare export data
      const exportData = {
        reportTitle: reportOptions.title,
        generatedAt: new Date(),
        dateRange: reportOptions.dateRange,
        summary: {
          netWorth: reportData.netWorth,
          totalAssets: reportData.totalAssets,
          totalLiabilities: reportData.totalLiabilities,
          monthlyIncome: reportData.income,
          monthlyExpenses: reportData.expenses,
          cashFlow: reportData.cashFlow,
          savingsRate: reportData.savingsRate
        },
        sections: reportOptions.sections.filter(s => s.enabled),
        data: reportData
      };

      // Generate report based on format
      // Convert ReportOptions to ExportOptions
      const exportOptions = {
        startDate: reportOptions.dateRange.start,
        endDate: reportOptions.dateRange.end,
        format: reportOptions.format,
        includeAccounts: true,
        includeInvestments: true,
        includeBudgets: true,
        includeTransactions: true,
        includeCharts: false,
        customTitle: reportOptions.title
      };

      switch (reportOptions.format) {
        case 'pdf':
          await exportService.generatePDFReport(exportData, exportOptions);
          break;
        case 'xlsx':
          await exportService.generateExcelReport(exportData, exportOptions);
          break;
        case 'csv':
          await exportService.generateCSVReport(exportData, exportOptions);
          break;
      }
      
      // Report generated successfully
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Financial Report Generator
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Create comprehensive financial reports with customizable sections
            </p>
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className={`
              px-6 py-3 rounded-lg font-medium flex items-center gap-2
              ${isGenerating
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gray-600 text-white hover:bg-gray-700'
              }
            `}
          >
            {isGenerating ? (
              <>
                <ClockIcon className="h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <ArrowDownTrayIcon className="h-5 w-5" />
                Generate Report
              </>
            )}
          </button>
        </div>

        {/* Report Title */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Report Title
          </label>
          <input
            type="text"
            value={reportOptions.title}
            onChange={(e) => setReportOptions(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Date Range Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date Range
          </label>
          <div className="flex gap-2 mb-3">
            {QUICK_RANGES.map(range => (
              <button
                key={range.id}
                onClick={() => handleQuickRange(range.id)}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {range.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={format(reportOptions.dateRange.start, 'yyyy-MM-dd')}
                onChange={(e) => setReportOptions(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, start: new Date(e.target.value) }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={format(reportOptions.dateRange.end, 'yyyy-MM-dd')}
                onChange={(e) => setReportOptions(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, end: new Date(e.target.value) }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
          </div>
        </div>

        {/* Format Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Export Format
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setReportOptions(prev => ({ ...prev, format: 'pdf' }))}
              className={`
                p-3 rounded-lg border-2 transition-all
                ${reportOptions.format === 'pdf'
                  ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }
              `}
            >
              <DocumentTextIcon className="h-6 w-6 mx-auto mb-1 text-red-600" />
              <span className="text-sm font-medium">PDF</span>
            </button>
            <button
              onClick={() => setReportOptions(prev => ({ ...prev, format: 'xlsx' }))}
              className={`
                p-3 rounded-lg border-2 transition-all
                ${reportOptions.format === 'xlsx'
                  ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }
              `}
            >
              <TableCellsIcon className="h-6 w-6 mx-auto mb-1 text-green-600" />
              <span className="text-sm font-medium">Excel</span>
            </button>
            <button
              onClick={() => setReportOptions(prev => ({ ...prev, format: 'csv' }))}
              className={`
                p-3 rounded-lg border-2 transition-all
                ${reportOptions.format === 'csv'
                  ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }
              `}
            >
              <DocumentArrowDownIcon className="h-6 w-6 mx-auto mb-1 text-gray-600" />
              <span className="text-sm font-medium">CSV</span>
            </button>
          </div>
        </div>

        {/* Report Sections */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Report Sections
          </label>
          <div className="space-y-2">
            {reportOptions.sections.map(section => (
              <div
                key={section.id}
                className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSectionToggle(section.id)}
                    className="text-gray-600 dark:text-gray-400"
                  >
                    {section.enabled ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {section.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {section.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Options */}
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2">
            <RadioCheckbox
              checked={reportOptions.includeCharts}
              onChange={(checked) => setReportOptions(prev => ({ ...prev, includeCharts: checked }))}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Include charts and visualizations</span>
          </label>
          <label className="flex items-center gap-2">
            <RadioCheckbox
              checked={reportOptions.includeTransactions}
              onChange={(checked) => setReportOptions(prev => ({ ...prev, includeTransactions: checked }))}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Include transaction details</span>
          </label>
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Report Preview
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-500 dark:text-gray-400">Net Worth</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(reportData.netWorth)}
            </div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-500 dark:text-gray-400">Monthly Income</div>
            <div className="text-xl font-bold text-green-600">
              {formatCurrency(reportData.income)}
            </div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-500 dark:text-gray-400">Monthly Expenses</div>
            <div className="text-xl font-bold text-red-600">
              {formatCurrency(reportData.expenses)}
            </div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-500 dark:text-gray-400">Savings Rate</div>
            <div className="text-xl font-bold text-gray-600">
              {reportData.savingsRate.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
          <div className="flex items-start gap-2">
            <PresentationChartBarIcon className="h-5 w-5 text-gray-600 mt-0.5" />
            <div>
              <div className="font-medium text-blue-900 dark:text-blue-200">
                Report will include {reportOptions.sections.filter(s => s.enabled).length} sections
              </div>
              <div className="text-sm text-blue-700 dark:text-gray-300 mt-1">
                Date range: {format(reportOptions.dateRange.start, 'MMM d, yyyy')} - {format(reportOptions.dateRange.end, 'MMM d, yyyy')}
              </div>
              <div className="text-sm text-blue-700 dark:text-gray-300">
                {reportData.transactionCount} transactions in selected period
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
