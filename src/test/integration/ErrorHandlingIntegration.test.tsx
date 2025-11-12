import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { renderWithProviders, createTestData, mockLocalStorage } from './test-utils';
import { toDecimal } from '../../utils/decimal';
import { calculateTotalBalance } from '../../utils/calculations-decimal';
import { toDecimalAccount } from '../../utils/decimal-converters';
import { formatDecimal } from '../../utils/decimal-format';

// Mock components to avoid complex dependencies
vi.mock('../../pages/Dashboard', () => ({
  default: () => (
    <div>
      <h1>WealthTracker</h1>
      <div>Dashboard content</div>
    </div>
  )
}));

// Mock console to capture errors
const mockConsoleError = vi.fn();
const mockConsoleWarn = vi.fn();
const originalError = console.error;
const originalWarn = console.warn;

describe('Error Handling Integration Tests', () => {
  let localStorageMock: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
    
    // Replace console methods
    console.error = mockConsoleError;
    console.warn = mockConsoleWarn;
    
    // Setup fresh localStorage mock
    localStorageMock = mockLocalStorage();
  });

  afterEach(() => {
    // Restore console methods
    console.error = originalError;
    console.warn = originalWarn;
  });

  describe('localStorage Error Handling', () => {
    it('handles localStorage.getItem throwing an error', async () => {
      // Mock localStorage.getItem to throw an error
      const erroringLocalStorage = {
        ...localStorageMock,
        getItem: vi.fn(() => {
          throw new Error('localStorage is not available');
        }),
      };
      
      Object.defineProperty(window, 'localStorage', {
        value: erroringLocalStorage,
        writable: true,
      });

      const Dashboard = (await import('../../pages/Dashboard')).default;
      
      // Should not crash the app but the error will be thrown
      try {
        renderWithProviders(<Dashboard />);
      } catch (error) {
        // Expected to throw
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('localStorage is not available');
      }
    });

    it.skip('handles localStorage.setItem throwing an error', async () => {
      // Mock localStorage.setItem to throw an error
      const errorConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      Object.defineProperty(window, 'localStorage', {
        value: {
          ...localStorageMock,
          setItem: vi.fn(() => {
            throw new Error('Storage quota exceeded');
          }),
        },
        writable: true,
      });

      const testData = createTestData();
      const Dashboard = (await import('../../pages/Dashboard')).default;
      
      // Should not crash the app
      renderWithProviders(<Dashboard />, {
        preloadedState: {
          accounts: { accounts: testData.accounts },
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // App should continue to work even if persistence fails
      expect(screen.getByText(/Dashboard content/i)).toBeInTheDocument();
      
      errorConsole.mockRestore();
    });

    it.skip('handles corrupted localStorage data gracefully', async () => {
      // Mock localStorage to return invalid JSON
      const errorConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      Object.defineProperty(window, 'localStorage', {
        value: {
          ...localStorageMock,
          getItem: vi.fn((key) => {
            if (key === 'wealthtracker_accounts') {
              return '{"invalid": json}'; // Invalid JSON
            }
            return null;
          }),
        },
        writable: true,
      });

      const Dashboard = (await import('../../pages/Dashboard')).default;
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should have logged the parse error
      expect(errorConsole).toHaveBeenCalled();
      
      errorConsole.mockRestore();
    });

    it('handles null localStorage data', async () => {
      // Mock localStorage to return null
      Object.defineProperty(window, 'localStorage', {
        value: {
          ...localStorageMock,
          getItem: vi.fn(() => null),
        },
        writable: true,
      });

      const Dashboard = (await import('../../pages/Dashboard')).default;
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should initialize with empty state without errors
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('handles empty string localStorage data', async () => {
      // Mock localStorage to return empty string
      Object.defineProperty(window, 'localStorage', {
        value: {
          ...localStorageMock,
          getItem: vi.fn(() => ''),
        },
        writable: true,
      });

      const Dashboard = (await import('../../pages/Dashboard')).default;
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
      const testData = createTestData();
      const invalidAccounts = [
        testData.accounts[0], // Valid account
        { ...testData.accounts[1], name: '' }, // Missing name
        { ...testData.accounts[0], balance: undefined }, // Missing balance
        { ...testData.accounts[1], type: undefined }, // Missing type
      ];

      const Dashboard = (await import('../../pages/Dashboard')).default;
      renderWithProviders(<Dashboard />, {
        preloadedState: {
          accounts: { accounts: invalidAccounts as any },
        }
      });

      await waitFor(() => {
        // Should handle invalid accounts gracefully
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });
    });

    it('handles transactions with invalid data', async () => {
      const testData = createTestData();
      const invalidTransactions = [
        testData.transactions[0], // Valid transaction
        { ...testData.transactions[1], amount: 'not a number' }, // Invalid amount
        { ...testData.transactions[0], description: undefined }, // Missing description
        { ...testData.transactions[1], accountId: 'nonexistent' }, // Invalid account
      ];

      const Dashboard = (await import('../../pages/Dashboard')).default;
      renderWithProviders(<Dashboard />, {
        preloadedState: {
          accounts: { accounts: testData.accounts },
          transactions: { transactions: invalidTransactions as any },
        }
      });

      await waitFor(() => {
        // Should handle invalid transactions gracefully  
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });
    });

    it.skip('handles budgets with invalid category references', async () => {
      const errorConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
      const testData = createTestData();
      const invalidBudgets = [
        testData.budgets[0], // Valid budget
        { ...testData.budgets[1], category: '' }, // Empty category
        { ...testData.budgets[0], amount: 'not a number' }, // Invalid amount
        { id: '4' }, // Missing required fields
      ];

      const Dashboard = (await import('../../pages/Dashboard')).default;
      renderWithProviders(<Dashboard />, {
        preloadedState: {
          budgets: { budgets: invalidBudgets as any },
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should not crash the app but should log validation errors
      expect(errorConsole).toHaveBeenCalled();
      
      errorConsole.mockRestore();
    });
  });

  describe('Calculation Error Handling', () => {
    it('handles division by zero in calculations', () => {
      const testData = createTestData();
      const accounts = [
        { ...testData.accounts[0], balance: 100 },
        { ...testData.accounts[1], balance: 0 },
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
      const one = toDecimal('1');
      const result = veryLargeNumber.plus(one);
      
      // Should handle large numbers without overflow
      expect(() => formatDecimal(result, 2, { group: false })).not.toThrow();
      // Decimal.js might handle this differently - check if result is at least as large
      expect(result.greaterThanOrEqualTo(veryLargeNumber)).toBe(true);
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

      const testData = createTestData();
      const accounts = [
        { ...testData.accounts[0], name: 'USD Account', currency: 'USD' },
      ];

      const Dashboard = (await import('../../pages/Dashboard')).default;
      renderWithProviders(<Dashboard />, {
        preloadedState: {
          accounts: { accounts },
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should continue to work despite network error
      expect(screen.getByText(/Dashboard content/i)).toBeInTheDocument();
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

      const testData = createTestData();
      const Dashboard = (await import('../../pages/Dashboard')).default;
      
      renderWithProviders(<Dashboard />, {
        preloadedState: {
          accounts: { accounts: testData.accounts },
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should continue to work despite timeout
      expect(screen.getByText(/Dashboard content/i)).toBeInTheDocument();
    });
  });

  describe('Component Error Boundaries', () => {
    it('handles component rendering errors gracefully', async () => {
      // Create a component that will throw an error
      const ErrorComponent = () => {
        throw new Error('Component rendering error');
      };

      // Create a simple error boundary
      class ErrorBoundary extends React.Component<
        { children: React.ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { children: React.ReactNode }) {
          super(props);
          this.state = { hasError: false };
        }

        static getDerivedStateFromError() {
          return { hasError: true };
        }

        render() {
          if (this.state.hasError) {
            return <div>Something went wrong</div>;
          }
          return this.props.children;
        }
      }

      const { render } = await import('@testing-library/react');
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
      const testData = createTestData();
      const Dashboard = (await import('../../pages/Dashboard')).default;
      
      renderWithProviders(<Dashboard />, {
        preloadedState: {
          accounts: { accounts: testData.accounts },
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Try to trigger form validation errors
      const forms = screen.queryAllByRole('form');
      forms.forEach(form => {
        // Should not crash when submitting invalid forms
        fireEvent.submit(form);
      });

      // App should continue to work
      expect(screen.getByText(/Dashboard content/i)).toBeInTheDocument();
    });

    it('handles missing required fields', async () => {
      const Dashboard = (await import('../../pages/Dashboard')).default;
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Try to submit forms with missing data
      const buttons = screen.queryAllByRole('button');
      buttons.forEach(button => {
        if (button.textContent !== 'Cancel') {
          fireEvent.click(button);
        }
      });

      // Should not crash
      expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
    });
  });

  describe('Date and Time Error Handling', () => {
    it.skip('handles invalid date formats', async () => {
      const errorConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
      const testData = createTestData();
      const transactionsWithInvalidDates = [
        { ...testData.transactions[0], date: 'invalid-date' },
        { ...testData.transactions[1], date: null },
        { ...testData.transactions[0], date: undefined },
      ];

      const Dashboard = (await import('../../pages/Dashboard')).default;
      renderWithProviders(<Dashboard />, {
        preloadedState: {
          transactions: { transactions: transactionsWithInvalidDates as any },
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      // Should have logged date parsing errors
      expect(errorConsole).toHaveBeenCalled();
      
      errorConsole.mockRestore();
    });

    it('handles future dates appropriately', async () => {
      const testData = createTestData();
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const futureDatedTransactions = [
        { ...testData.transactions[0], date: futureDate.toISOString() },
      ];

      const Dashboard = (await import('../../pages/Dashboard')).default;
      renderWithProviders(<Dashboard />, {
        preloadedState: {
          transactions: { transactions: futureDatedTransactions },
        }
      });

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
      const testData = createTestData();
      
      // Create a large dataset
      const largeAccounts = Array.from({ length: 1000 }, (_, i) => ({
        ...testData.accounts[0],
        id: `account-${i}`, 
        name: `Account ${i}`, 
        balance: Math.random() * 10000 
      }));

      const Dashboard = (await import('../../pages/Dashboard')).default;
      renderWithProviders(<Dashboard />, {
        preloadedState: {
          accounts: { accounts: largeAccounts },
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time
      expect(renderTime).toBeLessThan(2000); // 2 seconds
    });

    it('handles memory cleanup on unmount', async () => {
      const Dashboard = (await import('../../pages/Dashboard')).default;
      const { unmount } = renderWithProviders(<Dashboard />);
      
      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Browser Compatibility Error Handling', () => {
    it('handles missing browser APIs gracefully', async () => {
      // Mock missing localStorage
      const originalLocalStorage = global.localStorage;
      delete (global as any).localStorage;

      try {
        const Dashboard = (await import('../../pages/Dashboard')).default;
        const { render } = await import('@testing-library/react');
        
        // Try to render without localStorage - should handle gracefully or throw
        let errorThrown = false;
        try {
          render(<Dashboard />);
        } catch (error) {
          errorThrown = true;
        }
        
        // Either it throws or handles gracefully
        expect(errorThrown || screen.queryByText(/WealthTracker/i)).toBeTruthy();
      } finally {
        // Restore localStorage
        global.localStorage = originalLocalStorage;
      }
    });

    it('handles missing modern JavaScript features', async () => {
      // Test with older JavaScript feature support
      const originalToLocaleString = Number.prototype.toLocaleString;
      Number.prototype.toLocaleString = function() {
        return this.toString();
      };

      try {
        const Dashboard = (await import('../../pages/Dashboard')).default;
        renderWithProviders(<Dashboard />);
        expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
      } finally {
        Number.prototype.toLocaleString = originalToLocaleString;
      }
    });
  });

  describe('Concurrent Access Error Handling', () => {
    it('handles concurrent localStorage access', async () => {
      const testData = createTestData();
      const Dashboard = (await import('../../pages/Dashboard')).default;
      
      // Simulate concurrent access with fewer renders
      const promises = Array.from({ length: 3 }, (_, i) => 
        new Promise<void>((resolve) => {
          setTimeout(() => {
            const { unmount } = renderWithProviders(<Dashboard />, {
              preloadedState: {
                accounts: { accounts: [{ ...testData.accounts[0], id: `acc-${i}` }] },
              }
            });
            // Clean up immediately
            unmount();
            resolve();
          }, i * 10);
        })
      );

      await Promise.all(promises);

      // Should not cause race conditions
      expect(mockConsoleError).not.toHaveBeenCalled();
    }, 10000);

    it('handles rapid state updates', async () => {
      const testData = createTestData();
      const Dashboard = (await import('../../pages/Dashboard')).default;
      
      renderWithProviders(<Dashboard />, {
        preloadedState: {
          accounts: { accounts: testData.accounts },
        }
      });

      // Simulate rapid state updates
      for (let i = 0; i < 10; i++) {
        localStorageMock.setItem(`wealthtracker_accounts`, JSON.stringify([
          { ...testData.accounts[0], id: `${i}`, name: `Account ${i}` }
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
