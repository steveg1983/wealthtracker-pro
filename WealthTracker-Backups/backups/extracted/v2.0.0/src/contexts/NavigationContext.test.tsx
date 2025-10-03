/**
 * NavigationContext Tests
 * Comprehensive tests for the navigation context provider
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { NavigationProvider, useNavigation } from './NavigationContext';

describe('NavigationContext', () => {
  const mockNavigate = vi.fn();
  const mockSetCurrentPage = vi.fn();
  const mockSetSelectedAccountId = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <NavigationProvider
      navigate={mockNavigate}
      setCurrentPage={mockSetCurrentPage}
      setSelectedAccountId={mockSetSelectedAccountId}
    >
      {children}
    </NavigationProvider>
  );

  const wrapperWithCustomHandlers = (
    navigate: (path: string) => void,
    setCurrentPage: (page: string) => void,
    setSelectedAccountId: (accountId: string | null) => void
  ) => ({ children }: { children: ReactNode }) => (
    <NavigationProvider
      navigate={navigate}
      setCurrentPage={setCurrentPage}
      setSelectedAccountId={setSelectedAccountId}
    >
      {children}
    </NavigationProvider>
  );

  describe('provider', () => {
    it('provides navigation functions through context', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      expect(result.current.navigate).toBe(mockNavigate);
      expect(result.current.setCurrentPage).toBe(mockSetCurrentPage);
      expect(result.current.setSelectedAccountId).toBe(mockSetSelectedAccountId);
    });

    it('accepts custom navigation handlers', () => {
      const customNavigate = vi.fn();
      const customSetCurrentPage = vi.fn();
      const customSetSelectedAccountId = vi.fn();

      const { result } = renderHook(
        () => useNavigation(),
        { 
          wrapper: wrapperWithCustomHandlers(
            customNavigate,
            customSetCurrentPage,
            customSetSelectedAccountId
          )
        }
      );

      expect(result.current.navigate).toBe(customNavigate);
      expect(result.current.setCurrentPage).toBe(customSetCurrentPage);
      expect(result.current.setSelectedAccountId).toBe(customSetSelectedAccountId);
    });

    it('maintains function references across renders', () => {
      const { result, rerender } = renderHook(() => useNavigation(), { wrapper });

      const initialNavigate = result.current.navigate;
      const initialSetCurrentPage = result.current.setCurrentPage;
      const initialSetSelectedAccountId = result.current.setSelectedAccountId;

      rerender();

      expect(result.current.navigate).toBe(initialNavigate);
      expect(result.current.setCurrentPage).toBe(initialSetCurrentPage);
      expect(result.current.setSelectedAccountId).toBe(initialSetSelectedAccountId);
    });
  });

  describe('navigate function', () => {
    it('calls navigate with provided path', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.navigate('/dashboard');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    it('handles different path formats', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      const paths = [
        '/transactions',
        '/accounts/123',
        '/reports?period=monthly',
        '/settings#preferences',
        '../dashboard',
        'relative-path',
        '/',
      ];

      paths.forEach(path => {
        act(() => {
          result.current.navigate(path);
        });
      });

      expect(mockNavigate).toHaveBeenCalledTimes(paths.length);
      paths.forEach((path, index) => {
        expect(mockNavigate).toHaveBeenNthCalledWith(index + 1, path);
      });
    });

    it('handles empty path', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.navigate('');
      });

      expect(mockNavigate).toHaveBeenCalledWith('');
    });

    it('allows multiple navigation calls', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.navigate('/first');
        result.current.navigate('/second');
        result.current.navigate('/third');
      });

      expect(mockNavigate).toHaveBeenCalledTimes(3);
      expect(mockNavigate).toHaveBeenNthCalledWith(1, '/first');
      expect(mockNavigate).toHaveBeenNthCalledWith(2, '/second');
      expect(mockNavigate).toHaveBeenNthCalledWith(3, '/third');
    });
  });

  describe('setCurrentPage function', () => {
    it('calls setCurrentPage with provided page', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setCurrentPage('dashboard');
      });

      expect(mockSetCurrentPage).toHaveBeenCalledWith('dashboard');
      expect(mockSetCurrentPage).toHaveBeenCalledTimes(1);
    });

    it('handles different page names', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      const pages = [
        'transactions',
        'accounts',
        'reports',
        'budget',
        'goals',
        'settings',
        'analytics',
      ];

      pages.forEach(page => {
        act(() => {
          result.current.setCurrentPage(page);
        });
      });

      expect(mockSetCurrentPage).toHaveBeenCalledTimes(pages.length);
      pages.forEach((page, index) => {
        expect(mockSetCurrentPage).toHaveBeenNthCalledWith(index + 1, page);
      });
    });

    it('handles empty page name', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setCurrentPage('');
      });

      expect(mockSetCurrentPage).toHaveBeenCalledWith('');
    });

    it('allows updating page multiple times', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setCurrentPage('dashboard');
        result.current.setCurrentPage('transactions');
        result.current.setCurrentPage('accounts');
      });

      expect(mockSetCurrentPage).toHaveBeenCalledTimes(3);
      expect(mockSetCurrentPage).toHaveBeenNthCalledWith(1, 'dashboard');
      expect(mockSetCurrentPage).toHaveBeenNthCalledWith(2, 'transactions');
      expect(mockSetCurrentPage).toHaveBeenNthCalledWith(3, 'accounts');
    });
  });

  describe('setSelectedAccountId function', () => {
    it('calls setSelectedAccountId with provided account id', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setSelectedAccountId('account-123');
      });

      expect(mockSetSelectedAccountId).toHaveBeenCalledWith('account-123');
      expect(mockSetSelectedAccountId).toHaveBeenCalledTimes(1);
    });

    it('handles null account id', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setSelectedAccountId(null);
      });

      expect(mockSetSelectedAccountId).toHaveBeenCalledWith(null);
    });

    it('handles different account id formats', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      const accountIds = [
        'account-1',
        'acc_123456789',
        'checking-primary',
        'savings-emergency',
        'credit-card-visa',
        '12345',
        'uuid-v4-format',
      ];

      accountIds.forEach(accountId => {
        act(() => {
          result.current.setSelectedAccountId(accountId);
        });
      });

      expect(mockSetSelectedAccountId).toHaveBeenCalledTimes(accountIds.length);
      accountIds.forEach((accountId, index) => {
        expect(mockSetSelectedAccountId).toHaveBeenNthCalledWith(index + 1, accountId);
      });
    });

    it('allows clearing selection with null', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setSelectedAccountId('account-123');
        result.current.setSelectedAccountId(null);
        result.current.setSelectedAccountId('account-456');
        result.current.setSelectedAccountId(null);
      });

      expect(mockSetSelectedAccountId).toHaveBeenCalledTimes(4);
      expect(mockSetSelectedAccountId).toHaveBeenNthCalledWith(1, 'account-123');
      expect(mockSetSelectedAccountId).toHaveBeenNthCalledWith(2, null);
      expect(mockSetSelectedAccountId).toHaveBeenNthCalledWith(3, 'account-456');
      expect(mockSetSelectedAccountId).toHaveBeenNthCalledWith(4, null);
    });
  });

  describe('error handling', () => {
    it('throws error when useNavigation is used outside provider', () => {
      expect(() => {
        renderHook(() => useNavigation());
      }).toThrow('useNavigation must be used within NavigationProvider');
    });

    it('provides context even if handlers throw errors', () => {
      const throwingNavigate = vi.fn(() => {
        throw new Error('Navigation failed');
      });
      const throwingSetCurrentPage = vi.fn(() => {
        throw new Error('Set page failed');
      });
      const throwingSetSelectedAccountId = vi.fn(() => {
        throw new Error('Set account failed');
      });

      const { result } = renderHook(
        () => useNavigation(),
        { 
          wrapper: wrapperWithCustomHandlers(
            throwingNavigate,
            throwingSetCurrentPage,
            throwingSetSelectedAccountId
          )
        }
      );

      // Context should still provide the functions
      expect(result.current.navigate).toBe(throwingNavigate);
      expect(result.current.setCurrentPage).toBe(throwingSetCurrentPage);
      expect(result.current.setSelectedAccountId).toBe(throwingSetSelectedAccountId);

      // Functions should throw when called
      expect(() => {
        act(() => {
          result.current.navigate('/test');
        });
      }).toThrow('Navigation failed');

      expect(() => {
        act(() => {
          result.current.setCurrentPage('test');
        });
      }).toThrow('Set page failed');

      expect(() => {
        act(() => {
          result.current.setSelectedAccountId('test');
        });
      }).toThrow('Set account failed');
    });
  });

  describe('combined operations', () => {
    it('allows calling multiple navigation functions together', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.navigate('/accounts');
        result.current.setCurrentPage('accounts');
        result.current.setSelectedAccountId('account-123');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/accounts');
      expect(mockSetCurrentPage).toHaveBeenCalledWith('accounts');
      expect(mockSetSelectedAccountId).toHaveBeenCalledWith('account-123');
    });

    it('maintains function call order', () => {
      const callOrder: string[] = [];
      
      const trackingNavigate = vi.fn((path: string) => {
        callOrder.push(`navigate:${path}`);
      });
      const trackingSetCurrentPage = vi.fn((page: string) => {
        callOrder.push(`setPage:${page}`);
      });
      const trackingSetSelectedAccountId = vi.fn((accountId: string | null) => {
        callOrder.push(`setAccount:${accountId}`);
      });

      const { result } = renderHook(
        () => useNavigation(),
        { 
          wrapper: wrapperWithCustomHandlers(
            trackingNavigate,
            trackingSetCurrentPage,
            trackingSetSelectedAccountId
          )
        }
      );

      act(() => {
        result.current.setCurrentPage('dashboard');
        result.current.navigate('/dashboard');
        result.current.setSelectedAccountId('acc-1');
        result.current.setSelectedAccountId(null);
        result.current.navigate('/transactions');
      });

      expect(callOrder).toEqual([
        'setPage:dashboard',
        'navigate:/dashboard',
        'setAccount:acc-1',
        'setAccount:null',
        'navigate:/transactions',
      ]);
    });

    it('handles rapid successive calls', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        // Simulate rapid navigation
        for (let i = 0; i < 10; i++) {
          result.current.navigate(`/page-${i}`);
          result.current.setCurrentPage(`page-${i}`);
          if (i % 2 === 0) {
            result.current.setSelectedAccountId(`account-${i}`);
          } else {
            result.current.setSelectedAccountId(null);
          }
        }
      });

      expect(mockNavigate).toHaveBeenCalledTimes(10);
      expect(mockSetCurrentPage).toHaveBeenCalledTimes(10);
      expect(mockSetSelectedAccountId).toHaveBeenCalledTimes(10);
    });
  });

  describe('real-world usage patterns', () => {
    it('simulates typical navigation flow', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      // User opens accounts page
      act(() => {
        result.current.navigate('/accounts');
        result.current.setCurrentPage('accounts');
        result.current.setSelectedAccountId(null);
      });

      // User selects an account
      act(() => {
        result.current.setSelectedAccountId('checking-account');
      });

      // User navigates to transactions for that account
      act(() => {
        result.current.navigate('/transactions?accountId=checking-account');
        result.current.setCurrentPage('transactions');
      });

      // User goes back to all accounts
      act(() => {
        result.current.navigate('/accounts');
        result.current.setCurrentPage('accounts');
        result.current.setSelectedAccountId(null);
      });

      expect(mockNavigate).toHaveBeenCalledTimes(3);
      expect(mockSetCurrentPage).toHaveBeenCalledTimes(3);
      expect(mockSetSelectedAccountId).toHaveBeenCalledTimes(3);

      // Verify final calls
      expect(mockNavigate).toHaveBeenLastCalledWith('/accounts');
      expect(mockSetCurrentPage).toHaveBeenLastCalledWith('accounts');
      expect(mockSetSelectedAccountId).toHaveBeenLastCalledWith(null);
    });

    it('handles navigation between different pages', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      const navigationFlow = [
        { path: '/dashboard', page: 'dashboard', accountId: null },
        { path: '/transactions', page: 'transactions', accountId: null },
        { path: '/accounts', page: 'accounts', accountId: null },
        { path: '/accounts/123', page: 'accounts', accountId: '123' },
        { path: '/budget', page: 'budget', accountId: null },
        { path: '/reports', page: 'reports', accountId: null },
        { path: '/settings', page: 'settings', accountId: null },
      ];

      navigationFlow.forEach(({ path, page, accountId }) => {
        act(() => {
          result.current.navigate(path);
          result.current.setCurrentPage(page);
          result.current.setSelectedAccountId(accountId);
        });
      });

      expect(mockNavigate).toHaveBeenCalledTimes(navigationFlow.length);
      expect(mockSetCurrentPage).toHaveBeenCalledTimes(navigationFlow.length);
      expect(mockSetSelectedAccountId).toHaveBeenCalledTimes(navigationFlow.length);
    });
  });
});