import { useAccounts } from '../contexts/AccountContext';
import { useTransactions } from '../contexts/TransactionContext';
import { useBudgets } from '../contexts/BudgetContext';
import { useCategories } from '../contexts/CategoryContext';
import { useGoals } from '../contexts/GoalContext';

/**
 * Compatibility hook that provides the same interface as the old useApp hook
 * This allows for gradual migration of components to use the new split contexts
 */
export function useApp() {
  const accountContext = useAccounts();
  const transactionContext = useTransactions();
  const budgetContext = useBudgets();
  const categoryContext = useCategories();
  const goalContext = useGoals();

  // Check if we have test data by looking for specific test account names
  const hasTestData = accountContext.accounts.some(acc => 
    acc.name === 'Checking Account' || acc.name === 'Savings Account'
  );

  // Function to clear all data
  const clearAllData = () => {
    // Clear localStorage
    localStorage.removeItem('money_management_accounts');
    localStorage.removeItem('money_management_transactions');
    localStorage.removeItem('money_management_budgets');
    localStorage.removeItem('money_management_categories');
    localStorage.removeItem('money_management_goals');
    localStorage.removeItem('money_management_recurring_transactions');
    
    // Reload the page to reset all contexts
    window.location.reload();
  };

  // Create transfer transaction helper
  const createTransferTransaction = (from: string, to: string, amount: number, date: Date) => {
    // Create expense from source account
    transactionContext.addTransaction({
      date,
      description: `Transfer to ${accountContext.getAccount(to)?.name || 'Unknown'}`,
      amount,
      type: 'expense',
      category: 'transfer-out',
      accountId: from,
      cleared: false
    });

    // Create income to destination account
    transactionContext.addTransaction({
      date,
      description: `Transfer from ${accountContext.getAccount(from)?.name || 'Unknown'}`,
      amount,
      type: 'income',
      category: 'transfer-in',
      accountId: to,
      cleared: false
    });
  };

  return {
    // Account methods
    accounts: accountContext.accounts,
    addAccount: accountContext.addAccount,
    updateAccount: accountContext.updateAccount,
    deleteAccount: accountContext.deleteAccount,

    // Transaction methods
    transactions: transactionContext.transactions,
    addTransaction: transactionContext.addTransaction,
    updateTransaction: transactionContext.updateTransaction,
    deleteTransaction: transactionContext.deleteTransaction,
    recurringTransactions: transactionContext.recurringTransactions,
    addRecurringTransaction: transactionContext.addRecurringTransaction,
    updateRecurringTransaction: transactionContext.updateRecurringTransaction,
    deleteRecurringTransaction: transactionContext.deleteRecurringTransaction,
    importTransactions: transactionContext.importTransactions,

    // Budget methods
    budgets: budgetContext.budgets,
    addBudget: budgetContext.addBudget,
    updateBudget: budgetContext.updateBudget,
    deleteBudget: budgetContext.deleteBudget,

    // Category methods
    categories: categoryContext.categories,
    addCategory: categoryContext.addCategory,
    updateCategory: categoryContext.updateCategory,
    deleteCategory: categoryContext.deleteCategory,
    getSubCategories: categoryContext.getSubCategories,
    getDetailCategories: categoryContext.getDetailCategories,

    // Goal methods
    goals: goalContext.goals,
    addGoal: goalContext.addGoal,
    updateGoal: goalContext.updateGoal,
    deleteGoal: goalContext.deleteGoal,

    // Helper methods
    hasTestData,
    clearAllData,
    createTransferTransaction
  };
}