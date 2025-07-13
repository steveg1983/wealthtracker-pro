import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useCurrency } from '../hooks/useCurrency';
import { useReconciliation } from '../hooks/useReconciliation';
import TestDataWarningModal from '../components/TestDataWarningModal';

export default function Dashboard() {
  const { accounts, transactions, hasTestData, clearAllData } = useApp();
  const { firstName } = usePreferences();
  const { formatCurrency, convertAndSum, displayCurrency } = useCurrency();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);
  const [convertedTotals, setConvertedTotals] = useState({
    assets: 0,
    liabilities: 0,
    netWorth: 0
  });
  
  // Calculate totals with currency conversion
  useEffect(() => {
    let cancelled = false;
    
    const calculateTotals = async () => {
      setIsLoading(true);
      
      try {
        const assetAccounts = accounts.filter(acc => acc.balance > 0);
        const liabilityAccounts = accounts.filter(acc => acc.balance < 0);
        
        const [totalAssets, totalLiabilities] = await Promise.all([
          convertAndSum(assetAccounts.map(acc => ({ amount: acc.balance, currency: acc.currency }))),
          convertAndSum(liabilityAccounts.map(acc => ({ amount: Math.abs(acc.balance), currency: acc.currency })))
        ]);
        
        if (!cancelled) {
          setConvertedTotals({
            assets: totalAssets,
            liabilities: totalLiabilities,
            netWorth: totalAssets - totalLiabilities
          });
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error calculating totals:', error);
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    
    calculateTotals();
    
    return () => {
      cancelled = true;
    };
  }, [accounts, displayCurrency, convertAndSum]);
  
  const { assets: totalAssets, liabilities: totalLiabilities, netWorth } = convertedTotals;
  
  // Check for test data on component mount
  useEffect(() => {
    if (hasTestData) {
      const warningDismissed = localStorage.getItem('testDataWarningDismissed');
      if (warningDismissed !== 'true') {
        setShowTestDataWarning(true);
      }
    }
  }, [hasTestData]);


  // Generate net worth data for 24 months (memoized)
  const netWorthData = useMemo(() => {
    const data = [];
    const currentDate = new Date();
    for (let i = 23; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      
      // Use deterministic calculation based on index for consistent data
      const variation = Math.sin(i / 24 * Math.PI) * 0.1; // ±10% variation
      const historicalNetWorth = netWorth * (1 + variation);
      
      data.push({
        month: monthName,
        netWorth: Math.max(0, historicalNetWorth)
      });
    }
    return data;
  }, [netWorth]);

  // Get reconciliation data using shared hook
  const { reconciliationDetails } = useReconciliation(accounts, transactions);

  // Prepare data for pie chart (memoized)
  const pieData = useMemo(() => 
    accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      value: Math.abs(acc.balance),
      color: acc.balance > 0 ? '#10b981' : '#ef4444',
    })),
    [accounts]
  );

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Memoized chart styles for performance
  const chartStyles = useMemo(() => ({
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid #E5E7EB',
      borderRadius: '8px'
    },
    pieTooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid #ccc',
      borderRadius: '8px'
    }
  }), []);

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Welcome back, {firstName || 'User'}!
      </h1>
      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-4 md:mb-6">
        Here's your financial overview
      </p>

      {/* Summary Cards */}
      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-3">
        Click any card to view details
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/networth')}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Net Worth</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {isLoading ? '...' : formatCurrency(netWorth)}
              </p>
            </div>
            <DollarSign className="text-primary ml-2" size={20} />
          </div>
        </div>

        <div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/networth/assets')}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Total Assets</p>
              <p className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {isLoading ? '...' : formatCurrency(totalAssets)}
              </p>
            </div>
            <TrendingUp className="text-green-500 ml-2" size={20} />
          </div>
        </div>

        <div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/networth/liabilities')}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Total Liabilities</p>
              <p className="text-xl md:text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {isLoading ? '...' : formatCurrency(totalLiabilities)}
              </p>
            </div>
            <TrendingDown className="text-red-500 ml-2" size={20} />
          </div>
        </div>

      </div>

      {/* Charts and Additional Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
        {/* Net Worth Over Time Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 dark:text-white">Net Worth Over Time</h2>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={netWorthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="month" 
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                    return value.toString();
                  }}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Net Worth']}
                  contentStyle={chartStyles.tooltip}
                />
                <Bar dataKey="netWorth" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 md:mb-4 gap-1">
            <h2 className="text-lg md:text-xl font-semibold dark:text-white">Account Distribution</h2>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Click to view transactions</p>
          </div>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  onClick={(data) => {
                    navigate(`/transactions?account=${data.id}`);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={chartStyles.pieTooltip}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Outstanding Reconciliation Summary */}
      {reconciliationDetails.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 md:mb-4 gap-2">
            <h2 className="text-lg md:text-xl font-semibold dark:text-white">Outstanding Reconciliations</h2>
            <div className="sm:text-right">
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Total Outstanding</p>
              <p className="text-base md:text-lg font-bold text-orange-600 dark:text-orange-400">
                {reconciliationDetails.reduce((sum, acc) => sum + acc.unreconciledCount, 0)} items
              </p>
            </div>
          </div>
          
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3 md:mb-4">
            {reconciliationDetails.length} account{reconciliationDetails.length !== 1 ? 's' : ''} with unreconciled bank transactions.
          </p>

          {/* Summary Table */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-x-auto">
            <div className="min-w-[300px]">
              <div className="grid grid-cols-3 gap-2 sm:gap-4 p-2 sm:p-3 bg-gray-100 dark:bg-gray-600 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                <div>Account</div>
                <div className="text-center">Unreconciled</div>
                <div className="text-center">Total Amount</div>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {reconciliationDetails.map(account => (
                  <div 
                    key={account.account.id}
                    className="grid grid-cols-3 gap-2 sm:gap-4 p-2 sm:p-3 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                    onClick={() => navigate(`/reconciliation?account=${account.account.id}`)}
                  >
                    <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                      {account.account.name}
                    </div>
                    <div className="text-center text-xs sm:text-sm font-medium text-orange-600 dark:text-orange-400">
                      {account.unreconciledCount}
                    </div>
                    <div className="text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(account.totalToReconcile)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-3 md:mt-4">
            <div className="text-center p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">Accounts</p>
              <p className="text-base sm:text-lg font-bold text-blue-700 dark:text-blue-300">{reconciliationDetails.length}</p>
            </div>
            <div className="text-center p-2 sm:p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <p className="text-xs sm:text-sm text-orange-600 dark:text-orange-400">Unreconciled</p>
              <p className="text-base sm:text-lg font-bold text-orange-700 dark:text-orange-300">
                {reconciliationDetails.reduce((sum, acc) => sum + acc.unreconciledCount, 0)}
              </p>
            </div>
            <div className="text-center p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">Total Value</p>
              <p className="text-base sm:text-lg font-bold text-green-700 dark:text-green-300">
                {formatCurrency(reconciliationDetails.reduce((sum, acc) => sum + acc.totalToReconcile, 0))}
              </p>
            </div>
          </div>

          <div className="mt-3 md:mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              💡 <strong>Tip:</strong> Click on any account row to start reconciliation. Focus on accounts with the highest number of outstanding items first.
            </p>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 dark:text-white">Recent Transactions</h2>
        <div className="space-y-3">
          {transactions.slice(0, 5).map(transaction => (
            <div key={transaction.id} className="flex justify-between items-start sm:items-center py-2 border-b dark:border-gray-700 last:border-0">
              <div className="flex-1 min-w-0 mr-2">
                <p className="text-sm sm:text-base font-medium dark:text-white truncate">{transaction.description}</p>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {new Date(transaction.date).toLocaleDateString()}
                </p>
              </div>
              <span className={`text-sm sm:text-base font-semibold whitespace-nowrap ${
                transaction.type === 'income' 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
              </span>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No transactions yet
            </p>
          )}
        </div>
      </div>
      
      {/* Test Data Warning Modal */}
      <TestDataWarningModal
        isOpen={showTestDataWarning}
        onClose={() => setShowTestDataWarning(false)}
        onClearData={() => {
          clearAllData();
          setShowTestDataWarning(false);
        }}
      />
    </div>
  );
}