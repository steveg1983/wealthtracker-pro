import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useCurrency } from '../hooks/useCurrency';

export default function Dashboard() {
  const { accounts, transactions } = useApp();
  const { firstName } = usePreferences();
  const { formatCurrency, convertAndSum, displayCurrency } = useCurrency();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
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


  // Generate net worth data for 24 months
  const netWorthData = [];
  const currentDate = new Date();
  for (let i = 23; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    
    // For now, use current net worth as sample data
    // In a real app, you'd calculate historical net worth from transaction history
    const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
    const historicalNetWorth = netWorth * (1 + variation * (i / 24));
    
    netWorthData.push({
      month: monthName,
      netWorth: Math.max(0, historicalNetWorth)
    });
  }

  // Find accounts that need reconciliation based on outstanding transactions
  const accountsNeedingReconciliation = accounts.filter(account => {
    // Get transactions for this account from the last 60 days
    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 60);
    
    const accountTransactions = transactions.filter(t => 
      t.accountId === account.id && 
      new Date(t.date) >= recentCutoff
    );
    
    // Count unreconciled transactions (those without cleared status or recent ones)
    const unreconciled = accountTransactions.filter(t => {
      // Mark as needing reconciliation if:
      // 1. Transaction is not marked as cleared
      // 2. Transaction is from the last 30 days and might need verification
      const transactionAge = Math.floor((Date.now() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24));
      return !t.cleared || (transactionAge <= 30 && !t.reconciledWith);
    });
    
    return unreconciled.length > 0;
  });

  // Get reconciliation details for display
  const reconciliationDetails = accountsNeedingReconciliation.map(account => {
    const accountTransactions = transactions.filter(t => t.accountId === account.id);
    const unreconciledCount = accountTransactions.filter(t => !t.cleared).length;
    const recentUnverified = accountTransactions.filter(t => {
      const transactionAge = Math.floor((Date.now() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24));
      return transactionAge <= 30 && !t.reconciledWith;
    }).length;
    
    return {
      ...account,
      unreconciledCount,
      recentUnverified,
      totalIssues: unreconciledCount + recentUnverified
    };
  });

  // Prepare data for pie chart
  const pieData = accounts.map(acc => ({
    id: acc.id,
    name: acc.name,
    value: Math.abs(acc.balance),
    color: acc.balance > 0 ? '#10b981' : '#ef4444',
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Welcome back, {firstName || 'User'}!
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Here's your financial overview
      </p>

      {/* Summary Cards */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        Click any card to view details
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/networth')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Net Worth</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLoading ? '...' : formatCurrency(netWorth)}
              </p>
            </div>
            <DollarSign className="text-primary" size={24} />
          </div>
        </div>

        <div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/networth/assets')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Assets</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {isLoading ? '...' : formatCurrency(totalAssets)}
              </p>
            </div>
            <TrendingUp className="text-green-500" size={24} />
          </div>
        </div>

        <div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/networth/liabilities')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Liabilities</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {isLoading ? '...' : formatCurrency(totalLiabilities)}
              </p>
            </div>
            <TrendingDown className="text-red-500" size={24} />
          </div>
        </div>

      </div>

      {/* Charts and Additional Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Net Worth Over Time Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Net Worth Over Time (24 Months)</h2>
          <div className="h-64">
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
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="netWorth" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold dark:text-white">Account Distribution</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Click to view transactions</p>
          </div>
          <div className="h-64">
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
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #ccc',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Accounts Needing Reconciliation */}
      {reconciliationDetails.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Outstanding Reconciliation</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            These accounts have transactions that need to be reconciled with your bank statements.
          </p>
          <div className="space-y-3">
            {reconciliationDetails.map(account => (
              <div 
                key={account.id}
                className="flex justify-between items-center p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                onClick={() => navigate(`/reconciliation?account=${account.id}`)}
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{account.name}</p>
                  <div className="flex items-center gap-4 mt-1">
                    {account.unreconciledCount > 0 && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {account.unreconciledCount} uncleared transaction{account.unreconciledCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {account.recentUnverified > 0 && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {account.recentUnverified} recent unverified
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                      {account.totalIssues} item{account.totalIssues !== 1 ? 's' : ''}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">to reconcile</p>
                  </div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              💡 <strong>Tip:</strong> Click on an account to start reconciliation. Match your transactions with bank statements to ensure accuracy.
            </p>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Recent Transactions</h2>
        <div className="space-y-3">
          {transactions.slice(0, 5).map(transaction => (
            <div key={transaction.id} className="flex justify-between items-center py-2 border-b dark:border-gray-700 last:border-0">
              <div>
                <p className="font-medium dark:text-white">{transaction.description}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(transaction.date).toLocaleDateString()}
                </p>
              </div>
              <span className={`font-semibold ${
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
    </div>
  );
}