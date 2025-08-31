import { createAsyncThunk } from '@reduxjs/toolkit';
import { AppDispatch, RootState } from '../index';
import Decimal from 'decimal.js';
import type { Transaction } from '../../types';
import { 
  addTransaction as addTransactionAction,
  updateTransaction as updateTransactionAction,
  deleteTransaction as deleteTransactionAction,
  createTransactionInSupabase,
  updateTransactionInSupabase,
  deleteTransactionFromSupabase
} from '../slices/transactionsSlice';
import { 
  updateAccountBalance, 
  fetchAccountsFromSupabase as loadAccounts,
  updateAccountInSupabase
} from '../slices/accountsSlice';
import { 
  updateBudgetSpent, 
  fetchBudgetsFromSupabase as loadBudgets
} from '../slices/budgetsSlice';
import { 
  updateGoalProgress, 
  fetchGoalsFromSupabase as loadGoals
} from '../slices/goalsSlice';
import { addMultipleTags, saveTags, loadTags } from '../slices/tagsSlice';
import { fetchTransactionsFromSupabase as loadTransactions } from '../slices/transactionsSlice';
import { loadCategories } from '../slices/categoriesSlice';
import { loadRecurringTransactions } from '../slices/recurringTransactionsSlice';
import { syncOfflineData } from './supabaseThunks';
import { logger } from '../../services/loggingService';

// Load all data from Supabase (with localStorage fallback)
export const loadAllData = createAsyncThunk<void, void, { dispatch: AppDispatch }>(
  'app/loadAllData',
  async (_, { dispatch }) => {
    try {
      // Load all data in parallel from Supabase
      await Promise.all([
        dispatch(loadAccounts()),
        dispatch(loadTransactions(1000)), // Load last 1000 transactions
        dispatch(loadCategories()),
        dispatch(loadBudgets()),
        dispatch(loadGoals()),
        dispatch(loadTags()),
        dispatch(loadRecurringTransactions()),
      ]);
      
      // Sync any offline changes
      dispatch(syncOfflineData());
    } catch (error) {
      logger.error('Failed to load data from Supabase:', error);
      // The individual thunks will handle fallback to localStorage
    }
  }
);

// Add transaction with side effects (now using Supabase)
export const addTransaction = createAsyncThunk<
  void,
  Omit<Transaction, 'id'>,
  { state: RootState; dispatch: AppDispatch }
>(
  'app/addTransaction',
  async (transactionData, { getState, dispatch }) => {
    // Create transaction in Supabase
    const result = await dispatch(createTransactionInSupabase(transactionData));
    
    if (createTransactionInSupabase.fulfilled.match(result)) {
      const newTransaction = result.payload;
      const state = getState();
      
      // Update account balance in Supabase
      if (transactionData.accountId) {
        const account = state.accounts.accounts.find(a => a.id === transactionData.accountId);
        if (account) {
          const balance = calculateAccountBalance(
            [...state.transactions.transactions, newTransaction],
            transactionData.accountId,
            account.openingBalance || 0
          );
          dispatch(updateAccountInSupabase({ 
            id: transactionData.accountId, 
            updates: { balance }
          }));
        }
      }
      
      // Update budget spent
      if (transactionData.type === 'expense' && transactionData.category) {
        const budgets = state.budgets.budgets.filter(b => 
          b.category === transactionData.category &&
          isTransactionInBudgetPeriod(transactionData.date, b)
        );
        
        for (const budget of budgets) {
          const spent = calculateBudgetSpent(
            [...state.transactions.transactions, newTransaction],
            budget
          );
          dispatch(updateBudgetSpent({ id: budget.id, spent }));
        }
      }
      
      // Update goal progress for linked goals
      updateLinkedGoalProgress(newTransaction, state, dispatch);
      
      // Add new tags
      if (transactionData.tags && transactionData.tags.length > 0) {
        dispatch(addMultipleTags(transactionData.tags));
      }
    }
  }
);

// Update transaction with side effects (now using Supabase)
export const updateTransaction = createAsyncThunk<
  void,
  { id: string; updates: Partial<Transaction> },
  { state: RootState; dispatch: AppDispatch }
>(
  'app/updateTransaction',
  async ({ id, updates }, { getState, dispatch }) => {
    const stateBefore = getState();
    const oldTransaction = stateBefore.transactions.transactions.find(t => t.id === id);
    
    if (!oldTransaction) return;
    
    // Update the transaction in Supabase
    const result = await dispatch(updateTransactionInSupabase({ id, updates }));
    
    if (updateTransactionInSupabase.fulfilled.match(result)) {
      const updatedTransaction = result.payload;
      const stateAfter = getState();
      
      // Recalculate affected account balances
      const affectedAccountIds = new Set([oldTransaction.accountId, updates.accountId].filter(Boolean));
      
      for (const accountId of affectedAccountIds) {
        if (!accountId) continue;
        const account = stateAfter.accounts.accounts.find(a => a.id === accountId);
        if (account) {
          const balance = calculateAccountBalance(
            stateAfter.transactions.transactions,
            accountId,
            account.openingBalance || 0
          );
          dispatch(updateAccountInSupabase({ 
            id: accountId, 
            updates: { balance }
          }));
        }
      }
      
      // Recalculate affected budgets
      recalculateAffectedBudgets(oldTransaction, updatedTransaction, stateAfter, dispatch);
      
      // Update linked goals
      updateLinkedGoalProgress(updatedTransaction, stateAfter, dispatch);
      
      // Add new tags
      if (updates.tags) {
        dispatch(addMultipleTags(updates.tags));
      }
    }
  }
);

// Delete transaction with side effects (now using Supabase)
export const deleteTransaction = createAsyncThunk<
  void,
  string,
  { state: RootState; dispatch: AppDispatch }
>(
  'app/deleteTransaction',
  async (id, { getState, dispatch }) => {
    const stateBefore = getState();
    const transaction = stateBefore.transactions.transactions.find(t => t.id === id);
    
    if (!transaction) return;
    
    // Delete the transaction from Supabase
    const result = await dispatch(deleteTransactionFromSupabase(id));
    
    if (deleteTransactionFromSupabase.fulfilled.match(result)) {
      const stateAfter = getState();
      
      // Recalculate account balance
      if (transaction.accountId) {
        const account = stateAfter.accounts.accounts.find(a => a.id === transaction.accountId);
        if (account) {
          const balance = calculateAccountBalance(
            stateAfter.transactions.transactions,
            transaction.accountId,
            account.openingBalance || 0
          );
          dispatch(updateAccountInSupabase({ 
            id: transaction.accountId, 
            updates: { balance }
          }));
        }
      }
      
      // Recalculate affected budgets
      if (transaction.type === 'expense' && transaction.category) {
        const budgets = stateAfter.budgets.budgets.filter(b => 
          b.category === transaction.category &&
          isTransactionInBudgetPeriod(transaction.date, b)
        );
        
        for (const budget of budgets) {
          const spent = calculateBudgetSpent(
            stateAfter.transactions.transactions,
            budget
          );
          dispatch(updateBudgetSpent({ id: budget.id, spent }));
        }
      }
      
      // Update linked goals
      updateLinkedGoalProgress(transaction, stateAfter, dispatch);
    }
  }
);

// Helper functions
function calculateAccountBalance(
  transactions: Transaction[],
  accountId: string,
  openingBalance: number
): number {
  const accountTransactions = transactions.filter(t => t.accountId === accountId);
  
  let balance = new Decimal(openingBalance);
  
  for (const transaction of accountTransactions) {
    const amount = new Decimal(transaction.amount);
    
    if (transaction.type === 'income') {
      balance = balance.plus(amount);
    } else if (transaction.type === 'expense') {
      balance = balance.minus(amount);
    } else if (transaction.type === 'transfer') {
      // Transfer amount can be positive (incoming) or negative (outgoing)
      balance = balance.plus(amount);
    }
  }
  
  return balance.toNumber();
}

function calculateBudgetSpent(
  transactions: Transaction[],
  budget: any
): number {
  const budgetTransactions = transactions.filter(t =>
    t.type === 'expense' &&
    t.category === budget.category &&
    isTransactionInBudgetPeriod(t.date, budget)
  );
  
  return budgetTransactions.reduce((sum, t) => {
    return new Decimal(sum).plus(t.amount).toNumber();
  }, 0);
}

function isTransactionInBudgetPeriod(
  transactionDate: Date | string,
  budget: any
): boolean {
  const date = new Date(transactionDate);
  const now = new Date();
  
  switch (budget.period) {
    case 'monthly':
      return date.getMonth() === now.getMonth() && 
             date.getFullYear() === now.getFullYear();
    case 'quarterly': {
      const quarter = Math.floor(date.getMonth() / 3);
      const currentQuarter = Math.floor(now.getMonth() / 3);
      return quarter === currentQuarter && 
             date.getFullYear() === now.getFullYear();
    }
    case 'yearly':
      return date.getFullYear() === now.getFullYear();
    default:
      return false;
  }
}

function updateLinkedGoalProgress(
  transaction: Partial<Transaction>,
  state: RootState,
  dispatch: AppDispatch
) {
  // Find goals linked to the transaction's account
  const linkedGoals = state.goals.goals.filter(g => 
    g.linkedAccountIds?.includes(transaction.accountId || '')
  );
  
  for (const goal of linkedGoals) {
    // Calculate current amount based on linked accounts
    let currentAmount = new Decimal(0);
    
    for (const accountId of (goal.linkedAccountIds || [])) {
      const account = state.accounts.accounts.find(a => a.id === accountId);
      if (account) {
        currentAmount = currentAmount.plus(account.balance);
      }
    }
    
    dispatch(updateGoalProgress({ 
      id: goal.id, 
      currentAmount: currentAmount.toNumber() 
    }));
  }
}

function recalculateAffectedBudgets(
  oldTransaction: Transaction,
  newTransaction: Transaction,
  state: RootState,
  dispatch: AppDispatch
) {
  const affectedBudgetIds = new Set<string>();
  
  // Check old transaction's budget
  if (oldTransaction.type === 'expense' && oldTransaction.category) {
    const oldBudgets = state.budgets.budgets.filter(b => 
      b.category === oldTransaction.category &&
      isTransactionInBudgetPeriod(oldTransaction.date, b)
    );
    oldBudgets.forEach(b => affectedBudgetIds.add(b.id));
  }
  
  // Check new transaction's budget
  if (newTransaction.type === 'expense' && newTransaction.category) {
    const newBudgets = state.budgets.budgets.filter(b => 
      b.category === newTransaction.category &&
      isTransactionInBudgetPeriod(newTransaction.date, b)
    );
    newBudgets.forEach(b => affectedBudgetIds.add(b.id));
  }
  
  // Recalculate all affected budgets
  for (const budgetId of affectedBudgetIds) {
    const budget = state.budgets.budgets.find(b => b.id === budgetId);
    if (budget) {
      const spent = calculateBudgetSpent(state.transactions.transactions, budget);
      dispatch(updateBudgetSpent({ id: budgetId, spent }));
    }
  }
}

// Re-export thunks from slices and supabaseThunks
export { fetchAccountsFromSupabase as loadAccounts } from '../slices/accountsSlice';
export { fetchTransactionsFromSupabase as loadTransactions } from '../slices/transactionsSlice';
export { loadCategories } from '../slices/categoriesSlice';
export { fetchBudgetsFromSupabase as loadBudgets } from '../slices/budgetsSlice';
export { fetchGoalsFromSupabase as loadGoals } from '../slices/goalsSlice';
export { loadTags } from '../slices/tagsSlice';
export { loadRecurringTransactions } from '../slices/recurringTransactionsSlice';
export { syncOfflineData } from './supabaseThunks';