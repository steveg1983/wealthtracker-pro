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
import { buildHoldingAllocation } from '../utils/holdingAllocation';
// THE SEAM, not the service. This page called `InvestmentService` — and, through
// it, a Supabase client — directly until slice 31, with a `userIdService` lookup
// at every one of its five call sites. That is the coupling `src/desktop/routes.ts`
// recorded as the reason this route could not be mounted in a device window, and
// re-routing it through `@data` is what let that entry move to DESKTOP_ROUTES.
//
// Nothing about what the page DOES changed. The cloud half of the port delegates
// to the same service, with the same queries; the identity it used to resolve
// here is resolved inside the implementation, which is seam rule 1 and is the
// rule that stops "which user?" leaking into a component.
import { dataPort } from '@data';
import type { InvestmentHolding } from '@data';
import { fetchQuotes } from '../services/stockPriceService';
import { capSeriesWithRemainder, categoricalColor, useCategoricalRamp, useChartTooltipStyle } from '../components/charts/chartColors';
import { resolvePeriod } from '../hooks/usePeriod';

/**
 * The windows this chart offers, in the app's own words.
 *
 * `3 months` rather than `3M`: the abbreviation saved eleven characters on a
 * control that has room, at the cost of matching nothing else in the product.
 */
const INVESTMENT_PERIODS = ['1-month', '3-months', '6-months', '12-months', 'tax-year', 'all'] as const;
type InvestmentPeriod = (typeof INVESTMENT_PERIODS)[number];

const INVESTMENT_PERIOD_LABELS: Record<InvestmentPeriod, string> = {
  '1-month': '1 month',
  '3-months': '3 months',
  '6-months': '6 months',
  '12-months': '12 months',
  'tax-year': 'Tax year',
  all: 'All time',
};

/** Trailing windows only; 'tax-year' and 'all' resolve elsewhere. */
const INVESTMENT_PERIOD_MONTHS: Record<'1-month' | '3-months' | '6-months' | '12-months', number> = {
  '1-month': 1,
  '3-months': 3,
  '6-months': 6,
  '12-months': 12,
};

export default function Investments() {
  const { accounts, transactions, transactionSplits, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  /**
   * THE APP'S PERIOD VOCABULARY, spoken here too.
   *
   * This picker used to read `1M 3M 6M 1Y ALL` while every other surface in the
   * app said "This month / Tax year / 12 months / All time". Two vocabularies
   * for one idea means the reader has to translate between screens, and the one
   * period a UK user most wants of an investment chart — the tax year — was
   * missing from the only page where gains are realised.
   *
   * The WINDOWS stay trailing rather than becoming the Dashboard's calendar
   * periods: "the last 3 months" is the right question of a performance line,
   * and "this month" is not. What is shared is the wording and the tax-year
   * rule itself, which comes from `resolvePeriod` so that Tax year means 6
   * April here and on the Dashboard, forever, from one definition.
   */
  const [selectedPeriod, setSelectedPeriod] = useState<InvestmentPeriod>('12-months');
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
    try {
      // An engine with nowhere to keep a holding answers with an empty list
      // rather than rejecting (divergence B-12), which is honest: there are
      // none, because there is nowhere to keep them. The page used to reach
      // that answer by checking for a database id, which meant asking the
      // question "who is signed in?" in order to learn something about a STORE.
      setHoldings(await dataPort.listInvestments());
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
    if (symbols.length === 0) return;

    setIsUpdatingQuotes(true);
    setQuoteError(null);
    setSymbolErrors(new Map());
    try {
      const batch = await fetchQuotes(symbols);
      setSymbolErrors(batch.errors);

      if (batch.quotes.size > 0) {
        // A store with nowhere to keep a price refuses BY NAME, and seam rule 4
        // makes that refusal's own sentence the one on screen — which is why
        // this no longer checks for a session first and no longer words the
        // refusal itself. The engine knows why it cannot; this page does not.
        await dataPort.applyInvestmentPrices(
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
      await dataPort.createInvestment({
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
      await dataPort.updateInvestment(id, {
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
      await dataPort.deleteInvestment(id);
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
    if (selectedPeriod === 'all') return { from: null, to: null };
    // Borrowed whole, so the two pages cannot disagree about when the tax year
    // starts — including in the days between 1 and 5 April, which is exactly
    // when a second implementation would have been caught.
    if (selectedPeriod === 'tax-year') return resolvePeriod('tax-year', '', '');
    const months = INVESTMENT_PERIOD_MONTHS[selectedPeriod];
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
  /**
   * THE SLICES, capped at what the palette can colour.
   *
   * This drew one slice per account — twelve, against a five-colour ramp — so
   * slices 1 and 6 and 11 were painted identically and the ring read as one
   * grey doughnut. Reported by the owner as "the pie looks all the same colour
   * to the eye vs the legend".
   *
   * The four largest keep their own slice and everything below them becomes a
   * single remainder, which is the honest shape: a 0.01% wedge is not a slice
   * anybody can see or click, and pretending otherwise is what made the legend
   * twelve rows long. The remainder is NAMED with its count so the total is
   * still accounted for — a share that does not add up is the one thing a
   * finance chart may not do.
   */
  const allocationData = useMemo(
    () => capSeriesWithRemainder(
      summary.lines.filter(line => line.value.greaterThan(0)),
      line => line.value.toNumber(),
      line => line.name,
      count => `${count} smaller accounts`
    ),
    [summary.lines]
  );

  // The LEDGER lines, one per investment account. Named for what they are:
  // `holdings` is now the market-side data from public.investments, and the two
  // must never be confused for each other on this page.
  const portfolioLines = summary.lines;
  /**
   * WHAT the money is in, as opposed to WHERE it is kept.
   *
   * The ring above answers "which account holds it", which tells somebody with
   * one broker and six wrappers nothing. This one crosses accounts: Apple held
   * in an ISA and in a dealing account is one position, and every settlement
   * sleeve in the portfolio is a single Cash category.
   */
  const holdingAllocation = useMemo(
    () => buildHoldingAllocation(holdings, summary.lines),
    [holdings, summary.lines]
  );

  const holdingSlices = useMemo(
    () => capSeriesWithRemainder(
      holdingAllocation.slices,
      slice => slice.value.toNumber(),
      slice => slice.label,
      count => `${count} smaller holdings`
    ),
    [holdingAllocation.slices]
  );

  const holdingSlicesTotal = useMemo(
    () => holdingSlices.reduce((sum, slice) => sum + slice.value, 0),
    [holdingSlices]
  );

  const allocationTotal = useMemo(
    () => allocationData.reduce((sum, slice) => sum + slice.value, 0),
    [allocationData]
  );
  const isGain = summary.totalReturn.greaterThanOrEqualTo(0);
  // The shared ramp. The array that stood here claimed to be "consistent
  // colors" while being the only one of the app's palettes to differ from its
  // twin — positions seven and eight had drifted to a cyan and a lime.
  const ramp = useCategoricalRamp();
  const chartTooltipStyle = useChartTooltipStyle();

  // If no investment accounts, show empty state
  if (investmentAccounts.length === 0) {
    return (
      <div>
        {/* The conversion pass reached the populated page and not this branch, because an
            early return is easy to read past. Same hairline card, same ink, as everywhere. */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-4 mb-6">
          <h1 className="text-page font-semibold text-gray-900 dark:text-white">Investments</h1>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-8 text-center">
          <BarChart3Icon className="mx-auto text-gray-400 mb-4" size={64} />
          <h2 className="text-card font-semibold text-theme-heading dark:text-white mb-2">
            No Investment Accounts Yet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Add an investment account to start tracking your portfolio performance.
          </p>
          <p className="text-body text-gray-500 dark:text-gray-500">
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
            className="cursor-pointer rounded-full"
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
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-body font-medium rounded-md transition-colors ${
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
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-body font-medium rounded-md transition-colors ${
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
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-body font-medium rounded-md transition-colors ${
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
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-body font-medium rounded-md transition-colors ${
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body text-gray-500 dark:text-gray-400">Portfolio Value</p>
              <p className="text-page font-bold text-gray-900 dark:text-white">
                {formatCurrency(summary.value)}
              </p>
            </div>
            <BarChart3Icon className="text-primary" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body text-gray-500 dark:text-gray-400">Net Contributions</p>
              <p className="text-page font-bold text-blue-700 dark:text-blue-400">
                {formatCurrency(summary.netContributions)}
              </p>
              <p className="text-dense text-gray-500 dark:text-gray-400 mt-1">
                Transferred in, less transferred out
              </p>
            </div>
            <BarChart3Icon className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body text-gray-500 dark:text-gray-400">Total Return</p>
              <p className={`text-page font-bold ${isGain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isGain ? '+' : ''}{formatCurrency(summary.totalReturn)}
              </p>
            </div>
            <TrendingUpIcon className={isGain ? 'text-green-500' : 'text-red-500'} size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body text-gray-500 dark:text-gray-400">Return %</p>
              {summary.returnPercent === null ? (
                <>
                  <p className="text-page font-bold text-gray-500 dark:text-gray-400">—</p>
                  <p className="text-dense text-gray-500 dark:text-gray-400 mt-1">
                    No contributions to measure a return against
                  </p>
                </>
              ) : (
                <p className={`text-page font-bold ${isGain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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
          <div className="rounded-lg p-4">
            <p className="text-body text-gray-500 dark:text-gray-400">
              {formatCurrency(summary.unattributedTransfers.amount)} of transfers in and out of
              these accounts have no matching row in another account, so they are counted as
              money from outside. Any that were moves within the portfolio make Net Contributions
              too big and Total Return too small.
            </p>
          </div>
        )}

        {/* Performance Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-card font-semibold text-theme-heading dark:text-white">Portfolio Performance</h2>
          <div className="flex gap-2">
            {INVESTMENT_PERIODS.map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 text-body rounded-lg transition-colors ${
                  selectedPeriod === period
                    ? 'bg-[#1a2332] text-white dark:bg-gray-600 dark:text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {INVESTMENT_PERIOD_LABELS[period]}
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
                contentStyle={chartTooltipStyle}
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
          <h2 className="text-card font-semibold mb-4 text-theme-heading dark:text-white">Holdings</h2>
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
                          style={{ backgroundColor: categoricalColor(ramp, index) }}
                        />
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {line.name}
                          </h3>
                          <p className="text-body text-gray-500 dark:text-gray-400">
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
                        className="ml-5 mb-2 flex justify-between text-dense text-gray-500 dark:text-gray-400"
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
                            backgroundColor: categoricalColor(ramp, index)
                          }}
                        />
                      </div>
                      <span className="text-body text-gray-600 dark:text-gray-400 w-12 text-right">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
          <h2 className="text-card font-semibold mb-4 text-theme-heading dark:text-white">Asset Allocation</h2>
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
                        <Cell key={`cell-${index}`} fill={categoricalColor(ramp, index)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(toDecimal(Number(value)))}
                      contentStyle={chartTooltipStyle}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {/* Walks THE SLICES, not the accounts. The legend used to walk
                    `portfolioLines` while the ring walked `allocationData`, so
                    the two could differ in length and did — twelve rows beside
                    a five-colour ring. One source now, so a row and a wedge
                    cannot disagree about what exists. */}
                {allocationData.map((slice, index) => (
                  <div key={slice.name} className="flex items-center justify-between text-body">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: categoricalColor(ramp, index) }}
                      />
                      {/* The ACCOUNT, which is what the slice is. This read
                          `line.institution || 'N/A'` — so a portfolio held at
                          one bank showed the same word against four different
                          slices, and every account with no institution on file
                          was labelled "N/A". The legend is the only thing
                          identifying a slice (the ramp is one hue walked, and
                          it cycles), so naming it wrongly leaves the chart
                          unreadable rather than merely untidy. */}
                      <span className="text-gray-700 dark:text-gray-300">{slice.name}</span>
                    </div>
                    {/* The share is of THE RING, so the rows add to 100% — the
                        same rule the Dashboard's donut states. Taken from the
                        slice rather than from `line.allocation`, which was a
                        share of every account including the ones now folded
                        into the remainder, and so would no longer sum. */}
                    <span className="text-gray-900 dark:text-white font-medium">
                      {allocationTotal > 0
                        ? `${((slice.value / allocationTotal) * 100).toFixed(2)}%`
                        : '0.00%'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        </div>

        {/* ─ WHAT IT IS IN ────────────────────────────────────────────────────
            A second ring, because the first one's card was mostly empty space
            below a twelve-row legend and because it answers a different
            question. Where the money is KEPT and what it is INVESTED IN are
            not the same fact, and only the second one is a decision. */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6 mt-6">
          <h2 className="text-card font-semibold mb-1 text-theme-heading dark:text-white">
            Allocation by holding
          </h2>
          <p className="text-body text-gray-500 dark:text-gray-400 mb-4">
            Every account together — one line per security, with all settlement cash as one.
          </p>

          {holdingSlices.length === 0 ? (
            <p className="text-body text-gray-500 dark:text-gray-400">
              {holdingAllocation.unpricedCount > 0
                ? 'None of your holdings has a price yet, so there is nothing to size this by. Use “Update prices” on an account above.'
                : 'No priced holdings and no settlement cash, so there is nothing to divide up yet.'}
            </p>
          ) : (
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="h-56 w-full lg:w-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={holdingSlices}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {holdingSlices.map((slice, index) => (
                        <Cell key={slice.name} fill={categoricalColor(ramp, index)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(toDecimal(Number(value)))}
                      contentStyle={chartTooltipStyle}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                {holdingSlices.map((slice, index) => (
                  <div key={slice.name} className="flex items-center justify-between gap-3 text-body">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: categoricalColor(ramp, index) }}
                      />
                      <span className="text-gray-700 dark:text-gray-300 truncate">{slice.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-gray-500 dark:text-gray-400 tabular-nums">
                        {formatCurrency(toDecimal(slice.value))}
                      </span>
                      <span className="text-gray-900 dark:text-white font-medium tabular-nums w-16 text-right">
                        {holdingSlicesTotal > 0
                          ? `${((slice.value / holdingSlicesTotal) * 100).toFixed(2)}%`
                          : '0.00%'}
                      </span>
                    </div>
                  </div>
                ))}

                {/* SAID, not swallowed. A position with no price cannot be
                    sized, so it is not in the ring — and a chart that quietly
                    leaves out part of what you own is the same offence as a
                    filtered list claiming your money is gone. */}
                {holdingAllocation.unpricedCount > 0 && (
                  <p className="pt-2 text-body text-gray-500 dark:text-gray-400">
                    {holdingAllocation.unpricedCount === 1
                      ? '1 holding has no price yet, so it is not counted above.'
                      : `${holdingAllocation.unpricedCount} holdings have no price yet, so they are not counted above.`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Investment Tips */}
        <div className="bg-white dark:bg-gray-800 border border-line dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="text-blue-700 dark:text-blue-400 mt-1" size={20} />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">How these figures are worked out</h3>
              <ul className="text-body text-blue-800 dark:text-blue-200 space-y-1">
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
              <p className="text-body text-red-700 dark:text-red-300">{holdingsError}</p>
            </div>
          )}

          {investmentAccounts.map((account) => {
            const accountHoldings = holdingsByAccount.get(account.id) ?? [];
            return (
              <div key={account.id} className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                  <h3 className="text-card font-semibold text-gray-900 dark:text-white">{account.name}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setManagingAccountId(account.id);
                      setActiveTab('manage');
                    }}
                    className="text-body text-primary hover:text-secondary transition-colors"
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
              <p className="text-body text-red-700 dark:text-red-300">{holdingsError}</p>
            </div>
          )}

          {/* Account Selector */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-4">
            <label htmlFor="manage-account" className="block text-body font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select investment account
            </label>
            <select
              id="manage-account"
              value={managingAccountId || ''}
              onChange={(e) => setManagingAccountId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-transparent dark:bg-gray-700 dark:text-white"
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
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
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
