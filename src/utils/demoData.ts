/**
 * Demo data for UI/UX testing without authentication
 * This provides realistic sample data for testing the interface
 */

import { v4 as uuidv4 } from 'uuid';
import { toDecimal } from './decimal';
import { createScopedLogger } from '../loggers/scopedLogger';
import { isDemoModeRuntimeAllowed } from './runtimeMode';
import { storageAdapter, STORAGE_KEYS } from '../services/storageAdapter';
import { isMnyLocalImportRequested } from './mnyLocalImport';

export { isDemoModeRuntimeAllowed } from './runtimeMode';

const demoLogger = createScopedLogger('DemoData');

// Check if we're in demo mode
export const isDemoMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (!isDemoModeRuntimeAllowed(import.meta.env)) {
    return false;
  }
  return new URLSearchParams(window.location.search).get('demo') === 'true';
};

// Demo accounts.
//
// The ids are FIXED, not uuidv4(). They are minted at module scope, so a
// generated id changed on every page load — and anything the app keys by
// account id (the archive manager's per-account overrides, saved balances,
// bookmarked /accounts/:id links) silently pointed at an account that no
// longer existed. Demo sessions should behave like real ones, where an
// account keeps its identity.
export const demoAccounts = [
  {
    id: 'demo-account-checking',
    name: 'Main Checking',
    type: 'checking',
    balance: 5234.56,
    currency: 'USD',
    institution: 'Demo Bank',
    accountNumber: '****1234',
    isActive: true,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-account-savings',
    name: 'Savings Account',
    type: 'savings',
    balance: 25000.00,
    currency: 'USD',
    institution: 'Demo Bank',
    accountNumber: '****5678',
    isActive: true,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-account-investment',
    name: 'Investment Portfolio',
    type: 'investment',
    balance: 45678.90,
    currency: 'USD',
    institution: 'Demo Investments',
    accountNumber: '****9012',
    isActive: true,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date().toISOString(),
    holdings: [
      {
        id: 'demo-holding-aapl',
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
        id: 'demo-holding-googl',
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
        id: 'demo-holding-msft',
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
        id: 'demo-holding-vti',
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
        id: 'demo-holding-bnd',
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
        id: 'demo-holding-cash',
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
    id: 'demo-account-credit',
    name: 'Credit Card',
    type: 'credit',
    balance: -2345.67,
    currency: 'USD',
    institution: 'Demo Credit',
    accountNumber: '****3456',
    isActive: true,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date().toISOString(),
  },
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
    const randomAmount = Math.random() * (isExpense ? 500 : 3000) + (isExpense ? 10 : 1000);
    const signedAmount = isExpense ? -randomAmount : randomAmount;
    // amount MUST be a number (Transaction.amount: number). The old
    // formatDecimal string here poisoned every `sum + t.amount` reduce in the
    // app into string concatenation, crashing pages with DecimalError.
    const amount = toDecimal(signedAmount).toDecimalPlaces(2).toNumber();
    
    // Get expense categories or income category
    const expenseCategories = demoCategories.filter(c => c.type === 'expense');
    const incomeCategory = demoCategories.find(c => c.type === 'income');
    
    const categoryObj = isExpense 
      ? expenseCategories[Math.floor(Math.random() * expenseCategories.length)]
      : incomeCategory;
    
    const category = categoryObj?.id || 'cat-other';
    const categoryName = categoryObj?.name || 'Other';
    
    transactions.push({
      id: uuidv4(),
      date: date.toISOString().split('T')[0],
      description: transactionDescriptions[Math.floor(Math.random() * transactionDescriptions.length)],
      amount,
      category,
      categoryName,
      accountId: demoAccounts[Math.floor(Math.random() * demoAccounts.length)].id,
      type: signedAmount < 0 ? 'expense' : 'income',
      isRecurring: Math.random() > 0.9,
      isPending: Math.random() > 0.95,
      tags: Math.random() > 0.7 ? ['tagged'] : [],
      notes: Math.random() > 0.8 ? 'Sample transaction note' : '',
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
    });
  }
  
  return transactions.sort((a, b) => b.date.localeCompare(a.date));
};

// Demo budgets
export const demoBudgets = [
  {
    id: 'demo-budget-groceries',
    name: 'Monthly Expenses',
    category: 'Groceries',
    amount: 600.00,
    spent: 423.50,
    period: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: null,
    isActive: true,
  },
  {
    id: 'demo-budget-dining',
    name: 'Dining Out',
    category: 'Restaurants',
    amount: 400.00,
    spent: 312.75,
    period: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: null,
    isActive: true,
  },
  {
    id: 'demo-budget-entertainment',
    name: 'Entertainment',
    category: 'Entertainment',
    amount: 200.00,
    spent: 145.00,
    period: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: null,
    isActive: true,
  },
  {
    id: 'demo-budget-transport',
    name: 'Transportation',
    category: 'Transportation',
    amount: 300.00,
    spent: 389.00,
    period: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: null,
    isActive: true,
  },
];

// Demo goals
export const demoGoals = [
  {
    id: 'demo-goal-emergency-fund',
    name: 'Emergency Fund',
    targetAmount: 10000.00,
    currentAmount: 6500.00,
    deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    type: 'savings',
    category: 'savings',
    priority: 'high',
    isActive: true,
  },
  {
    id: 'demo-goal-vacation',
    name: 'Vacation Fund',
    targetAmount: 5000.00,
    currentAmount: 2100.00,
    deadline: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    type: 'savings',
    category: 'travel',
    priority: 'medium',
    isActive: true,
  },
  {
    id: 'demo-goal-new-car',
    name: 'New Car Down Payment',
    targetAmount: 8000.00,
    currentAmount: 3200.00,
    deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    type: 'savings',
    category: 'purchase',
    priority: 'low',
    isActive: true,
  },
];

// Demo categories with colors
export const demoCategories = [
  // Type-level parents — the category selector builds its sub-category list
  // from getSubCategories(`type-${type}`), so these parents must exist and the
  // leaf categories must point at them via parentId/level (matching the real
  // category hierarchy in getDefaultCategories).
  { id: 'type-income', name: 'Income', color: '#22c55e', icon: '💰', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expense', color: '#ef4444', icon: '💸', type: 'expense', level: 'type', isSystem: true },
  { id: 'type-transfer', name: 'Transfer', color: '#6b7280', icon: '🔄', type: 'both', level: 'type', isSystem: true },

  { id: 'cat-groceries', name: 'Groceries', color: '#10b981', icon: '🛒', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-restaurants', name: 'Restaurants', color: '#f59e0b', icon: '🍽️', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-transportation', name: 'Transportation', color: '#3b82f6', icon: '🚗', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-entertainment', name: 'Entertainment', color: '#8b5cf6', icon: '🎬', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-shopping', name: 'Shopping', color: '#ec4899', icon: '🛍️', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-bills', name: 'Bills & Utilities', color: '#ef4444', icon: '📱', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-healthcare', name: 'Healthcare', color: '#06b6d4', icon: '🏥', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-education', name: 'Education', color: '#6366f1', icon: '📚', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-travel', name: 'Travel', color: '#0ea5e9', icon: '✈️', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-insurance', name: 'Insurance', color: '#84cc16', icon: '🛡️', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-investments', name: 'Investments', color: '#14b8a6', icon: '📈', type: 'both', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-salary', name: 'Salary', color: '#22c55e', icon: '💰', type: 'income', level: 'sub', parentId: 'type-income' },

  // Detail-level leaves — the transaction modal requires drilling
  // type → sub → detail, so each sub needs at least one detail child for the
  // add-transaction flow to complete.
  { id: 'det-groceries-food', name: 'Food & Drink', type: 'expense', level: 'detail', parentId: 'cat-groceries' },
  { id: 'det-restaurants-dining', name: 'Dining Out', type: 'expense', level: 'detail', parentId: 'cat-restaurants' },
  { id: 'det-transport-fuel', name: 'Fuel', type: 'expense', level: 'detail', parentId: 'cat-transportation' },
  { id: 'det-entertainment-streaming', name: 'Streaming', type: 'expense', level: 'detail', parentId: 'cat-entertainment' },
  { id: 'det-shopping-clothing', name: 'Clothing', type: 'expense', level: 'detail', parentId: 'cat-shopping' },
  { id: 'det-bills-utilities', name: 'Utilities', type: 'expense', level: 'detail', parentId: 'cat-bills' },
  { id: 'det-healthcare-medical', name: 'Medical', type: 'expense', level: 'detail', parentId: 'cat-healthcare' },
  { id: 'det-education-courses', name: 'Courses', type: 'expense', level: 'detail', parentId: 'cat-education' },
  { id: 'det-travel-flights', name: 'Flights', type: 'expense', level: 'detail', parentId: 'cat-travel' },
  { id: 'det-insurance-premiums', name: 'Premiums', type: 'expense', level: 'detail', parentId: 'cat-insurance' },
  { id: 'det-investments-contributions', name: 'Contributions', type: 'both', level: 'detail', parentId: 'cat-investments' },
  { id: 'det-salary-regular', name: 'Regular Salary', type: 'income', level: 'detail', parentId: 'cat-salary' },
];

// Demo recurring transactions
export const demoRecurringTransactions = [
  {
    id: 'demo-recurring-netflix',
    name: 'Netflix Subscription',
    amount: -15.99,
    category: 'Entertainment',
    frequency: 'monthly',
    nextDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    accountId: demoAccounts[0].id,
    isActive: true,
  },
  {
    id: 'demo-recurring-spotify',
    name: 'Spotify Premium',
    amount: -9.99,
    category: 'Entertainment',
    frequency: 'monthly',
    nextDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    accountId: demoAccounts[0].id,
    isActive: true,
  },
  {
    id: 'demo-recurring-gym',
    name: 'Gym Membership',
    amount: -49.99,
    category: 'Healthcare',
    frequency: 'monthly',
    nextDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    accountId: demoAccounts[0].id,
    isActive: true,
  },
  {
    id: 'demo-recurring-salary',
    name: 'Salary',
    amount: 3500.00,
    category: 'Salary',
    frequency: 'monthly',
    nextDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    accountId: demoAccounts[0].id,
    isActive: true,
  },
];

/**
 * Seed the demo sample data, through the SAME storage the app reads from.
 *
 * This used to write the wealthtracker_* keys straight into localStorage and
 * then clear the `wt_migration_completed` flag, on the understanding that
 * storageAdapter would carry them into encrypted IndexedDB on its next init.
 * Nothing in the app ever calls storageAdapter.init(), so that migration never
 * ran and the flag meant nothing: the seed was only ever visible through the
 * adapter's "not in IndexedDB, so try localStorage" fallback. The moment
 * IndexedDB held any value for one of those keys — an empty array, which
 * Settings → Data Management → Clear All Data is enough to produce — the
 * fallback stopped being consulted, and demo mode was empty forever no matter
 * how many times the page was reloaded with ?demo=true.
 *
 * Going through storageAdapter puts the seed exactly where the reads look, and
 * keeps the localStorage fallback for browsers where IndexedDB is unavailable
 * (the adapter already falls back on write). AppContext awaits this before its
 * first read, so seeding and loading can no longer race.
 */
export const initializeDemoData = async (): Promise<void> => {
  if (!isDemoMode()) return;
  // The DEV-only Money import seeds the same keys from a real file and reloads
  // the page itself. Sample data would only fight it.
  if (isMnyLocalImportRequested()) return;

  localStorage.setItem('demoMode', 'true');

  // Only seed when there is nothing to show. A demo session that has been used
  // holds the visitor's own edits, and a reload must not throw those away —
  // which is also what makes the fixed account ids above worth having.
  const existingAccounts = await storageAdapter.get<unknown[]>(STORAGE_KEYS.ACCOUNTS);
  if (Array.isArray(existingAccounts) && existingAccounts.length > 0) {
    return;
  }

  await Promise.all([
    storageAdapter.set(STORAGE_KEYS.ACCOUNTS, demoAccounts),
    storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, generateDemoTransactions(100)),
    storageAdapter.set(STORAGE_KEYS.BUDGETS, demoBudgets),
    storageAdapter.set(STORAGE_KEYS.GOALS, demoGoals),
    storageAdapter.set(STORAGE_KEYS.CATEGORIES, demoCategories),
    storageAdapter.set(STORAGE_KEYS.RECURRING, demoRecurringTransactions),
  ]);

  demoLogger.info('Demo mode seeded with sample data');
};
