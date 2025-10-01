/**
 * Demo data for UI/UX testing without authentication
 * This provides realistic sample data for testing the interface
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../services/loggingService';

// Check if we're in demo mode
export const isDemoMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('demo') === 'true';
};

// Demo user data
export const demoUser = {
  id: 'demo-user-001',
  email: 'demo@wealthtracker.app',
  firstName: 'Demo',
  lastName: 'User',
  fullName: 'Demo User',
  imageUrl: null,
};

// Demo accounts
export const demoAccounts = [
  {
    id: uuidv4(),
    name: 'Main Checking',
    type: 'checking',
    balance: '5234.56',
    currency: 'USD',
    institution: 'Demo Bank',
    accountNumber: '****1234',
    isActive: true,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    name: 'Savings Account',
    type: 'savings',
    balance: '25000.00',
    currency: 'USD',
    institution: 'Demo Bank',
    accountNumber: '****5678',
    isActive: true,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    name: 'Investment Portfolio',
    type: 'investment',
    balance: '45678.90',
    currency: 'USD',
    institution: 'Demo Investments',
    accountNumber: '****9012',
    isActive: true,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date().toISOString(),
    holdings: [
      {
        id: uuidv4(),
        symbol: 'AAPL',
        name: 'Apple Inc.',
        shares: 50,
        costBasis: 7500.00,
        currentPrice: 185.50,
        marketValue: 9275.00,
        value: 9275.00,
        assetType: 'stock',
        allocation: 20.3
      },
      {
        id: uuidv4(),
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        shares: 25,
        costBasis: 3250.00,
        currentPrice: 140.25,
        marketValue: 3506.25,
        value: 3506.25,
        assetType: 'stock',
        allocation: 7.7
      },
      {
        id: uuidv4(),
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        shares: 30,
        costBasis: 10200.00,
        currentPrice: 380.75,
        marketValue: 11422.50,
        value: 11422.50,
        assetType: 'stock',
        allocation: 25.0
      },
      {
        id: uuidv4(),
        symbol: 'VTI',
        name: 'Vanguard Total Stock Market ETF',
        shares: 40,
        costBasis: 8800.00,
        currentPrice: 235.40,
        marketValue: 9416.00,
        value: 9416.00,
        assetType: 'etf',
        allocation: 20.6
      },
      {
        id: uuidv4(),
        symbol: 'BND',
        name: 'Vanguard Total Bond Market ETF',
        shares: 100,
        costBasis: 7800.00,
        currentPrice: 74.95,
        marketValue: 7495.00,
        value: 7495.00,
        assetType: 'etf',
        allocation: 16.4
      },
      {
        id: uuidv4(),
        symbol: 'CASH',
        name: 'Cash & Money Market',
        shares: 1,
        costBasis: 4563.15,
        currentPrice: 4563.15,
        marketValue: 4563.15,
        value: 4563.15,
        assetType: 'cash',
        allocation: 10.0
      }
    ]
  },
  {
    id: uuidv4(),
    name: 'Credit Card',
    type: 'credit',
    balance: '-2345.67',
    currency: 'USD',
    institution: 'Demo Credit',
    accountNumber: '****3456',
    isActive: true,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const primaryDemoAccountId = demoAccounts[0]?.id ?? 'demo-account';

// Demo transactions
const transactionCategories = [
  'Groceries', 'Restaurants', 'Transportation', 'Entertainment',
  'Shopping', 'Bills & Utilities', 'Healthcare', 'Education',
  'Travel', 'Insurance', 'Investments', 'Salary'
];

const transactionDescriptions = [
  'Whole Foods Market', 'Starbucks Coffee', 'Uber Ride', 'Netflix Subscription',
  'Amazon Purchase', 'Electric Bill', 'Doctor Visit', 'Online Course',
  'Flight Booking', 'Car Insurance', 'Stock Purchase', 'Monthly Salary',
  'Target Store', 'Gas Station', 'Spotify Premium', 'Gym Membership',
  'Restaurant Dinner', 'Grocery Store', 'Phone Bill', 'Internet Service'
];

// Generate demo transactions
export const generateDemoTransactions = (count: number = 50) => {
  const transactions = [];
  const today = new Date();
  
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 90); // Last 90 days
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    
    const isExpense = Math.random() > 0.2; // 80% expenses, 20% income
    const rawAmount = isExpense 
      ? -(Math.random() * 500 + 10) // Expenses: -$10 to -$510
      : (Math.random() * 3000 + 1000); // Income: $1000 to $4000
    const amount = Number(rawAmount.toFixed(2));
    
    // Get expense categories or income category
    const expenseCategories = demoCategories.filter(c => c.type === 'expense');
    const incomeCategory = demoCategories.find(c => c.type === 'income');
    
    const categoryObj = isExpense 
      ? expenseCategories[Math.floor(Math.random() * expenseCategories.length)]
      : incomeCategory;
    
    const category = categoryObj?.id || 'cat-other';
    const categoryName = categoryObj?.name || 'Other';
    
    const account = demoAccounts[Math.floor(Math.random() * demoAccounts.length)];
    const accountId = account?.id ?? primaryDemoAccountId;

    transactions.push({
      id: uuidv4(),
      date: date.toISOString().split('T')[0],
      description: transactionDescriptions[Math.floor(Math.random() * transactionDescriptions.length)],
      amount,
      category,
      categoryName,
      accountId,
      type: amount < 0 ? 'expense' : 'income',
      isRecurring: Math.random() > 0.9,
      isPending: Math.random() > 0.95,
      tags: Math.random() > 0.7 ? ['tagged'] : [],
      notes: Math.random() > 0.8 ? 'Sample transaction note' : '',
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
    });
  }
  
  return transactions.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
};

// Demo budgets
export const demoBudgets = [
  {
    id: uuidv4(),
    name: 'Monthly Expenses',
    category: 'Groceries',
    amount: '600.00',
    spent: '423.50',
    period: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: null,
    isActive: true,
  },
  {
    id: uuidv4(),
    name: 'Dining Out',
    category: 'Restaurants',
    amount: '400.00',
    spent: '312.75',
    period: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: null,
    isActive: true,
  },
  {
    id: uuidv4(),
    name: 'Entertainment',
    category: 'Entertainment',
    amount: '200.00',
    spent: '145.00',
    period: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: null,
    isActive: true,
  },
  {
    id: uuidv4(),
    name: 'Transportation',
    category: 'Transportation',
    amount: '300.00',
    spent: '389.00',
    period: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: null,
    isActive: true,
  },
];

// Demo goals
export const demoGoals = [
  {
    id: uuidv4(),
    name: 'Emergency Fund',
    targetAmount: '10000.00',
    currentAmount: '6500.00',
    deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    category: 'savings',
    priority: 'high',
    isActive: true,
  },
  {
    id: uuidv4(),
    name: 'Vacation Fund',
    targetAmount: '5000.00',
    currentAmount: '2100.00',
    deadline: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    category: 'travel',
    priority: 'medium',
    isActive: true,
  },
  {
    id: uuidv4(),
    name: 'New Car Down Payment',
    targetAmount: '8000.00',
    currentAmount: '3200.00',
    deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    category: 'purchase',
    priority: 'low',
    isActive: true,
  },
];

// Demo categories with colors
export const demoCategories = [
  { id: 'cat-groceries', name: 'Groceries', color: '#10b981', icon: '🛒', type: 'expense' },
  { id: 'cat-restaurants', name: 'Restaurants', color: '#f59e0b', icon: '🍽️', type: 'expense' },
  { id: 'cat-transportation', name: 'Transportation', color: '#3b82f6', icon: '🚗', type: 'expense' },
  { id: 'cat-entertainment', name: 'Entertainment', color: '#8b5cf6', icon: '🎬', type: 'expense' },
  { id: 'cat-shopping', name: 'Shopping', color: '#ec4899', icon: '🛍️', type: 'expense' },
  { id: 'cat-bills', name: 'Bills & Utilities', color: '#ef4444', icon: '📱', type: 'expense' },
  { id: 'cat-healthcare', name: 'Healthcare', color: '#06b6d4', icon: '🏥', type: 'expense' },
  { id: 'cat-education', name: 'Education', color: '#6366f1', icon: '📚', type: 'expense' },
  { id: 'cat-travel', name: 'Travel', color: '#0ea5e9', icon: '✈️', type: 'expense' },
  { id: 'cat-insurance', name: 'Insurance', color: '#84cc16', icon: '🛡️', type: 'expense' },
  { id: 'cat-investments', name: 'Investments', color: '#14b8a6', icon: '📈', type: 'both' },
  { id: 'cat-salary', name: 'Salary', color: '#22c55e', icon: '💰', type: 'income' },
];

// Demo recurring transactions
export const demoRecurringTransactions = [
  {
    id: uuidv4(),
    name: 'Netflix Subscription',
    amount: '-15.99',
    category: 'Entertainment',
    frequency: 'monthly',
    nextDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    accountId: primaryDemoAccountId,
    isActive: true,
  },
  {
    id: uuidv4(),
    name: 'Spotify Premium',
    amount: '-9.99',
    category: 'Entertainment',
    frequency: 'monthly',
    nextDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    accountId: primaryDemoAccountId,
    isActive: true,
  },
  {
    id: uuidv4(),
    name: 'Gym Membership',
    amount: '-49.99',
    category: 'Healthcare',
    frequency: 'monthly',
    nextDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    accountId: primaryDemoAccountId,
    isActive: true,
  },
  {
    id: uuidv4(),
    name: 'Salary',
    amount: '3500.00',
    category: 'Salary',
    frequency: 'monthly',
    nextDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    accountId: primaryDemoAccountId,
    isActive: true,
  },
];

// Demo data provider hook
export const useDemoData = () => {
  if (!isDemoMode()) {
    return null;
  }
  
  return {
    user: demoUser,
    accounts: demoAccounts,
    transactions: generateDemoTransactions(100),
    budgets: demoBudgets,
    goals: demoGoals,
    categories: demoCategories,
    recurringTransactions: demoRecurringTransactions,
  };
};

// Helper to inject demo data into localStorage
export const initializeDemoData = () => {
  if (!isDemoMode()) return;
  
  // Store demo data in localStorage for the app to use
  const demoData = {
    accounts: demoAccounts,
    transactions: generateDemoTransactions(100),
    budgets: demoBudgets,
    goals: demoGoals,
    categories: demoCategories,
    recurringTransactions: demoRecurringTransactions,
  };
  
  localStorage.setItem('demoMode', 'true');
  localStorage.setItem('accounts', JSON.stringify(demoData.accounts));
  localStorage.setItem('transactions', JSON.stringify(demoData.transactions));
  localStorage.setItem('budgets', JSON.stringify(demoData.budgets));
  localStorage.setItem('goals', JSON.stringify(demoData.goals));
  localStorage.setItem('categories', JSON.stringify(demoData.categories));
  localStorage.setItem('recurringTransactions', JSON.stringify(demoData.recurringTransactions));
  
  logger.info('Demo mode initialized with sample data');
};

// Clear demo data
export const clearDemoData = () => {
  localStorage.removeItem('demoMode');
  localStorage.removeItem('accounts');
  localStorage.removeItem('transactions');
  localStorage.removeItem('budgets');
  localStorage.removeItem('goals');
  localStorage.removeItem('categories');
  localStorage.removeItem('recurringTransactions');
  
  logger.info('Demo data cleared');
};
