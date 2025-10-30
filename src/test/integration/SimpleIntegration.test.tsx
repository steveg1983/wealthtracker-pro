import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from '../../contexts/AppContext';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { BudgetProvider } from '../../contexts/BudgetContext';
import { createMockAccount, createMockTransaction, createMockBudget, createMockGoal } from '../factories';
import Dashboard from '../../pages/Dashboard';
import { calculateTotalBalance, calculateBudgetUsage } from '../../utils/calculations';

describe('Simple Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup fresh localStorage mock for each test
    const storage = new Map<string, string>();
    vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      storage.set(key, value);
    });
    vi.mocked(localStorage.removeItem).mockImplementation(key => {
      storage.delete(key);
    });
    vi.mocked(localStorage.clear).mockImplementation(() => {
      storage.clear();
    });
  });

  const renderWithProvider = (component: React.ReactElement, initialData = {}) => {
    const mockData = {
      accounts: [],
      transactions: [],
      budgets: [],
      goals: [],
      ...initialData,
    };

    // Pre-populate localStorage
    const storage = new Map<string, string>();
    Object.entries(mockData).forEach(([key, value]) => {
      storage.set(`wealthtracker_${key}`, JSON.stringify(value));
    });

    vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);

    return render(
      <BrowserRouter>
        <PreferencesProvider>
          <AppProvider>
            <NotificationProvider>
              <BudgetProvider>
                {component}
              </BudgetProvider>
            </NotificationProvider>
          </AppProvider>
        </PreferencesProvider>
      </BrowserRouter>
    );
  };

  describe('Data Flow', () => {
    it('calculates total balance correctly', () => {
      const accounts = [
        createMockAccount({ balance: 1000 }),
        createMockAccount({ balance: 2000 }),
        createMockAccount({ balance: -500 })
      ];

      const total = calculateTotalBalance(accounts);
      expect(total).toBe(2500);
    });

    it('calculates budget usage correctly', () => {
      const budget = createMockBudget({ category: 'groceries', amount: 500 });
      const transactions = [
        createMockTransaction({ category: 'groceries', amount: 150, type: 'expense' }),
        createMockTransaction({ category: 'groceries', amount: 100, type: 'expense' }),
        createMockTransaction({ category: 'utilities', amount: 50, type: 'expense' })
      ];

      const usage = calculateBudgetUsage(budget, transactions);
      expect(usage).toBe(250);
    });
  });

  describe('Component Integration', () => {
    it.skip('renders dashboard with account data', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Test Account', balance: 1000 }),
      ];

      renderWithProvider(<Dashboard />, { accounts });

      await waitFor(() => {
        expect(screen.getByText('Test Account')).toBeInTheDocument();
      });
    });

    it('displays empty state when no data', async () => {
      renderWithProvider(<Dashboard />);

      await waitFor(() => {
        // Dashboard should render without crashing
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });
    });
  });

  describe('Financial Calculations', () => {
    it('maintains decimal precision in calculations', () => {
      const accounts = [
        createMockAccount({ balance: 999.99 }),
        createMockAccount({ balance: 0.01 })
      ];

      const total = calculateTotalBalance(accounts);
      expect(total).toBe(1000.00);
    });

    it('handles budget calculations with precision', () => {
      const budget = createMockBudget({ category: 'groceries', amount: 100 });
      const transactions = [
        createMockTransaction({ category: 'groceries', amount: 33.33, type: 'expense' }),
        createMockTransaction({ category: 'groceries', amount: 66.67, type: 'expense' })
      ];

      const usage = calculateBudgetUsage(budget, transactions);
      expect(usage).toBe(100.00);
    });
  });

  describe('Error Handling', () => {
    it('handles missing data gracefully', async () => {
      // Mock localStorage to return null
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      renderWithProvider(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });
    });

    it('handles invalid JSON gracefully', async () => {
      // Mock localStorage to return invalid JSON
      vi.mocked(localStorage.getItem).mockImplementation(key => {
        if (key === 'wealthtracker_accounts') {
          return 'invalid json';
        }
        return null;
      });

      renderWithProvider(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Relationships', () => {
    it('maintains account-transaction relationships', () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Checking' }),
        createMockAccount({ id: '2', name: 'Savings' }),
      ];

      const transactions = [
        createMockTransaction({ id: '1', accountId: '1', description: 'Salary' }),
        createMockTransaction({ id: '2', accountId: '2', description: 'Interest' }),
      ];

      // Find transactions for account 1
      const account1Transactions = transactions.filter(t => t.accountId === '1');
      expect(account1Transactions).toHaveLength(1);
      expect(account1Transactions[0].description).toBe('Salary');
    });

    it('maintains budget-category relationships', () => {
      const budget = createMockBudget({ category: 'groceries' });
      const transactions = [
        createMockTransaction({ category: 'groceries', amount: 100, type: 'expense' }),
        createMockTransaction({ category: 'dining', amount: 50, type: 'expense' }),
      ];

      const groceryTransactions = transactions.filter(t => t.category === budget.categoryId);
      expect(groceryTransactions).toHaveLength(1);
      expect(groceryTransactions[0].amount).toBe(100);
    });
  });
});