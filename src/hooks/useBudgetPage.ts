import { useState, useMemo, useCallback, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { usePreferences } from '../contexts/PreferencesContext';
import { budgetPageService } from '../services/budgetPageService';
import type { Budget } from '../types';
import type { BudgetTab, BudgetWithSpent, BudgetTotals, BudgetAlert } from '../services/budgetPageService';

interface BudgetPageState {
  activeTab: BudgetTab;
  isModalOpen: boolean;
  editingBudget: Budget | null;
  alertThreshold: number;
  currentMonth: number;
  currentYear: number;
  isLoading: boolean;
}

export function useBudgetPage() {
  const { budgets, transactions, categories, updateBudget, deleteBudget } = useApp();
  const { preferences } = usePreferences();
  
  // Initialize state
  const [state, setState] = useState<BudgetPageState>(() => {
    const { currentMonth, currentYear } = budgetPageService.getCurrentDateInfo();
    return {
      activeTab: 'traditional',
      isModalOpen: false,
      editingBudget: null,
      alertThreshold: preferences?.budgetAlertThreshold || 80,
      currentMonth,
      currentYear,
      isLoading: true
    };
  });

  // Update loading state when data is available
  useEffect(() => {
    if (budgets !== undefined && transactions !== undefined && categories !== undefined) {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [budgets, transactions, categories]);

  // Calculate budgets with spent amounts
  const budgetsWithSpent = useMemo(() => {
    if (!budgets || !transactions) return [];
    return budgetPageService.calculateBudgetsWithSpent(
      budgets,
      transactions,
      state.currentMonth,
      state.currentYear
    );
  }, [budgets, transactions, state.currentMonth, state.currentYear]);

  // Calculate totals
  const totals = useMemo(() => {
    return budgetPageService.calculateTotals(budgetsWithSpent);
  }, [budgetsWithSpent]);

  // Generate alerts
  const alerts = useMemo(() => {
    if (!categories) return [];
    return budgetPageService.generateBudgetAlerts(
      budgetsWithSpent,
      categories,
      state.alertThreshold
    );
  }, [budgetsWithSpent, categories, state.alertThreshold]);

  // Tab configs
  const tabConfigs = useMemo(() => {
    return budgetPageService.getTabConfigs();
  }, []);

  // Handlers
  const setActiveTab = useCallback((tab: BudgetTab) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  const openModal = useCallback((budget?: Budget) => {
    setState(prev => ({
      ...prev,
      isModalOpen: true,
      editingBudget: budget || null
    }));
  }, []);

  const closeModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isModalOpen: false,
      editingBudget: null
    }));
  }, []);

  const handleEdit = useCallback((budget: Budget) => {
    openModal(budget);
  }, [openModal]);

  const handleDelete = useCallback(async (budgetId: string) => {
    if (window.confirm('Are you sure you want to delete this budget?')) {
      await deleteBudget(budgetId);
    }
  }, [deleteBudget]);

  const handleToggleActive = useCallback(async (budgetId: string, currentStatus: boolean | undefined) => {
    await updateBudget(budgetId, { isActive: !currentStatus });
  }, [updateBudget]);

  const setMonthYear = useCallback((month: number, year: number) => {
    setState(prev => ({ ...prev, currentMonth: month, currentYear: year }));
  }, []);

  const setAlertThreshold = useCallback((threshold: number) => {
    setState(prev => ({ ...prev, alertThreshold: threshold }));
  }, []);

  // Utility functions
  const getProgressColor = useCallback((percentage: number) => {
    return budgetPageService.getProgressColor(percentage);
  }, []);

  const getTabClassName = useCallback((isActive: boolean) => {
    return budgetPageService.getTabClassName(isActive);
  }, []);

  const formatPeriodLabel = useCallback((period: string) => {
    return budgetPageService.formatPeriodLabel(period);
  }, []);

  return {
    // State
    activeTab: state.activeTab,
    isModalOpen: state.isModalOpen,
    editingBudget: state.editingBudget,
    alertThreshold: state.alertThreshold,
    currentMonth: state.currentMonth,
    currentYear: state.currentYear,
    isLoading: state.isLoading,
    
    // Computed values
    budgetsWithSpent,
    totals,
    alerts,
    tabConfigs,
    categories,
    
    // Handlers
    setActiveTab,
    openModal,
    closeModal,
    handleEdit,
    handleDelete,
    handleToggleActive,
    setMonthYear,
    setAlertThreshold,
    
    // Utilities
    getProgressColor,
    getTabClassName,
    formatPeriodLabel
  };
}