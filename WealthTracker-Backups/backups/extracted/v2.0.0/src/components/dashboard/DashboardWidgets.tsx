import React, { memo } from 'react';
import { TrendingUpIcon, TrendingDownIcon } from '../icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Account } from '../../types';

interface SummaryCardProps {
  title: string;
  value: string;
  trend?: number;
  icon?: React.ReactNode;
  onClick?: () => void;
}

// Memoized Summary Card
export const SummaryCard = memo(({ title, value, trend, icon, onClick }: SummaryCardProps) => {
  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {trend !== undefined && (
            <div className={`flex items-center mt-2 text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? <TrendingUpIcon size={16} /> : <TrendingDownIcon size={16} />}
              <span className="ml-1">{Math.abs(trend).toFixed(1)}%</span>
            </div>
          )}
        </div>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return prevProps.value === nextProps.value && 
         prevProps.trend === nextProps.trend &&
         prevProps.title === nextProps.title;
});

SummaryCard.displayName = 'SummaryCard';

interface AccountChartProps {
  accounts: Account[];
  formatCurrency: (value: number) => string;
  onAccountClick?: (account: Account) => void;
}

// Memoized Account Distribution Chart
export const AccountDistributionChart = memo(({ accounts, formatCurrency, onAccountClick }: AccountChartProps) => {
  const accountData = accounts
    .filter(acc => acc.isActive && acc.balance > 0)
    .map(acc => ({
      id: acc.id,
      name: acc.name,
      value: acc.balance
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (accountData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No active accounts with positive balance
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={accountData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
        >
          {accountData.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={COLORS[index % COLORS.length]}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                const account = accounts.find(acc => acc.id === entry.id);
                if (account && onAccountClick) {
                  onAccountClick(account);
                }
              }}
            />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
      </PieChart>
    </ResponsiveContainer>
  );
}, (prevProps, nextProps) => {
  // Compare account balances for re-render decision
  if (prevProps.accounts.length !== nextProps.accounts.length) return false;
  
  return prevProps.accounts.every((acc, index) => {
    const nextAcc = nextProps.accounts[index];
    return acc.id === nextAcc.id && 
           acc.balance === nextAcc.balance && 
           acc.isActive === nextAcc.isActive;
  });
});

AccountDistributionChart.displayName = 'AccountDistributionChart';

interface TransactionListProps {
  transactions: Array<{
    id: string;
    date: Date;
    description: string;
    amount: number;
    category: string;
  }>;
  formatCurrency: (value: number) => string;
  onTransactionClick?: (transaction: {
    id: string;
    date: Date;
    description: string;
    amount: number;
    category: string;
  }) => void;
}

// Memoized Recent Transactions List
export const RecentTransactionsList = memo(({ 
  transactions, 
  formatCurrency, 
  onTransactionClick 
}: TransactionListProps) => {
  const recentTransactions = transactions
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  if (recentTransactions.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No transactions yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recentTransactions.map(txn => (
        <div
          key={txn.id}
          className="flex justify-between items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
          onClick={() => onTransactionClick?.(txn)}
        >
          <div className="flex-1">
            <p className="font-medium text-sm">{txn.description}</p>
            <p className="text-xs text-gray-500">
              {txn.date.toLocaleDateString()} • {txn.category}
            </p>
          </div>
          <span className={`font-semibold ${txn.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(txn.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  // Compare transaction counts and first 5 transactions
  if (prevProps.transactions.length !== nextProps.transactions.length) return false;
  
  const prevRecent = prevProps.transactions.slice(0, 5);
  const nextRecent = nextProps.transactions.slice(0, 5);
  
  return prevRecent.every((txn, index) => {
    const nextTxn = nextRecent[index];
    return txn.id === nextTxn.id && 
           txn.amount === nextTxn.amount &&
           txn.description === nextTxn.description;
  });
});

RecentTransactionsList.displayName = 'RecentTransactionsList';

// Export a custom hook for dashboard calculations
export const useDashboardCalculations = (accounts: Account[], transactions: Array<{
  date: Date;
  amount: number;
  type?: string;
}>) => {
  return React.useMemo(() => {
    const totalAssets = accounts
      .filter(acc => acc.isActive && acc.type !== 'credit' && acc.type !== 'loan')
      .reduce((sum, acc) => sum + acc.balance, 0);

    const totalLiabilities = accounts
      .filter(acc => acc.isActive && (acc.type === 'credit' || acc.type === 'loan'))
      .reduce((sum, acc) => sum + acc.balance, 0);

    const netWorth = totalAssets - totalLiabilities;

    // Calculate monthly spending
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const monthlySpending = transactions
      .filter(txn => txn.date >= thirtyDaysAgo && txn.amount < 0)
      .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      monthlySpending
    };
  }, [accounts, transactions]);
};