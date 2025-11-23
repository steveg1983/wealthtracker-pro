/**
 * BudgetContext Tests
 * Comprehensive tests for the budget context provider
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { BudgetProvider, useBudgets } from './BudgetContext';

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

// Mock error logging
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

class HookErrorBoundary extends React.Component<{
  onError: (error: Error) => void;
  children: ReactNode;
}, { error: Error | null }> {
  constructor(props: { onError: (error: Error) => void; children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.error) {
      return null;
    }
    return this.props.children;
  }
}

describe('BudgetContext', () => {
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
    <BudgetProvider>{children}</BudgetProvider>
  );

  const wrapperWithInitial = (initialBudgets: any[]) => 
    ({ children }: { children: ReactNode }) => (
      <BudgetProvider initialBudgets={initialBudgets}>{children}</BudgetProvider>
    );

  const createMockBudget = (overrides = {}) => {
    const overrideObj = overrides as { category?: string; categoryId?: string };
    const category = overrideObj.category ?? 'food';
    const categoryId = overrideObj.categoryId ?? category;

    const budget = {
      category,
      categoryId,
      amount: 500,
      period: 'monthly' as const,
      isActive: true,
      createdAt: new Date('2025-01-01'),
      ...overrides,
    };

    if (budget.categoryId === undefined) {
      budget.categoryId = budget.category ?? categoryId;
    }
    if (budget.category === undefined) {
      budget.category = category;
    }

    return budget;
  };

  describe('initialization', () => {
    it('provides empty array when localStorage is empty', () => {
      const { result } = renderHook(() => useBudgets(), { wrapper });

      expect(result.current.budgets).toEqual([]);
    });

    it('loads budgets from localStorage', () => {
      const savedBudgets = [
        {
          id: 'saved-1',
          category: 'groceries',
          amount: 400,
          period: 'monthly',
          isActive: true,
          createdAt: '2025-01-01T00:00:00.000Z',
          name: 'Grocery Budget',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedBudgets));

      const { result } = renderHook(() => useBudgets(), { wrapper });

      expect(result.current.budgets).toHaveLength(1);
      expect(result.current.budgets[0].category).toBe('groceries');
      expect(result.current.budgets[0].name).toBe('Grocery Budget');
    });

    it('handles invalid localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      const { result } = renderHook(() => useBudgets(), { wrapper });

      expect(result.current.budgets).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error parsing saved budgets:',
        expect.any(Error)
      );
    });

    it('uses initialBudgets when provided and localStorage is empty', () => {
      const initialBudgets = [createMockBudget({ id: 'init-1' })];

      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial(initialBudgets) }
      );

      expect(result.current.budgets).toEqual(initialBudgets);
    });

    it('prefers localStorage over initialBudgets', () => {
      const savedBudgets = [
        {
          id: 'saved-1',
          category: 'entertainment',
          amount: 200,
          period: 'monthly',
          isActive: true,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ];
      const initialBudgets = [createMockBudget({ category: 'food' })];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedBudgets));

      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial(initialBudgets) }
      );

      expect(result.current.budgets[0].category).toBe('entertainment');
    });
  });

  describe('addBudget', () => {
    it('adds a new budget with generated id and createdAt', () => {
      const { result } = renderHook(() => useBudgets(), { wrapper });

      const newBudget = {
        category: 'transport',
        amount: 300,
        period: 'monthly' as const,
      };

      act(() => {
        result.current.addBudget(newBudget);
      });

      expect(result.current.budgets).toHaveLength(1);
      expect(result.current.budgets[0]).toMatchObject({
        ...newBudget,
        id: 'mock-uuid-123',
        isActive: true,
        createdAt: new Date('2025-01-20T12:00:00'),
      });
    });

    it('preserves explicit isActive value', () => {
      const { result } = renderHook(() => useBudgets(), { wrapper });

      const inactiveBudget = {
        category: 'entertainment',
        amount: 100,
        period: 'monthly' as const,
        isActive: false,
      };

      act(() => {
        result.current.addBudget(inactiveBudget);
      });

      expect(result.current.budgets[0].isActive).toBe(false);
    });

    it('defaults isActive to true when not specified', () => {
      const { result } = renderHook(() => useBudgets(), { wrapper });

      act(() => {
        result.current.addBudget({
          category: 'food',
          amount: 400,
          period: 'monthly',
        });
      });

      expect(result.current.budgets[0].isActive).toBe(true);
    });

    it('saves to localStorage after adding', () => {
      const { result } = renderHook(() => useBudgets(), { wrapper });

      act(() => {
        result.current.addBudget({
          category: 'utilities',
          amount: 250,
          period: 'monthly',
        });
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_budgets',
        expect.stringContaining('utilities')
      );
    });

    it('handles budgets with all optional fields', () => {
      const { result } = renderHook(() => useBudgets(), { wrapper });

      const fullBudget = {
        category: 'shopping',
        amount: 600,
        period: 'monthly' as const,
        name: 'Shopping Budget',
        color: '#FF5733',
        spent: 150,
        budgeted: 600,
        limit: 700,
        isActive: true,
      };

      act(() => {
        result.current.addBudget(fullBudget);
      });

      const added = result.current.budgets[0];
      expect(added.name).toBe('Shopping Budget');
      expect(added.color).toBe('#FF5733');
      expect(added.spent).toBe(150);
      expect(added.budgeted).toBe(600);
      expect(added.limit).toBe(700);
    });

    it('supports all budget periods', () => {
      const { result } = renderHook(() => useBudgets(), { wrapper });

      const periods = ['weekly', 'monthly', 'yearly'] as const;

      periods.forEach((period, index) => {
        mockUuidV4.mockReturnValueOnce(`budget-${index}`);
        act(() => {
          result.current.addBudget({
            category: `category-${period}`,
            amount: 100 * (index + 1),
            period,
          });
        });
      });

      expect(result.current.budgets).toHaveLength(3);
      periods.forEach((period, index) => {
        expect(result.current.budgets[index].period).toBe(period);
      });
    });
  });

  describe('updateBudget', () => {
    it('updates an existing budget', () => {
      const initialBudget = createMockBudget({ id: 'budget-1' });
      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial([initialBudget]) }
      );

      act(() => {
        result.current.updateBudget('budget-1', {
          amount: 750,
          name: 'Updated Food Budget',
        });
      });

      const updated = result.current.budgets[0];
      expect(updated.amount).toBe(750);
      expect(updated.name).toBe('Updated Food Budget');
      expect(updated.category).toBe('food'); // Unchanged
    });

    it('does nothing if budget not found', () => {
      const initialBudget = createMockBudget({ id: 'budget-1' });
      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial([initialBudget]) }
      );

      act(() => {
        result.current.updateBudget('non-existent', { amount: 999 });
      });

      expect(result.current.budgets[0].amount).toBe(500);
    });

    it('saves to localStorage after updating', () => {
      const initialBudget = createMockBudget({ id: 'budget-1' });
      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial([initialBudget]) }
      );

      mockLocalStorage.setItem.mockClear();

      act(() => {
        result.current.updateBudget('budget-1', { amount: 800 });
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_budgets',
        expect.stringContaining('800')
      );
    });

    it('can update period', () => {
      const initialBudget = createMockBudget({ id: 'budget-1', period: 'monthly' });
      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial([initialBudget]) }
      );

      act(() => {
        result.current.updateBudget('budget-1', { period: 'yearly' });
      });

      expect(result.current.budgets[0].period).toBe('yearly');
    });

    it('can toggle isActive status', () => {
      const initialBudget = createMockBudget({ id: 'budget-1', isActive: true });
      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial([initialBudget]) }
      );

      act(() => {
        result.current.updateBudget('budget-1', { isActive: false });
      });

      expect(result.current.budgets[0].isActive).toBe(false);
    });

    it('can update tracking fields', () => {
      const initialBudget = createMockBudget({ id: 'budget-1' });
      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial([initialBudget]) }
      );

      act(() => {
        result.current.updateBudget('budget-1', {
          spent: 350,
          budgeted: 500,
          limit: 600,
          updatedAt: new Date('2025-01-20'),
        });
      });

      const updated = result.current.budgets[0];
      expect(updated.spent).toBe(350);
      expect(updated.budgeted).toBe(500);
      expect(updated.limit).toBe(600);
      expect(updated.updatedAt).toEqual(new Date('2025-01-20'));
    });
  });

  describe('deleteBudget', () => {
    it('deletes an existing budget', () => {
      const budgets = [
        createMockBudget({ id: 'budget-1' }),
        createMockBudget({ id: 'budget-2', category: 'transport' }),
      ];
      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial(budgets) }
      );

      act(() => {
        result.current.deleteBudget('budget-1');
      });

      expect(result.current.budgets).toHaveLength(1);
      expect(result.current.budgets[0].id).toBe('budget-2');
    });

    it('does nothing if budget not found', () => {
      const initialBudget = createMockBudget({ id: 'budget-1' });
      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial([initialBudget]) }
      );

      act(() => {
        result.current.deleteBudget('non-existent');
      });

      expect(result.current.budgets).toHaveLength(1);
    });

    it('saves to localStorage after deletion', () => {
      const budgets = [
        createMockBudget({ id: 'budget-1' }),
        createMockBudget({ id: 'budget-2', category: 'transport' }),
      ];
      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial(budgets) }
      );

      mockLocalStorage.setItem.mockClear();

      act(() => {
        result.current.deleteBudget('budget-1');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const savedData = mockLocalStorage.setItem.mock.calls[0][1];
      expect(savedData).not.toContain('food');
      expect(savedData).toContain('transport');
    });
  });

  describe('getBudgetByCategory', () => {
    it('returns active budget for category', () => {
      const budgets = [
        createMockBudget({ id: 'budget-1', category: 'food', isActive: true }),
        createMockBudget({ id: 'budget-2', category: 'transport', isActive: true }),
      ];
      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial(budgets) }
      );

      const foodBudget = result.current.getBudgetByCategory('food');

      expect(foodBudget).toBeDefined();
      expect(foodBudget?.id).toBe('budget-1');
      expect(foodBudget?.category).toBe('food');
    });

    it('returns undefined for non-existent category', () => {
      const budgets = [createMockBudget({ category: 'food' })];
      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial(budgets) }
      );

      const budget = result.current.getBudgetByCategory('non-existent');

      expect(budget).toBeUndefined();
    });

    it('ignores inactive budgets', () => {
      const budgets = [
        createMockBudget({ id: 'budget-1', category: 'food', isActive: false }),
        createMockBudget({ id: 'budget-2', category: 'food', isActive: true }),
      ];
      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial(budgets) }
      );

      const foodBudget = result.current.getBudgetByCategory('food');

      expect(foodBudget?.id).toBe('budget-2');
      expect(foodBudget?.isActive).toBe(true);
    });

    it('returns first active budget if multiple exist for category', () => {
      const budgets = [
        createMockBudget({ id: 'budget-1', category: 'food', isActive: true }),
        createMockBudget({ id: 'budget-2', category: 'food', isActive: true }),
      ];
      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial(budgets) }
      );

      const foodBudget = result.current.getBudgetByCategory('food');

      expect(foodBudget?.id).toBe('budget-1');
    });

    it('handles budget with isActive undefined as active', () => {
      const budgets = [
        createMockBudget({ id: 'budget-1', category: 'food', isActive: undefined }),
      ];
      const { result } = renderHook(
        () => useBudgets(),
        { wrapper: wrapperWithInitial(budgets) }
      );

      const foodBudget = result.current.getBudgetByCategory('food');

      expect(foodBudget).toBeDefined();
      expect(foodBudget?.id).toBe('budget-1');
    });
  });

  describe('persistence', () => {
    it('saves to localStorage on every change', () => {
      const { result } = renderHook(() => useBudgets(), { wrapper });

      mockLocalStorage.setItem.mockClear();

      // Add
      act(() => {
        result.current.addBudget({
          category: 'test',
          amount: 100,
          period: 'monthly',
        });
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);

      // Update
      act(() => {
        result.current.updateBudget('mock-uuid-123', { amount: 200 });
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);

      // Delete
      act(() => {
        result.current.deleteBudget('mock-uuid-123');
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3);
    });

    it('persists budgets across remounts', () => {
      // First mount
      const { result: result1, unmount } = renderHook(() => useBudgets(), { wrapper });

      act(() => {
        result1.current.addBudget({
          category: 'persistent',
          amount: 500,
          period: 'monthly',
        });
      });

      // Unmount
      unmount();

      // Mock localStorage to return saved budget
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'money_management_budgets') {
          return JSON.stringify([{
            id: 'mock-uuid-123',
            category: 'persistent',
            amount: 500,
            period: 'monthly',
            isActive: true,
            createdAt: '2025-01-20T12:00:00.000Z',
          }]);
        }
        return null;
      });

      // Remount
      const { result: result2 } = renderHook(() => useBudgets(), { wrapper });

      expect(result2.current.budgets).toHaveLength(1);
      expect(result2.current.budgets[0].category).toBe('persistent');
    });
  });

  describe('error handling', () => {
    it('throws error when useBudgets is used outside provider', () => {
      let capturedError: Error | null = null;
      const errorHandler = (event: ErrorEvent) => {
        if (event.message?.includes('useBudgets must be used within BudgetProvider')) {
          event.preventDefault();
        }
      };
      window.addEventListener('error', errorHandler);
      const BoundaryWrapper = ({ children }: { children: ReactNode }) => (
        <HookErrorBoundary onError={(error) => { capturedError = error; }}>
          {children}
        </HookErrorBoundary>
      );

      renderHook(() => useBudgets(), { wrapper: BoundaryWrapper });
      window.removeEventListener('error', errorHandler);

      expect(capturedError).toBeInstanceOf(Error);
      expect(capturedError?.message).toBe('useBudgets must be used within BudgetProvider');
    });

    it('throws when localStorage fails', () => {
      const { result } = renderHook(() => useBudgets(), { wrapper });

      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => {
        act(() => {
          result.current.addBudget({
            category: 'test',
            amount: 100,
            period: 'monthly',
          });
        });
      }).toThrow('Storage quota exceeded');
    });
  });

  describe('complex scenarios', () => {
    it('handles multiple budget operations', () => {
      const { result } = renderHook(() => useBudgets(), { wrapper });

      // Add multiple budgets
      const budgetData = [
        { category: 'food', amount: 500, period: 'monthly' as const },
        { category: 'transport', amount: 200, period: 'weekly' as const },
        { category: 'entertainment', amount: 1200, period: 'yearly' as const },
      ];

      act(() => {
        budgetData.forEach((data, index) => {
          mockUuidV4.mockReturnValueOnce(`budget-${index + 1}`);
          result.current.addBudget(data);
        });
      });

      expect(result.current.budgets).toHaveLength(3);

      // Update budgets
      act(() => {
        result.current.updateBudget('budget-1', { amount: 600, spent: 350 });
        result.current.updateBudget('budget-2', { isActive: false });
      });

      // Test getBudgetByCategory with active/inactive
      const foodBudget = result.current.getBudgetByCategory('food');
      const transportBudget = result.current.getBudgetByCategory('transport');

      expect(foodBudget?.amount).toBe(600);
      expect(foodBudget?.spent).toBe(350);
      expect(transportBudget).toBeUndefined(); // inactive

      // Delete a budget
      act(() => {
        result.current.deleteBudget('budget-3');
      });

      expect(result.current.budgets).toHaveLength(2);
    });

    it('handles budget tracking workflow', () => {
      const { result } = renderHook(() => useBudgets(), { wrapper });

      // Create budget
      act(() => {
        result.current.addBudget({
          category: 'groceries',
          amount: 400,
          period: 'monthly',
          name: 'Monthly Grocery Budget',
        });
      });

      // Simulate spending tracking
      const spendingUpdates = [50, 125, 200, 350, 425];

      spendingUpdates.forEach((spent) => {
        act(() => {
          result.current.updateBudget('mock-uuid-123', { 
            spent,
            updatedAt: new Date()
          });
        });

        const budget = result.current.getBudgetByCategory('groceries');
        expect(budget?.spent).toBe(spent);
        
        // Calculate remaining budget
        const remaining = (budget?.amount || 0) - (budget?.spent || 0);
        if (spent <= 400) {
          expect(remaining).toBeGreaterThanOrEqual(0);
        } else {
          expect(remaining).toBeLessThan(0); // Over budget
        }
      });
    });

    it('handles budget period conversions', () => {
      const { result } = renderHook(() => useBudgets(), { wrapper });

      // Create yearly budget
      act(() => {
        result.current.addBudget({
          category: 'vacation',
          amount: 2400, // $2400/year
          period: 'yearly',
        });
      });

      // Convert to monthly equivalent
      const yearlyBudget = result.current.getBudgetByCategory('vacation');
      const monthlyEquivalent = (yearlyBudget?.amount || 0) / 12;
      expect(monthlyEquivalent).toBe(200);

      // Update to monthly budget
      act(() => {
        result.current.updateBudget('mock-uuid-123', {
          period: 'monthly',
          amount: monthlyEquivalent,
        });
      });

      const monthlyBudget = result.current.getBudgetByCategory('vacation');
      expect(monthlyBudget?.period).toBe('monthly');
      expect(monthlyBudget?.amount).toBe(200);
    });

    it('handles budget categories with special characters', () => {
      const { result } = renderHook(() => useBudgets(), { wrapper });

      const specialCategories = [
        'food & dining',
        'health/medical',
        'home-improvement',
        'kids_activities',
        'tax-planning',
      ];

      act(() => {
        specialCategories.forEach((category, index) => {
          mockUuidV4.mockReturnValueOnce(`special-${index}`);
          result.current.addBudget({
            category,
            amount: 100,
            period: 'monthly',
          });
        });
      });

      expect(result.current.budgets).toHaveLength(5);

      // Test retrieval
      specialCategories.forEach((category) => {
        const budget = result.current.getBudgetByCategory(category);
        expect(budget).toBeDefined();
        expect(budget?.categoryId).toBe(category);
      });
    });

    it('handles large number of budgets efficiently', () => {
      const { result } = renderHook(() => useBudgets(), { wrapper });

      // Create 50 budgets
      act(() => {
        for (let i = 0; i < 50; i++) {
          mockUuidV4.mockReturnValueOnce(`budget-${i}`);
          result.current.addBudget({
            category: `category-${i}`,
            amount: 100 + i * 10,
            period: i % 3 === 0 ? 'weekly' : i % 3 === 1 ? 'monthly' : 'yearly',
          });
        }
      });

      expect(result.current.budgets).toHaveLength(50);

      // Test lookup performance (should be fast)
      const startTime = performance.now();
      for (let i = 0; i < 50; i++) {
        result.current.getBudgetByCategory(`category-${i}`);
      }
      const endTime = performance.now();
      
      // Should complete quickly (less than 10ms for 50 lookups)
      expect(endTime - startTime).toBeLessThan(10);
    });
  });
});
