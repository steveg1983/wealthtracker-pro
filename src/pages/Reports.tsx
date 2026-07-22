import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { PieChartIcon, TrendingUpIcon, CalendarIcon, DownloadIcon, FilterIcon, PdfIcon } from '../components/icons';
import { exportTransactionsToCSV, downloadCSV } from '../utils/csvExport';
import { generatePDFReport, generateSimplePDFReport } from '../utils/pdfExport';
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
import { computeExpenseCategoryNetTotals } from '../utils/categoryNetting';
import { buildMonthlyTrend } from '../utils/monthlyTrend';
import { computeIncomeExpense } from '../utils/incomeExpense';
import { usePeriod, PERIOD_LABELS } from '../hooks/usePeriod';
import PeriodPicker from '../components/PeriodPicker';
import EditTransactionModal from '../components/EditTransactionModal';
import IncomeExpenseBreakdownModal from '../components/IncomeExpenseBreakdownModal';
import TransferSweepModal from '../components/TransferSweepModal';
import BulkCategorizeModal from '../components/BulkCategorizeModal';
import { expandSplitTransactions } from '../utils/transactionSplits';
import { createScopedLogger } from '../loggers/scopedLogger';

const reportsLogger = createScopedLogger('ReportsPage');

const CATEGORY_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'
];

export default function Reports() {
  const { transactions: rawTransactions, transactionSplits, accounts, categories } = useApp();
  // Reports work on the split-EXPANDED view (like every other reporting
  // surface): a split parent becomes one row per line, so each line's spend
  // lands in ITS category — the pie and summary would otherwise drop split
  // lines into the uncategorised fallback.
  const transactions = useMemo(
    () => expandSplitTransactions(rawTransactions, transactionSplits),
    [rawTransactions, transactionSplits]
  );
  // The shared reporting period (same windows and meanings everywhere).
  const picker = usePeriod('reportsPeriod');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [breakdownType, setBreakdownType] = useState<'income' | 'expense' | 'uncategorized' | null>(null);
  // Chart drill-in: a clicked trend point (one series, one month) or pie
  // slice (one category) opens the same breakdown modal, scoped to it.
  const [chartDrill, setChartDrill] = useState<{
    title: string;
    bucket: 'income' | 'expense';
    rows: typeof transactions;
    total: number;
  } | null>(null);
  const [editingBreakdownTxnId, setEditingBreakdownTxnId] = useState<string | null>(null);
  const [showTransferSweep, setShowTransferSweep] = useState(false);
  const [showBulkCategorize, setShowBulkCategorize] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const chartRef1 = useRef<HTMLDivElement>(null);
  const chartRef2 = useRef<HTMLDivElement>(null);
  const { formatCurrency } = useCurrencyDecimal();

  // Filter transactions to the shared period + account
  const filteredTransactions = useMemo(
    () => transactions.filter(t =>
      picker.inRange(t.date) &&
      (selectedAccount === 'all' || t.accountId === selectedAccount)
    ),
    [transactions, picker, selectedAccount]
  );

  // Calculate summary statistics — CATEGORY semantics via the shared
  // classifier (utils/incomeExpense), so a refund filed under an expense
  // category reduces Expenses here rather than inflating Income. The rows
  // ride along to power the click-through breakdown. filteredTransactions is
  // already split-expanded, so splits are passed empty (no double expansion).
  const flows = useMemo(
    () => computeIncomeExpense(filteredTransactions, [], categories),
    [filteredTransactions, categories]
  );

  const summary = useMemo(() => {
    const netIncomeDecimal = flows.income.minus(flows.expenses);
    const savingsRateDecimal = flows.income.gt(0)
      ? netIncomeDecimal.dividedBy(flows.income).times(100)
      : toDecimal(0);

    return {
      income: flows.income.toNumber(),
      expenses: flows.expenses.toNumber(),
      netIncome: netIncomeDecimal.toNumber(),
      savingsRate: savingsRateDecimal.toNumber(),
    };
  }, [flows]);

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
  // The category id rides along so a clicked slice can list its own
  // transactions — as `categoryId`, NOT `key`: recharts spreads datum fields
  // onto React elements, and a `key` field collides with React's reserved
  // prop and silently breaks sector rendering. Re-mapped to plain literals
  // because recharts' data prop needs index-signature rows.
  const categoryData = useMemo(
    () => computeExpenseCategoryNetTotals(filteredTransactions, categories)
      .slice(0, 8)
      .map(({ key, name, value }) => ({ categoryId: key, name, value })),
    [filteredTransactions, categories]
  );

  const drillIntoCategory = (key: string, name: string, value: number): void => {
    setChartDrill({
      title: `${name} — Expenses`,
      bucket: 'expense',
      rows: flows.expenseRows.filter(t => t.category === key),
      total: value,
    });
  };

  const drillIntoMonth = (monthKey: string, label: string, bucket: 'income' | 'expense', total: number): void => {
    const source = bucket === 'income' ? flows.incomeRows : flows.expenseRows;
    setChartDrill({
      title: `${bucket === 'income' ? 'Income' : 'Expenses'} — ${label}`,
      bucket,
      rows: source.filter(t => new Date(t.date).toISOString().slice(0, 7) === monthKey),
      total,
    });
  };

  // recharts calls activeDot onClick with (props, event) — but the argument
  // order has differed across versions, so scan for whichever carries the
  // datum payload.
  const handleTrendDotClick = (series: 'income' | 'expenses') =>
    (...args: unknown[]): void => {
      for (const arg of args) {
        const payload = (arg as { payload?: { monthKey?: string; month?: string; income?: number; expenses?: number } } | null)?.payload;
        if (payload?.monthKey && payload.month) {
          const bucket = series === 'income' ? 'income' : 'expense';
          drillIntoMonth(payload.monthKey, payload.month, bucket, payload[series] ?? 0);
          return;
        }
      }
    };

  // Monthly trend via the shared builder (also drives the Dashboard's pinned
  // trend widget — one implementation, no drift).
  const monthlyTrendData = useMemo(
    () => buildMonthlyTrend(filteredTransactions, categories),
    [filteredTransactions, categories]
  );

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
        dateRange: PERIOD_LABELS[picker.period],
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

      {/* Filters — the shared period picker + account filter */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <CalendarIcon className="text-gray-500" size={20} />
            <PeriodPicker picker={picker} />
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
        </div>
      </div>

      {/* Main content grid with consistent spacing */}
      <div className="grid gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* flex-col: buttons lay children out in a ROW by default, which put
            the figure beside the label — every stat card stacks label OVER
            figure, matching the Dashboard. */}
        <button
          type="button"
          onClick={() => setBreakdownType('income')}
          className="flex flex-col items-start bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 text-left cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Income</p>
          {/* div, not p: the loading skeleton renders block elements and a
              <div> inside <p> is invalid DOM nesting */}
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">
            {isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.income)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setBreakdownType('expense')}
          className="flex flex-col items-start bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 text-left cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Expenses</p>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.expenses)}
          </div>
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Net Income</p>
          <div className={`text-2xl font-bold ${
            summary.netIncome >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.netIncome)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Savings Rate</p>
          <div className={`text-2xl font-bold ${
            savingsRateValue >= 20 ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'
          }`}>
            {isLoading ? <SkeletonText className="w-20 h-8" /> : `${savingsRateDisplay}%`}
          </div>
        </div>
        </div>

        {/* Uncategorised review band — these rows are EXCLUDED from every
            total above (no category = not income, not an expense). Shown so
            the data gets cleaned rather than silently miscounted. */}
        {flows.uncategorizedRows.length > 0 && (
          <button
            type="button"
            onClick={() => setBreakdownType('uncategorized')}
            className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 px-5 py-3 text-left hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {flows.uncategorizedRows.length.toLocaleString()} uncategorised transaction{flows.uncategorizedRows.length === 1 ? '' : 's'} excluded from these totals
            </span>
            <span className="text-sm text-amber-700 dark:text-amber-400 tabular-nums">
              {formatCurrency(flows.uncategorizedIn.toNumber())} in · {formatCurrency(flows.uncategorizedOut.toNumber())} out
            </span>
            <span className="ml-auto text-xs text-amber-700 dark:text-amber-400">
              Click to review and categorise
            </span>
          </button>
        )}

        {/* Bulk transfer matching — the biggest single cause of uncategorised
            rows is bank-feed transfer legs that were never linked. */}
        {flows.uncategorizedRows.length > 0 && (
          <button
            type="button"
            onClick={() => setShowTransferSweep(true)}
            className="text-sm text-blue-700 dark:text-blue-400 hover:underline text-left"
          >
            Or match transfers automatically — find equal-and-opposite pairs and link them in one go
          </button>
        )}

        {flows.uncategorizedRows.length > 0 && (
          <button
            type="button"
            onClick={() => setShowBulkCategorize(true)}
            className="text-sm text-blue-700 dark:text-blue-400 hover:underline text-left"
          >
            Or categorise by payee — file a whole merchant at once and teach future imports
          </button>
        )}

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
                  {/* Hover shows the active dot; clicking it opens that
                      month's transactions for THAT series. The handler scans
                      its args for the datum because recharts' activeDot
                      onClick argument order differs across versions. */}
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{ r: 6, cursor: 'pointer', onClick: handleTrendDotClick('income') }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="#EF4444"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{ r: 6, cursor: 'pointer', onClick: handleTrendDotClick('expenses') }}
                  />
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
                  {/* Click a slice to open that category's transactions */}
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    strokeWidth={0}
                    isAnimationActive={false}
                    onClick={(entry) => {
                      const datum = ((entry as { payload?: typeof categoryData[number] })?.payload ?? entry) as typeof categoryData[number];
                      if (datum?.categoryId) drillIntoCategory(datum.categoryId, datum.name, datum.value);
                    }}
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
      </div>

      {/* Income/Expense breakdown — the shared component (category sections,
          sortable headings, click-to-edit) also used by the Dashboard. */}
      <IncomeExpenseBreakdownModal
        isOpen={breakdownType !== null}
        onClose={() => setBreakdownType(null)}
        title={
          breakdownType === 'income' ? 'Income Breakdown'
          : breakdownType === 'expense' ? 'Expense Breakdown'
          : 'Uncategorised Transactions'
        }
        bucket={breakdownType ?? 'income'}
        rows={
          breakdownType === 'income' ? flows.incomeRows
          : breakdownType === 'expense' ? flows.expenseRows
          : flows.uncategorizedRows
        }
        total={
          breakdownType === 'income' ? summary.income
          : breakdownType === 'expense' ? summary.expenses
          : null
        }
        categories={categories}
        onEditTransaction={setEditingBreakdownTxnId}
      />

      {/* Chart drill-ins (a trend point or a pie slice) share the same
          breakdown modal, scoped to the clicked month/category. */}
      <IncomeExpenseBreakdownModal
        isOpen={chartDrill !== null}
        onClose={() => setChartDrill(null)}
        title={chartDrill?.title ?? ''}
        bucket={chartDrill?.bucket ?? 'expense'}
        rows={chartDrill?.rows ?? []}
        total={chartDrill?.total ?? 0}
        categories={categories}
        onEditTransaction={setEditingBreakdownTxnId}
      />

      <TransferSweepModal
        isOpen={showTransferSweep}
        onClose={() => setShowTransferSweep(false)}
      />

      <BulkCategorizeModal
        isOpen={showBulkCategorize}
        onClose={() => setShowBulkCategorize(false)}
      />

      {/* Edit a transaction straight from the breakdown list */}
      {editingBreakdownTxnId && (
        <EditTransactionModal
          isOpen
          onClose={() => setEditingBreakdownTxnId(null)}
          transaction={rawTransactions.find(t => t.id === editingBreakdownTxnId) ?? null}
        />
      )}
    </div>
  );
}
