import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { PieChartIcon, TrendingUpIcon, CalendarIcon, DownloadIcon, FilterIcon, PdfIcon } from '../components/icons';
import { exportTransactionsToCSV, downloadCSV } from '../utils/csvExport';
import { generatePDFReport, generateSimplePDFReport } from '../utils/pdfExport';
import ScheduledReports from '../components/ScheduledReports';
import { SkeletonCard, SkeletonText } from '../components/loading/Skeleton';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal, DecimalInstance } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import { computeExpenseCategoryNetTotals, bucketByCategoryDirection } from '../utils/categoryNetting';
import { createScopedLogger } from '../loggers/scopedLogger';

const reportsLogger = createScopedLogger('ReportsPage');

const CATEGORY_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'
];

export default function Reports() {
  const { transactions, accounts, categories } = useApp();
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year' | 'all' | 'custom'>('month');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const chartRef1 = useRef<HTMLDivElement>(null);
  const chartRef2 = useRef<HTMLDivElement>(null);
  const { formatCurrency } = useCurrencyDecimal();

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

  // Calculate summary statistics — bucketed by CATEGORY direction (the same
  // Money-style netting as the pie), so a refund filed under an expense
  // category reduces Expenses here rather than inflating Income.
  const summary = useMemo(() => {
    const categoryById = new Map(categories.map(c => [c.id, c]));
    let incomeDecimal = toDecimal(0);
    let expensesDecimal = toDecimal(0);

    for (const t of filteredTransactions) {
      const bucket = bucketByCategoryDirection(t, categoryById);
      if (bucket === 'income') {
        // Signed sum: an outgoing filed under an income category nets it down.
        incomeDecimal = incomeDecimal.plus(t.amount);
      } else if (bucket === 'expense') {
        // Spending is negative; negate so refunds net the total down.
        expensesDecimal = expensesDecimal.minus(t.amount);
      }
    }

    const netIncomeDecimal = incomeDecimal.minus(expensesDecimal);
    const savingsRateDecimal = incomeDecimal.gt(0)
      ? netIncomeDecimal.dividedBy(incomeDecimal).times(100)
      : toDecimal(0);

    return {
      income: incomeDecimal.toNumber(),
      expenses: expensesDecimal.toNumber(),
      netIncome: netIncomeDecimal.toNumber(),
      savingsRate: savingsRateDecimal.toNumber(),
    };
  }, [filteredTransactions, categories]);

  const formatPercentage = (value: DecimalInstance | number, decimals: number = 1) => {
    return formatDecimal(value, decimals);
  };

  const savingsRateDecimal = toDecimal(summary.savingsRate ?? 0);
  const savingsRateValue = savingsRateDecimal.toNumber();
  const savingsRateDisplay = formatPercentage(savingsRateDecimal, 1);

  // Set loading to false when data is loaded
  useEffect(() => {
    if (transactions !== undefined && accounts !== undefined) {
      setIsLoading(false);
    }
  }, [transactions, accounts]);

  // Prepare data for category breakdown. Money-style netting: bucket by the
  // CATEGORY's direction and net signed amounts, so a refund filed under an
  // expense category reduces that category instead of inflating income —
  // and slice labels show category NAMES, never raw ids.
  const categoryData = useMemo(
    () => computeExpenseCategoryNetTotals(filteredTransactions, categories)
      .slice(0, 8)
      .map(({ name, value }) => ({ name, value })),
    [filteredTransactions, categories]
  );

  // Prepare data for monthly trend — same category-direction netting as the
  // summary and the pie, so all three views on this page agree.
  const monthlyTrendData = useMemo(() => {
    const monthlyData: Record<string, { income: DecimalInstance; expenses: DecimalInstance }> = {};
    const categoryById = new Map(categories.map(c => [c.id, c]));

    filteredTransactions.forEach(t => {
      const bucket = bucketByCategoryDirection(t, categoryById);
      if (bucket === 'transfer') return;
      const monthKey = new Date(t.date).toISOString().slice(0, 7);
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: toDecimal(0), expenses: toDecimal(0) };
      }

      if (bucket === 'income') {
        monthlyData[monthKey].income = monthlyData[monthKey].income.plus(t.amount);
      } else {
        // Spending is negative; negate so refunds net the month down.
        monthlyData[monthKey].expenses = monthlyData[monthKey].expenses.minus(t.amount);
      }
    });

    const sortedMonths = Object.keys(monthlyData).sort();

    return sortedMonths.map(month => ({
      month: new Date(month + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      income: monthlyData[month].income.toNumber(),
      expenses: monthlyData[month].expenses.toNumber()
    }));
  }, [filteredTransactions, categories]);

  const exportToCSV = () => {
    const csv = exportTransactionsToCSV(filteredTransactions, accounts);
    const filename = `financial-report-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csv, filename);
  };

  const exportToPDF = async (includeCharts: boolean = true) => {
    setIsGeneratingPDF(true);
    try {
      // Prepare category breakdown data (same Money-style netting as the pie).
      const netTotals = computeExpenseCategoryNetTotals(filteredTransactions, categories);
      const totalExpensesDecimal = netTotals.reduce(
        (sum, entry) => sum.plus(toDecimal(entry.value)),
        toDecimal(0)
      );

      const categoryBreakdown = netTotals.map(({ name, value }) => ({
        category: name,
        amount: value,
        percentage: totalExpensesDecimal.gt(0)
          ? toDecimal(value).dividedBy(totalExpensesDecimal).times(100).toNumber()
          : 0
      }));

      const reportData = {
        title: 'Financial Report',
        dateRange: dateRange === 'month' ? 'Last Month' : 
                   dateRange === 'quarter' ? 'Last Quarter' : 
                   dateRange === 'year' ? 'Last Year' : 'All Time',
        summary,
        categoryBreakdown,
        topTransactions: filteredTransactions
          .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
          .slice(0, 10),
        chartElements: includeCharts && chartRef1.current && chartRef2.current
          ? [chartRef1.current, chartRef2.current]
          : undefined
      };

      if (includeCharts) {
        await generatePDFReport(reportData, accounts);
      } else {
        generateSimplePDFReport(reportData, accounts);
      }
    } catch (error) {
      reportsLogger.error('Error generating PDF', error);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow p-4">
          <h1 className="text-3xl font-bold text-white">Reports</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white rounded-2xl hover:bg-secondary transition-colors"
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
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <CalendarIcon className="text-gray-500" size={20} />
            <select
              aria-label="Date range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as 'month' | 'quarter' | 'year' | 'all' | 'custom')}
              className="px-3 py-2 bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
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
              aria-label="Account filter"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
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
                className="px-3 py-2 bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              />
              <label className="text-sm text-gray-600 dark:text-gray-400">To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main content grid with consistent spacing */}
      <div className="grid gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Income</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">
            {isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.income)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.expenses)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Net Income</p>
          <p className={`text-2xl font-bold ${
            summary.netIncome >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.netIncome)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Savings Rate</p>
          <p className={`text-2xl font-bold ${
            savingsRateValue >= 20 ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'
          }`}>
            {isLoading ? <SkeletonText className="w-20 h-8" /> : `${savingsRateDisplay}%`}
          </p>
        </div>
        </div>

        {/* Charts */}
        <div className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-theme-heading dark:text-white">
            <TrendingUpIcon size={20} />
            Income vs Expenses Trend
          </h2>
          <div className="h-64" ref={chartRef1}>
            {isLoading ? (
              <SkeletonCard className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(55, 65, 81, 0.3)" />
                  <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 12 }} />
                  <YAxis
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    tickFormatter={(value: number) => {
                      if (value >= 1_000_000) return `${formatDecimal(value / 1_000_000, 1)}M`;
                      if (value >= 1_000) return `${formatDecimal(value / 1_000, 0)}K`;
                      return formatDecimal(value, 0);
                    }}
                  />
                  <Tooltip
                    formatter={(value: number | string | Array<number | string>) =>
                      formatCurrency(typeof value === 'number' ? value : Number(value))
                    }
                  />
                  <Legend />
                  <Line type="monotone" dataKey="income" name="Income" stroke="#10B981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" strokeWidth={2} dot={false} />
                </RechartsLineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-theme-heading dark:text-white">
            <PieChartIcon size={20} />
            Expense Categories
          </h2>
          <div className="h-64" ref={chartRef2}>
            {isLoading ? (
              <SkeletonCard className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    strokeWidth={0}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | string | Array<number | string>) =>
                      formatCurrency(typeof value === 'number' ? value : Number(value))
                    }
                  />
                  <Legend layout="vertical" align="right" verticalAlign="middle" />
                </RechartsPieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        </div>
        </div>

        {/* Top Transactions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-theme-heading dark:text-white">Top Transactions</h2>
        </div>
        {/* Mobile card view */}
        <div className="block sm:hidden">
          <div className="space-y-3">
            {filteredTransactions
              .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
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
                      transaction.type === 'income' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {/* Amounts are stored signed; derive the sign from the value so incoming transfers show '+' */}
                      {transaction.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(transaction.amount))}
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
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
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
                      transaction.type === 'income' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {/* Amounts are stored signed; derive the sign from the value so incoming transfers show '+' */}
                      {transaction.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(transaction.amount))}
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
    </div>
  );
}
