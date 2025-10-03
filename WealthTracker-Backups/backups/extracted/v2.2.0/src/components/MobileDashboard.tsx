import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useMobileOptimizations } from '../hooks/useMobileOptimizations';
import { SkeletonCard } from './loading/Skeleton';
import type { Account, Transaction } from '../types';

// Lazy load heavy chart components
const ChartComponents = lazy(() => import('./DashboardCharts'));

interface MobileDashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  totals: {
    assets: string;
    liabilities: string;
    netWorth: string;
    netWorthValue: number;
  };
}

export const MobileDashboard: React.FC<MobileDashboardProps> = ({
  accounts,
  transactions,
  totals
}) => {
  const { isMobile, shouldLazyLoad } = useMobileOptimizations();
  const [showCharts, setShowCharts] = useState(false);

  useEffect(() => {
    // Delay loading charts on mobile until after initial render
    if (isMobile) {
      const timer = setTimeout(() => {
        setShowCharts(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setShowCharts(true);
    }
  }, [isMobile]);

  // Mobile-optimized summary cards
  interface SummaryCardProps {
    title: string;
    value: string | number;
    trend?: number;
    color?: string;
  }
  
  const SummaryCard = ({ title, value, trend, color }: SummaryCardProps) => (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm ${color}`}>
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
      <p className="text-xl font-semibold mt-1">{value}</p>
      {trend && (
        <span className={`text-xs ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
  );

  // Recent transactions optimized for mobile
  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="space-y-4 p-4">
      {/* Summary Cards - Load immediately */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          title="Net Worth"
          value={totals.netWorth}
          trend={totals.netWorthValue > 0 ? 5.2 : -2.1}
          color={totals.netWorthValue >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}
        />
        <SummaryCard
          title="Assets"
          value={totals.assets}
          color="border-l-4 border-gray-500"
        />
        <SummaryCard
          title="Liabilities"
          value={totals.liabilities}
          color="border-l-4 border-orange-500"
        />
        <SummaryCard
          title="Accounts"
          value={accounts.length}
          color="border-l-4 border-purple-500"
        />
      </div>

      {/* Recent Transactions - Load immediately */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-3">Recent Transactions</h3>
        <div className="space-y-2">
          {recentTransactions.map((transaction) => (
            <div key={transaction.id} className="flex justify-between items-center py-2 border-b last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{transaction.description}</p>
                <p className="text-xs text-gray-500">{new Date(transaction.date).toLocaleDateString()}</p>
              </div>
              <span className={`text-sm font-semibold ${
                transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'
              }`}>
                {transaction.amount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Charts - Lazy load */}
      {showCharts && (
        <Suspense fallback={
          <div className="space-y-4">
            <SkeletonCard height={200} />
            <SkeletonCard height={200} />
          </div>
        }>
          <ChartComponents accounts={accounts} transactions={transactions} />
        </Suspense>
      )}
    </div>
  );
};