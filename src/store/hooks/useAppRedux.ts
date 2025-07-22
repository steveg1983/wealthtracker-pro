import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../index';
import {
  addTransaction as addTransactionThunk,
  updateTransaction as updateTransactionThunk,
  deleteTransaction as deleteTransactionThunk,
  loadAllData
} from '../thunks';
import { saveTransactions } from '../slices/transactionsSlice';
import { saveTags } from '../slices/tagsSlice';
import type { BackupData } from '../../utils/backupRestore';
import { 
  addAccount as addAccountAction,
  updateAccount as updateAccountAction,
  deleteAccount as deleteAccountAction,
  saveAccounts
} from '../slices/accountsSlice';
import {
  addBudget as addBudgetAction,
  updateBudget as updateBudgetAction,
  deleteBudget as deleteBudgetAction,
  saveBudgets
} from '../slices/budgetsSlice';
import {
  addCategory as addCategoryAction,
  updateCategory as updateCategoryAction,
  deleteCategory as deleteCategoryAction,
  saveCategories
} from '../slices/categoriesSlice';
import {
  addGoal as addGoalAction,
  updateGoal as updateGoalAction,
  deleteGoal as deleteGoalAction,
  saveGoals
} from '../slices/goalsSlice';
import {
  addRecurringTransaction as addRecurringTransactionAction,
  updateRecurringTransaction as updateRecurringTransactionAction,
  deleteRecurringTransaction as deleteRecurringTransactionAction,
  saveRecurringTransactions
} from '../slices/recurringTransactionsSlice';
import type { Account, Transaction, Budget, Category, Goal, RecurringTransaction } from '../../types';

// This hook provides the same interface as the existing AppContext
export function useAppRedux() {
  const dispatch = useAppDispatch();
  
  // Select all state
  const accounts = useAppSelector(state => state.accounts.accounts);
  const transactions = useAppSelector(state => state.transactions.transactions);
  const budgets = useAppSelector(state => state.budgets.budgets);
  const categories = useAppSelector(state => state.categories.categories);
  const goals = useAppSelector(state => state.goals.goals);
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
  
  // Account methods
  const addAccount = useCallback(async (account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => {
    dispatch(addAccountAction(account));
    const newAccounts = [...accounts, { ...account, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() }];
    await dispatch(saveAccounts(newAccounts));
  }, [dispatch, accounts]);
  
  const updateAccount = useCallback(async (id: string, updates: Partial<Account>) => {
    dispatch(updateAccountAction({ id, updates }));
    const updatedAccounts = accounts.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date() } : a);
    await dispatch(saveAccounts(updatedAccounts));
  }, [dispatch, accounts]);
  
  const deleteAccount = useCallback(async (id: string) => {
    dispatch(deleteAccountAction(id));
    const filteredAccounts = accounts.filter(a => a.id !== id);
    await dispatch(saveAccounts(filteredAccounts));
  }, [dispatch, accounts]);
  
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
  
  // Budget methods
  const addBudget = useCallback(async (budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>) => {
    dispatch(addBudgetAction(budget));
    const newBudgets = [...budgets, { ...budget, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() }];
    await dispatch(saveBudgets(newBudgets));
  }, [dispatch, budgets]);
  
  const updateBudget = useCallback(async (id: string, updates: Partial<Budget>) => {
    dispatch(updateBudgetAction({ id, updates }));
    const updatedBudgets = budgets.map(b => b.id === id ? { ...b, ...updates, updatedAt: new Date() } : b);
    await dispatch(saveBudgets(updatedBudgets));
  }, [dispatch, budgets]);
  
  const deleteBudget = useCallback(async (id: string) => {
    dispatch(deleteBudgetAction(id));
    const filteredBudgets = budgets.filter(b => b.id !== id);
    await dispatch(saveBudgets(filteredBudgets));
  }, [dispatch, budgets]);
  
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
      .map(c => c.parentId === id ? { ...c, parentId: undefined } : c);
    await dispatch(saveCategories(updatedCategories));
  }, [dispatch, categories]);
  
  // Goal methods
  const addGoal = useCallback(async (goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => {
    dispatch(addGoalAction(goal));
    const newGoals = [...goals, { ...goal, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() }];
    await dispatch(saveGoals(newGoals));
  }, [dispatch, goals]);
  
  const updateGoal = useCallback(async (id: string, updates: Partial<Goal>) => {
    dispatch(updateGoalAction({ id, updates }));
    const updatedGoals = goals.map(g => g.id === id ? { ...g, ...updates, updatedAt: new Date() } : g);
    await dispatch(saveGoals(updatedGoals));
  }, [dispatch, goals]);
  
  const deleteGoal = useCallback(async (id: string) => {
    dispatch(deleteGoalAction(id));
    const filteredGoals = goals.filter(g => g.id !== id);
    await dispatch(saveGoals(filteredGoals));
  }, [dispatch, goals]);
  
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
    // Clear all data from Redux and storage
    await Promise.all([
      dispatch(saveAccounts([])),
      dispatch(saveTransactions([])),
      dispatch(saveBudgets([])),
      dispatch(saveCategories([])),
      dispatch(saveGoals([])),
      dispatch(saveTags([])),
      dispatch(saveRecurringTransactions([]))
    ]);
  }, [dispatch]);
  
  const loadTestData = useCallback(async () => {
    // This would be implemented to load test data
    console.log('Load test data not implemented in Redux version yet');
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
    // Import data to Redux
    await Promise.all([
      data.accounts && dispatch(saveAccounts(data.accounts)),
      data.transactions && dispatch(saveTransactions(data.transactions)),
      data.budgets && dispatch(saveBudgets(data.budgets)),
      data.categories && dispatch(saveCategories(data.categories)),
      data.goals && dispatch(saveGoals(data.goals)),
      data.tags && dispatch(saveTags(data.tags)),
      data.recurringTransactions && dispatch(saveRecurringTransactions(data.recurringTransactions))
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