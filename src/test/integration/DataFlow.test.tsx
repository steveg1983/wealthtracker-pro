import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import { AppProvider, useAppContext } from '../../contexts/AppContext';
import { createMockAccount, createMockTransaction, createMockBudget, createMockGoal } from '../factories';

// Test component to access context directly
const TestComponent = ({ onContextChange }: { onContextChange?: (context: any) => void }) => {
  const context = useAppContext();
  
  React.useEffect(() => {
    if (onContextChange) {
      onContextChange(context);
    }
  }, [context, onContextChange]);

  return (
    <div>
      <div data-testid="accounts-count">{context.accounts.length}</div>
      <div data-testid="transactions-count">{context.transactions.length}</div>
      <div data-testid="budgets-count">{context.budgets.length}</div>
      <div data-testid="goals-count">{context.goals.length}</div>
      <button onClick={() => context.addAccount(createMockAccount({ name: 'New Account' }))}>
        Add Account
      </button>
      <button onClick={() => context.addTransaction(createMockTransaction({ description: 'New Transaction' }))}>
        Add Transaction
      </button>
      <button onClick={() => context.addBudget(createMockBudget({ category: 'test' }))}>
        Add Budget
      </button>
      <button onClick={() => context.addGoal(createMockGoal({ name: 'New Goal' }))}>
        Add Goal
      </button>
    </div>
  );
};

describe('Data Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup localStorage mock
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

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <AppProvider>
        {component}
      </AppProvider>
    );
  };

  describe('Context State Management', () => {
    it('initializes with empty state when no data in localStorage', async () => {
      renderWithProvider(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('accounts-count')).toHaveTextContent('0');
        expect(screen.getByTestId('transactions-count')).toHaveTextContent('0');
        expect(screen.getByTestId('budgets-count')).toHaveTextContent('0');
        expect(screen.getByTestId('goals-count')).toHaveTextContent('0');
      });
    });

    it('loads initial data from localStorage', async () => {
      const accounts = [createMockAccount({ name: 'Test Account' })];
      const transactions = [createMockTransaction({ description: 'Test Transaction' })];
      
      // Pre-populate localStorage
      const storage = new Map();
      storage.set('wealthtracker_accounts', JSON.stringify(accounts));
      storage.set('wealthtracker_transactions', JSON.stringify(transactions));
      
      vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);

      renderWithProvider(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('accounts-count')).toHaveTextContent('1');
        expect(screen.getByTestId('transactions-count')).toHaveTextContent('1');
      });
    });

    it('persists data to localStorage when state changes', async () => {
      const setItemSpy = vi.mocked(localStorage.setItem);
      
      renderWithProvider(<TestComponent />);

      // Add an account
      const addAccountButton = screen.getByText('Add Account');
      fireEvent.click(addAccountButton);

      await waitFor(() => {
        expect(screen.getByTestId('accounts-count')).toHaveTextContent('1');
      });

      // Verify localStorage was updated
      expect(setItemSpy).toHaveBeenCalledWith(
        'wealthtracker_accounts',
        expect.stringContaining('New Account')
      );
    });
  });

  describe('CRUD Operations', () => {
    it('adds accounts correctly', async () => {
      renderWithProvider(<TestComponent />);

      // Initially empty
      expect(screen.getByTestId('accounts-count')).toHaveTextContent('0');

      // Add account
      const addButton = screen.getByText('Add Account');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('accounts-count')).toHaveTextContent('1');
      });
    });

    it('adds transactions correctly', async () => {
      renderWithProvider(<TestComponent />);

      // Add transaction
      const addButton = screen.getByText('Add Transaction');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('transactions-count')).toHaveTextContent('1');
      });
    });

    it('adds budgets correctly', async () => {
      renderWithProvider(<TestComponent />);

      // Add budget
      const addButton = screen.getByText('Add Budget');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('budgets-count')).toHaveTextContent('1');
      });
    });

    it('adds goals correctly', async () => {
      renderWithProvider(<TestComponent />);

      // Add goal
      const addButton = screen.getByText('Add Goal');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('goals-count')).toHaveTextContent('1');
      });
    });
  });

  describe('Data Relationships', () => {
    it('maintains account-transaction relationships', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Checking' }),
        createMockAccount({ id: '2', name: 'Savings' }),
      ];

      const transactions = [
        createMockTransaction({ id: '1', accountId: '1', description: 'Salary' }),
        createMockTransaction({ id: '2', accountId: '2', description: 'Interest' }),
      ];

      // Pre-populate localStorage
      const storage = new Map();
      storage.set('wealthtracker_accounts', JSON.stringify(accounts));
      storage.set('wealthtracker_transactions', JSON.stringify(transactions));
      
      vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);

      let contextData: any;
      const handleContextChange = (context: any) => {
        contextData = context;
      };

      renderWithProvider(<TestComponent onContextChange={handleContextChange} />);

      await waitFor(() => {
        expect(screen.getByTestId('accounts-count')).toHaveTextContent('2');
        expect(screen.getByTestId('transactions-count')).toHaveTextContent('2');
      });

      // Verify relationships are maintained
      expect(contextData.accounts[0].id).toBe('1');
      expect(contextData.transactions[0].accountId).toBe('1');
      expect(contextData.transactions[1].accountId).toBe('2');
    });

    it('maintains budget-transaction category relationships', async () => {
      const transactions = [
        createMockTransaction({ 
          id: '1', 
          category: 'groceries', 
          amount: 150, 
          type: 'expense' 
        }),
        createMockTransaction({ 
          id: '2', 
          category: 'dining', 
          amount: 50, 
          type: 'expense' 
        }),
      ];

      const budgets = [
        createMockBudget({ id: '1', category: 'groceries', amount: 500 }),
        createMockBudget({ id: '2', category: 'dining', amount: 200 }),
      ];

      // Pre-populate localStorage
      const storage = new Map();
      storage.set('wealthtracker_transactions', JSON.stringify(transactions));
      storage.set('wealthtracker_budgets', JSON.stringify(budgets));
      
      vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);

      let contextData: any;
      const handleContextChange = (context: any) => {
        contextData = context;
      };

      renderWithProvider(<TestComponent onContextChange={handleContextChange} />);

      await waitFor(() => {
        expect(screen.getByTestId('transactions-count')).toHaveTextContent('2');
        expect(screen.getByTestId('budgets-count')).toHaveTextContent('2');
      });

      // Verify category relationships
      expect(contextData.transactions[0].category).toBe('groceries');
      expect(contextData.budgets[0].category).toBe('groceries');
    });
  });

  describe('State Consistency', () => {
    it('maintains consistent state across multiple operations', async () => {
      renderWithProvider(<TestComponent />);

      // Perform multiple operations
      const addAccountButton = screen.getByText('Add Account');
      const addTransactionButton = screen.getByText('Add Transaction');
      const addBudgetButton = screen.getByText('Add Budget');

      fireEvent.click(addAccountButton);
      fireEvent.click(addTransactionButton);
      fireEvent.click(addBudgetButton);

      await waitFor(() => {
        expect(screen.getByTestId('accounts-count')).toHaveTextContent('1');
        expect(screen.getByTestId('transactions-count')).toHaveTextContent('1');
        expect(screen.getByTestId('budgets-count')).toHaveTextContent('1');
      });

      // Verify all operations were persisted
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'wealthtracker_accounts',
        expect.any(String)
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'wealthtracker_transactions',
        expect.any(String)
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'wealthtracker_budgets',
        expect.any(String)
      );
    });
  });

  describe('Error Handling', () => {
    it('handles localStorage errors gracefully', async () => {
      // Mock localStorage to throw error
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('Storage full');
      });

      renderWithProvider(<TestComponent />);

      // Should not crash when trying to save
      const addAccountButton = screen.getByText('Add Account');
      fireEvent.click(addAccountButton);

      await waitFor(() => {
        expect(screen.getByTestId('accounts-count')).toHaveTextContent('1');
      });

      // State should still be updated even if persistence fails
      expect(screen.getByTestId('accounts-count')).toHaveTextContent('1');
    });

    it('handles invalid JSON in localStorage', async () => {
      // Mock localStorage to return invalid JSON
      vi.mocked(localStorage.getItem).mockImplementation(key => {
        if (key === 'wealthtracker_accounts') {
          return 'invalid json';
        }
        return null;
      });

      renderWithProvider(<TestComponent />);

      // Should initialize with empty state
      await waitFor(() => {
        expect(screen.getByTestId('accounts-count')).toHaveTextContent('0');
      });
    });
  });

  describe('Performance', () => {
    it('handles frequent state updates efficiently', async () => {
      renderWithProvider(<TestComponent />);

      const startTime = performance.now();

      // Perform many operations quickly
      const addAccountButton = screen.getByText('Add Account');
      
      for (let i = 0; i < 100; i++) {
        fireEvent.click(addAccountButton);
      }

      await waitFor(() => {
        expect(screen.getByTestId('accounts-count')).toHaveTextContent('100');
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(1000); // 1 second
    });
  });

  describe('Data Validation', () => {
    it('validates data integrity during operations', async () => {
      let contextData: any;
      const handleContextChange = (context: any) => {
        contextData = context;
      };

      renderWithProvider(<TestComponent onContextChange={handleContextChange} />);

      // Add account
      const addAccountButton = screen.getByText('Add Account');
      fireEvent.click(addAccountButton);

      await waitFor(() => {
        expect(screen.getByTestId('accounts-count')).toHaveTextContent('1');
      });

      // Verify data structure
      expect(contextData.accounts[0]).toHaveProperty('id');
      expect(contextData.accounts[0]).toHaveProperty('name');
      expect(contextData.accounts[0]).toHaveProperty('balance');
      expect(contextData.accounts[0]).toHaveProperty('type');
    });
  });
});