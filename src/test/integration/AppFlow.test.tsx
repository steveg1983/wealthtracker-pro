import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import { AppProvider } from '../../contexts/AppContext';
import App from '../../App';
import { createMockAccount, createMockTransaction, createMockBudget, createMockGoal } from '../factories';

// Mock the navigation hook
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Helper to render the app with providers
const renderApp = (initialData = {}) => {
  const mockData = {
    accounts: [],
    transactions: [],
    budgets: [],
    goals: [],
    ...initialData,
  };

  // Mock localStorage with initial data
  const storage = new Map();
  storage.set('wealthtracker_accounts', JSON.stringify(mockData.accounts));
  storage.set('wealthtracker_transactions', JSON.stringify(mockData.transactions));
  storage.set('wealthtracker_budgets', JSON.stringify(mockData.budgets));
  storage.set('wealthtracker_goals', JSON.stringify(mockData.goals));

  vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);
  vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
    storage.set(key, value);
  });

  return render(
    <AppProvider>
      <App />
    </AppProvider>
  );
};

describe('App Integration Tests', () => {
  beforeEach(() => {
    // Clear localStorage mock
    vi.clearAllMocks();
    const storage = new Map();
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

  describe('Dashboard Integration', () => {
    it('displays account balances and recent transactions', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Savings', balance: 5000 }),
        createMockAccount({ id: '2', name: 'Checking', balance: 2000 }),
      ];
      
      const transactions = [
        createMockTransaction({ id: '1', description: 'Salary', amount: 3000, type: 'income' }),
        createMockTransaction({ id: '2', description: 'Groceries', amount: 150, type: 'expense' }),
      ];

      renderApp({ accounts, transactions });

      // Check if dashboard shows account balances
      await waitFor(() => {
        expect(screen.getByText('Savings')).toBeInTheDocument();
        expect(screen.getByText('Checking')).toBeInTheDocument();
      });

      // Check if recent transactions are displayed
      await waitFor(() => {
        expect(screen.getByText('Salary')).toBeInTheDocument();
        expect(screen.getByText('Groceries')).toBeInTheDocument();
      });
    });

    it('calculates and displays net worth correctly', async () => {
      const accounts = [
        createMockAccount({ id: '1', balance: 5000 }),
        createMockAccount({ id: '2', balance: -1000 }), // liability
      ];

      renderApp({ accounts });

      // Net worth should be 5000 - 1000 = 4000
      await waitFor(() => {
        expect(screen.getByText(/4[,.]000/)).toBeInTheDocument();
      });
    });
  });

  describe('Account Management Flow', () => {
    it('allows creating and managing accounts', async () => {
      renderApp();

      // Navigate to accounts page
      const accountsLink = screen.getByText('Accounts');
      fireEvent.click(accountsLink);

      // Look for add account button
      await waitFor(() => {
        const addButton = screen.getByText(/Add Account/i);
        expect(addButton).toBeInTheDocument();
      });

      // Test account creation flow
      const addButton = screen.getByText(/Add Account/i);
      fireEvent.click(addButton);

      // Fill out account form
      const nameInput = screen.getByLabelText(/Account Name/i);
      const balanceInput = screen.getByLabelText(/Balance/i);
      
      fireEvent.change(nameInput, { target: { value: 'Test Account' } });
      fireEvent.change(balanceInput, { target: { value: '1000' } });

      // Submit form
      const submitButton = screen.getByText(/Save/i);
      fireEvent.click(submitButton);

      // Verify account was created
      await waitFor(() => {
        expect(screen.getByText('Test Account')).toBeInTheDocument();
      });
    });
  });

  describe('Transaction Management Flow', () => {
    it('allows creating and categorizing transactions', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Checking', balance: 2000 }),
      ];

      renderApp({ accounts });

      // Navigate to transactions page
      const transactionsLink = screen.getByText('Transactions');
      fireEvent.click(transactionsLink);

      // Look for add transaction button
      await waitFor(() => {
        const addButton = screen.getByText(/Add Transaction/i);
        expect(addButton).toBeInTheDocument();
      });

      // Test transaction creation
      const addButton = screen.getByText(/Add Transaction/i);
      fireEvent.click(addButton);

      // Fill out transaction form
      const descriptionInput = screen.getByLabelText(/Description/i);
      const amountInput = screen.getByLabelText(/Amount/i);
      
      fireEvent.change(descriptionInput, { target: { value: 'Coffee' } });
      fireEvent.change(amountInput, { target: { value: '5.50' } });

      // Submit form
      const submitButton = screen.getByText(/Save/i);
      fireEvent.click(submitButton);

      // Verify transaction was created
      await waitFor(() => {
        expect(screen.getByText('Coffee')).toBeInTheDocument();
      });
    });
  });

  describe('Budget Management Flow', () => {
    it('creates budgets and tracks spending', async () => {
      const transactions = [
        createMockTransaction({ 
          id: '1', 
          description: 'Grocery Store', 
          amount: 150, 
          type: 'expense',
          category: 'groceries' 
        }),
      ];

      renderApp({ transactions });

      // Navigate to budget page
      const budgetLink = screen.getByText('Budget');
      fireEvent.click(budgetLink);

      // Look for add budget button
      await waitFor(() => {
        const addButton = screen.getByText(/Add Budget/i);
        expect(addButton).toBeInTheDocument();
      });

      // Create a budget
      const addButton = screen.getByText(/Add Budget/i);
      fireEvent.click(addButton);

      // Fill out budget form
      const amountInput = screen.getByLabelText(/Amount/i);
      fireEvent.change(amountInput, { target: { value: '500' } });

      // Submit form
      const submitButton = screen.getByText(/Save/i);
      fireEvent.click(submitButton);

      // Verify budget shows spending progress
      await waitFor(() => {
        expect(screen.getByText(/groceries/i)).toBeInTheDocument();
        expect(screen.getByText(/150/)).toBeInTheDocument(); // spent amount
        expect(screen.getByText(/500/)).toBeInTheDocument(); // budget amount
      });
    });
  });

  describe('Goal Tracking Flow', () => {
    it('creates and tracks financial goals', async () => {
      renderApp();

      // Navigate to goals page
      const goalsLink = screen.getByText('Goals');
      fireEvent.click(goalsLink);

      // Look for add goal button
      await waitFor(() => {
        const addButton = screen.getByText(/Add Goal/i);
        expect(addButton).toBeInTheDocument();
      });

      // Create a goal
      const addButton = screen.getByText(/Add Goal/i);
      fireEvent.click(addButton);

      // Fill out goal form
      const nameInput = screen.getByLabelText(/Goal Name/i);
      const targetInput = screen.getByLabelText(/Target Amount/i);
      
      fireEvent.change(nameInput, { target: { value: 'Emergency Fund' } });
      fireEvent.change(targetInput, { target: { value: '10000' } });

      // Submit form
      const submitButton = screen.getByText(/Save/i);
      fireEvent.click(submitButton);

      // Verify goal was created
      await waitFor(() => {
        expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
        expect(screen.getByText(/10[,.]000/)).toBeInTheDocument();
      });
    });
  });

  describe('Data Persistence', () => {
    it('persists data across app reloads', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Savings', balance: 5000 }),
      ];

      // First render with data
      const { unmount } = renderApp({ accounts });
      
      await waitFor(() => {
        expect(screen.getByText('Savings')).toBeInTheDocument();
      });

      // Unmount and re-render to simulate app reload
      unmount();
      renderApp();

      // Data should persist
      await waitFor(() => {
        expect(screen.getByText('Savings')).toBeInTheDocument();
      });
    });
  });

  describe('Calculation Accuracy', () => {
    it('maintains decimal precision in financial calculations', async () => {
      const accounts = [
        createMockAccount({ id: '1', balance: 999.99 }),
        createMockAccount({ id: '2', balance: 0.01 }),
      ];

      renderApp({ accounts });

      // Net worth should be exactly 1000.00
      await waitFor(() => {
        expect(screen.getByText(/1[,.]000\.00/)).toBeInTheDocument();
      });
    });

    it('handles budget calculations with precision', async () => {
      const transactions = [
        createMockTransaction({ 
          amount: 33.33, 
          type: 'expense',
          category: 'groceries' 
        }),
        createMockTransaction({ 
          amount: 66.67, 
          type: 'expense',
          category: 'groceries' 
        }),
      ];

      const budgets = [
        createMockBudget({ category: 'groceries', amount: 100 }),
      ];

      renderApp({ transactions, budgets });

      // Navigate to budget page
      const budgetLink = screen.getByText('Budget');
      fireEvent.click(budgetLink);

      // Should show exactly 100% usage (33.33 + 66.67 = 100.00)
      await waitFor(() => {
        expect(screen.getByText(/100%/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles localStorage errors gracefully', async () => {
      // Mock localStorage to throw errors
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('Storage error');
      });

      // App should still render without crashing
      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });
    });

    it('handles invalid transaction data gracefully', async () => {
      const invalidTransactions = [
        { id: '1', description: 'Invalid', amount: 'not-a-number' },
      ];

      // Should not crash the app
      renderApp({ transactions: invalidTransactions });

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });
    });
  });
});