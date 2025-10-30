import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../index';
import { logger } from '../../services/loggingService';
import { selectAccounts } from '../selectors/accountsSelectors';
import { selectTransactions } from '../selectors/transactionsSelectors';
import { selectBudgets } from '../selectors/budgetsSelectors';
import { selectGoals } from '../selectors/goalsSelectors';
import {
  addTransaction as addTransactionThunk,
  updateTransaction as updateTransactionThunk,
  deleteTransaction as deleteTransactionThunk,
  loadAllData
} from '../thunks';
import type { BackupData } from '../../utils/backupRestore';
import {
  setAccounts,
  createAccountInSupabase,
  updateAccountInSupabase,
  deleteAccountFromSupabase
} from '../slices/accountsSlice';
import {
  updateBudget as updateBudgetAction,
  deleteBudget as deleteBudgetAction,
  setBudgets,
  createBudgetInSupabase
} from '../slices/budgetsSlice';
import {
  addCategory as addCategoryAction,
  updateCategory as updateCategoryAction,
  deleteCategory as deleteCategoryAction,
  setCategories,
  saveCategories
} from '../slices/categoriesSlice';
import {
  updateGoal as updateGoalAction,
  deleteGoal as deleteGoalAction,
  setGoals,
  createGoalInSupabase
} from '../slices/goalsSlice';
import {
  addRecurringTransaction as addRecurringTransactionAction,
  updateRecurringTransaction as updateRecurringTransactionAction,
  deleteRecurringTransaction as deleteRecurringTransactionAction,
  setRecurringTransactions,
  saveRecurringTransactions
} from '../slices/recurringTransactionsSlice';
import { setTransactions } from '../slices/transactionsSlice';
import { setTags, saveTags } from '../slices/tagsSlice';
import type { Account, Transaction, Budget, Category, Goal, RecurringTransaction } from '../../types';

// This hook provides the same interface as the existing AppContext
export function useAppRedux() {
  const dispatch = useAppDispatch();
  
  // Select all state
  const accounts = useAppSelector(selectAccounts);
  const transactions = useAppSelector(selectTransactions);
  const budgets = useAppSelector(selectBudgets);
  const categories = useAppSelector(state => state.categories.categories);
  const goals = useAppSelector(selectGoals);
  const tags = useAppSelector(state => state.tags.tags);
  const recurringTransactions = useAppSelector(state => state.recurringTransactions.recurringTransactions);
  
  // Loading states
  const isLoading = useAppSelector(state => 
    state.accounts.loading ||
    state.transactions.loading ||
    state.budgets.loading ||
    state.categories.loading ||
    state.goals.loading ||
    state.tags.loading ||
    state.recurringTransactions.loading
  );
  
  // Account methods (now using Supabase)
  const addAccount = useCallback(async (account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => {
    await dispatch(createAccountInSupabase(account));
  }, [dispatch]);
  
  const updateAccount = useCallback(async (id: string, updates: Partial<Account>) => {
    await dispatch(updateAccountInSupabase({ id, updates }));
  }, [dispatch]);
  
  const deleteAccount = useCallback(async (id: string) => {
    await dispatch(deleteAccountFromSupabase(id));
  }, [dispatch]);
  
  // Transaction methods (using thunks for side effects)
  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => {
    await dispatch(addTransactionThunk(transaction));
  }, [dispatch]);
  
  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    await dispatch(updateTransactionThunk({ id, updates }));
  }, [dispatch]);
  
  const deleteTransaction = useCallback(async (id: string) => {
    await dispatch(deleteTransactionThunk(id));
  }, [dispatch]);
  
  // Budget methods (now using Supabase for creation)
  const addBudget = useCallback(async (budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload = {
      ...budget,
      spent: budget.spent ?? 0,
    };
    await dispatch(createBudgetInSupabase(payload));
  }, [dispatch]);
  
  const updateBudget = useCallback(async (id: string, updates: Partial<Budget>) => {
    // For now, use local action - will implement Supabase update later
    dispatch(updateBudgetAction({ id, updates }));
  }, [dispatch]);
  
  const deleteBudget = useCallback(async (id: string) => {
    // For now, use local action - will implement Supabase delete later
    dispatch(deleteBudgetAction(id));
  }, [dispatch]);
  
  // Category methods
  const addCategory = useCallback(async (category: Omit<Category, 'id'>) => {
    dispatch(addCategoryAction(category));
    const newCategories = [...categories, { ...category, id: crypto.randomUUID() }];
    await dispatch(saveCategories(newCategories));
  }, [dispatch, categories]);
  
  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    dispatch(updateCategoryAction({ id, updates }));
    const updatedCategories = categories.map(c => c.id === id ? { ...c, ...updates } : c);
    await dispatch(saveCategories(updatedCategories));
  }, [dispatch, categories]);
  
  const deleteCategory = useCallback(async (id: string) => {
    dispatch(deleteCategoryAction(id));
    const updatedCategories = categories
      .filter(c => c.id !== id)
      .map(c => (c.parentId === id ? { ...c, parentId: null } : c));
    await dispatch(saveCategories(updatedCategories));
  }, [dispatch, categories]);
  
  // Goal methods (now using Supabase for creation)
  const addGoal = useCallback(async (goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => {
    const targetAmount = goal.targetAmount ?? 0;
    const currentAmount = goal.currentAmount ?? 0;
    const payload = {
      ...goal,
      currentAmount,
      progress: goal.progress ?? (targetAmount === 0 ? 0 : Math.min(100, (currentAmount / targetAmount) * 100)),
    };
    await dispatch(createGoalInSupabase(payload));
  }, [dispatch]);
  
  const updateGoal = useCallback(async (id: string, updates: Partial<Goal>) => {
    // For now, use local action - will implement Supabase update later
    dispatch(updateGoalAction({ id, updates }));
  }, [dispatch]);
  
  const deleteGoal = useCallback(async (id: string) => {
    // For now, use local action - will implement Supabase delete later
    dispatch(deleteGoalAction(id));
  }, [dispatch]);
  
  // Recurring transaction methods
  const addRecurringTransaction = useCallback(async (recurring: Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>) => {
    dispatch(addRecurringTransactionAction(recurring));
    const newRecurring = [...recurringTransactions, { ...recurring, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() }];
    await dispatch(saveRecurringTransactions(newRecurring));
  }, [dispatch, recurringTransactions]);
  
  const updateRecurringTransaction = useCallback(async (id: string, updates: Partial<RecurringTransaction>) => {
    dispatch(updateRecurringTransactionAction({ id, updates }));
    const updatedRecurring = recurringTransactions.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date() } : r);
    await dispatch(saveRecurringTransactions(updatedRecurring));
  }, [dispatch, recurringTransactions]);
  
  const deleteRecurringTransaction = useCallback(async (id: string) => {
    dispatch(deleteRecurringTransactionAction(id));
    const filteredRecurring = recurringTransactions.filter(r => r.id !== id);
    await dispatch(saveRecurringTransactions(filteredRecurring));
  }, [dispatch, recurringTransactions]);
  
  // Data management methods
  const clearAllData = useCallback(async () => {
    dispatch(setAccounts([]));
    dispatch(setTransactions([]));
    dispatch(setBudgets([]));
    dispatch(setCategories([]));
    dispatch(setGoals([]));
    dispatch(setTags([]));
    dispatch(setRecurringTransactions([]));

    await Promise.all([
      dispatch(saveCategories([])),
      dispatch(saveTags([])),
      dispatch(saveRecurringTransactions([])),
    ]);
  }, [dispatch]);
  
  const loadTestData = useCallback(async () => {
    // This would be implemented to load test data
    logger.warn('Load test data not implemented in Redux version yet');
  }, []);
  
  const exportData = useCallback(async () => {
    return {
      accounts,
      transactions,
      budgets,
      categories,
      goals,
      tags,
      recurringTransactions,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  }, [accounts, transactions, budgets, categories, goals, tags, recurringTransactions]);
  
  const importData = useCallback(async (data: BackupData) => {
    dispatch(setAccounts(data.accounts));
    dispatch(setTransactions(data.transactions));
    dispatch(setBudgets(data.budgets));
    dispatch(setGoals(data.goals));

    const importedCategories = data.categories ?? [];
    const importedTags = data.tags ?? [];
    const importedRecurring = data.recurringTransactions ?? [];

    dispatch(setCategories(importedCategories));
    dispatch(setTags(importedTags));
    dispatch(setRecurringTransactions(importedRecurring));

    await Promise.all([
      dispatch(saveCategories(importedCategories)),
      dispatch(saveTags(importedTags)),
      dispatch(saveRecurringTransactions(importedRecurring)),
    ]);
  }, [dispatch]);
  
  // Initialize data on mount
  const initializeData = useCallback(async () => {
    await dispatch(loadAllData());
  }, [dispatch]);
  
  // Return the same interface as AppContext
  return useMemo(() => ({
    // State
    accounts,
    transactions,
    budgets,
    categories,
    goals,
    tags,
    recurringTransactions,
    isLoading,
    
    // Account methods
    addAccount,
    updateAccount,
    deleteAccount,
    
    // Transaction methods
    addTransaction,
    updateTransaction,
    deleteTransaction,
    
    // Budget methods
    addBudget,
    updateBudget,
    deleteBudget,
    
    // Category methods
    addCategory,
    updateCategory,
    deleteCategory,
    
    // Goal methods
    addGoal,
    updateGoal,
    deleteGoal,
    
    // Recurring transaction methods
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    
    // Data management
    clearAllData,
    loadTestData,
    exportData,
    importData,
    initializeData
  }), [
    accounts, transactions, budgets, categories, goals, tags, recurringTransactions, isLoading,
    addAccount, updateAccount, deleteAccount,
    addTransaction, updateTransaction, deleteTransaction,
    addBudget, updateBudget, deleteBudget,
    addCategory, updateCategory, deleteCategory,
    addGoal, updateGoal, deleteGoal,
    addRecurringTransaction, updateRecurringTransaction, deleteRecurringTransaction,
    clearAllData, loadTestData, exportData, importData, initializeData
  ]);
}

export { useAppDispatch, useAppSelector } from '../index';
