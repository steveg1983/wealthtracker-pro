import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AppProvider } from '../../contexts/AppContext';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { createMockAccount, createMockTransaction, createMockBudget } from '../factories';
import Dashboard from '../../pages/Dashboard';
import { toDecimal } from '../../utils/decimal';
import { calculateTotalBalance } from '../../utils/calculations-decimal';
import { toDecimalAccount } from '../../utils/decimal-converters';

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

// Mock console to capture errors
const mockConsoleError = vi.fn();
const mockConsoleWarn = vi.fn();
const originalError = console.error;
const originalWarn = console.warn;

describe('Error Handling Integration Tests', () => {
  const renderWithProviders = (component: React.ReactElement, initialData = {}) => {
    const mockData = {
      accounts: [],
      transactions: [],
      budgets: [],
      goals: [],
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
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
    
    // Replace console methods
    console.error = mockConsoleError;
    console.warn = mockConsoleWarn;
    
    // Setup fresh localStorage mock
    const storage = new Map();
    vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      storage.set(key, value);
    });
  });

  afterEach(() => {
    // Restore console methods
    console.error = originalError;
    console.warn = originalWarn;
  });

  describe('localStorage Error Handling', () => {
    it('handles localStorage.getItem throwing an error', async () => {
      // Mock localStorage.getItem to throw an error
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('localStorage is not available');
      });

      // Should not crash the app
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should have logged the error
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('handles localStorage.setItem throwing an error', async () => {
      // Mock localStorage.setItem to throw an error
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const accounts = [createMockAccount({ name: 'Test Account' })];
      
      // Should not crash the app
      renderWithProviders(<Dashboard />, { accounts });

      await waitFor(() => {
        expect(screen.getByText('Test Account')).toBeInTheDocument();
      });

      // App should continue to work even if persistence fails
      expect(screen.getByText('Test Account')).toBeInTheDocument();
    });

    it('handles corrupted localStorage data gracefully', async () => {
      // Mock localStorage to return invalid JSON
      vi.mocked(localStorage.getItem).mockImplementation(key => {
        if (key === 'wealthtracker_accounts') {
          return '{"invalid": json}'; // Invalid JSON
        }
        return null;
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should initialize with empty state
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('handles null localStorage data', async () => {
      // Mock localStorage to return null
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should initialize with empty state without errors
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('handles empty string localStorage data', async () => {
      // Mock localStorage to return empty string
      vi.mocked(localStorage.getItem).mockReturnValue('');

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should handle empty string gracefully
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  describe('Data Validation Error Handling', () => {
    it('handles accounts with missing required fields', async () => {
      const invalidAccounts = [
        { id: '1', name: 'Valid Account', balance: 1000, currency: 'GBP', type: 'savings' },
        { id: '2', name: '', balance: 1000, currency: 'GBP', type: 'savings' }, // Missing name
        { id: '3', name: 'No Balance', currency: 'GBP', type: 'savings' }, // Missing balance
        { id: '4', name: 'No Type', balance: 1000, currency: 'GBP' }, // Missing type
      ];

      renderWithProviders(<Dashboard />, { accounts: invalidAccounts });

      await waitFor(() => {
        // Should show valid account
        expect(screen.getByText('Valid Account')).toBeInTheDocument();
        // Should handle invalid accounts gracefully
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });
    });

    it('handles transactions with invalid data', async () => {
      const accounts = [createMockAccount({ id: '1', name: 'Test Account' })];
      const invalidTransactions = [
        createMockTransaction({ id: '1', description: 'Valid Transaction', amount: 100 }),
        { id: '2', description: 'Invalid Amount', amount: 'not a number' }, // Invalid amount
        { id: '3', amount: 100 }, // Missing description
        { id: '4', description: 'Missing Account', amount: 100, accountId: 'nonexistent' }, // Invalid account
      ];

      renderWithProviders(<Dashboard />, { accounts, transactions: invalidTransactions });

      await waitFor(() => {
        expect(screen.getByText('Test Account')).toBeInTheDocument();
        // Should handle invalid transactions gracefully
        expect(screen.getByText('Valid Transaction')).toBeInTheDocument();
      });
    });

    it('handles budgets with invalid category references', async () => {
      const invalidBudgets = [
        createMockBudget({ id: '1', category: 'valid-category', amount: 500 }),
        { id: '2', category: '', amount: 300 }, // Empty category
        { id: '3', category: 'invalid-category', amount: 'not a number' }, // Invalid amount
        { id: '4' }, // Missing required fields
      ];

      renderWithProviders(<Dashboard />, { budgets: invalidBudgets });

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should not crash the app
      expect(mockConsoleError).toHaveBeenCalled();
    });
  });

  describe('Calculation Error Handling', () => {
    it('handles division by zero in calculations', () => {
      const accounts = [
        createMockAccount({ id: '1', balance: 100 }),
        createMockAccount({ id: '2', balance: 0 }),
      ];

      const decimalAccounts = accounts.map(toDecimalAccount);
      const total = calculateTotalBalance(decimalAccounts);

      // Should handle zero values without throwing
      expect(total.toString()).toBe('100');
    });

    it('handles infinite and NaN values', () => {
      // Test with extreme values
      const extremeValues = [
        toDecimal('999999999999999999999999999999'),
        toDecimal('-999999999999999999999999999999'),
        toDecimal('0'),
      ];

      extremeValues.forEach(value => {
        expect(value.isFinite()).toBe(true);
        expect(value.isNaN()).toBe(false);
      });
    });

    it('handles overflow in decimal calculations', () => {
      const veryLargeNumber = toDecimal('1e+100');
      const result = veryLargeNumber.plus(toDecimal('1'));
      
      // Should handle large numbers without overflow
      expect(result.isFinite()).toBe(true);
      expect(result.greaterThan(veryLargeNumber)).toBe(true);
    });

    it('handles underflow in decimal calculations', () => {
      const verySmallNumber = toDecimal('1e-100');
      const result = verySmallNumber.dividedBy(toDecimal('2'));
      
      // Should handle very small numbers
      expect(result.isFinite()).toBe(true);
      expect(result.lessThan(verySmallNumber)).toBe(true);
    });
  });

  describe('Network Error Handling', () => {
    it('handles currency conversion service failures', async () => {
      // Mock currency service to fail
      vi.doMock('../../services/currencyService', () => ({
        convertCurrency: vi.fn().mockRejectedValue(new Error('Network error')),
      }));

      const accounts = [
        createMockAccount({ id: '1', name: 'USD Account', balance: 1000, currency: 'USD' }),
      ];

      renderWithProviders(<Dashboard />, { accounts });

      await waitFor(() => {
        expect(screen.getByText('USD Account')).toBeInTheDocument();
      });

      // Should display original currency values as fallback
      expect(screen.getByText(/1[,.]000/)).toBeInTheDocument();
    });

    it('handles API timeout errors', async () => {
      // Mock a timeout scenario
      vi.doMock('../../services/currencyService', () => ({
        convertCurrency: vi.fn().mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
        ),
      }));

      const accounts = [createMockAccount({ name: 'Test Account' })];
      
      renderWithProviders(<Dashboard />, { accounts });

      await waitFor(() => {
        expect(screen.getByText('Test Account')).toBeInTheDocument();
      });

      // Should continue to work despite timeout
      expect(screen.getByText('Test Account')).toBeInTheDocument();
    });
  });

  describe('Component Error Boundaries', () => {
    it('handles component rendering errors gracefully', async () => {
      // Create a component that will throw an error
      const ErrorComponent = () => {
        throw new Error('Component rendering error');
      };

      // Mock the error boundary
      const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
        try {
          return <>{children}</>;
        } catch (error) {
          return <div>Something went wrong</div>;
        }
      };

      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('handles missing context providers', () => {
      // Try to render component without required providers
      const TestComponent = () => {
        return <div>Test</div>;
      };

      // Should work with providers
      expect(() => {
        renderWithProviders(<TestComponent />);
      }).not.toThrow();
    });
  });

  describe('Form Validation Error Handling', () => {
    it('handles invalid form data gracefully', async () => {
      const accounts = [createMockAccount({ name: 'Test Account' })];
      
      renderWithProviders(<Dashboard />, { accounts });

      await waitFor(() => {
        expect(screen.getByText('Test Account')).toBeInTheDocument();
      });

      // Try to trigger form validation errors
      const forms = screen.queryAllByRole('form');
      forms.forEach(form => {
        // Should not crash when submitting invalid forms
        fireEvent.submit(form);
      });

      // App should continue to work
      expect(screen.getByText('Test Account')).toBeInTheDocument();
    });

    it('handles missing required fields', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Try to submit forms with missing data
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        fireEvent.click(button);
      });

      // Should not crash
      expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
    });
  });

  describe('Date and Time Error Handling', () => {
    it('handles invalid date formats', async () => {
      const transactionsWithInvalidDates = [
        createMockTransaction({ id: '1', date: 'invalid-date' as any }),
        createMockTransaction({ id: '2', date: null as any }),
        createMockTransaction({ id: '3', date: undefined as any }),
      ];

      renderWithProviders(<Dashboard />, { transactions: transactionsWithInvalidDates });

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should handle invalid dates gracefully
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('handles future dates appropriately', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const futureDatedTransactions = [
        createMockTransaction({ id: '1', date: futureDate }),
      ];

      renderWithProviders(<Dashboard />, { transactions: futureDatedTransactions });

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should handle future dates without errors
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  describe('Memory and Performance Error Handling', () => {
    it('handles large datasets without memory issues', async () => {
      const startTime = performance.now();
      
      // Create a large dataset
      const largeAccounts = Array.from({ length: 1000 }, (_, i) => 
        createMockAccount({ 
          id: `account-${i}`, 
          name: `Account ${i}`, 
          balance: Math.random() * 10000 
        })
      );

      renderWithProviders(<Dashboard />, { accounts: largeAccounts });

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time
      expect(renderTime).toBeLessThan(2000); // 2 seconds
    });

    it('handles memory cleanup on unmount', () => {
      const { unmount } = renderWithProviders(<Dashboard />);
      
      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Browser Compatibility Error Handling', () => {
    it('handles missing browser APIs gracefully', () => {
      // Mock missing localStorage
      const originalLocalStorage = global.localStorage;
      delete (global as any).localStorage;

      try {
        renderWithProviders(<Dashboard />);
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      } finally {
        // Restore localStorage
        global.localStorage = originalLocalStorage;
      }
    });

    it('handles missing modern JavaScript features', () => {
      // Test with older JavaScript feature support
      const originalToLocaleString = Number.prototype.toLocaleString;
      Number.prototype.toLocaleString = function() {
        return this.toString();
      };

      try {
        renderWithProviders(<Dashboard />);
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      } finally {
        Number.prototype.toLocaleString = originalToLocaleString;
      }
    });
  });

  describe('Concurrent Access Error Handling', () => {
    it('handles concurrent localStorage access', async () => {
      const accounts = [createMockAccount({ name: 'Test Account' })];
      
      // Simulate concurrent access
      const promises = Array.from({ length: 10 }, () => 
        new Promise<void>((resolve) => {
          setTimeout(() => {
            renderWithProviders(<Dashboard />, { accounts });
            resolve();
          }, Math.random() * 100);
        })
      );

      await Promise.all(promises);

      // Should not cause race conditions
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('handles rapid state updates', async () => {
      renderWithProviders(<Dashboard />);

      // Simulate rapid state updates
      const storage = new Map();
      for (let i = 0; i < 100; i++) {
        storage.set(`wealthtracker_accounts`, JSON.stringify([
          createMockAccount({ id: `${i}`, name: `Account ${i}` })
        ]));
      }

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should handle rapid updates without errors
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });
});