/**
 * Demo Mode Slice - Manages demo mode state and data isolation
 * 
 * Features:
 * - Complete data isolation from real user data
 * - Generate realistic demo data
 * - No persistence to database
 * - Clear visual indicators
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Account, Transaction, Budget, Goal } from '../../types';

interface DemoState {
  isActive: boolean;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  timestamp: number;
}

const generateDemoAccounts = (): Account[] => [
  {
    id: 'demo-checking',
    name: 'Demo Checking',
    type: 'checking',
    balance: 5234.56,
    currency: 'USD',
    isActive: true,
    institution: 'Demo Bank',
    lastUpdated: new Date()
  },
  {
    id: 'demo-savings',
    name: 'Demo Savings',
    type: 'savings',
    balance: 12500.00,
    currency: 'USD',
    isActive: true,
    institution: 'Demo Bank',
    lastUpdated: new Date()
  },
  {
    id: 'demo-credit',
    name: 'Demo Credit Card',
    type: 'credit',
    balance: -1245.67,
    currency: 'USD',
    isActive: true,
    institution: 'Demo Bank',
    lastUpdated: new Date()
  },
  {
    id: 'demo-investment',
    name: 'Demo Investment',
    type: 'investment',
    balance: 45678.90,
    currency: 'USD',
    isActive: true,
    institution: 'Demo Investments',
    lastUpdated: new Date()
  }
];

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
    
    transactions.push({
      id: `demo-txn-${i}`,
      accountId: i % 3 === 0 ? 'demo-checking' : i % 3 === 1 ? 'demo-savings' : 'demo-credit',
      date,
      description: isExpense ? merchants[categoryIndex] : 'Salary Deposit',
      amount: isExpense ? -(Math.random() * 200 + 10) : (Math.random() * 3000 + 1000),
      category: isExpense ? categories[categoryIndex] : 'Income',
      type: isExpense ? 'expense' : 'income',
      pending: Math.random() > 0.9
    });
  }
  
  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
};

const generateDemoBudgets = (): Budget[] => [
  {
    id: 'demo-budget-1',
    name: 'Groceries',
    amount: 500,
    spent: 423.50,
    period: 'monthly',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    category: 'Groceries',
    isActive: true
  },
  {
    id: 'demo-budget-2',
    name: 'Dining Out',
    amount: 300,
    spent: 256.75,
    period: 'monthly',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    category: 'Dining',
    isActive: true
  },
  {
    id: 'demo-budget-3',
    name: 'Entertainment',
    amount: 200,
    spent: 189.99,
    period: 'monthly',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    category: 'Entertainment',
    isActive: true
  }
];

const generateDemoGoals = (): Goal[] => [
  {
    id: 'demo-goal-1',
    name: 'Emergency Fund',
    targetAmount: 10000,
    currentAmount: 6500,
    targetDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
    category: 'savings',
    priority: 'high',
    description: 'Build 6-month emergency fund'
  },
  {
    id: 'demo-goal-2',
    name: 'Vacation Fund',
    targetAmount: 3000,
    currentAmount: 1250,
    targetDate: new Date(new Date().setMonth(new Date().getMonth() + 4)),
    category: 'travel',
    priority: 'medium',
    description: 'Summer vacation to Europe'
  },
  {
    id: 'demo-goal-3',
    name: 'New Car Down Payment',
    targetAmount: 5000,
    currentAmount: 2000,
    targetDate: new Date(new Date().setMonth(new Date().getMonth() + 8)),
    category: 'savings',
    priority: 'low',
    description: 'Save for car down payment'
  }
];

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
        const oldAmount = state.transactions[index].amount;
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