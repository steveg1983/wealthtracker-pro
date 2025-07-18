/* eslint-disable react-refresh/only-export-components */
// AppContext with internal Decimal support for precise financial calculations
import { createContext, useContext, type ReactNode, useState, useEffect } from 'react';
import { 
  getDefaultTestAccounts, 
  getDefaultTestTransactions, 
  getDefaultTestBudgets, 
  getDefaultTestGoals 
} from '../data/defaultTestData';
import { getDefaultCategories, getMinimalSystemCategories } from '../data/defaultCategories';
import type { Account, Transaction, Budget, Goal } from '../types';
import type { DecimalAccount, DecimalTransaction, DecimalBudget, DecimalGoal } from '../types/decimal-types';
import { 
  toDecimalAccount, toDecimalTransaction, toDecimalBudget, toDecimalGoal,
  fromDecimalAccount, fromDecimalTransaction, fromDecimalBudget, fromDecimalGoal
} from '../utils/decimal-converters';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../utils/decimal';
import { recalculateAccountBalances } from '../utils/recalculateBalances';
import { smartCategorizationService } from '../services/smartCategorizationService';

export interface Tag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  level: 'type' | 'sub' | 'detail';
  parentId?: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
}

export interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  accountId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  startDate: Date;
  endDate?: Date;
  nextDate: Date;
  lastProcessed?: Date;
  isActive: boolean;
  tags?: string[];
  notes?: string;
}

// Internal Decimal version of RecurringTransaction
interface DecimalRecurringTransaction extends Omit<RecurringTransaction, 'amount'> {
  amount: DecimalInstance;
}

interface AppContextType {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  categories: Category[];
  goals: Goal[];
  tags: Tag[];
  hasTestData: boolean;
  clearAllData: () => void;
  exportData: () => string;
  loadTestData: () => void;
  // Add required methods
  addAccount: (account: Omit<Account, 'id' | 'lastUpdated'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addBudget: (budget: Omit<Budget, 'id' | 'createdAt'>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  getTagUsageCount: (tagName: string) => number;
  getAllUsedTags: () => string[];
  recurringTransactions: RecurringTransaction[];
  addRecurringTransaction: (transaction: Omit<RecurringTransaction, 'id'>) => void;
  updateRecurringTransaction: (id: string, updates: Partial<RecurringTransaction>) => void;
  deleteRecurringTransaction: (id: string) => void;
  importTransactions: (transactions: Omit<Transaction, 'id'>[]) => void;
  getSubCategories: (parentId: string) => Category[];
  getDetailCategories: (parentId: string) => Category[];
  createTransferTransaction: (from: string, to: string, amount: number, date: Date) => void;
  // New Decimal-aware methods
  getDecimalAccounts: () => DecimalAccount[];
  getDecimalTransactions: () => DecimalTransaction[];
  getDecimalBudgets: () => DecimalBudget[];
  getDecimalGoals: () => DecimalGoal[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to convert recurring transaction to/from decimal
function toDecimalRecurring(recurring: RecurringTransaction): DecimalRecurringTransaction {
  return {
    ...recurring,
    amount: toDecimal(recurring.amount)
  };
}

function fromDecimalRecurring(recurring: DecimalRecurringTransaction): RecurringTransaction {
  return {
    ...recurring,
    amount: recurring.amount.toNumber()
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Internal state uses Decimal types for precision
  // Initialize transactions first as we need them to calculate account balances
  const [decimalTransactions, setDecimalTransactions] = useState<DecimalTransaction[]>(() => {
    const saved = localStorage.getItem('wealthtracker_transactions');
    if (saved) {
      try {
        const parsed: Transaction[] = JSON.parse(saved);
        return parsed.map(toDecimalTransaction);
      } catch (e) {
        console.error('Error parsing saved transactions:', e);
      }
    }
    if (localStorage.getItem('wealthtracker_data_cleared') === 'true') {
      return [];
    }
    return getDefaultTestTransactions().map(toDecimalTransaction);
  });

  const [decimalAccounts, setDecimalAccounts] = useState<DecimalAccount[]>(() => {
    const saved = localStorage.getItem('wealthtracker_accounts');
    if (saved) {
      try {
        const parsed: Account[] = JSON.parse(saved);
        return parsed.map(toDecimalAccount);
      } catch (e) {
        console.error('Error parsing saved accounts:', e);
      }
    }
    if (localStorage.getItem('wealthtracker_data_cleared') === 'true') {
      return [];
    }
    // Get test accounts and recalculate their balances based on transactions
    const testAccounts = getDefaultTestAccounts();
    const testTransactions = getDefaultTestTransactions();
    const recalculatedAccounts = recalculateAccountBalances(testAccounts, testTransactions);
    return recalculatedAccounts.map(toDecimalAccount);
  });
  
  const [decimalBudgets, setDecimalBudgets] = useState<DecimalBudget[]>(() => {
    const saved = localStorage.getItem('wealthtracker_budgets');
    if (saved) {
      try {
        const parsed: Budget[] = JSON.parse(saved);
        return parsed.map(toDecimalBudget);
      } catch (e) {
        console.error('Error parsing saved budgets:', e);
      }
    }
    if (localStorage.getItem('wealthtracker_data_cleared') === 'true') {
      return [];
    }
    return getDefaultTestBudgets().map(toDecimalBudget);
  });
  
  const [decimalGoals, setDecimalGoals] = useState<DecimalGoal[]>(() => {
    const saved = localStorage.getItem('wealthtracker_goals');
    if (saved) {
      try {
        const parsed: Goal[] = JSON.parse(saved);
        return parsed.map(toDecimalGoal);
      } catch (e) {
        console.error('Error parsing saved goals:', e);
      }
    }
    if (localStorage.getItem('wealthtracker_data_cleared') === 'true') {
      return [];
    }
    return getDefaultTestGoals().map(toDecimalGoal);
  });
  
  const [categories, setCategories] = useState(() => getDefaultCategories());
  
  const [tags, setTags] = useState<Tag[]>(() => {
    const saved = localStorage.getItem('wealthtracker_tags');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved tags:', e);
      }
    }
    return [];
  });
  
  const [decimalRecurringTransactions, setDecimalRecurringTransactions] = useState<DecimalRecurringTransaction[]>(() => {
    const saved = localStorage.getItem('wealthtracker_recurring');
    if (saved) {
      try {
        const parsed: RecurringTransaction[] = JSON.parse(saved);
        return parsed.map(toDecimalRecurring);
      } catch (e) {
        console.error('Error parsing saved recurring transactions:', e);
      }
    }
    return [];
  });
  
  // Convert Decimal state to number-based for backward compatibility
  const accounts = decimalAccounts.map(fromDecimalAccount);
  const transactions = decimalTransactions.map(fromDecimalTransaction);
  const budgets = decimalBudgets.map(fromDecimalBudget);
  const goals = decimalGoals.map(fromDecimalGoal);
  const recurringTransactions = decimalRecurringTransactions.map(fromDecimalRecurring);
  
  // Determine if we have test data based on actual data presence
  const hasTestData = decimalAccounts.length > 0 && decimalAccounts.some((acc) => 
    acc.name === 'Main Checking' || acc.name === 'Savings Account'
  );

  // Save to localStorage whenever data changes (convert to number format for storage)
  useEffect(() => {
    localStorage.setItem('wealthtracker_accounts', JSON.stringify(accounts));
  }, [accounts]);
  
  useEffect(() => {
    localStorage.setItem('wealthtracker_transactions', JSON.stringify(transactions));
  }, [transactions]);
  
  useEffect(() => {
    localStorage.setItem('wealthtracker_budgets', JSON.stringify(budgets));
  }, [budgets]);
  
  useEffect(() => {
    localStorage.setItem('wealthtracker_goals', JSON.stringify(goals));
  }, [goals]);
  
  useEffect(() => {
    localStorage.setItem('wealthtracker_tags', JSON.stringify(tags));
  }, [tags]);
  
  useEffect(() => {
    localStorage.setItem('wealthtracker_recurring', JSON.stringify(recurringTransactions));
  }, [recurringTransactions]);

  const getTagUsageCount = (tagName: string): number => {
    return decimalTransactions.filter(t => t.tags?.includes(tagName)).length;
  };

  const getAllUsedTags = (): string[] => {
    const tagSet = new Set<string>();
    decimalTransactions.forEach(t => {
      t.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet);
  };

  const getSubCategories = (parentId: string): Category[] => {
    return categories.filter(c => c.parentId === parentId && c.level === 'sub');
  };

  const getDetailCategories = (parentId: string): Category[] => {
    return categories.filter(c => c.parentId === parentId && c.level === 'detail');
  };

  const value: AppContextType = {
    accounts,
    transactions,
    budgets,
    categories,
    goals,
    tags,
    hasTestData,
    recurringTransactions,
    clearAllData: () => {
      // Clear all state
      setDecimalAccounts([]);
      setDecimalTransactions([]);
      setDecimalBudgets([]);
      setDecimalGoals([]);
      setTags([]);
      setDecimalRecurringTransactions([]);
      setCategories(getMinimalSystemCategories());
      
      // Clear all localStorage keys
      localStorage.removeItem('wealthtracker_accounts');
      localStorage.removeItem('wealthtracker_transactions');
      localStorage.removeItem('wealthtracker_budgets');
      localStorage.removeItem('wealthtracker_goals');
      localStorage.removeItem('wealthtracker_tags');
      localStorage.removeItem('wealthtracker_recurring');
      
      // Also clear other app-related keys
      localStorage.removeItem('testDataWarningDismissed');
      localStorage.removeItem('onboardingCompleted');
      
      // Set a flag to prevent loading test data on refresh
      localStorage.setItem('wealthtracker_data_cleared', 'true');
      
      // Clear money_management keys from old versions
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('money_management_') || key.startsWith('wealthtracker_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    },
    exportData: () => {
      const data = {
        accounts,
        transactions,
        budgets,
        goals,
        recurringTransactions,
        categories,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
      return JSON.stringify(data, null, 2);
    },
    loadTestData: () => {
      const testAccounts = getDefaultTestAccounts();
      const testTransactions = getDefaultTestTransactions();
      const testBudgets = getDefaultTestBudgets().map(toDecimalBudget);
      const testGoals = getDefaultTestGoals().map(toDecimalGoal);
      
      // Recalculate account balances based on transactions
      const recalculatedAccounts = recalculateAccountBalances(testAccounts, testTransactions);
      
      setDecimalAccounts(recalculatedAccounts.map(toDecimalAccount));
      setDecimalTransactions(testTransactions.map(toDecimalTransaction));
      setDecimalBudgets(testBudgets);
      setDecimalGoals(testGoals);
      
      // Remove the cleared flag since we're loading data
      localStorage.removeItem('wealthtracker_data_cleared');
    },
    addAccount: (account) => {
      const decimalAccount = toDecimalAccount({
        ...account,
        id: Date.now().toString(),
        lastUpdated: new Date()
      });
      setDecimalAccounts(prev => [...prev, decimalAccount]);
    },
    updateAccount: (id, updates) => {
      setDecimalAccounts(prev => prev.map(a => {
        if (a.id === id) {
          const numberAccount = fromDecimalAccount(a);
          const updatedNumberAccount = { ...numberAccount, ...updates, lastUpdated: new Date() };
          return toDecimalAccount(updatedNumberAccount);
        }
        return a;
      }));
    },
    deleteAccount: (id) => setDecimalAccounts(prev => prev.filter(a => a.id !== id)),
    addTransaction: (transaction) => {
      const decimalTransaction = toDecimalTransaction({
        ...transaction,
        id: Date.now().toString()
      });
      setDecimalTransactions(prev => [...prev, decimalTransaction]);
      
      // Update account balance
      setDecimalAccounts(prev => prev.map(account => {
        if (account.id === transaction.accountId) {
          let adjustment;
          if (transaction.type === 'income') {
            adjustment = toDecimal(transaction.amount);
          } else if (transaction.type === 'expense') {
            adjustment = toDecimal(transaction.amount).negated();
          } else if (transaction.type === 'transfer') {
            // For transfers, use the amount as-is (negative for out, positive for in)
            adjustment = toDecimal(transaction.amount);
          } else {
            adjustment = toDecimal(0);
          }
          return {
            ...account,
            balance: account.balance.plus(adjustment)
          };
        }
        return account;
      }));
    },
    updateTransaction: (id, updates) => {
      // First, find the original transaction to calculate balance adjustment
      const originalTransaction = decimalTransactions.find(t => t.id === id);
      if (!originalTransaction) return;
      
      setDecimalTransactions(prev => prev.map(t => {
        if (t.id === id) {
          const numberTransaction = fromDecimalTransaction(t);
          const updatedNumberTransaction = { ...numberTransaction, ...updates };
          return toDecimalTransaction(updatedNumberTransaction);
        }
        return t;
      }));
      
      // Update account balance if amount or type changed
      if (updates.amount !== undefined || updates.type !== undefined) {
        let oldAdjustment;
        const originalType = fromDecimalTransaction(originalTransaction).type;
        if (originalType === 'income') {
          oldAdjustment = originalTransaction.amount;
        } else if (originalType === 'expense') {
          oldAdjustment = originalTransaction.amount.negated();
        } else if (originalType === 'transfer') {
          // For transfers, use the amount as-is
          oldAdjustment = originalTransaction.amount;
        } else {
          oldAdjustment = toDecimal(0);
        }
        
        const newType = updates.type || originalType;
        const newAmount = updates.amount !== undefined 
          ? toDecimal(updates.amount) 
          : originalTransaction.amount;
        
        let newAdjustment;
        if (newType === 'income') {
          newAdjustment = newAmount;
        } else if (newType === 'expense') {
          newAdjustment = newAmount.negated();
        } else if (newType === 'transfer') {
          // For transfers, use the amount as-is
          newAdjustment = newAmount;
        } else {
          newAdjustment = toDecimal(0);
        }
        
        const balanceChange = newAdjustment.minus(oldAdjustment);
        
        setDecimalAccounts(prev => prev.map(account => {
          if (account.id === originalTransaction.accountId) {
            return {
              ...account,
              balance: account.balance.plus(balanceChange)
            };
          }
          return account;
        }));
      }
      
      // Real-time learning: If category was updated, train the model
      if (updates.category) {
        const updatedTransaction = decimalTransactions.find(t => t.id === id);
        if (updatedTransaction) {
          const numberTransaction = { ...fromDecimalTransaction(updatedTransaction), ...updates };
          smartCategorizationService.learnFromCategorization(numberTransaction, updates.category);
        }
      }
    },
    deleteTransaction: (id) => {
      // Find the transaction to get its details for balance adjustment
      const transactionToDelete = decimalTransactions.find(t => t.id === id);
      if (!transactionToDelete) return;
      
      setDecimalTransactions(prev => prev.filter(t => t.id !== id));
      
      // Update account balance
      let adjustment;
      const transactionType = fromDecimalTransaction(transactionToDelete).type;
      if (transactionType === 'income') {
        adjustment = transactionToDelete.amount.negated();
      } else if (transactionType === 'expense') {
        adjustment = transactionToDelete.amount;
      } else if (transactionType === 'transfer') {
        // For transfers, reverse the amount (negate it)
        adjustment = transactionToDelete.amount.negated();
      } else {
        adjustment = toDecimal(0);
      }
      
      setDecimalAccounts(prev => prev.map(account => {
        if (account.id === transactionToDelete.accountId) {
          return {
            ...account,
            balance: account.balance.plus(adjustment)
          };
        }
        return account;
      }));
    },
    addBudget: (budget) => {
      const decimalBudget = toDecimalBudget({
        ...budget,
        id: Date.now().toString(),
        createdAt: new Date()
      });
      setDecimalBudgets(prev => [...prev, decimalBudget]);
    },
    updateBudget: (id, updates) => {
      setDecimalBudgets(prev => prev.map(b => {
        if (b.id === id) {
          const numberBudget = fromDecimalBudget(b);
          const updatedNumberBudget = { ...numberBudget, ...updates };
          return toDecimalBudget(updatedNumberBudget);
        }
        return b;
      }));
    },
    deleteBudget: (id) => setDecimalBudgets(prev => prev.filter(b => b.id !== id)),
    addCategory: (category) => setCategories(prev => [...prev, { ...category, id: Date.now().toString() }]),
    updateCategory: (id, updates) => setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c)),
    deleteCategory: (id) => setCategories(prev => prev.filter(c => c.id !== id)),
    addGoal: (goal) => {
      const decimalGoal = toDecimalGoal({
        ...goal,
        id: Date.now().toString(),
        createdAt: new Date()
      });
      setDecimalGoals(prev => [...prev, decimalGoal]);
    },
    updateGoal: (id, updates) => {
      setDecimalGoals(prev => prev.map(g => {
        if (g.id === id) {
          const numberGoal = fromDecimalGoal(g);
          const updatedNumberGoal = { ...numberGoal, ...updates };
          return toDecimalGoal(updatedNumberGoal);
        }
        return g;
      }));
    },
    deleteGoal: (id) => setDecimalGoals(prev => prev.filter(g => g.id !== id)),
    addTag: (tag) => setTags(prev => [...prev, { 
      ...tag, 
      id: Date.now().toString(), 
      createdAt: new Date(), 
      updatedAt: new Date() 
    }]),
    updateTag: (id, updates) => setTags(prev => prev.map(t => 
      t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
    )),
    deleteTag: (id) => setTags(prev => prev.filter(t => t.id !== id)),
    getTagUsageCount,
    getAllUsedTags,
    addRecurringTransaction: (transaction) => {
      const decimalRecurring = toDecimalRecurring({
        ...transaction,
        id: Date.now().toString()
      });
      setDecimalRecurringTransactions(prev => [...prev, decimalRecurring]);
    },
    updateRecurringTransaction: (id, updates) => {
      setDecimalRecurringTransactions(prev => prev.map(r => {
        if (r.id === id) {
          const numberRecurring = fromDecimalRecurring(r);
          const updatedNumberRecurring = { ...numberRecurring, ...updates };
          return toDecimalRecurring(updatedNumberRecurring);
        }
        return r;
      }));
    },
    deleteRecurringTransaction: (id) => setDecimalRecurringTransactions(prev => prev.filter(r => r.id !== id)),
    importTransactions: (newTransactions) => {
      const decimalTransactions = newTransactions.map(t => toDecimalTransaction({
        ...t,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
      }));
      setDecimalTransactions(prev => [...prev, ...decimalTransactions]);
    },
    getSubCategories,
    getDetailCategories,
    createTransferTransaction: (from: string, to: string, amount: number, date: Date) => {
      const timestamp = Date.now();
      const fromAccount = accounts.find(a => a.id === from);
      const toAccount = accounts.find(a => a.id === to);
      
      // Create transfer out transaction (from account) - negative amount
      const transferOutTransaction = toDecimalTransaction({
        id: `${timestamp}-out`,
        date,
        amount: -Math.abs(amount), // Ensure negative for money going out
        description: `Transfer to ${toAccount?.name || 'Unknown Account'}`,
        category: 'transfer',
        accountId: from,
        type: 'transfer',
        tags: ['transfer'],
        notes: `Transfer to ${toAccount?.name || 'account'}`,
        cleared: true
      });
      
      // Create transfer in transaction (to account) - positive amount
      const transferInTransaction = toDecimalTransaction({
        id: `${timestamp}-in`,
        date,
        amount: Math.abs(amount), // Ensure positive for money coming in
        description: `Transfer from ${fromAccount?.name || 'Unknown Account'}`,
        category: 'transfer',
        accountId: to,
        type: 'transfer',
        tags: ['transfer'],
        notes: `Transfer from ${fromAccount?.name || 'account'}`,
        cleared: true
      });
      
      setDecimalTransactions(prev => [...prev, transferOutTransaction, transferInTransaction]);
    },
    // New Decimal-aware methods
    getDecimalAccounts: () => decimalAccounts,
    getDecimalTransactions: () => decimalTransactions,
    getDecimalBudgets: () => decimalBudgets,
    getDecimalGoals: () => decimalGoals
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

// Alias for backward compatibility
export const useApp = useAppContext;