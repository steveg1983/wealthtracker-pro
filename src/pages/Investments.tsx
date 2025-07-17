import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { TrendingUpIcon, TrendingDownIcon, BarChart3Icon, AlertCircleIcon, ChevronRightIcon, LineChartIcon, EyeIcon } from '../components/icons';
import EnhancedPortfolioView from '../components/EnhancedPortfolioView';
import AddInvestmentModal from '../components/AddInvestmentModal';
import RealTimePortfolio from '../components/RealTimePortfolio';
import StockWatchlist from '../components/StockWatchlist';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import PageWrapper from '../components/PageWrapper';

export default function Investments() {
  const { accounts, transactions, getDecimalAccounts, getDecimalTransactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [selectedPeriod, setSelectedPeriod] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('1Y');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showAddInvestmentModal, setShowAddInvestmentModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'watchlist' | 'portfolio'>('overview');

  // Helper function to format percentages
  const formatPercentage = (value: number): string => {
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value) + '%';
  };

  // Get investment accounts only
  const investmentAccounts = accounts.filter(acc => acc.type === 'investment');
  const decimalInvestmentAccounts = getDecimalAccounts().filter(acc => acc.type === 'investment');
  
  // Calculate portfolio value from investment accounts using Decimal
  const portfolioValue = decimalInvestmentAccounts.reduce((sum, acc) => sum.plus(acc.balance), toDecimal(0));
  
  // Calculate invested amount from investment-related transactions
  const decimalTransactions = getDecimalTransactions();
  const investmentTransactions = transactions.filter(t => 
    t.category?.toLowerCase().includes('invest') || 
    investmentAccounts.some(acc => t.accountId === acc.id)
  );
  
  const decimalInvestmentTransactions = decimalTransactions.filter(t => 
    investmentTransactions.some(it => it.id === t.id)
  );
  
  const totalInvested = decimalInvestmentTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
    
  const totalReturn = portfolioValue.minus(totalInvested);
  const returnPercentage = totalInvested.greaterThan(0) ? totalReturn.dividedBy(totalInvested).times(100).toNumber() : 0;

  // Create holdings data from investment accounts
  const holdings = investmentAccounts.map((acc) => {
    const decimalAcc = decimalInvestmentAccounts.find(da => da.id === acc.id);
    const balance = decimalAcc?.balance || toDecimal(0);
    return {
      name: acc.name,
      value: balance.toNumber(),
      allocation: portfolioValue.greaterThan(0) ? balance.dividedBy(portfolioValue).times(100).toNumber() : 0,
      return: 0, // Would need historical data to calculate actual returns
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
        cumulativeValue = portfolioValue.toNumber();
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
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  // If no investment accounts, show empty state
  if (investmentAccounts.length === 0) {
    return (
      <div>
        <div className="bg-[#6B86B3] dark:bg-gray-700 rounded-2xl shadow p-4 mb-6">
          <h1 className="text-3xl font-bold text-white">Investments</h1>
        </div>
        
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-8 text-center">
          <BarChart3Icon className="mx-auto text-gray-400 mb-4" size={64} />
          <h2 className="text-xl font-semibold text-blue-800 dark:text-white mb-2">
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
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(totalInvested)}
              </p>
            </div>
            <BarChart3Icon className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Return</p>
              <p className={`text-2xl font-bold ${totalReturn.greaterThanOrEqualTo(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {totalReturn.greaterThanOrEqualTo(0) ? '+' : ''}{formatCurrency(totalReturn)}
              </p>
            </div>
            <TrendingUpIcon className={totalReturn.greaterThanOrEqualTo(0) ? 'text-green-500' : 'text-red-500'} size={24} />
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
          <h2 className="text-xl font-semibold text-blue-800 dark:text-white">Portfolio Performance</h2>
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
          <h2 className="text-xl font-semibold mb-4 text-blue-800 dark:text-white">Holdings</h2>
          {holdings.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No holdings to display
            </p>
          ) : (
            <div className="space-y-4">
              {investmentAccounts.map((account) => {
                const holding = holdings.find(h => h.name === account.name);
                if (!holding) return null;
                
                return (
                  <div 
                    key={account.id} 
                    className="border-b dark:border-gray-700 pb-4 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded"
                    onClick={() => setSelectedAccountId(account.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white hover:text-primary dark:hover:text-primary transition-colors">
                          {holding.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{holding.ticker}</p>
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
                            backgroundColor: COLORS[investmentAccounts.indexOf(account) % COLORS.length]
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
          <h2 className="text-xl font-semibold mb-4 text-blue-800 dark:text-white">Asset Allocation</h2>
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
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="text-blue-600 dark:text-blue-400 mt-1" size={20} />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Investment Tips</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
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
              <h2 className="text-xl font-semibold text-blue-800 dark:text-white mb-2">
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
            <div className="grid gap-6">
              {investmentAccounts.map((account) => (
                <RealTimePortfolio
                  key={account.id}
                  accountId={account.id}
                  accountName={account.name}
                  currency={account.currency}
                />
              ))}
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
      <AddInvestmentModal
        isOpen={showAddInvestmentModal}
        onClose={() => setShowAddInvestmentModal(false)}
      />
    </PageWrapper>
  );
}