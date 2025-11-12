import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { PieChartIcon, TrendingUpIcon, CalendarIcon, DownloadIcon, FilterIcon, PdfIcon } from '../components/icons';
import { exportTransactionsToCSV, downloadCSV } from '../utils/csvExport';
import { generatePDFReport, generateSimplePDFReport } from '../utils/pdfExport';
import ScheduledReports from '../components/ScheduledReports';
import { SkeletonCard, SkeletonText } from '../components/loading/Skeleton';
import { LineChart } from '../components/charts/LazyChart';
import DoughnutChart from '../components/charts/DoughnutChart';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal, DecimalInstance } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import { createScopedLogger } from '../loggers/scopedLogger';

const reportsLogger = createScopedLogger('ReportsPage');

export default function Reports() {
  const { transactions, accounts } = useApp();
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

  // Calculate summary statistics
  const summary = useMemo(() => {
    const incomeDecimal = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));

    const expensesDecimal = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));

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
  }, [filteredTransactions]);

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

  // Prepare data for category breakdown
  const categoryData = useMemo(() => {
    const categoryTotals = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce<Record<string, DecimalInstance>>((acc, t) => {
        const key = t.category || 'Uncategorized';
        const current = acc[key] ?? toDecimal(0);
        acc[key] = current.plus(t.amount);
        return acc;
      }, {});

    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b.minus(a).toNumber())
      .slice(0, 8);

    return {
      labels: sortedCategories.map(([cat]) => cat),
      datasets: [{
        data: sortedCategories.map(([, amount]) => amount.toNumber()),
        backgroundColor: [
          '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
          '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'
        ]
      }]
    };
  }, [filteredTransactions]);

  // Prepare data for monthly trend
  const monthlyTrendData = useMemo(() => {
    const monthlyData: Record<string, { income: DecimalInstance; expenses: DecimalInstance }> = {};

    filteredTransactions.forEach(t => {
      const monthKey = new Date(t.date).toISOString().slice(0, 7);
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: toDecimal(0), expenses: toDecimal(0) };
      }

      if (t.type === 'income') {
        monthlyData[monthKey].income = monthlyData[monthKey].income.plus(t.amount);
      } else {
        monthlyData[monthKey].expenses = monthlyData[monthKey].expenses.plus(t.amount);
      }
    });

    const sortedMonths = Object.keys(monthlyData).sort();

    return {
      labels: sortedMonths.map(month => {
        const date = new Date(month + '-01');
        return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      }),
      datasets: [
        {
          label: 'Income',
          data: sortedMonths.map(month => monthlyData[month].income.toNumber()),
          borderColor: '#10B981',
          backgroundColor: '#10B98120',
          tension: 0.4
        },
        {
          label: 'Expenses',
          data: sortedMonths.map(month => monthlyData[month].expenses.toNumber()),
          borderColor: '#EF4444',
          backgroundColor: '#EF444420',
          tension: 0.4
        }
      ]
    };
  }, [filteredTransactions]);

  const exportToCSV = () => {
    const csv = exportTransactionsToCSV(filteredTransactions, accounts);
    const filename = `financial-report-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csv, filename);
  };

  const exportToPDF = async (includeCharts: boolean = true) => {
    setIsGeneratingPDF(true);
    try {
      // Prepare category breakdown data
      const expenseTotals = filteredTransactions
        .filter(t => t.type === 'expense')
        .reduce<Record<string, DecimalInstance>>((acc, t) => {
          const key = t.category || 'Uncategorized';
          const current = acc[key] ?? toDecimal(0);
          acc[key] = current.plus(t.amount);
          return acc;
        }, {});

      const totalExpensesDecimal = Object.values(expenseTotals).reduce(
        (sum, amount) => sum.plus(amount),
        toDecimal(0)
      );

      const categoryBreakdown = Object.entries(expenseTotals)
        .sort(([, a], [, b]) => b.minus(a).toNumber())
        .map(([category, amount]) => ({
          category,
          amount: amount.toNumber(),
          percentage: totalExpensesDecimal.gt(0)
            ? amount.dividedBy(totalExpensesDecimal).times(100).toNumber()
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
          .sort((a, b) => b.amount - a.amount)
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
        </div>
      </div>

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
            savingsRateValue >= 20 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
          }`}>
            {isLoading ? <SkeletonText className="w-20 h-8" /> : `${savingsRateDisplay}%`}
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
            <LineChart
              data={monthlyTrendData as unknown as Parameters<typeof LineChart>[0]['data']}
              width={500}
              height={250}
            />
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
            <DoughnutChart
              data={categoryData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right'
                  }
                }
              }}
            />
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
    </div>
  );
}
