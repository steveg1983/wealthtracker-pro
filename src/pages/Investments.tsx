import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useUser } from '@clerk/clerk-react';
import { TrendingUpIcon, TrendingDownIcon, BarChart3Icon, AlertCircleIcon, ChevronRightIcon, LineChartIcon, EyeIcon, PlusIcon } from '../components/icons';
import EnhancedPortfolioView from '../components/EnhancedPortfolioView';
import AddInvestmentModal from '../components/AddInvestmentModal';
import RealTimePortfolio from '../components/RealTimePortfolio';
import RealTimePortfolioEnhanced from '../components/RealTimePortfolioEnhanced';
import PortfolioManager from '../components/PortfolioManager';
import StockWatchlist from '../components/StockWatchlist';
import PortfolioOptimizer from '../components/investments/PortfolioOptimizer';
// Use optimized lazy-loaded charts to reduce bundle size
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from '../components/charts/OptimizedCharts';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import PageWrapper from '../components/PageWrapper';
import { investmentService, type PortfolioSummary } from '../services/api/investmentService';
import { logger } from '../services/loggingService';

export default function Investments() {
  const { accounts, transactions, updateAccount } = useApp();
  const { user } = useUser();
  const { formatCurrency } = useCurrencyDecimal();
  const [selectedPeriod, setSelectedPeriod] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('1Y');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showAddInvestmentModal, setShowAddInvestmentModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'watchlist' | 'portfolio' | 'optimize' | 'manage'>('overview');
  const [managingAccountId, setManagingAccountId] = useState<string | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load portfolio data from investment service
  useEffect(() => {
    if (user?.id) {
      loadPortfolioData();
      
      // Start real-time price updates
      investmentService.startPriceUpdates(user.id, 60000); // Update every minute
      
      return () => {
        investmentService.stopPriceUpdates();
      };
    }
  }, [user?.id, selectedAccountId]);

  const loadPortfolioData = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const summary = await investmentService.getPortfolioSummary(user.id, selectedAccountId || undefined);
      setPortfolioSummary(summary);
      
      // Migrate from localStorage if needed
      await investmentService.migrateFromLocalStorage(user.id);
    } catch (error) {
      logger.error('Failed to load portfolio data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format percentages
  const formatPercentage = (value: number): string => {
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value) + '%';
  };

  // Get investment accounts only
  const investmentAccounts = accounts.filter(acc => acc.type === 'investment');
  
  // Use portfolio summary from investment service if available, otherwise fall back to calculated values
  const portfolioValue = portfolioSummary?.totalValue || investmentAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalInvested = portfolioSummary?.totalCost || 0;
  const totalReturn = portfolioSummary?.totalGainLoss || (portfolioValue - totalInvested);
  const returnPercentage = portfolioSummary?.totalGainLossPercent || (totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0);
  
  // Get investment transactions for chart data
  const investmentTransactions = transactions.filter(t => 
    t.category?.toLowerCase().includes('invest') || 
    investmentAccounts.some(acc => t.accountId === acc.id)
  );

  // Create holdings data from portfolio summary or investment accounts
  const holdings = portfolioSummary?.investments.map((inv) => ({
    name: inv.name,
    value: inv.marketValue || 0,
    allocation: portfolioValue > 0 ? ((inv.marketValue || 0) / portfolioValue) * 100 : 0,
    return: inv.costBasis > 0 ? (((inv.marketValue || 0) - inv.costBasis) / inv.costBasis) * 100 : 0,
    ticker: inv.symbol || 'N/A'
  })) || investmentAccounts.map((acc) => {
    const numericBalance = typeof acc.balance === 'string' ? parseFloat(acc.balance) : acc.balance;
    return {
      name: acc.name,
      value: numericBalance,
      allocation: portfolioValue > 0 ? (numericBalance / portfolioValue) * 100 : 0,
      return: 0,
      ticker: acc.institution || 'N/A'
    };
  });

  // Create performance data based on transactions
  const generatePerformanceData = () => {
    const data: Array<{ month: string; value: number }> = [];
    const today = new Date();
    let periodMonths = 12; // Default to 1Y
    
    // Adjust period based on selection
    switch (selectedPeriod) {
      case '1M': periodMonths = 1; break;
      case '3M': periodMonths = 3; break;
      case '6M': periodMonths = 6; break;
      case '1Y': periodMonths = 12; break;
      case 'ALL': {
        // Find earliest transaction date
        const earliestDate = investmentTransactions.reduce((earliest, t) => {
          const tDate = new Date(t.date);
          return tDate < earliest ? tDate : earliest;
        }, new Date());
        periodMonths = Math.max(12, Math.ceil((today.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
        break;
      }
    }
    
    let cumulativeValue = 0;
    
    for (let i = periodMonths - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      
      // Get all transactions up to this month
      const transactionsUpToDate = investmentTransactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate <= new Date(date.getFullYear(), date.getMonth() + 1, 0);
      });
      
      // Calculate cumulative invested amount
      const totalInvestedUpToDate = transactionsUpToDate
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
        
      const totalWithdrawnUpToDate = transactionsUpToDate
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      cumulativeValue = totalInvestedUpToDate - totalWithdrawnUpToDate;
      
      // For the current month, use actual portfolio value
      if (i === 0) {
        cumulativeValue = portfolioValue;
      } else {
        // Add some simulated growth for historical data (since we don't have actual historical values)
        const monthsFromNow = i;
        const estimatedGrowthRate = returnPercentage > 0 ? (returnPercentage / 100) / 12 : 0;
        cumulativeValue = cumulativeValue * (1 + (estimatedGrowthRate * monthsFromNow));
      }
      
      data.push({
        month: date.toLocaleString('default', { month: 'short' }),
        value: Math.max(0, cumulativeValue)
      });
    }
    
    return data;
  };

  const performanceData = generatePerformanceData();
  // Use consistent colors for better visual coherence
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  // If no investment accounts, show empty state
  if (investmentAccounts.length === 0) {
    return (
      <div>
        <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow p-4 mb-6">
          <h1 className="text-3xl font-bold text-white">Investments</h1>
        </div>
        
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-8 text-center">
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
          <div 
            onClick={() => setShowAddInvestmentModal(true)}
            className="cursor-pointer"
            title="Add Investment"
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
              className="transition-all duration-200 hover:scale-110 drop-shadow-lg hover:drop-shadow-xl"
              style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
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
          </div>
        )
      }
    >

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
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
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
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
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'portfolio'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <LineChartIcon size={16} />
          Portfolio
        </button>
        <button
          onClick={() => setActiveTab('optimize')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'optimize'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <TrendingUpIcon size={16} />
          Optimize
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
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
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(portfolioValue)}
              </p>
            </div>
            <BarChart3Icon className="text-primary" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Invested</p>
              <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
                {formatCurrency(totalInvested)}
              </p>
            </div>
            <BarChart3Icon className="text-gray-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Return</p>
              <p className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {totalReturn >= 0 ? '+' : ''}{formatCurrency(totalReturn)}
              </p>
            </div>
            <TrendingUpIcon className={totalReturn >= 0 ? 'text-green-500' : 'text-red-500'} size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Return %</p>
              <p className={`text-2xl font-bold ${returnPercentage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {returnPercentage >= 0 ? '+' : ''}{formatPercentage(returnPercentage)}
              </p>
            </div>
            <TrendingDownIcon className={returnPercentage >= 0 ? 'text-green-500' : 'text-red-500'} size={24} />
          </div>
        </div>
        </div>

        {/* Performance Chart */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-theme-heading dark:text-white">Portfolio Performance</h2>
          <div className="flex gap-2">
            {['1M', '3M', '6M', '1Y', 'ALL'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period as '1M' | '3M' | '6M' | '1Y' | 'ALL')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  selectedPeriod === period
                    ? 'bg-primary text-white'
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
              <XAxis dataKey="month" stroke="#9CA3AF" />
              <YAxis 
                stroke="#9CA3AF" 
                tickFormatter={(value) => {
                  const formatted = formatCurrency(value);
                  if (value >= 1000) {
                    return `${formatted.charAt(0)}${(value / 1000).toFixed(0)}k`;
                  }
                  return formatted;
                }}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
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
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <h2 className="text-xl font-semibold mb-4 text-theme-heading dark:text-white">Holdings</h2>
          {holdings.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No holdings to display
            </p>
          ) : (
            <div className="space-y-4">
              {holdings.map((holding, index) => {
                const account = investmentAccounts.find(a => a.name === holding.name);
                if (!account) return null;
                
                return (
                  <div 
                    key={account.id} 
                    className="border-b dark:border-gray-700 pb-4 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded"
                    onClick={() => setSelectedAccountId(account.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white hover:text-primary dark:hover:text-primary transition-colors">
                            {holding.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{holding.ticker}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(holding.value)}</p>
                        </div>
                        {account.holdings && account.holdings.length > 0 && (
                          <ChevronRightIcon className="text-gray-400" size={20} />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full"
                          style={{ 
                            width: `${holding.allocation}%`,
                            backgroundColor: COLORS[index % COLORS.length]
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
                        {formatPercentage(holding.allocation)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Allocation Chart */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <h2 className="text-xl font-semibold mb-4 text-theme-heading dark:text-white">Asset Allocation</h2>
          {holdings.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No data to display
            </p>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={holdings}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {holdings.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
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
                {holdings.map((holding, index) => (
                  <div key={holding.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-gray-700 dark:text-gray-300">{holding.ticker}</span>
                    </div>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatPercentage(holding.allocation)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        </div>

        {/* Investment Tips */}
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-6 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="text-amber-600 dark:text-amber-400 mt-1" size={20} />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Investment Tips</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Add investment accounts to track your portfolio</li>
                <li>• Record investment transactions with appropriate categories</li>
                <li>• Review your asset allocation regularly</li>
                <li>• Consider your risk tolerance and investment timeline</li>
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

      {/* Portfolio Tab */}
      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          {investmentAccounts.length === 0 ? (
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-8 text-center">
              <BarChart3Icon className="mx-auto text-gray-400 mb-4" size={64} />
              <h2 className="text-xl font-semibold text-theme-heading dark:text-white mb-2">
                No Investment Accounts Yet
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Add an investment account to start tracking your portfolio performance with real-time data.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Go to Accounts → Add Account → Choose "Investment" as the account type
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Combined Portfolio View */}
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Combined Portfolio</h2>
                <RealTimePortfolioEnhanced
                  holdings={investmentAccounts.flatMap(acc => 
                    (acc.holdings || []).map(h => ({
                      symbol: h.symbol || h.ticker,
                      shares: toDecimal(h.shares),
                      averageCost: toDecimal(h.averageCost || h.costBasis / h.shares || h.value / h.shares),
                      costBasis: toDecimal(h.costBasis || h.shares * (h.averageCost || h.value / h.shares))
                    }))
                  )}
                  baseCurrency={investmentAccounts[0]?.currency || 'USD'}
                />
              </div>
              
              {/* Individual Account Views */}
              {investmentAccounts.map((account) => (
                <div key={account.id} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{account.name}</h3>
                    <button
                      onClick={() => {
                        setManagingAccountId(account.id);
                        setActiveTab('manage');
                      }}
                      className="text-sm text-primary hover:text-secondary transition-colors"
                    >
                      Manage Holdings →
                    </button>
                  </div>
                  {account.holdings && account.holdings.length > 0 ? (
                    <RealTimePortfolioEnhanced
                      holdings={account.holdings.map(h => ({
                        symbol: h.symbol || h.ticker,
                        shares: toDecimal(h.shares),
                        averageCost: toDecimal(h.averageCost || h.costBasis / h.shares || h.value / h.shares),
                        costBasis: toDecimal(h.costBasis || h.shares * (h.averageCost || h.value / h.shares))
                      }))}
                      baseCurrency={account.currency}
                    />
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                      No holdings in this account. Click "Manage Holdings" to add stocks.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Optimize Tab */}
      {activeTab === 'optimize' && (
        <div className="space-y-6">
          <PortfolioOptimizer
            portfolioValue={totalValue}
            currentAllocations={
              portfolioSummary?.assetAllocation?.reduce((acc, asset) => {
                acc[asset.category] = asset.percentage / 100;
                return acc;
              }, {} as Record<string, number>) || {}
            }
          />
        </div>
      )}
      
      {/* Manage Tab */}
      {activeTab === 'manage' && (
        <div className="space-y-6">
          {investmentAccounts.length === 0 ? (
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-8 text-center">
              <BarChart3Icon className="mx-auto text-gray-400 mb-4" size={64} />
              <h2 className="text-xl font-semibold text-theme-heading dark:text-white mb-2">
                No Investment Accounts Yet
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Add an investment account to start managing your portfolio holdings.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Account Selector */}
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Investment Account
                </label>
                <select
                  value={managingAccountId || ''}
                  onChange={(e) => setManagingAccountId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Choose an account...</option>
                  {investmentAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Portfolio Manager */}
              {managingAccountId && (() => {
                const account = investmentAccounts.find(a => a.id === managingAccountId);
                if (!account) return null;
                
                return (
                  <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
                    <PortfolioManager
                      accountId={account.id}
                      holdings={(account.holdings || []).map(h => ({
                        id: `${account.id}-${h.ticker}`,
                        symbol: h.ticker,
                        shares: toDecimal(h.shares),
                        averageCost: toDecimal(h.averageCost || h.value / h.shares),
                        costBasis: toDecimal(h.shares * (h.averageCost || h.value / h.shares)),
                        dateAdded: h.lastUpdated || new Date()
                      }))}
                      onUpdate={(newHoldings) => {
                        const updatedAccount = {
                          ...account,
                          holdings: newHoldings.map(h => ({
                            ticker: h.symbol,
                            name: h.symbol, // Will be updated by real-time service
                            shares: h.shares.toNumber(),
                            value: h.costBasis.toNumber(),
                            averageCost: h.averageCost.toNumber(),
                            lastUpdated: new Date()
                          }))
                        };
                        updateAccount(updatedAccount);
                      }}
                    />
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
      
      {/* Portfolio View Modal */}
      {selectedAccountId && (() => {
        const account = investmentAccounts.find(a => a.id === selectedAccountId);
        if (!account) return null;
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#D9E1F2] dark:bg-gray-900 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border-2 border-blue-300 dark:border-gray-700">
              <EnhancedPortfolioView
                accountId={selectedAccountId}
                accountName={account.name}
                holdings={account.holdings || []}
                currency={account.currency}
                onClose={() => setSelectedAccountId(null)}
              />
            </div>
          </div>
        );
      })()}
      
      {/* Add Investment Modal */}
      {user?.id && (
        <AddInvestmentModal
          isOpen={showAddInvestmentModal}
          onClose={() => setShowAddInvestmentModal(false)}
          onAdd={async (investment: any) => {
            try {
              await investmentService.createInvestment(user.id, {
                symbol: investment.ticker,
                name: investment.name,
                quantity: investment.shares,
                costBasis: investment.purchasePrice * investment.shares,
                purchasePrice: investment.purchasePrice,
                purchaseDate: new Date(investment.purchaseDate),
                assetType: investment.type as any,
                accountId: investment.accountId,
                currency: 'USD'
              });
              
              // Reload portfolio data
              await loadPortfolioData();
              setShowAddInvestmentModal(false);
            } catch (error) {
              logger.error('Failed to add investment:', error);
            }
          }}
        />
      )}
    </PageWrapper>
  );
}