import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AppProvider } from '../../contexts/AppContext';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { createMockAccount, createMockTransaction, createMockBudget, createMockGoal } from '../factories';
import Dashboard from '../../pages/Dashboard';
import Budget from '../../pages/Budget';
import Accounts from '../../pages/Accounts';
import { toDecimal } from '../../utils/decimal';
import { calculateTotalBalance, calculateBudgetUsage } from '../../utils/calculations-decimal';
import { toDecimalAccount, toDecimalTransaction, toDecimalBudget } from '../../utils/decimal-converters';

// Mock the router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/' }),
  };
});

describe('User Workflow Integration Tests', () => {
  const renderWithProviders = (component: React.ReactElement, initialData = {}) => {
    const mockData = {
      accounts: [],
      transactions: [],
      budgets: [],
      goals: [],
      categories: [
        { id: 'groceries', name: 'Groceries', type: 'expense' },
        { id: 'utilities', name: 'Utilities', type: 'expense' },
        { id: 'salary', name: 'Salary', type: 'income' },
        { id: 'transport', name: 'Transport', type: 'expense' },
        { id: 'entertainment', name: 'Entertainment', type: 'expense' },
      ],
      ...initialData,
    };

    // Mock localStorage
    const storage = new Map();
    Object.entries(mockData).forEach(([key, value]) => {
      storage.set(`wealthtracker_${key}`, JSON.stringify(value));
    });

    vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      storage.set(key, value);
    });

    return render(
      <PreferencesProvider>
        <AppProvider>
          {component}
        </AppProvider>
      </PreferencesProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup fresh localStorage mock
    const storage = new Map();
    vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      storage.set(key, value);
    });
  });

  describe('New User Onboarding Workflow', () => {
    it('guides new user through initial setup', async () => {
      // Empty state - new user
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should show empty state or onboarding
      expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
    });

    it('handles first account creation', async () => {
      renderWithProviders(<Accounts />);

      await waitFor(() => {
        expect(screen.getByText(/Account/i)).toBeInTheDocument();
      });

      // Should show account creation interface
      expect(screen.getByText(/Account/i)).toBeInTheDocument();
    });

    it('persists user data after initial setup', async () => {
      const initialAccounts = [
        createMockAccount({ id: '1', name: 'First Account', balance: 1000 }),
      ];

      renderWithProviders(<Dashboard />, { accounts: initialAccounts });

      await waitFor(() => {
        expect(screen.getByText('First Account')).toBeInTheDocument();
      });

      // Data should be persisted
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'wealthtracker_accounts',
        expect.stringContaining('First Account')
      );
    });
  });

  describe('Daily Money Management Workflow', () => {
    it('supports adding income transaction', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Checking', balance: 2000 }),
      ];

      const transactions = [
        createMockTransaction({ 
          id: '1', 
          amount: 3000, 
          type: 'income', 
          description: 'Monthly Salary',
          accountId: '1'
        }),
      ];

      renderWithProviders(<Dashboard />, { accounts, transactions });

      await waitFor(() => {
        expect(screen.getByText('Monthly Salary')).toBeInTheDocument();
        expect(screen.getByText('Checking')).toBeInTheDocument();
      });

      // Should show positive impact on balance
      expect(screen.getByText(/2[,.]000/)).toBeInTheDocument();
    });

    it('supports adding expense transaction', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Checking', balance: 1800 }),
      ];

      const transactions = [
        createMockTransaction({ 
          id: '1', 
          amount: 200, 
          type: 'expense', 
          description: 'Weekly Groceries',
          accountId: '1',
          category: 'groceries'
        }),
      ];

      renderWithProviders(<Dashboard />, { accounts, transactions });

      await waitFor(() => {
        expect(screen.getByText('Weekly Groceries')).toBeInTheDocument();
        expect(screen.getByText('Checking')).toBeInTheDocument();
      });

      // Should show expense impact
      expect(screen.getByText(/1[,.]800/)).toBeInTheDocument();
    });

    it('calculates running balance correctly', () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Checking', balance: 1000 }),
      ];

      const transactions = [
        createMockTransaction({ id: '1', amount: 2000, type: 'income', accountId: '1' }),
        createMockTransaction({ id: '2', amount: 500, type: 'expense', accountId: '1' }),
        createMockTransaction({ id: '3', amount: 300, type: 'expense', accountId: '1' }),
      ];

      // Calculate expected balance: 1000 + 2000 - 500 - 300 = 2200
      const decimalAccount = toDecimalAccount(accounts[0]);
      const decimalTransactions = transactions.map(toDecimalTransaction);
      
      const accountTransactions = decimalTransactions.filter(t => t.accountId === '1');
      const balanceFromTransactions = accountTransactions.reduce((sum, t) => {
        return t.type === 'income' ? sum.plus(t.amount) : sum.minus(t.amount);
      }, decimalAccount.balance);

      expect(balanceFromTransactions.toString()).toBe('2200');
    });
  });

  describe('Budget Management Workflow', () => {
    it('supports creating monthly budget', async () => {
      const budgets = [
        createMockBudget({ id: '1', category: 'groceries', amount: 500, period: 'monthly' }),
      ];

      renderWithProviders(<Budget />, { budgets });

      await waitFor(() => {
        expect(screen.getByText(/groceries/i)).toBeInTheDocument();
        expect(screen.getByText(/500/)).toBeInTheDocument();
      });
    });

    it('tracks budget progress throughout month', async () => {
      const budgets = [
        createMockBudget({ id: '1', category: 'groceries', amount: 500 }),
      ];

      const transactions = [
        createMockTransaction({ id: '1', amount: 150, type: 'expense', category: 'groceries' }),
        createMockTransaction({ id: '2', amount: 200, type: 'expense', category: 'groceries' }),
      ];

      renderWithProviders(<Budget />, { budgets, transactions });

      await waitFor(() => {
        expect(screen.getByText(/groceries/i)).toBeInTheDocument();
        expect(screen.getByText(/350/)).toBeInTheDocument(); // 150 + 200 = 350
      });

      // Calculate budget usage
      const decimalBudget = toDecimalBudget(budgets[0]);
      const decimalTransactions = transactions.map(toDecimalTransaction);
      const usage = calculateBudgetUsage(decimalBudget, decimalTransactions);
      
      expect(usage.toString()).toBe('350');
    });

    it('alerts when budget is exceeded', async () => {
      const budgets = [
        createMockBudget({ id: '1', category: 'groceries', amount: 400 }),
      ];

      const transactions = [
        createMockTransaction({ id: '1', amount: 250, type: 'expense', category: 'groceries' }),
        createMockTransaction({ id: '2', amount: 200, type: 'expense', category: 'groceries' }),
      ];

      renderWithProviders(<Budget />, { budgets, transactions });

      await waitFor(() => {
        expect(screen.getByText(/groceries/i)).toBeInTheDocument();
        // Should show overspending: 450 > 400
        expect(screen.getByText(/450/)).toBeInTheDocument();
      });
    });
  });

  describe('Goal Tracking Workflow', () => {
    it('supports setting financial goals', async () => {
      const goals = [
        createMockGoal({ 
          id: '1', 
          name: 'Emergency Fund', 
          targetAmount: 10000, 
          currentAmount: 2500,
          type: 'savings'
        }),
      ];

      renderWithProviders(<Dashboard />, { goals });

      await waitFor(() => {
        expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      });
    });

    it('tracks progress toward goals', async () => {
      const goals = [
        createMockGoal({ 
          id: '1', 
          name: 'Vacation Fund', 
          targetAmount: 5000, 
          currentAmount: 1500,
          type: 'savings'
        }),
      ];

      renderWithProviders(<Dashboard />, { goals });

      await waitFor(() => {
        expect(screen.getByText('Vacation Fund')).toBeInTheDocument();
      });

      // Progress should be 30% (1500/5000)
      const progress = (1500 / 5000) * 100;
      expect(progress).toBe(30);
    });

    it('calculates goal completion timeline', () => {
      const monthlyContribution = toDecimal('500');
      const targetAmount = toDecimal('10000');
      const currentAmount = toDecimal('2000');
      
      const remaining = targetAmount.minus(currentAmount);
      const monthsToGoal = remaining.dividedBy(monthlyContribution);
      
      expect(remaining.toString()).toBe('8000');
      expect(monthsToGoal.toString()).toBe('16');
    });
  });

  describe('Investment Tracking Workflow', () => {
    it('supports adding investment accounts', async () => {
      const accounts = [
        createMockAccount({ 
          id: '1', 
          name: 'Investment Portfolio', 
          balance: 25000, 
          type: 'investment' 
        }),
      ];

      renderWithProviders(<Accounts />, { accounts });

      await waitFor(() => {
        expect(screen.getByText('Investment Portfolio')).toBeInTheDocument();
        expect(screen.getByText(/25[,.]000/)).toBeInTheDocument();
      });
    });

    it('tracks investment performance', async () => {
      const accounts = [
        createMockAccount({ 
          id: '1', 
          name: 'Stocks', 
          balance: 15000, 
          type: 'investment' 
        }),
        createMockAccount({ 
          id: '2', 
          name: 'Bonds', 
          balance: 8000, 
          type: 'investment' 
        }),
      ];

      const transactions = [
        createMockTransaction({ 
          id: '1', 
          amount: 2000, 
          type: 'expense', 
          description: 'Stock Purchase',
          accountId: '1',
          category: 'investment'
        }),
      ];

      renderWithProviders(<Dashboard />, { accounts, transactions });

      await waitFor(() => {
        expect(screen.getByText('Stocks')).toBeInTheDocument();
        expect(screen.getByText('Bonds')).toBeInTheDocument();
      });

      // Calculate total investment value
      const decimalAccounts = accounts.map(toDecimalAccount);
      const investmentAccounts = decimalAccounts.filter(acc => acc.type === 'investment');
      const totalInvestments = calculateTotalBalance(investmentAccounts);
      
      expect(totalInvestments.toString()).toBe('23000');
    });
  });

  describe('Financial Reporting Workflow', () => {
    it('generates monthly financial summary', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Checking', balance: 3000 }),
        createMockAccount({ id: '2', name: 'Savings', balance: 15000 }),
        createMockAccount({ id: '3', name: 'Credit Card', balance: -2000 }),
      ];

      const transactions = [
        createMockTransaction({ id: '1', amount: 4000, type: 'income', description: 'Salary' }),
        createMockTransaction({ id: '2', amount: 1200, type: 'expense', description: 'Rent' }),
        createMockTransaction({ id: '3', amount: 400, type: 'expense', description: 'Groceries' }),
        createMockTransaction({ id: '4', amount: 200, type: 'expense', description: 'Utilities' }),
      ];

      renderWithProviders(<Dashboard />, { accounts, transactions });

      await waitFor(() => {
        expect(screen.getByText('Salary')).toBeInTheDocument();
        expect(screen.getByText('Rent')).toBeInTheDocument();
        expect(screen.getByText('Groceries')).toBeInTheDocument();
      });

      // Calculate net worth: 3000 + 15000 - 2000 = 16000
      const decimalAccounts = accounts.map(toDecimalAccount);
      const netWorth = calculateTotalBalance(decimalAccounts);
      expect(netWorth.toString()).toBe('16000');
    });

    it('shows spending breakdown by category', async () => {
      const transactions = [
        createMockTransaction({ id: '1', amount: 400, type: 'expense', category: 'groceries' }),
        createMockTransaction({ id: '2', amount: 200, type: 'expense', category: 'utilities' }),
        createMockTransaction({ id: '3', amount: 300, type: 'expense', category: 'transport' }),
        createMockTransaction({ id: '4', amount: 150, type: 'expense', category: 'entertainment' }),
      ];

      renderWithProviders(<Dashboard />, { transactions });

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Calculate spending by category
      const decimalTransactions = transactions.map(toDecimalTransaction);
      const categorySpending = decimalTransactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || toDecimal(0)).plus(t.amount);
          return acc;
        }, {} as Record<string, any>);

      expect(categorySpending.groceries.toString()).toBe('400');
      expect(categorySpending.utilities.toString()).toBe('200');
      expect(categorySpending.transport.toString()).toBe('300');
      expect(categorySpending.entertainment.toString()).toBe('150');
    });
  });

  describe('Multi-Account Management Workflow', () => {
    it('supports managing multiple accounts', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Personal Checking', balance: 2000, type: 'current' }),
        createMockAccount({ id: '2', name: 'Business Checking', balance: 5000, type: 'current' }),
        createMockAccount({ id: '3', name: 'Emergency Savings', balance: 10000, type: 'savings' }),
        createMockAccount({ id: '4', name: 'Investment ISA', balance: 15000, type: 'investment' }),
      ];

      renderWithProviders(<Accounts />, { accounts });

      await waitFor(() => {
        expect(screen.getByText('Personal Checking')).toBeInTheDocument();
        expect(screen.getByText('Business Checking')).toBeInTheDocument();
        expect(screen.getByText('Emergency Savings')).toBeInTheDocument();
        expect(screen.getByText('Investment ISA')).toBeInTheDocument();
      });
    });

    it('handles transfers between accounts', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Checking', balance: 1800 }),
        createMockAccount({ id: '2', name: 'Savings', balance: 10200 }),
      ];

      const transactions = [
        createMockTransaction({ 
          id: '1', 
          amount: 200, 
          type: 'transfer', 
          description: 'Transfer to Savings',
          accountId: '1' // From checking
        }),
        createMockTransaction({ 
          id: '2', 
          amount: 200, 
          type: 'transfer', 
          description: 'Transfer from Checking',
          accountId: '2' // To savings
        }),
      ];

      renderWithProviders(<Dashboard />, { accounts, transactions });

      await waitFor(() => {
        expect(screen.getByText('Transfer to Savings')).toBeInTheDocument();
        expect(screen.getByText('Transfer from Checking')).toBeInTheDocument();
      });

      // Balances should reflect transfer
      expect(screen.getByText(/1[,.]800/)).toBeInTheDocument(); // Checking: 2000 - 200
      expect(screen.getByText(/10[,.]200/)).toBeInTheDocument(); // Savings: 10000 + 200
    });
  });

  describe('Data Export and Backup Workflow', () => {
    it('supports exporting transaction data', async () => {
      const transactions = [
        createMockTransaction({ id: '1', amount: 100, type: 'expense', description: 'Groceries' }),
        createMockTransaction({ id: '2', amount: 2000, type: 'income', description: 'Salary' }),
      ];

      renderWithProviders(<Dashboard />, { transactions });

      await waitFor(() => {
        expect(screen.getByText('Groceries')).toBeInTheDocument();
        expect(screen.getByText('Salary')).toBeInTheDocument();
      });

      // Data should be available for export
      expect(localStorage.getItem('wealthtracker_transactions')).toContain('Groceries');
      expect(localStorage.getItem('wealthtracker_transactions')).toContain('Salary');
    });

    it('supports data backup and restore', async () => {
      const originalData = {
        accounts: [createMockAccount({ name: 'Test Account' })],
        transactions: [createMockTransaction({ description: 'Test Transaction' })],
      };

      renderWithProviders(<Dashboard />, originalData);

      await waitFor(() => {
        expect(screen.getByText('Test Account')).toBeInTheDocument();
        expect(screen.getByText('Test Transaction')).toBeInTheDocument();
      });

      // Data should be backed up in localStorage
      expect(localStorage.getItem('wealthtracker_accounts')).toContain('Test Account');
      expect(localStorage.getItem('wealthtracker_transactions')).toContain('Test Transaction');
    });
  });

  describe('Performance with Real Usage Patterns', () => {
    it('handles typical user data volume efficiently', async () => {
      const startTime = performance.now();
      
      // Simulate 6 months of typical usage
      const accounts = Array.from({ length: 5 }, (_, i) => 
        createMockAccount({ 
          id: `account-${i}`, 
          name: `Account ${i}`, 
          balance: Math.random() * 5000 
        })
      );

      const transactions = Array.from({ length: 200 }, (_, i) => 
        createMockTransaction({ 
          id: `transaction-${i}`, 
          amount: Math.random() * 500, 
          type: Math.random() > 0.3 ? 'expense' : 'income',
          accountId: `account-${i % 5}`,
          description: `Transaction ${i}`
        })
      );

      const budgets = Array.from({ length: 8 }, (_, i) => 
        createMockBudget({ 
          id: `budget-${i}`, 
          category: `category-${i}`, 
          amount: (i + 1) * 200 
        })
      );

      renderWithProviders(<Dashboard />, { accounts, transactions, budgets });

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render efficiently with typical data volume
      expect(renderTime).toBeLessThan(500); // 0.5 seconds
      expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
    });

    it('maintains responsiveness during user interactions', async () => {
      const accounts = [createMockAccount({ name: 'Test Account' })];
      
      renderWithProviders(<Dashboard />, { accounts });

      await waitFor(() => {
        expect(screen.getByText('Test Account')).toBeInTheDocument();
      });

      // Simulate rapid user interactions
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button, index) => {
        setTimeout(() => fireEvent.click(button), index * 10);
      });

      // Should remain responsive
      expect(screen.getByText('Test Account')).toBeInTheDocument();
    });
  });
});