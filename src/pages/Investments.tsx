import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, AlertCircle } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function Investments() {
  const { accounts, transactions } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('1Y');

  // Helper function to format currency properly
  const formatCurrency = (amount: number): string => {
    return '£' + new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(amount));
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
  
  // Calculate portfolio value from investment accounts
  const portfolioValue = investmentAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  
  // Calculate invested amount from investment-related transactions
  const investmentTransactions = transactions.filter(t => 
    t.category?.toLowerCase().includes('invest') || 
    investmentAccounts.some(acc => t.accountId === acc.id)
  );
  
  const totalInvested = investmentTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalReturn = portfolioValue - totalInvested;
  const returnPercentage = totalInvested > 0 ? ((totalReturn / totalInvested) * 100) : 0;

  // Create holdings data from investment accounts
  const holdings = investmentAccounts.map((acc, index) => ({
    name: acc.name,
    value: acc.balance,
    allocation: portfolioValue > 0 ? (acc.balance / portfolioValue) * 100 : 0,
    return: 0, // Would need historical data to calculate actual returns
    ticker: acc.institution || 'N/A'
  }));

  // Create performance data based on transactions
  const generatePerformanceData = () => {
    const data = [];
    const today = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthTransactions = investmentTransactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getFullYear() === date.getFullYear() && 
               tDate.getMonth() === date.getMonth();
      });
      
      const monthInvested = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
        
      const monthWithdrawn = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const netInvested = monthInvested - monthWithdrawn;
      
      data.push({
        month: date.toLocaleString('default', { month: 'short' }),
        value: data.length > 0 ? data[data.length - 1].value + netInvested : totalInvested
      });
    }
    
    // Add current value
    if (data.length > 0) {
      data[data.length - 1].value = portfolioValue;
    }
    
    return data;
  };

  const performanceData = generatePerformanceData();
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  // If no investment accounts, show empty state
  if (investmentAccounts.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Investments</h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <BarChart3 className="mx-auto text-gray-400 mb-4" size={64} />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
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
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Investments</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(portfolioValue)}
              </p>
            </div>
            <DollarSign className="text-primary" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Invested</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(totalInvested)}
              </p>
            </div>
            <BarChart3 className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Return</p>
              <p className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {totalReturn >= 0 ? '+' : ''}{formatCurrency(totalReturn)}
              </p>
            </div>
            <TrendingUp className={totalReturn >= 0 ? 'text-green-500' : 'text-red-500'} size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Return %</p>
              <p className={`text-2xl font-bold ${returnPercentage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {returnPercentage >= 0 ? '+' : ''}{formatPercentage(returnPercentage)}
              </p>
            </div>
            <TrendingDown className={returnPercentage >= 0 ? 'text-green-500' : 'text-red-500'} size={24} />
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">Portfolio Performance</h2>
          <div className="flex gap-2">
            {['1M', '3M', '6M', '1Y', 'ALL'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period as any)}
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
                tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Holdings List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Holdings</h2>
          {holdings.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No holdings to display
            </p>
          ) : (
            <div className="space-y-4">
              {holdings.map((holding, index) => (
                <div key={holding.name} className="border-b dark:border-gray-700 pb-4 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{holding.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{holding.ticker}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(holding.value)}</p>
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
              ))}
            </div>
          )}
        </div>

        {/* Allocation Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Asset Allocation</h2>
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
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-blue-600 dark:text-blue-400 mt-1" size={20} />
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
  );
}
