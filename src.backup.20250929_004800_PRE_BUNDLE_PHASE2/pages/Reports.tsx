import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { PieChartIcon, TrendingUpIcon, CalendarIcon, DownloadIcon, FilterIcon, PdfIcon, BarChart3Icon } from '../components/icons';
import { exportTransactionsToCSV, downloadCSV } from '../utils/csvExport';
import { generatePDFReport, generateSimplePDFReport } from '../utils/pdfExport';
import ScheduledReports from '../components/ScheduledReports';
import BudgetComparison from '../components/reports/BudgetComparison';
import FinancialReportGenerator from '../components/reports/FinancialReportGenerator';
import { SkeletonCard, SkeletonText } from '../components/loading/Skeleton';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from '../components/charts/OptimizedCharts';
import { logger } from '../services/loggingService';

export default function Reports() {
  const { transactions, accounts } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'budget' | 'generator'>('overview');
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year' | 'all' | 'custom'>('month');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const chartRef1 = useRef<HTMLDivElement>(null);
  const chartRef2 = useRef<HTMLDivElement>(null);

  // Filter transactions based on date range and account
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let startDate = new Date();

    switch (dateRange) {
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      case 'custom':
        if (customStartDate) {
          startDate = new Date(customStartDate);
        }
        break;
    }

    return transactions.filter(t => {
      const transDate = new Date(t.date);
      let dateMatch = transDate >= startDate;
      
      // For custom date range, also check end date
      if (dateRange === 'custom' && customEndDate) {
        const endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999); // Include the entire end day
        dateMatch = dateMatch && transDate <= endDate;
      }
      
      const accountMatch = selectedAccount === 'all' || t.accountId === selectedAccount;
      return dateMatch && accountMatch;
    });
  }, [transactions, dateRange, selectedAccount, customStartDate, customEndDate]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netIncome = income - expenses;
    const savingsRate = income > 0 ? (netIncome / income) * 100 : 0;

    return { income, expenses, netIncome, savingsRate };
  }, [filteredTransactions]);

  // Set loading to false when data is loaded
  useEffect(() => {
    if (transactions !== undefined && accounts !== undefined) {
      setIsLoading(false);
    }
  }, [transactions, accounts]);

  const CATEGORY_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

  // Prepare data for category breakdown
  const categoryChartData = useMemo(() => {
    const categoryTotals = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(categoryTotals)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 8)
      .map(([category, amount]) => ({
        name: category,
        value: amount as number
      }));
  }, [filteredTransactions]);

  // Prepare data for monthly trend
  const monthlyTrendChartData = useMemo(() => {
    const monthlyTotals: Record<string, { income: number; expenses: number }> = {};

    filteredTransactions.forEach(t => {
      const monthKey = new Date(t.date).toISOString().slice(0, 7);
      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = { income: 0, expenses: 0 };
      }

      if (t.type === 'income') {
        monthlyTotals[monthKey].income += t.amount;
      } else if (t.type === 'expense') {
        monthlyTotals[monthKey].expenses += t.amount;
      }
    });

    return Object.keys(monthlyTotals)
      .sort()
      .map(month => {
        const dateLabel = new Date(`${month}-01`).toLocaleDateString('en-GB', {
          month: 'short',
          year: 'numeric'
        });

        return {
          label: dateLabel,
          income: monthlyTotals[month]?.income ?? 0,
          expenses: monthlyTotals[month]?.expenses ?? 0
        };
      });
  }, [filteredTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const exportToCSV = () => {
    const csv = exportTransactionsToCSV(filteredTransactions, accounts);
    const filename = `financial-report-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csv, filename);
  };

  const exportToPDF = async (includeCharts: boolean = true) => {
    setIsGeneratingPDF(true);
    try {
      // Prepare category breakdown data
      const categoryBreakdown = Object.entries(
        filteredTransactions
          .filter(t => t.type === 'expense')
          .reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + t.amount;
            return acc;
          }, {} as Record<string, number>)
      )
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .map(([category, amount]) => {
          const total = filteredTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
          return {
            category,
            amount: amount as number,
            percentage: ((amount as number) / total) * 100
          };
        });

      const chartRefs: Array<HTMLDivElement | null> = [chartRef1.current, chartRef2.current];
      const chartElements: HTMLDivElement[] = includeCharts
        ? chartRefs.filter(
            (element): element is HTMLDivElement => element instanceof HTMLDivElement
          )
        : [];

      const reportData = {
        title: 'Financial Report',
        dateRange: dateRange === 'month' ? 'Last Month' : 
                   dateRange === 'quarter' ? 'Last Quarter' : 
                   dateRange === 'year' ? 'Last Year' : 'All Time',
        summary,
        categoryBreakdown,
        topTransactions: filteredTransactions
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10),
        chartElements
      };

      if (includeCharts) {
        await generatePDFReport(reportData, accounts);
      } else {
        generateSimplePDFReport(reportData, accounts);
      }
    } catch (error) {
      logger.error('Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleBudgetExport = (data: any[]) => {
    const csv = data.map(row => ({
      Category: row.categoryName,
      Budgeted: row.budgeted,
      Actual: row.actual,
      Variance: row.variance,
      'Variance %': row.variancePercent.toFixed(1) + '%',
      Status: row.status
    }));
    
    if (csv.length === 0) {
      logger.warn('No budget data available for export', undefined, 'ReportsPage');
      return;
    }

    const firstRow = csv[0];

    if (!firstRow) {
      logger.warn('Budget export aborted: first row undefined', undefined, 'ReportsPage');
      return;
    }

    const csvContent = [
      Object.keys(firstRow).join(','),
      ...csv.map(row => Object.values(row).join(','))
    ].join('\n');
    
    downloadCSV(csvContent, `budget-comparison-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow p-4">
          <h1 className="text-3xl font-bold text-white">Reports</h1>
        </div>
        <div className="flex gap-2">
          {activeTab === 'overview' ? (
            <>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-2xl hover:bg-secondary transition-colors"
              >
                <DownloadIcon size={20} />
                Export CSV
              </button>
              <button
                onClick={() => exportToPDF(true)}
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PdfIcon size={20} />
                {isGeneratingPDF ? 'Generating...' : 'Export PDF'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-1 mb-6">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
              activeTab === 'overview'
                ? 'bg-gray-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <TrendingUpIcon size={20} />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('budget')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
              activeTab === 'budget'
                ? 'bg-gray-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <BarChart3Icon size={20} />
            Budget Comparison
          </button>
          <button
            onClick={() => setActiveTab('generator')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
              activeTab === 'generator'
                ? 'bg-gray-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <PdfIcon size={20} />
            Report Generator
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'budget' ? (
        <BudgetComparison 
          dateRange={dateRange === 'all' ? 'year' : dateRange === 'custom' ? 'month' : dateRange}
          onExport={handleBudgetExport}
        />
      ) : activeTab === 'generator' ? (
        <FinancialReportGenerator />
      ) : (
        <>
      {/* Filters */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <CalendarIcon className="text-gray-500" size={20} />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as 'month' | 'quarter' | 'year' | 'all' | 'custom')}
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
              onChange={(e) => setSelectedAccount(e.target.value)}
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
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              />
              <label className="text-sm text-gray-600 dark:text-gray-400">To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main content grid with consistent spacing */}
      <div className="grid gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Income</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.income)}
          </p>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.expenses)}
          </p>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Net Income</p>
          <p className={`text-2xl font-bold ${
            summary.netIncome >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.netIncome)}
          </p>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Savings Rate</p>
          <p className={`text-2xl font-bold ${
            summary.savingsRate >= 20 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
          }`}>
            {isLoading ? <SkeletonText className="w-20 h-8" /> : `${summary.savingsRate.toFixed(1)}%`}
          </p>
        </div>
        </div>

        {/* Charts */}
        <div className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-theme-heading dark:text-white">
            <TrendingUpIcon size={20} />
            Income vs Expenses Trend
          </h2>
          <div className="h-64" ref={chartRef1}>
            {isLoading ? (
              <SkeletonCard className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} dot={false} name="Income" />
                  <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} dot={false} name="Expenses" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-theme-heading dark:text-white">
            <PieChartIcon size={20} />
            Expense Categories
          </h2>
          <div className="h-64" ref={chartRef2}>
            {isLoading ? (
              <SkeletonCard className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Pie
                    data={categoryChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        </div>
        </div>

        {/* Top Transactions */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-theme-heading dark:text-white">Top Transactions</h2>
        </div>
        {/* Mobile card view */}
        <div className="block sm:hidden">
          <div className="space-y-3">
            {filteredTransactions
              .sort((a, b) => b.amount - a.amount)
              .slice(0, 10)
              .map((transaction) => (
                <div key={transaction.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{transaction.description}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{transaction.category}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        {new Date(transaction.date).toLocaleDateString()}
                      </p>
                    </div>
                    <p className={`text-lg font-semibold ${
                      transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
        
        {/* Desktop table view */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Category</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransactions
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 10)
                .map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white hidden sm:table-cell">
                      {transaction.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                      {transaction.category}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        </div>
        
        {/* Scheduled Reports */}
        <div className="mt-8">
          <ScheduledReports />
        </div>
      </div>
        </>
      )}
    </div>
  );
}
