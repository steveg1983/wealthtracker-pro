/**
 * AccountContext Tests
 * Comprehensive tests for the account context provider
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { AccountProvider, useAccounts } from './AccountContext';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock uuid
const mockUuidV4 = vi.fn(() => 'mock-uuid-123');
vi.mock('uuid', () => ({
  v4: () => mockUuidV4(),
}));

// Mock console.error
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('AccountContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers(); // Reset timers first
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-20T12:00:00'));
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.setItem.mockImplementation(() => {}); // Reset to no-op
    mockUuidV4.mockReturnValue('mock-uuid-123');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <AccountProvider>{children}</AccountProvider>
  );

  const wrapperWithInitial = (initialAccounts: any[]) => 
    ({ children }: { children: ReactNode }) => (
      <AccountProvider initialAccounts={initialAccounts}>{children}</AccountProvider>
    );

  const createMockAccount = (overrides = {}) => ({
    name: 'Test Account',
    type: 'checking' as const,
    balance: 1000,
    currency: 'USD',
    lastUpdated: new Date('2025-01-01'),
    ...overrides,
  });

  const createMockHolding = (overrides = {}) => ({
    ticker: 'AAPL',
    name: 'Apple Inc.',
    shares: 10,
    value: 1500,
    averageCost: 150,
    currentPrice: 155,
    marketValue: 1550,
    gain: 50,
    gainPercent: 3.33,
    currency: 'USD',
    lastUpdated: new Date('2025-01-20'),
    ...overrides,
  });

  describe('initialization', () => {
    it('provides empty array when localStorage is empty', () => {
      const { result } = renderHook(() => useAccounts(), { wrapper });

      expect(result.current.accounts).toEqual([]);
    });

    it('loads accounts from localStorage', () => {
      const savedAccounts = [
        {
          id: 'saved-1',
          name: 'Checking Account',
          type: 'checking',
          balance: 2500,
          currency: 'USD',
          lastUpdated: '2025-01-15T00:00:00.000Z',
          openingBalanceDate: '2025-01-01T00:00:00.000Z',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedAccounts));

      const { result } = renderHook(() => useAccounts(), { wrapper });

      expect(result.current.accounts).toHaveLength(1);
      expect(result.current.accounts[0].name).toBe('Checking Account');
      expect(result.current.accounts[0].lastUpdated).toBeInstanceOf(Date);
      expect(result.current.accounts[0].openingBalanceDate).toBeInstanceOf(Date);
    });

    it('handles invalid localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      const { result } = renderHook(() => useAccounts(), { wrapper });

      expect(result.current.accounts).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error parsing saved accounts:',
        expect.any(Error)
      );
    });

    it('uses initialAccounts when provided and localStorage is empty', () => {
      const initialAccounts = [createMockAccount({ id: 'init-1' })];

      const { result } = renderHook(
        () => useAccounts(),
        { wrapper: wrapperWithInitial(initialAccounts) }
      );

      expect(result.current.accounts).toEqual(initialAccounts);
    });

    it('prefers localStorage over initialAccounts', () => {
      const savedAccounts = [
        {
          id: 'saved-1',
          name: 'Saved Account',
          type: 'savings',
          balance: 5000,
          currency: 'USD',
          lastUpdated: '2025-01-15T00:00:00.000Z',
        },
      ];
      const initialAccounts = [createMockAccount({ name: 'Initial Account' })];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedAccounts));

      const { result } = renderHook(
        () => useAccounts(),
        { wrapper: wrapperWithInitial(initialAccounts) }
      );

      expect(result.current.accounts[0].name).toBe('Saved Account');
    });

    it('handles accounts with missing openingBalanceDate', () => {
      const savedAccounts = [
        {
          id: 'saved-1',
          name: 'No Opening Date',
          type: 'checking',
          balance: 1000,
          currency: 'USD',
          lastUpdated: '2025-01-15T00:00:00.000Z',
          // openingBalanceDate is undefined
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedAccounts));

      const { result } = renderHook(() => useAccounts(), { wrapper });

      expect(result.current.accounts[0].openingBalanceDate).toBeUndefined();
    });
  });

  describe('addAccount', () => {
    it('adds a new account with generated id and lastUpdated', () => {
      const { result } = renderHook(() => useAccounts(), { wrapper });

      const newAccount = {
        name: 'New Savings',
        type: 'savings' as const,
        balance: 5000,
        currency: 'USD',
      };

      act(() => {
        result.current.addAccount(newAccount);
      });

      expect(result.current.accounts).toHaveLength(1);
      expect(result.current.accounts[0]).toMatchObject({
        ...newAccount,
        id: 'mock-uuid-123',
        lastUpdated: new Date('2025-01-20T12:00:00'),
      });
    });

    it('saves to localStorage after adding', () => {
      const { result } = renderHook(() => useAccounts(), { wrapper });

      act(() => {
        result.current.addAccount(createMockAccount({ name: 'New Account' }));
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_accounts',
        expect.stringContaining('New Account')
      );
    });

    it('handles accounts with all optional fields', () => {
      const { result } = renderHook(() => useAccounts(), { wrapper });

      const fullAccount = {
        name: 'Investment Account',
        type: 'investment' as const,
        balance: 50000,
        currency: 'USD',
        institution: 'Vanguard',
        holdings: [createMockHolding()],
        notes: 'Retirement portfolio',
        openingBalance: 45000,
        openingBalanceDate: new Date('2024-01-01'),
        sortCode: '12-34-56',
        accountNumber: '87654321',
      };

      act(() => {
        result.current.addAccount(fullAccount);
      });

      const added = result.current.accounts[0];
      expect(added.institution).toBe('Vanguard');
      expect(added.holdings).toHaveLength(1);
      expect(added.notes).toBe('Retirement portfolio');
      expect(added.openingBalance).toBe(45000);
      expect(added.sortCode).toBe('12-34-56');
      expect(added.accountNumber).toBe('87654321');
    });

    it('supports all account types', () => {
      const { result } = renderHook(() => useAccounts(), { wrapper });

      const accountTypes = [
        'current', 'savings', 'credit', 'loan', 'investment', 
        'assets', 'other', 'mortgage', 'checking', 'asset'
      ] as const;

      accountTypes.forEach((type, index) => {
        mockUuidV4.mockReturnValueOnce(`account-${index}`);
        act(() => {
          result.current.addAccount(createMockAccount({
            name: `${type} Account`,
            type,
          }));
        });
      });

      expect(result.current.accounts).toHaveLength(accountTypes.length);
      accountTypes.forEach((type, index) => {
        expect(result.current.accounts[index].type).toBe(type);
      });
    });

    it('handles holdings with different currencies', () => {
      const { result } = renderHook(() => useAccounts(), { wrapper });

      const holdings = [
        createMockHolding({ ticker: 'AAPL', currency: 'USD' }),
        createMockHolding({ ticker: 'VOO', currency: 'USD' }),
        createMockHolding({ ticker: 'VXUS', currency: 'USD' }),
      ];

      act(() => {
        result.current.addAccount({
          name: 'Multi-Currency Investment',
          type: 'investment',
          balance: 100000,
          currency: 'USD',
          holdings,
        });
      });

      const account = result.current.accounts[0];
      expect(account.holdings).toHaveLength(3);
      expect(account.holdings![0].currency).toBe('USD');
    });
  });

  describe('updateAccount', () => {
    it('updates an existing account', () => {
      const initialAccount = createMockAccount({ id: 'acc-1' });
      const { result } = renderHook(
        () => useAccounts(),
        { wrapper: wrapperWithInitial([initialAccount]) }
      );

      act(() => {
        result.current.updateAccount('acc-1', {
          name: 'Updated Account',
          balance: 2500,
        });
      });

      const updated = result.current.accounts[0];
      expect(updated.name).toBe('Updated Account');
      expect(updated.balance).toBe(2500);
      expect(updated.type).toBe('checking'); // Unchanged
      expect(updated.lastUpdated).toEqual(new Date('2025-01-20T12:00:00'));
    });

    it('does nothing if account not found', () => {
      const initialAccount = createMockAccount({ id: 'acc-1' });
      const { result } = renderHook(
        () => useAccounts(),
        { wrapper: wrapperWithInitial([initialAccount]) }
      );

      act(() => {
        result.current.updateAccount('non-existent', { name: 'Should not update' });
      });

      expect(result.current.accounts[0].name).toBe('Test Account');
    });

    it('saves to localStorage after updating', () => {
      const initialAccount = createMockAccount({ id: 'acc-1' });
      const { result } = renderHook(
        () => useAccounts(),
        { wrapper: wrapperWithInitial([initialAccount]) }
      );

      mockLocalStorage.setItem.mockClear();

      act(() => {
        result.current.updateAccount('acc-1', { balance: 3000 });
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_accounts',
        expect.stringContaining('3000')
      );
    });

    it('can update account type', () => {
      const initialAccount = createMockAccount({ id: 'acc-1', type: 'checking' });
      const { result } = renderHook(
        () => useAccounts(),
        { wrapper: wrapperWithInitial([initialAccount]) }
      );

      act(() => {
        result.current.updateAccount('acc-1', { type: 'savings' });
      });

      expect(result.current.accounts[0].type).toBe('savings');
    });

    it('can update holdings', () => {
      const initialAccount = createMockAccount({ id: 'acc-1', type: 'investment' });
      const { result } = renderHook(
        () => useAccounts(),
        { wrapper: wrapperWithInitial([initialAccount]) }
      );

      const newHoldings = [
        createMockHolding({ ticker: 'MSFT', shares: 5 }),
        createMockHolding({ ticker: 'GOOGL', shares: 2 }),
      ];

      act(() => {
        result.current.updateAccount('acc-1', { holdings: newHoldings });
      });

      const updated = result.current.accounts[0];
      expect(updated.holdings).toHaveLength(2);
      expect(updated.holdings![0].ticker).toBe('MSFT');
      expect(updated.holdings![1].ticker).toBe('GOOGL');
    });

    it('can update institution and notes', () => {
      const initialAccount = createMockAccount({ id: 'acc-1' });
      const { result } = renderHook(
        () => useAccounts(),
        { wrapper: wrapperWithInitial([initialAccount]) }
      );

      act(() => {
        result.current.updateAccount('acc-1', {
          institution: 'Chase Bank',
          notes: 'Primary checking account',
        });
      });

      const updated = result.current.accounts[0];
      expect(updated.institution).toBe('Chase Bank');
      expect(updated.notes).toBe('Primary checking account');
    });
  });

  describe('deleteAccount', () => {
    it('deletes an existing account', () => {
      const accounts = [
        createMockAccount({ id: 'acc-1' }),
        createMockAccount({ id: 'acc-2', name: 'Keep this' }),
      ];
      const { result } = renderHook(
        () => useAccounts(),
        { wrapper: wrapperWithInitial(accounts) }
      );

      act(() => {
        result.current.deleteAccount('acc-1');
      });

      expect(result.current.accounts).toHaveLength(1);
      expect(result.current.accounts[0].id).toBe('acc-2');
    });

    it('does nothing if account not found', () => {
      const initialAccount = createMockAccount({ id: 'acc-1' });
      const { result } = renderHook(
        () => useAccounts(),
        { wrapper: wrapperWithInitial([initialAccount]) }
      );

      act(() => {
        result.current.deleteAccount('non-existent');
      });

      expect(result.current.accounts).toHaveLength(1);
    });

    it('saves to localStorage after deletion', () => {
      const accounts = [
        createMockAccount({ id: 'acc-1' }),
        createMockAccount({ id: 'acc-2', name: 'Keep this' }),
      ];
      const { result } = renderHook(
        () => useAccounts(),
        { wrapper: wrapperWithInitial(accounts) }
      );

      mockLocalStorage.setItem.mockClear();

      act(() => {
        result.current.deleteAccount('acc-1');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const savedData = mockLocalStorage.setItem.mock.calls[0][1];
      expect(savedData).not.toContain('Test Account');
      expect(savedData).toContain('Keep this');
    });
  });

  describe('getAccount', () => {
    it('returns account by id', () => {
      const accounts = [
        createMockAccount({ id: 'acc-1' }),
        createMockAccount({ id: 'acc-2', name: 'Savings Account' }),
      ];
      const { result } = renderHook(
        () => useAccounts(),
        { wrapper: wrapperWithInitial(accounts) }
      );

      const account = result.current.getAccount('acc-2');

      expect(account).toBeDefined();
      expect(account?.name).toBe('Savings Account');
    });

    it('returns undefined for non-existent id', () => {
      const initialAccount = createMockAccount({ id: 'acc-1' });
      const { result } = renderHook(
        () => useAccounts(),
        { wrapper: wrapperWithInitial([initialAccount]) }
      );

      const account = result.current.getAccount('non-existent');

      expect(account).toBeUndefined();
    });

    it('returns updated account after modification', () => {
      const initialAccount = createMockAccount({ id: 'acc-1' });
      const { result } = renderHook(
        () => useAccounts(),
        { wrapper: wrapperWithInitial([initialAccount]) }
      );

      act(() => {
        result.current.updateAccount('acc-1', { name: 'Modified Account' });
      });

      const account = result.current.getAccount('acc-1');
      expect(account?.name).toBe('Modified Account');
    });
  });

  describe('persistence', () => {
    it('saves to localStorage on every change', () => {
      const { result } = renderHook(() => useAccounts(), { wrapper });

      mockLocalStorage.setItem.mockClear();

      // Add
      act(() => {
        result.current.addAccount(createMockAccount());
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);

      // Update
      act(() => {
        result.current.updateAccount('mock-uuid-123', { balance: 2000 });
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);

      // Delete
      act(() => {
        result.current.deleteAccount('mock-uuid-123');
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3);
    });

    it('persists accounts across remounts', () => {
      // First mount
      const { result: result1, unmount } = renderHook(() => useAccounts(), { wrapper });

      act(() => {
        result1.current.addAccount(createMockAccount({ name: 'Persistent Account' }));
      });

      // Unmount
      unmount();

      // Mock localStorage to return saved account
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'money_management_accounts') {
          return JSON.stringify([{
            id: 'mock-uuid-123',
            name: 'Persistent Account',
            type: 'checking',
            balance: 1000,
            currency: 'USD',
            lastUpdated: '2025-01-20T12:00:00.000Z',
          }]);
        }
        return null;
      });

      // Remount
      const { result: result2 } = renderHook(() => useAccounts(), { wrapper });

      expect(result2.current.accounts).toHaveLength(1);
      expect(result2.current.accounts[0].name).toBe('Persistent Account');
    });
  });

  describe('error handling', () => {
    it('throws error when useAccounts is used outside provider', () => {
      expect(() => {
        renderHook(() => useAccounts());
      }).toThrow('useAccounts must be used within AccountProvider');
    });

    it('throws when localStorage fails', () => {
      const { result } = renderHook(() => useAccounts(), { wrapper });

      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => {
        act(() => {
          result.current.addAccount(createMockAccount());
        });
      }).toThrow('Storage quota exceeded');
    });
  });

  describe('complex scenarios', () => {
    it('handles multiple account operations', () => {
      const { result } = renderHook(() => useAccounts(), { wrapper });

      // Add multiple accounts
      const accountData = [
        { name: 'Checking', type: 'checking' as const, balance: 2000 },
        { name: 'Savings', type: 'savings' as const, balance: 10000 },
        { name: 'Investment', type: 'investment' as const, balance: 50000 },
      ];

      act(() => {
        accountData.forEach((data, index) => {
          mockUuidV4.mockReturnValueOnce(`account-${index + 1}`);
          result.current.addAccount({
            ...data,
            currency: 'USD',
          });
        });
      });

      expect(result.current.accounts).toHaveLength(3);

      // Update balances
      act(() => {
        result.current.updateAccount('account-1', { balance: 2500 });
        result.current.updateAccount('account-2', { balance: 12000 });
      });

      // Check updated balances
      expect(result.current.getAccount('account-1')?.balance).toBe(2500);
      expect(result.current.getAccount('account-2')?.balance).toBe(12000);

      // Delete one account
      act(() => {
        result.current.deleteAccount('account-3');
      });

      expect(result.current.accounts).toHaveLength(2);
    });

    it('handles investment account with portfolio tracking', () => {
      const { result } = renderHook(() => useAccounts(), { wrapper });

      const holdings = [
        createMockHolding({ ticker: 'AAPL', shares: 10, value: 1500 }),
        createMockHolding({ ticker: 'MSFT', shares: 8, value: 2400 }),
        createMockHolding({ ticker: 'GOOGL', shares: 2, value: 5600 }),
      ];

      // Create investment account
      act(() => {
        result.current.addAccount({
          name: 'Investment Portfolio',
          type: 'investment',
          balance: 9500, // Total value of holdings
          currency: 'USD',
          institution: 'Fidelity',
          holdings,
        });
      });

      // Update portfolio values
      const updatedHoldings = holdings.map(h => ({
        ...h,
        currentPrice: (h.currentPrice || 0) * 1.1, // 10% increase
        value: h.value * 1.1,
        marketValue: (h.marketValue || 0) * 1.1,
      }));

      act(() => {
        result.current.updateAccount('mock-uuid-123', {
          holdings: updatedHoldings,
          balance: 10450, // Updated total value
        });
      });

      const account = result.current.getAccount('mock-uuid-123');
      expect(account?.holdings).toHaveLength(3);
      expect(account?.balance).toBe(10450);
    });

    it('handles date parsing edge cases', () => {
      const savedWithDates = [
        {
          id: 'date-test',
          name: 'Date Test Account',
          type: 'checking',
          balance: 1000,
          currency: 'USD',
          lastUpdated: '2025-01-15T10:30:00.000Z',
          openingBalanceDate: null, // null date
        },
      ];

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'money_management_accounts') {
          return JSON.stringify(savedWithDates);
        }
        return null;
      });

      const { result } = renderHook(() => useAccounts(), { wrapper });

      const account = result.current.accounts[0];
      expect(account.lastUpdated).toBeInstanceOf(Date);
      expect(account.openingBalanceDate).toBeUndefined();
    });

    it('handles large number of accounts efficiently', () => {
      const { result } = renderHook(() => useAccounts(), { wrapper });

      // Add 100 accounts
      act(() => {
        for (let i = 0; i < 100; i++) {
          mockUuidV4.mockReturnValueOnce(`account-${i}`);
          result.current.addAccount({
            name: `Account ${i}`,
            type: i % 2 === 0 ? 'checking' : 'savings',
            balance: 1000 + i * 100,
            currency: 'USD',
          });
        }
      });

      expect(result.current.accounts).toHaveLength(100);

      // Test lookup performance
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        result.current.getAccount(`account-${i}`);
      }
      const endTime = performance.now();
      
      // Should complete quickly (less than 10ms for 100 lookups)
      expect(endTime - startTime).toBeLessThan(10);
    });
  });
});