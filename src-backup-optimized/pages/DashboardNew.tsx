import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { 
  ArrowUpIcon, 
  ArrowDownIcon,
  PlusIcon,
  ChartBarIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  ArrowTrendingUpIcon as TrendingUpIcon,
  ArrowTrendingDownIcon as TrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  BellIcon,
  CreditCardIcon,
  ChartPieIcon
} from '@heroicons/react/24/outline';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';

interface DashboardWidget {
  id: string;
  title: string;
  value?: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
  action?: () => void;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
}

export default function DashboardNew(): React.JSX.Element {
  const navigate = useNavigate();
  const { accounts, transactions, budgets, goals } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setIsLoading(false), 500);
  }, []);

  // Calculate total balance
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, account) => {
      const balance = toDecimal(account.balance);
      return sum.plus(balance);
    }, toDecimal(0));
  }, [accounts]);

  // Calculate recent transactions stats
  const recentTransactionsStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthTransactions = transactions.filter(t => 
      new Date(t.date) >= startOfMonth
    );

    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));

    const expenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), toDecimal(0));

    return { income, expenses, total: income.minus(expenses) };
  }, [transactions]);

  // Calculate budget status
  const budgetStatus = useMemo(() => {
    const activeBudgets = budgets.filter(b => b.isActive);
    const overBudget = activeBudgets.filter(b => {
      const spent = toDecimal(b.spent || 0);
      const amount = toDecimal(b.amount);
      return spent.greaterThan(amount);
    });

    return {
      total: activeBudgets.length,
      overBudget: overBudget.length,
      percentage: activeBudgets.length > 0 
        ? Math.round((overBudget.length / activeBudgets.length) * 100)
        : 0
    };
  }, [budgets]);

  // Dashboard widgets configuration
  const widgets: DashboardWidget[] = [
    {
      id: 'accounts',
      title: 'Your accounts',
      subtitle: accounts.length === 0 ? 'No accounts to display' : 'See more',
      empty: accounts.length === 0,
      emptyMessage: 'You have no accounts to display',
      action: () => navigate('/accounts')
    },
    {
      id: 'transactions',
      title: 'Recent transactions',
      subtitle: transactions.length === 0 ? 'No transactions' : 'See more',
      empty: transactions.length === 0,
      emptyMessage: 'You have no transactions to display',
      action: () => navigate('/transactions')
    },
    {
      id: 'spending',
      title: 'Earning and spending',
      subtitle: 'See more',
      empty: transactions.length === 0,
      emptyMessage: 'You have no earning or spending data to display',
      action: () => navigate('/analytics')
    },
    {
      id: 'budgets',
      title: 'All budgets',
      subtitle: budgets.length === 0 ? 'No budgets to display' : 'See more',
      empty: budgets.length === 0,
      emptyMessage: 'You have no budgets to display',
      action: () => navigate('/budget')
    },
    {
      id: 'balance',
      title: 'Your balance',
      subtitle: 'Today',
      value: formatCurrency(totalBalance.toNumber()),
      action: () => navigate('/accounts')
    },
    {
      id: 'forecast',
      title: 'FORECAST',
      value: formatCurrency(0),
      color: 'blue',
      action: () => navigate('/forecasting')
    },
    {
      id: 'actual',
      title: 'ACTUAL', 
      value: formatCurrency(0),
      color: 'red',
      action: () => navigate('/transactions')
    },
    {
      id: 'savings',
      title: 'Savings Rate',
      subtitle: `Rolling Month • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      empty: true,
      emptyMessage: 'You have no earning or spending data to display'
    },
    {
      id: 'bills',
      title: 'Bill reminders',
      subtitle: 'Overdue bills',
      empty: true,
      emptyMessage: 'No overdue bills'
    },
    {
      id: 'overspent',
      title: 'Overspent budgets',
      subtitle: 'See more',
      empty: budgetStatus.overBudget === 0,
      emptyMessage: 'No overspent budgets',
      action: () => navigate('/budget')
    }
  ];

  const getWidgetIcon = (widgetId: string) => {
    switch (widgetId) {
      case 'accounts':
        return <CreditCardIcon className="w-5 h-5 text-gray-400" />;
      case 'transactions':
        return <BanknotesIcon className="w-5 h-5 text-gray-400" />;
      case 'spending':
        return <ChartPieIcon className="w-5 h-5 text-gray-400" />;
      case 'budgets':
        return <ChartBarIcon className="w-5 h-5 text-gray-400" />;
      case 'balance':
        return <CurrencyDollarIcon className="w-5 h-5 text-gray-400" />;
      case 'bills':
        return <BellIcon className="w-5 h-5 text-gray-400" />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Full-width header section */}
      <div className="bg-secondary dark:bg-gray-700 w-full">
        <div className="px-4 md:px-6 lg:px-8 max-w-7xl mx-auto py-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome to your financial dashboard
          </h1>
          <p className="text-gray-200 dark:text-gray-300">
            Here's your financial overview at a glance
          </p>
        </div>
      </div>

      {/* Main content with standard constraints */}
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto pb-20 md:pb-8">

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {widgets.map((widget) => (
          <div
            key={widget.id}
            className={`
              bg-white dark:bg-gray-800 rounded-xl 
              transition-all duration-300 cursor-pointer border border-gray-200 
              dark:border-gray-700 overflow-hidden relative
              ${widget.id === 'balance' ? 'lg:col-span-2 lg:row-span-2' : ''}
              hover:scale-[1.02] hover:border-gray-300 dark:hover:border-gray-600
            `}
            style={{
              filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))'
            }}
            onClick={widget.action}
          >
            {/* Special layout for balance widget */}
            {widget.id === 'balance' ? (
              <div className="p-6 h-full flex flex-col justify-center items-center bg-gradient-to-br from-secondary to-primary text-white">
                <h3 className="text-lg font-medium mb-4">{widget.title}</h3>
                <div className="text-4xl font-bold mb-2">{widget.value}</div>
                <p className="text-sm opacity-90">{widget.subtitle}</p>
                <div className="mt-6 grid grid-cols-2 gap-4 w-full">
                  <div className="text-center">
                    <div className="text-sm opacity-75">Income</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(recentTransactionsStats.income.toNumber())}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm opacity-75">Expenses</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(recentTransactionsStats.expenses.toNumber())}
                    </div>
                  </div>
                </div>
              </div>
            ) : widget.id === 'forecast' || widget.id === 'actual' ? (
              <div className={`p-4 ${widget.color === 'blue' ? 'bg-primary' : 'bg-red-500'} text-white`}>
                <div className="text-xs uppercase font-medium mb-2">{widget.title}</div>
                <div className="text-2xl font-bold">{widget.value}</div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    {widget.title}
                  </h3>
                  {getWidgetIcon(widget.id)}
                </div>
                
                {widget.empty ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                      <ExclamationTriangleIcon className="w-8 h-8" />
                    </div>
                    <p className="text-sm text-center">{widget.emptyMessage}</p>
                  </div>
                ) : widget.loading ? (
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                ) : (
                  <>
                    {widget.value && (
                      <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {widget.value}
                      </div>
                    )}
                    <p className="text-sm text-secondary dark:text-primary hover:underline">
                      {widget.subtitle}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {/* New Transaction Widget */}
        <div className="bg-gradient-to-br from-primary to-secondary rounded-xl text-white p-6 flex flex-col justify-center items-center cursor-pointer hover:scale-[1.02] transition-all duration-300 overflow-hidden"
          onClick={() => navigate('/transactions?action=add')}
          style={{
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))'
          }}
        >
          <PlusIcon className="w-12 h-12 mb-3" />
          <h3 className="text-lg font-medium">Add Transaction</h3>
          <p className="text-sm opacity-90 text-center mt-2">
            Quickly add a new transaction
          </p>
        </div>
      </div>

      {/* Bottom Welcome Message */}
      <div className="mt-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6 border-l-4 border-amber-400 dark:border-amber-600"
        style={{
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))'
        }}
      >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="w-6 h-6 text-secondary dark:text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Welcome to your customizable financial dashboard
              </h3>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                Completely configurable, extremely flexible. You can start building your own financial dashboard 
                from the ground up, or use one of our pre-configured templates and customize from there.
              </p>
              <button className="mt-3 text-sm font-medium text-secondary dark:text-primary hover:underline">
                Learn more →
              </button>
            </div>
        </div>
      </div>
      </div>
    </>
  );
}