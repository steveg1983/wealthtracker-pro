/**
 * Demo Mode Slice - Manages demo mode state and data isolation
 * 
 * Features:
 * - Complete data isolation from real user data
 * - Generate realistic demo data
 * - No persistence to database
 * - Clear visual indicators
 */

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Account, Transaction, Budget, Goal } from '../../types';

interface DemoState {
  isActive: boolean;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  timestamp: number;
}

const generateDemoAccounts = (): Account[] => {
  const timestamp = new Date();
  return [
    {
      id: 'demo-checking',
      name: 'Demo Checking',
      type: 'checking',
      balance: 5234.56,
      currency: 'USD',
      isActive: true,
      institution: 'Demo Bank',
      lastUpdated: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'demo-savings',
      name: 'Demo Savings',
      type: 'savings',
      balance: 12500.0,
      currency: 'USD',
      isActive: true,
      institution: 'Demo Bank',
      lastUpdated: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'demo-credit',
      name: 'Demo Credit Card',
      type: 'credit',
      balance: -1245.67,
      currency: 'USD',
      isActive: true,
      institution: 'Demo Bank',
      lastUpdated: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'demo-investment',
      name: 'Demo Investment',
      type: 'investment',
      balance: 45678.9,
      currency: 'USD',
      isActive: true,
      institution: 'Demo Investments',
      lastUpdated: timestamp,
      updatedAt: timestamp,
    },
  ];
};

const generateDemoTransactions = (): Transaction[] => {
  const categories = ['Groceries', 'Dining', 'Transportation', 'Entertainment', 'Shopping', 'Utilities', 'Healthcare'];
  const merchants = ['Supermarket', 'Restaurant', 'Gas Station', 'Movie Theater', 'Department Store', 'Electric Company', 'Pharmacy'];
  const transactions: Transaction[] = [];
  
  // Generate 50 demo transactions
  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    
    const isExpense = Math.random() > 0.2; // 80% expenses, 20% income
    const categoryIndex = Math.floor(Math.random() * categories.length);
    const categoryName = categories[categoryIndex] ?? 'General';
    const merchantName = merchants[categoryIndex] ?? 'Merchant';
    
    transactions.push({
      id: `demo-txn-${i}`,
      accountId: i % 3 === 0 ? 'demo-checking' : i % 3 === 1 ? 'demo-savings' : 'demo-credit',
      date,
      description: isExpense ? merchantName : 'Salary Deposit',
      amount: isExpense ? -(Math.random() * 200 + 10) : (Math.random() * 3000 + 1000),
      category: isExpense ? categoryName : 'Income',
      type: isExpense ? 'expense' : 'income',
      pending: Math.random() > 0.9
    });
  }
  
  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
};

const toStartOfMonthIso = (date: Date): string => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  return start.toISOString();
};

const toEndOfMonthIso = (date: Date): string => {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
};

const generateDemoBudgets = (): Budget[] => {
  const now = new Date();
  const startDate = toStartOfMonthIso(now);
  const endDate = toEndOfMonthIso(now);

  const baseTimestamp = new Date();

  return [
    {
      id: 'demo-budget-1',
      name: 'Groceries',
      categoryId: 'demo-category-groceries',
      amount: 500,
      spent: 423.5,
      period: 'monthly',
      isActive: true,
      createdAt: baseTimestamp,
      updatedAt: baseTimestamp,
      startDate,
      endDate,
    },
    {
      id: 'demo-budget-2',
      name: 'Dining Out',
      categoryId: 'demo-category-dining',
      amount: 300,
      spent: 256.75,
      period: 'monthly',
      isActive: true,
      createdAt: baseTimestamp,
      updatedAt: baseTimestamp,
      startDate,
      endDate,
    },
    {
      id: 'demo-budget-3',
      name: 'Entertainment',
      categoryId: 'demo-category-entertainment',
      amount: 200,
      spent: 189.99,
      period: 'monthly',
      isActive: true,
      createdAt: baseTimestamp,
      updatedAt: baseTimestamp,
      startDate,
      endDate,
    },
  ];
};

const generateDemoGoals = (): Goal[] => {
  const buildGoal = (
    id: string,
    name: string,
    targetAmount: number,
    currentAmount: number,
    monthsAhead: number,
    category: string,
    priority: 'low' | 'medium' | 'high',
    description: string
  ): Goal => {
    const createdAt = new Date();
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + monthsAhead);
    const progress = Math.min(100, Math.round((currentAmount / targetAmount) * 100));

    return {
      id,
      name,
      type: 'savings',
      targetAmount,
      currentAmount,
      targetDate,
      description,
      linkedAccountIds: [],
      isActive: true,
      createdAt,
      progress,
      updatedAt: createdAt,
      category,
      priority,
      status: 'active',
    };
  };

  return [
    buildGoal(
      'demo-goal-1',
      'Emergency Fund',
      10000,
      6500,
      6,
      'savings',
      'high',
      'Build 6-month emergency fund'
    ),
    buildGoal(
      'demo-goal-2',
      'Vacation Fund',
      3000,
      1250,
      4,
      'travel',
      'medium',
      'Summer vacation to Europe'
    ),
    buildGoal(
      'demo-goal-3',
      'New Car Down Payment',
      5000,
      2000,
      8,
      'savings',
      'low',
      'Save for car down payment'
    ),
  ];
};

const initialState: DemoState = {
  isActive: false,
  accounts: [],
  transactions: [],
  budgets: [],
  goals: [],
  timestamp: Date.now()
};

const demoSlice = createSlice({
  name: 'demo',
  initialState,
  reducers: {
    activateDemoMode: (state) => {
      state.isActive = true;
      state.accounts = generateDemoAccounts();
      state.transactions = generateDemoTransactions();
      state.budgets = generateDemoBudgets();
      state.goals = generateDemoGoals();
      state.timestamp = Date.now();
      
      // Store demo mode flag in sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('demoMode', 'true');
      }
    },
    
    deactivateDemoMode: (state) => {
      state.isActive = false;
      state.accounts = [];
      state.transactions = [];
      state.budgets = [];
      state.goals = [];
      state.timestamp = Date.now();
      
      // Clear demo mode flag
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('demoMode');
      }
    },
    
    updateDemoAccount: (state, action: PayloadAction<Account>) => {
      if (!state.isActive) return;
      
      const index = state.accounts.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        state.accounts[index] = action.payload;
      }
    },
    
    addDemoTransaction: (state, action: PayloadAction<Transaction>) => {
      if (!state.isActive) return;
      
      state.transactions.unshift(action.payload);
      
      // Update account balance
      const account = state.accounts.find(a => a.id === action.payload.accountId);
      if (account) {
        account.balance += action.payload.amount;
      }
    },
    
    updateDemoTransaction: (state, action: PayloadAction<Transaction>) => {
      if (!state.isActive) return;
      
      const index = state.transactions.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        const existing = state.transactions[index];
        if (!existing) {
          return;
        }

        const oldAmount = existing.amount;
        const newAmount = action.payload.amount;
        const difference = newAmount - oldAmount;
        
        state.transactions[index] = action.payload;
        
        // Update account balance
        const account = state.accounts.find(a => a.id === action.payload.accountId);
        if (account) {
          account.balance += difference;
        }
      }
    },
    
    deleteDemoTransaction: (state, action: PayloadAction<string>) => {
      if (!state.isActive) return;
      
      const transaction = state.transactions.find(t => t.id === action.payload);
      if (transaction) {
        // Update account balance
        const account = state.accounts.find(a => a.id === transaction.accountId);
        if (account) {
          account.balance -= transaction.amount;
        }
        
        state.transactions = state.transactions.filter(t => t.id !== action.payload);
      }
    },
    
    regenerateDemoData: (state) => {
      if (!state.isActive) return;
      
      state.accounts = generateDemoAccounts();
      state.transactions = generateDemoTransactions();
      state.budgets = generateDemoBudgets();
      state.goals = generateDemoGoals();
      state.timestamp = Date.now();
    }
  }
});

export const {
  activateDemoMode,
  deactivateDemoMode,
  updateDemoAccount,
  addDemoTransaction,
  updateDemoTransaction,
  deleteDemoTransaction,
  regenerateDemoData
} = demoSlice.actions;

export default demoSlice.reducer;

// Selectors
export const selectDemoMode = (state: { demo: DemoState }) => state.demo.isActive;
export const selectDemoAccounts = (state: { demo: DemoState }) => state.demo.accounts;
export const selectDemoTransactions = (state: { demo: DemoState }) => state.demo.transactions;
export const selectDemoBudgets = (state: { demo: DemoState }) => state.demo.budgets;
export const selectDemoGoals = (state: { demo: DemoState }) => state.demo.goals;
