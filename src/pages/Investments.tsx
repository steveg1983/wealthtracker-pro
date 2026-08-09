import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { TrendingUpIcon, TrendingDownIcon, BarChart3Icon, AlertCircleIcon, LineChartIcon, EyeIcon, PlusIcon } from '../components/icons';
import AddInvestmentModal from '../components/AddInvestmentModal';
import InvestmentMarketView from '../components/InvestmentMarketView';
import PortfolioManager, { type HoldingFormValues } from '../components/PortfolioManager';
import StockWatchlist from '../components/StockWatchlist';
// Use optimized lazy-loaded charts to reduce bundle size
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from '../components/charts/OptimizedCharts';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import PageWrapper from '../components/PageWrapper';
import GroupedAccountOptions from '../components/common/GroupedAccountOptions';
import { buildPortfolioSummary, buildPortfolioHistory } from '../utils/portfolioSummary';
import { InvestmentService, type InvestmentHolding } from '../services/api/investmentService';
import { userIdService } from '../services/userIdService';
import { fetchQuotes } from '../services/stockPriceService';

export default function Investments() {
  const { accounts, transactions, transactionSplits, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [selectedPeriod, setSelectedPeriod] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('1Y');
  const [showAddInvestmentModal, setShowAddInvestmentModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'watchlist' | 'portfolio' | 'manage'>('overview');
  const [managingAccountId, setManagingAccountId] = useState<string | null>(null);

  // ── Holdings: the MARKET view's data, from public.investments ─────────────
  // Kept deliberately apart from `summary` below. Holdings × price is a second
  // opinion about the same money; the ledger figures are the page's truth and
  // the two are never added. See utils/portfolioSummary and
  // components/InvestmentMarketView.
  const [holdings, setHoldings] = useState<InvestmentHolding[]>([]);
  const [holdingsError, setHoldingsError] = useState<string | null>(null);
  const [isUpdatingQuotes, setIsUpdatingQuotes] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [symbolErrors, setSymbolErrors] = useState<Map<string, string>>(new Map());
  // Which account the last (or current) quote update concerns. Without it a
  // spinner and an error raised by one account's button appear on every
  // account's panel, and the reader cannot tell which one failed.
  const [quotedAccountId, setQuotedAccountId] = useState<string | null>(null);

  const reloadHoldings = useCallback(async (): Promise<void> => {
    const userId = userIdService.getCurrentDatabaseUserId();
    if (!userId) {
      // Local-only session: there is no row to read, and saying "no holdings"
      // is honest — there are none, because there is nowhere to keep them.
      setHoldings([]);
      return;
    }
    try {
      setHoldings(await InvestmentService.list(userId));
      setHoldingsError(null);
    } catch (error) {
      setHoldingsError(
        error instanceof Error ? error.message : 'Could not load your holdings.'
      );
    }
  }, []);

  useEffect(() => {
    void reloadHoldings();
  }, [reloadHoldings]);

  /**
   * Fetch prices for the symbols on screen and store them.
   *
   * The write-back is what makes the nightly cron and this button the same
   * feature: both put a price and its as-of date on the row, so a page opened
   * tomorrow morning already shows last night's close without asking anyone.
   */
  const updateQuotes = useCallback(async (
    accountId: string,
    symbols: readonly string[]
  ): Promise<void> => {
    setQuotedAccountId(accountId);
    const userId = userIdService.getCurrentDatabaseUserId();
    if (!userId) {
      setQuoteError('Sign in to fetch and store prices.');
      return;
    }
    if (symbols.length === 0) return;

    setIsUpdatingQuotes(true);
    setQuoteError(null);
    setSymbolErrors(new Map());
    try {
      const batch = await fetchQuotes(symbols);
      setSymbolErrors(batch.errors);

      if (batch.quotes.size > 0) {
        await InvestmentService.applyQuotes(
          userId,
          [...batch.quotes.values()].map((quote) => ({
            symbol: quote.symbol,
            price: quote.price.toString(),
            asOf: quote.asOf.toISOString()
          }))
        );
        await reloadHoldings();
      }

      if (batch.errors.size > 0) {
        // Names the count, not the symbols — each failing row says its own
        // reason in place, which is where the reader is looking.
        setQuoteError(
          batch.quotes.size === 0
            ? 'No prices could be fetched. Check your connection and try again.'
            : `${batch.errors.size} of ${symbols.length} holdings could not be priced.`
        );
      }
    } catch (error) {
      setQuoteError(
        error instanceof Error ? error.message : 'Prices could not be updated.'
      );
    } finally {
      setIsUpdatingQuotes(false);
    }
  }, [reloadHoldings]);

  const handleAddHolding = useCallback(
    async (accountId: string, currency: string, values: HoldingFormValues): Promise<void> => {
      const userId = userIdService.getCurrentDatabaseUserId();
      if (!userId) {
        throw new Error('Sign in to save holdings.');
      }
      await InvestmentService.create(userId, {
        accountId,
        symbol: values.symbol,
        name: values.name,
        quantity: values.quantity,
        averageCost: values.averageCost,
        currency,
        assetType: values.assetType
      });
      await reloadHoldings();
    },
    [reloadHoldings]
  );

  const handleEditHolding = useCallback(
    async (id: string, values: HoldingFormValues): Promise<void> => {
      const userId = userIdService.getCurrentDatabaseUserId();
      if (!userId) {
        throw new Error('Sign in to save holdings.');
      }
      await InvestmentService.update(userId, id, {
        symbol: values.symbol,
        name: values.name,
        quantity: values.quantity,
        averageCost: values.averageCost,
        assetType: values.assetType
      });
      await reloadHoldings();
    },
    [reloadHoldings]
  );

  const handleDeleteHolding = useCallback(
    async (id: string): Promise<void> => {
      const userId = userIdService.getCurrentDatabaseUserId();
      if (!userId) {
        throw new Error('Sign in to change holdings.');
      }
      await InvestmentService.remove(userId, id);
      await reloadHoldings();
    },
    [reloadHoldings]
  );

  const holdingsByAccount = useMemo(() => {
    const map = new Map<string, InvestmentHolding[]>();
    for (const holding of holdings) {
      if (holding.accountId === null) continue;
      const list = map.get(holding.accountId) ?? [];
      list.push(holding);
      map.set(holding.accountId, list);
    }
    return map;
  }, [holdings]);

  // Helper function to format percentages
  const formatPercentage = (value: DecimalInstance | number, decimals: number = 2): string => {
    return `${formatDecimal(value, decimals)}%`;
  };

  const openAccounts = useMemo(() => accounts.filter(acc => acc.isActive !== false), [accounts]);

  // The portfolio set that drives the tabs and the empty state: every
  // investment account, including one paired inside another.
  const investmentAccounts = useMemo(
    () => openAccounts.filter(acc => acc.type === 'investment'),
    [openAccounts]
  );

  const accountsById = useMemo(
    () => new Map(openAccounts.map(acc => [acc.id, acc])),
    [openAccounts]
  );

  // Value, contributions and return over the investment↔cash PAIRS — an
  // account's settlement cash is part of what the portfolio is worth, and
  // moving money between the two sides is not a contribution. See
  // utils/portfolioSummary; the nesting rules are the Accounts page's own.
  const summary = useMemo(
    () => buildPortfolioSummary({ accounts: openAccounts, transactions, transactionSplits, categories }),
    [openAccounts, transactions, transactionSplits, categories]
  );

  // The window the chart covers. 'ALL' is unbounded at both ends, which the
  // history walk reads as "first transaction until today".
  const historyRange = useMemo(() => {
    if (selectedPeriod === 'ALL') return { from: null, to: null };
    const months = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 }[selectedPeriod];
    const now = new Date();
    return { from: new Date(now.getFullYear(), now.getMonth() - months, now.getDate()), to: now };
  }, [selectedPeriod]);

  // Real history: what the pair was worth on each date, never a projection of
  // today's figure backwards.
  const performanceData = useMemo(
    () => buildPortfolioHistory(summary.memberAccounts, transactions, historyRange),
    [summary.memberAccounts, transactions, historyRange]
  );

  // Numbers for the donut, converted once at the chart boundary.
  const allocationData = useMemo(
    () => summary.lines.map(line => ({
      name: line.name,
      ticker: line.institution || 'N/A',
      value: line.value.toNumber()
    })),
    [summary.lines]
  );

  // The LEDGER lines, one per investment account. Named for what they are:
  // `holdings` is now the market-side data from public.investments, and the two
  // must never be confused for each other on this page.
  const portfolioLines = summary.lines;
  const isGain = summary.totalReturn.greaterThanOrEqualTo(0);
  // Use consistent colors for better visual coherence
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  // If no investment accounts, show empty state
  if (investmentAccounts.length === 0) {
    return (
      <div>
        <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow p-4 mb-6">
          <h1 className="text-3xl font-bold text-white">Investments</h1>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 text-center">
          <BarChart3Icon className="mx-auto text-gray-400 mb-4" size={64} />
          <h2 className="text-xl font-semibold text-theme-heading dark:text-white mb-2">
            No Investment Accounts Yet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Add an investment account to start tracking your portfolio performance.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Go to Accounts → Add Account → Choose "Investment" as the account type
          </p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper 
      title="Investments"
      rightContent={
        investmentAccounts.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAddInvestmentModal(true)}
            className="cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Add investment"
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              focusable="false"
              className="transition-all duration-200 hover:scale-110 drop-shadow-lg hover:drop-shadow-xl"
            >
              <circle
                cx="24"
                cy="24"
                r="24"
                fill="#D9E1F2"
                className="transition-all duration-200"
                onMouseEnter={(e) => e.currentTarget.setAttribute('fill', '#C5D3E8')}
                onMouseLeave={(e) => e.currentTarget.setAttribute('fill', '#D9E1F2')}
              />
              <g transform="translate(12, 12)">
                <path 
                  d="M12 5v14M5 12h14" 
                  stroke="#1F2937" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </g>
            </svg>
          </button>
        )
      }
    >

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <BarChart3Icon size={16} />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('watchlist')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'watchlist'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <EyeIcon size={16} />
          Watchlist
        </button>
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'portfolio'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <LineChartIcon size={16} />
          Portfolio
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'manage'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <PlusIcon size={16} />
          Manage
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(summary.value)}
              </p>
            </div>
            <BarChart3Icon className="text-primary" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Net Contributions</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {formatCurrency(summary.netContributions)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Transferred in, less transferred out
              </p>
            </div>
            <BarChart3Icon className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Return</p>
              <p className={`text-2xl font-bold ${isGain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isGain ? '+' : ''}{formatCurrency(summary.totalReturn)}
              </p>
            </div>
            <TrendingUpIcon className={isGain ? 'text-green-500' : 'text-red-500'} size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Return %</p>
              {summary.returnPercent === null ? (
                <>
                  <p className="text-2xl font-bold text-gray-500 dark:text-gray-400">—</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    No contributions to measure a return against
                  </p>
                </>
              ) : (
                <p className={`text-2xl font-bold ${isGain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isGain ? '+' : ''}{formatPercentage(summary.returnPercent)}
                </p>
              )}
            </div>
            <TrendingDownIcon
              className={
                summary.returnPercent === null
                  ? 'text-gray-400'
                  : isGain ? 'text-green-500' : 'text-red-500'
              }
              size={24}
            />
          </div>
        </div>
        </div>

        {/* What the contributions figure rests on. Says what could be WRONG
            with it, not how many rows there are — and renders nothing at all
            when every transfer is accounted for. */}
        {summary.unattributedTransfers.count > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              {formatCurrency(summary.unattributedTransfers.amount)} of transfers in and out of
              these accounts have no matching row in another account, so they are counted as
              money from outside. Any that were moves within the portfolio make Net Contributions
              too big and Total Return too small.
            </p>
          </div>
        )}

        {/* Performance Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-theme-heading dark:text-white">Portfolio Performance</h2>
          <div className="flex gap-2">
            {['1M', '3M', '6M', '1Y', 'ALL'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period as '1M' | '3M' | '6M' | '1Y' | 'ALL')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  selectedPeriod === period
                    ? 'bg-[#1a2332] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" stroke="#9CA3AF" />
              <YAxis 
                stroke="#9CA3AF" 
                tickFormatter={(value: number) => {
                  const formatted = formatCurrency(value);
                  if (value >= 1000) {
                    const thousands = formatDecimal(
                      toDecimal(value).dividedBy(1000),
                      0
                    );
                    return `${formatted.charAt(0)}${thousands}k`;
                  }
                  return formatted;
                }}
              />
              <Tooltip
                formatter={(value) => formatCurrency(toDecimal(Number(value)))}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #ccc',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        </div>

        {/* Holdings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Holdings List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold mb-4 text-theme-heading dark:text-white">Holdings</h2>
          {portfolioLines.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No holdings to display
            </p>
          ) : (
            <div className="space-y-4">
              {portfolioLines.map((line, index) => {
                const account = accountsById.get(line.accountId);
                if (!account) return null;

                return (
                  <div
                    key={account.id}
                    className="border-b dark:border-gray-700 pb-4 last:border-0 -mx-2 px-2 py-2 rounded"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {line.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {line.institution || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(line.value)}</p>
                      </div>
                    </div>
                    {/* The paired cash, inside the line rather than beside it:
                        the row's value already contains it, so this says what
                        part of the total is not invested. */}
                    {line.cash.map(cash => (
                      <p
                        key={cash.accountId}
                        className="ml-5 mb-2 flex justify-between text-xs text-gray-500 dark:text-gray-400"
                      >
                        <span>{cash.label}</span>
                        <span className="tabular-nums">{formatCurrency(cash.value)}</span>
                      </p>
                    ))}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            // Clamped for layout only: a line can be worth a
                            // negative amount, and a negative width renders
                            // nothing anywhere.
                            width: `${Math.min(100, Math.max(0, line.allocation.toNumber()))}%`,
                            backgroundColor: COLORS[index % COLORS.length]
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
                        {formatPercentage(line.allocation)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Allocation Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold mb-4 text-theme-heading dark:text-white">Asset Allocation</h2>
          {portfolioLines.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No data to display
            </p>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {allocationData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(toDecimal(Number(value)))}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #ccc',
                        borderRadius: '8px'
                      }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {portfolioLines.map((line, index) => (
                  <div key={line.accountId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-gray-700 dark:text-gray-300">{line.institution || 'N/A'}</span>
                    </div>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatPercentage(line.allocation)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        </div>

        {/* Investment Tips */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="text-blue-700 dark:text-blue-400 mt-1" size={20} />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">How these figures are worked out</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• A line is worth the investment account plus any cash account paired with it — set the pairing in Account Settings → Part of investment account</li>
                <li>• Money transferred in from elsewhere counts as a contribution; moving money between an investment account and its own cash does not</li>
                <li>• Total Return is what the portfolio is worth today less what was put into it</li>
                <li>• The chart is the balance history of these accounts, not a projection</li>
              </ul>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Watchlist Tab */}
      {activeTab === 'watchlist' && (
        <StockWatchlist />
      )}

      {/* Portfolio Tab — the MARKET view.

          Deliberately NOT the same number as the Overview's Portfolio Value.
          That tile is the ledger (opening balance plus transactions across the
          investment↔cash pair); this is quantity × last fetched price. Both are
          true, they answer different questions, and adding them would count the
          shares and the cash that bought them twice. */}
      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          {holdingsError && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
              <p className="text-sm text-red-700 dark:text-red-300">{holdingsError}</p>
            </div>
          )}

          {investmentAccounts.map((account) => {
            const accountHoldings = holdingsByAccount.get(account.id) ?? [];
            return (
              <div key={account.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{account.name}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setManagingAccountId(account.id);
                      setActiveTab('manage');
                    }}
                    className="text-sm text-primary hover:text-secondary transition-colors"
                  >
                    Manage holdings →
                  </button>
                </div>
                <InvestmentMarketView
                  holdings={accountHoldings}
                  fallbackCurrency={account.currency}
                  onUpdateQuotes={() =>
                    void updateQuotes(
                      account.id,
                      accountHoldings.map((holding) => holding.symbol)
                    )
                  }
                  isUpdating={isUpdatingQuotes && quotedAccountId === account.id}
                  updateError={quotedAccountId === account.id ? quoteError : null}
                  symbolErrors={quotedAccountId === account.id ? symbolErrors : undefined}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Manage Tab */}
      {activeTab === 'manage' && (
        <div className="space-y-6">
          {holdingsError && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
              <p className="text-sm text-red-700 dark:text-red-300">{holdingsError}</p>
            </div>
          )}

          {/* Account Selector */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4">
            <label htmlFor="manage-account" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select investment account
            </label>
            <select
              id="manage-account"
              value={managingAccountId || ''}
              onChange={(e) => setManagingAccountId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="">Choose an account...</option>
              {/* Grouped and alphabetised like every other account
                  dropdown in the app. */}
              <GroupedAccountOptions accounts={investmentAccounts} />
            </select>
          </div>

          {managingAccountId && (() => {
            const account = investmentAccounts.find(a => a.id === managingAccountId);
            if (!account) return null;

            return (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
                <PortfolioManager
                  holdings={holdingsByAccount.get(account.id) ?? []}
                  currency={account.currency}
                  onAdd={(values) => handleAddHolding(account.id, account.currency, values)}
                  onEdit={handleEditHolding}
                  onDelete={handleDeleteHolding}
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* Add Investment Modal */}
      <AddInvestmentModal
        isOpen={showAddInvestmentModal}
        onClose={() => setShowAddInvestmentModal(false)}
      />
    </PageWrapper>
  );
}
