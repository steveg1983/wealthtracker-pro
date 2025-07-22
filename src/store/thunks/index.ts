import { createAsyncThunk } from '@reduxjs/toolkit';
import { AppDispatch, RootState } from '../index';
import Decimal from 'decimal.js';
import type { Transaction } from '../../types';
import { 
  addTransaction as addTransactionAction,
  updateTransaction as updateTransactionAction,
  deleteTransaction as deleteTransactionAction,
  saveTransactions
} from '../slices/transactionsSlice';
import { updateAccountBalance, saveAccounts, loadAccounts } from '../slices/accountsSlice';
import { updateBudgetSpent, saveBudgets, loadBudgets } from '../slices/budgetsSlice';
import { updateGoalProgress, saveGoals, loadGoals } from '../slices/goalsSlice';
import { addMultipleTags, saveTags, loadTags } from '../slices/tagsSlice';
import { loadTransactions } from '../slices/transactionsSlice';
import { loadCategories } from '../slices/categoriesSlice';
import { loadRecurringTransactions } from '../slices/recurringTransactionsSlice';

// Load all data from storage
export const loadAllData = createAsyncThunk<void, void, { dispatch: AppDispatch }>(
  'app/loadAllData',
  async (_, { dispatch }) => {
    // Load all data in parallel
    await Promise.all([
      dispatch(loadAccounts()),
      dispatch(loadTransactions()),
      dispatch(loadCategories()),
      dispatch(loadBudgets()),
      dispatch(loadGoals()),
      dispatch(loadTags()),
      dispatch(loadRecurringTransactions()),
    ]);
  }
);

// Add transaction with side effects
export const addTransaction = createAsyncThunk<
  void,
  Omit<Transaction, 'id'>,
  { state: RootState; dispatch: AppDispatch }
>(
  'app/addTransaction',
  async (transactionData, { getState, dispatch }) => {
    // Add the transaction
    dispatch(addTransactionAction(transactionData));
    
    const state = getState();
    
    // Update account balance
    if (transactionData.accountId) {
      const account = state.accounts.accounts.find(a => a.id === transactionData.accountId);
      if (account) {
        const balance = calculateAccountBalance(
          state.transactions.transactions,
          transactionData.accountId,
          account.openingBalance || 0
        );
        dispatch(updateAccountBalance({ id: transactionData.accountId, balance }));
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
          state.transactions.transactions,
          budget
        );
        dispatch(updateBudgetSpent({ id: budget.id, spent }));
      }
    }
    
    // Update goal progress for linked goals
    updateLinkedGoalProgress(transactionData, state, dispatch);
    
    // Add new tags
    if (transactionData.tags && transactionData.tags.length > 0) {
      dispatch(addMultipleTags(transactionData.tags));
    }
    
    // Save all changes
    await Promise.all([
      dispatch(saveTransactions(state.transactions.transactions)),
      dispatch(saveAccounts(state.accounts.accounts)),
      dispatch(saveBudgets(state.budgets.budgets)),
      dispatch(saveGoals(state.goals.goals)),
      dispatch(saveTags(state.tags.tags)),
    ]);
  }
);

// Update transaction with side effects
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
    
    // Update the transaction
    dispatch(updateTransactionAction({ id, updates }));
    
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
        dispatch(updateAccountBalance({ id: accountId, balance }));
      }
    }
    
    // Recalculate affected budgets
    recalculateAffectedBudgets(oldTransaction, { ...oldTransaction, ...updates }, stateAfter, dispatch);
    
    // Update linked goals
    updateLinkedGoalProgress({ ...oldTransaction, ...updates }, stateAfter, dispatch);
    
    // Add new tags
    if (updates.tags) {
      dispatch(addMultipleTags(updates.tags));
    }
    
    // Save all changes
    await Promise.all([
      dispatch(saveTransactions(stateAfter.transactions.transactions)),
      dispatch(saveAccounts(stateAfter.accounts.accounts)),
      dispatch(saveBudgets(stateAfter.budgets.budgets)),
      dispatch(saveGoals(stateAfter.goals.goals)),
      dispatch(saveTags(stateAfter.tags.tags)),
    ]);
  }
);

// Delete transaction with side effects
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
    
    // Delete the transaction
    dispatch(deleteTransactionAction(id));
    
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
        dispatch(updateAccountBalance({ id: transaction.accountId, balance }));
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
    
    // Save all changes
    await Promise.all([
      dispatch(saveTransactions(stateAfter.transactions.transactions)),
      dispatch(saveAccounts(stateAfter.accounts.accounts)),
      dispatch(saveBudgets(stateAfter.budgets.budgets)),
      dispatch(saveGoals(stateAfter.goals.goals)),
    ]);
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
    case 'quarterly':
      const quarter = Math.floor(date.getMonth() / 3);
      const currentQuarter = Math.floor(now.getMonth() / 3);
      return quarter === currentQuarter && 
             date.getFullYear() === now.getFullYear();
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

// Re-export the load thunks from slices
export { loadAccounts } from '../slices/accountsSlice';
export { loadTransactions } from '../slices/transactionsSlice';
export { loadCategories } from '../slices/categoriesSlice';
export { loadBudgets } from '../slices/budgetsSlice';
export { loadGoals } from '../slices/goalsSlice';
export { loadTags } from '../slices/tagsSlice';
export { loadRecurringTransactions } from '../slices/recurringTransactionsSlice';