import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from './useCurrencyDecimal';
import { dashboardDraggableService, type DashboardWidget } from '../services/dashboardDraggableService';
import type { Layout, Layouts } from 'react-grid-layout';

export function useDashboardDraggable() {
  const navigate = useNavigate();
  const { accounts, transactions, budgets, goals } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [layouts, setLayouts] = useState<Layouts>({});

  const defaultLayouts = dashboardDraggableService.getDefaultLayouts();

  useEffect(() => {
    const loadedLayouts = dashboardDraggableService.loadLayouts();
    setLayouts(loadedLayouts);
    setTimeout(() => setIsLoading(false), 500);
  }, []);

  const totalBalance = useMemo(() => {
    return dashboardDraggableService.calculateTotalBalance(accounts);
  }, [accounts]);

  const recentTransactionsStats = useMemo(() => {
    return dashboardDraggableService.calculateRecentTransactionsStats(transactions);
  }, [transactions]);

  const budgetStatus = useMemo(() => {
    return dashboardDraggableService.calculateBudgetStatus(budgets);
  }, [budgets]);

  const widgets: DashboardWidget[] = useMemo(() => [
    {
      id: 'accounts',
      title: 'Your accounts',
      subtitle: accounts.length === 0 ? 'No accounts to display' : 'See more',
      empty: accounts.length === 0,
      emptyMessage: 'You have no accounts to display',
      icon: 'CreditCardIcon',
      action: () => navigate('/accounts')
    },
    {
      id: 'transactions',
      title: 'Recent transactions',
      subtitle: transactions.length === 0 ? 'No transactions' : 'See more',
      empty: transactions.length === 0,
      emptyMessage: 'You have no transactions to display',
      icon: 'BanknotesIcon',
      action: () => navigate('/transactions')
    },
    {
      id: 'spending',
      title: 'Earning and spending',
      subtitle: 'See more',
      empty: transactions.length === 0,
      emptyMessage: 'You have no earning or spending data to display',
      icon: 'ChartPieIcon',
      action: () => navigate('/analytics')
    },
    {
      id: 'budgets',
      title: 'All budgets',
      subtitle: budgets.length === 0 ? 'No budgets to display' : 'See more',
      empty: budgets.length === 0,
      emptyMessage: 'You have no budgets to display',
      icon: 'ChartBarIcon',
      action: () => navigate('/budget')
    },
    {
      id: 'balance',
      title: 'Your balance',
      subtitle: 'Today',
      value: formatCurrency(totalBalance.toNumber()),
      icon: 'CurrencyDollarIcon',
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
      subtitle: `Rolling Month " ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      empty: true,
      emptyMessage: 'You have no earning or spending data to display'
    },
    {
      id: 'bills',
      title: 'Bill reminders',
      subtitle: 'Overdue bills',
      empty: true,
      emptyMessage: 'No overdue bills',
      icon: 'BellIcon'
    },
    {
      id: 'overspent',
      title: 'Overspent budgets',
      subtitle: 'See more',
      empty: budgetStatus.overBudget === 0,
      emptyMessage: 'No overspent budgets',
      action: () => navigate('/budget')
    },
    {
      id: 'addTransaction',
      title: 'Add Transaction',
      action: () => navigate('/transactions?action=add')
    }
  ], [accounts, transactions, budgets, budgetStatus, totalBalance, formatCurrency, navigate]);

  const handleLayoutChange = useCallback((layout: Layout[], layouts: Layouts) => {
    setLayouts(layouts);
    dashboardDraggableService.saveLayouts(layouts);
  }, []);

  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  return {
    // State
    isLoading,
    isEditMode,
    layouts,
    
    // Data
    widgets,
    totalBalance,
    recentTransactionsStats,
    budgetStatus,
    defaultLayouts,
    
    // Actions
    handleLayoutChange,
    toggleEditMode,
    
    // Utilities
    formatCurrency
  };
}