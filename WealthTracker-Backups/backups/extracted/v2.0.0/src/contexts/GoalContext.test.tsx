/**
 * GoalContext Tests
 * Comprehensive tests for the goal context provider
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { GoalProvider, useGoals } from './GoalContext';

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

describe('GoalContext', () => {
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
    <GoalProvider>{children}</GoalProvider>
  );

  const wrapperWithInitial = (initialGoals: any[]) => 
    ({ children }: { children: ReactNode }) => (
      <GoalProvider initialGoals={initialGoals}>{children}</GoalProvider>
    );

  const createMockGoal = (overrides = {}) => ({
    id: 'goal-1',
    name: 'Emergency Fund',
    type: 'savings' as const,
    targetAmount: 10000,
    currentAmount: 2500,
    targetDate: new Date('2025-12-31'),
    isActive: true,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  });

  describe('initialization', () => {
    it('provides empty array when localStorage is empty', () => {
      const { result } = renderHook(() => useGoals(), { wrapper });

      expect(result.current.goals).toEqual([]);
    });

    it('loads goals from localStorage', () => {
      const savedGoals = [
        {
          id: 'saved-1',
          name: 'Vacation Fund',
          type: 'savings',
          targetAmount: 5000,
          currentAmount: 1000,
          targetDate: '2025-06-30T00:00:00.000Z',
          isActive: true,
          createdAt: '2025-01-15T00:00:00.000Z',
        },
        {
          id: 'saved-2',
          name: 'Debt Payoff',
          type: 'debt-payoff',
          targetAmount: 15000,
          currentAmount: 3000,
          targetDate: '2026-01-01T00:00:00.000Z',
          isActive: true,
          createdAt: '2025-01-10T00:00:00.000Z',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedGoals));

      const { result } = renderHook(() => useGoals(), { wrapper });

      expect(result.current.goals).toHaveLength(2);
      expect(result.current.goals[0].name).toBe('Vacation Fund');
      expect(result.current.goals[0].targetDate).toBeInstanceOf(Date);
      expect(result.current.goals[0].createdAt).toBeInstanceOf(Date);
    });

    it('handles invalid localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      const { result } = renderHook(() => useGoals(), { wrapper });

      expect(result.current.goals).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error parsing saved goals:',
        expect.any(Error)
      );
    });

    it('uses initialGoals when provided and localStorage is empty', () => {
      const initialGoals = [createMockGoal()];

      const { result } = renderHook(
        () => useGoals(),
        { wrapper: wrapperWithInitial(initialGoals) }
      );

      expect(result.current.goals).toEqual(initialGoals);
    });

    it('prefers localStorage over initialGoals', () => {
      const savedGoals = [
        {
          id: 'saved-1',
          name: 'Saved Goal',
          type: 'savings',
          targetAmount: 1000,
          currentAmount: 0,
          targetDate: '2025-12-31T00:00:00.000Z',
          isActive: true,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ];
      const initialGoals = [createMockGoal({ name: 'Initial Goal' })];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedGoals));

      const { result } = renderHook(
        () => useGoals(),
        { wrapper: wrapperWithInitial(initialGoals) }
      );

      expect(result.current.goals[0].name).toBe('Saved Goal');
    });

    it('parses dates correctly from localStorage', () => {
      const savedGoals = [
        {
          id: 'saved-1',
          name: 'Test Goal',
          type: 'savings',
          targetAmount: 1000,
          currentAmount: 0,
          targetDate: '2025-12-31T00:00:00.000Z',
          isActive: true,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedGoals));

      const { result } = renderHook(() => useGoals(), { wrapper });

      const goal = result.current.goals[0];
      expect(goal.targetDate).toBeInstanceOf(Date);
      expect(goal.targetDate.getFullYear()).toBe(2025);
      expect(goal.targetDate.getMonth()).toBe(11); // December (0-indexed)
      expect(goal.createdAt).toBeInstanceOf(Date);
      expect(goal.createdAt.getFullYear()).toBe(2025);
      expect(goal.createdAt.getMonth()).toBe(0); // January
    });
  });

  describe('addGoal', () => {
    it('adds a new goal with generated id and createdAt', () => {
      const { result } = renderHook(() => useGoals(), { wrapper });

      const newGoal = {
        name: 'New Car',
        type: 'savings' as const,
        targetAmount: 30000,
        currentAmount: 5000,
        targetDate: new Date('2026-06-30'),
        isActive: true,
      };

      act(() => {
        result.current.addGoal(newGoal);
      });

      expect(result.current.goals).toHaveLength(1);
      expect(result.current.goals[0]).toMatchObject({
        ...newGoal,
        id: 'mock-uuid-123',
        createdAt: new Date('2025-01-20T12:00:00'),
      });
    });

    it('saves to localStorage after adding', () => {
      const { result } = renderHook(() => useGoals(), { wrapper });

      act(() => {
        result.current.addGoal({
          name: 'Test Goal',
          type: 'savings',
          targetAmount: 1000,
          currentAmount: 0,
          targetDate: new Date('2025-12-31'),
          isActive: true,
        });
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_goals',
        expect.stringContaining('Test Goal')
      );
    });

    it('handles goals with optional fields', () => {
      const { result } = renderHook(() => useGoals(), { wrapper });

      const goalWithOptionals = {
        name: 'Investment Goal',
        type: 'investment' as const,
        targetAmount: 50000,
        currentAmount: 10000,
        targetDate: new Date('2030-01-01'),
        description: 'Retirement investment portfolio',
        linkedAccountIds: ['account-1', 'account-2'],
        isActive: true,
      };

      act(() => {
        result.current.addGoal(goalWithOptionals);
      });

      const added = result.current.goals[0];
      expect(added.description).toBe('Retirement investment portfolio');
      expect(added.linkedAccountIds).toEqual(['account-1', 'account-2']);
    });

    it('supports all goal types', () => {
      const { result } = renderHook(() => useGoals(), { wrapper });

      const goalTypes = ['savings', 'debt-payoff', 'investment', 'custom'] as const;

      goalTypes.forEach((type, index) => {
        mockUuidV4.mockReturnValueOnce(`goal-${index}`);
        act(() => {
          result.current.addGoal({
            name: `${type} Goal`,
            type,
            targetAmount: 1000,
            currentAmount: 0,
            targetDate: new Date('2025-12-31'),
            isActive: true,
          });
        });
      });

      expect(result.current.goals).toHaveLength(4);
      goalTypes.forEach((type, index) => {
        expect(result.current.goals[index].type).toBe(type);
      });
    });
  });

  describe('updateGoal', () => {
    it('updates an existing goal', () => {
      const initialGoal = createMockGoal();
      const { result } = renderHook(
        () => useGoals(),
        { wrapper: wrapperWithInitial([initialGoal]) }
      );

      act(() => {
        result.current.updateGoal('goal-1', {
          name: 'Updated Emergency Fund',
          currentAmount: 5000,
        });
      });

      const updated = result.current.goals[0];
      expect(updated.name).toBe('Updated Emergency Fund');
      expect(updated.currentAmount).toBe(5000);
      expect(updated.targetAmount).toBe(10000); // Unchanged
    });

    it('does nothing if goal not found', () => {
      const initialGoal = createMockGoal();
      const { result } = renderHook(
        () => useGoals(),
        { wrapper: wrapperWithInitial([initialGoal]) }
      );

      act(() => {
        result.current.updateGoal('non-existent', { name: 'Should not update' });
      });

      expect(result.current.goals[0].name).toBe('Emergency Fund');
    });

    it('saves to localStorage after updating', () => {
      const initialGoal = createMockGoal();
      const { result } = renderHook(
        () => useGoals(),
        { wrapper: wrapperWithInitial([initialGoal]) }
      );

      mockLocalStorage.setItem.mockClear();

      act(() => {
        result.current.updateGoal('goal-1', { currentAmount: 3000 });
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_goals',
        expect.stringContaining('3000')
      );
    });

    it('can update date fields', () => {
      const initialGoal = createMockGoal();
      const { result } = renderHook(
        () => useGoals(),
        { wrapper: wrapperWithInitial([initialGoal]) }
      );

      const newTargetDate = new Date('2026-06-30');

      act(() => {
        result.current.updateGoal('goal-1', { targetDate: newTargetDate });
      });

      expect(result.current.goals[0].targetDate).toEqual(newTargetDate);
    });

    it('can toggle isActive status', () => {
      const initialGoal = createMockGoal({ isActive: true });
      const { result } = renderHook(
        () => useGoals(),
        { wrapper: wrapperWithInitial([initialGoal]) }
      );

      act(() => {
        result.current.updateGoal('goal-1', { isActive: false });
      });

      expect(result.current.goals[0].isActive).toBe(false);
    });
  });

  describe('deleteGoal', () => {
    it('deletes an existing goal', () => {
      const goals = [
        createMockGoal({ id: 'goal-1' }),
        createMockGoal({ id: 'goal-2', name: 'Vacation Fund' }),
      ];
      const { result } = renderHook(
        () => useGoals(),
        { wrapper: wrapperWithInitial(goals) }
      );

      act(() => {
        result.current.deleteGoal('goal-1');
      });

      expect(result.current.goals).toHaveLength(1);
      expect(result.current.goals[0].id).toBe('goal-2');
    });

    it('does nothing if goal not found', () => {
      const initialGoal = createMockGoal();
      const { result } = renderHook(
        () => useGoals(),
        { wrapper: wrapperWithInitial([initialGoal]) }
      );

      act(() => {
        result.current.deleteGoal('non-existent');
      });

      expect(result.current.goals).toHaveLength(1);
    });

    it('saves to localStorage after deletion', () => {
      const goals = [
        createMockGoal({ id: 'goal-1' }),
        createMockGoal({ id: 'goal-2', name: 'Keep this' }),
      ];
      const { result } = renderHook(
        () => useGoals(),
        { wrapper: wrapperWithInitial(goals) }
      );

      mockLocalStorage.setItem.mockClear();

      act(() => {
        result.current.deleteGoal('goal-1');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const savedData = mockLocalStorage.setItem.mock.calls[0][1];
      expect(savedData).not.toContain('Emergency Fund');
      expect(savedData).toContain('Keep this');
    });
  });

  describe('getGoalById', () => {
    it('returns goal by id', () => {
      const goals = [
        createMockGoal({ id: 'goal-1' }),
        createMockGoal({ id: 'goal-2', name: 'Vacation Fund' }),
      ];
      const { result } = renderHook(
        () => useGoals(),
        { wrapper: wrapperWithInitial(goals) }
      );

      const goal = result.current.getGoalById('goal-2');

      expect(goal).toBeDefined();
      expect(goal?.name).toBe('Vacation Fund');
    });

    it('returns undefined for non-existent id', () => {
      const initialGoal = createMockGoal();
      const { result } = renderHook(
        () => useGoals(),
        { wrapper: wrapperWithInitial([initialGoal]) }
      );

      const goal = result.current.getGoalById('non-existent');

      expect(goal).toBeUndefined();
    });
  });

  describe('getActiveGoals', () => {
    it('returns only active goals', () => {
      const goals = [
        createMockGoal({ id: 'goal-1', isActive: true }),
        createMockGoal({ id: 'goal-2', name: 'Inactive Goal', isActive: false }),
        createMockGoal({ id: 'goal-3', name: 'Another Active', isActive: true }),
      ];
      const { result } = renderHook(
        () => useGoals(),
        { wrapper: wrapperWithInitial(goals) }
      );

      const activeGoals = result.current.getActiveGoals();

      expect(activeGoals).toHaveLength(2);
      expect(activeGoals[0].id).toBe('goal-1');
      expect(activeGoals[1].id).toBe('goal-3');
    });

    it('returns empty array when no active goals', () => {
      const goals = [
        createMockGoal({ id: 'goal-1', isActive: false }),
        createMockGoal({ id: 'goal-2', isActive: false }),
      ];
      const { result } = renderHook(
        () => useGoals(),
        { wrapper: wrapperWithInitial(goals) }
      );

      const activeGoals = result.current.getActiveGoals();

      expect(activeGoals).toEqual([]);
    });

    it('returns empty array when no goals exist', () => {
      const { result } = renderHook(() => useGoals(), { wrapper });

      const activeGoals = result.current.getActiveGoals();

      expect(activeGoals).toEqual([]);
    });
  });

  describe('persistence', () => {
    it('saves to localStorage on every change', () => {
      const { result } = renderHook(() => useGoals(), { wrapper });

      mockLocalStorage.setItem.mockClear();

      // Add
      act(() => {
        result.current.addGoal({
          name: 'Test 1',
          type: 'savings',
          targetAmount: 1000,
          currentAmount: 0,
          targetDate: new Date('2025-12-31'),
          isActive: true,
        });
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);

      // Update
      act(() => {
        result.current.updateGoal('mock-uuid-123', { currentAmount: 500 });
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);

      // Delete
      act(() => {
        result.current.deleteGoal('mock-uuid-123');
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3);
    });

    it('persists goals across remounts', () => {
      // First mount
      const { result: result1, unmount } = renderHook(() => useGoals(), { wrapper });

      act(() => {
        result1.current.addGoal({
          name: 'Persistent Goal',
          type: 'savings',
          targetAmount: 5000,
          currentAmount: 1000,
          targetDate: new Date('2025-12-31'),
          isActive: true,
        });
      });

      // Unmount
      unmount();

      // Mock localStorage to return saved goal
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'money_management_goals') {
          return JSON.stringify([{
            id: 'mock-uuid-123',
            name: 'Persistent Goal',
            type: 'savings',
            targetAmount: 5000,
            currentAmount: 1000,
            targetDate: '2025-12-31T00:00:00.000Z',
            isActive: true,
            createdAt: '2025-01-20T12:00:00.000Z',
          }]);
        }
        return null;
      });

      // Remount
      const { result: result2 } = renderHook(() => useGoals(), { wrapper });

      expect(result2.current.goals).toHaveLength(1);
      expect(result2.current.goals[0].name).toBe('Persistent Goal');
    });
  });

  describe('error handling', () => {
    it('throws error when useGoals is used outside provider', () => {
      expect(() => {
        renderHook(() => useGoals());
      }).toThrow('useGoals must be used within GoalProvider');
    });

    it('throws when localStorage fails', () => {
      const { result } = renderHook(() => useGoals(), { wrapper });

      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => {
        act(() => {
          result.current.addGoal({
            name: 'Test',
            type: 'savings',
            targetAmount: 1000,
            currentAmount: 0,
            targetDate: new Date(),
            isActive: true,
          });
        });
      }).toThrow('Storage quota exceeded');
    });
  });

  describe('complex scenarios', () => {
    it('handles multiple goal operations', () => {
      const { result } = renderHook(() => useGoals(), { wrapper });

      // Add multiple goals
      const goalData = [
        { name: 'Goal 1', type: 'savings' as const, targetAmount: 1000 },
        { name: 'Goal 2', type: 'debt-payoff' as const, targetAmount: 2000 },
        { name: 'Goal 3', type: 'investment' as const, targetAmount: 3000 },
      ];

      act(() => {
        goalData.forEach((data, index) => {
          mockUuidV4.mockReturnValueOnce(`goal-${index + 1}`);
          result.current.addGoal({
            ...data,
            currentAmount: index * 100,
            targetDate: new Date('2025-12-31'),
            isActive: index !== 1, // Make second goal inactive
          });
        });
      });

      expect(result.current.goals).toHaveLength(3);

      // Update progress on active goals
      act(() => {
        result.current.updateGoal('goal-1', { currentAmount: 500 });
        result.current.updateGoal('goal-3', { currentAmount: 600 });
      });

      // Check active goals
      const activeGoals = result.current.getActiveGoals();
      expect(activeGoals).toHaveLength(2);
      expect(activeGoals[0].currentAmount).toBe(500);
      expect(activeGoals[1].currentAmount).toBe(600);

      // Delete middle goal
      act(() => {
        result.current.deleteGoal('goal-2');
      });

      expect(result.current.goals).toHaveLength(2);
    });

    it('handles goal progress tracking', () => {
      const { result } = renderHook(() => useGoals(), { wrapper });

      // Create a goal
      act(() => {
        result.current.addGoal({
          name: 'Progress Test',
          type: 'savings',
          targetAmount: 10000,
          currentAmount: 0,
          targetDate: new Date('2025-12-31'),
          isActive: true,
        });
      });

      // Simulate progress updates
      const progressUpdates = [1000, 2500, 5000, 7500, 10000];

      progressUpdates.forEach(amount => {
        act(() => {
          result.current.updateGoal('mock-uuid-123', { currentAmount: amount });
        });

        const goal = result.current.getGoalById('mock-uuid-123');
        expect(goal?.currentAmount).toBe(amount);
        
        // Calculate progress percentage
        const progress = (amount / 10000) * 100;
        expect(progress).toBe((amount / 10000) * 100);
      });
    });

    it('handles linked accounts', () => {
      const { result } = renderHook(() => useGoals(), { wrapper });

      // Create goal with linked accounts
      act(() => {
        result.current.addGoal({
          name: 'Linked Account Goal',
          type: 'savings',
          targetAmount: 5000,
          currentAmount: 1000,
          targetDate: new Date('2025-12-31'),
          linkedAccountIds: ['account-1', 'account-2'],
          isActive: true,
        });
      });

      // Add more linked accounts
      act(() => {
        const goal = result.current.goals[0];
        result.current.updateGoal(goal.id, {
          linkedAccountIds: [...(goal.linkedAccountIds || []), 'account-3'],
        });
      });

      const updatedGoal = result.current.goals[0];
      expect(updatedGoal.linkedAccountIds).toHaveLength(3);
      expect(updatedGoal.linkedAccountIds).toContain('account-3');

      // Remove a linked account
      act(() => {
        result.current.updateGoal(updatedGoal.id, {
          linkedAccountIds: updatedGoal.linkedAccountIds?.filter(id => id !== 'account-2'),
        });
      });

      expect(result.current.goals[0].linkedAccountIds).toHaveLength(2);
      expect(result.current.goals[0].linkedAccountIds).not.toContain('account-2');
    });

    it('handles date-based goal filtering', () => {
      const { result } = renderHook(() => useGoals(), { wrapper });

      // Create goals with different target dates
      const goals = [
        { name: 'Short-term', targetDate: new Date('2025-03-31') },
        { name: 'Medium-term', targetDate: new Date('2025-12-31') },
        { name: 'Long-term', targetDate: new Date('2030-01-01') },
      ];

      act(() => {
        goals.forEach((goal, index) => {
          mockUuidV4.mockReturnValueOnce(`goal-${index + 1}`);
          result.current.addGoal({
            ...goal,
            type: 'savings',
            targetAmount: 10000,
            currentAmount: 0,
            isActive: true,
          });
        });
      });

      // Filter goals by target date
      const currentDate = new Date('2025-01-20');
      const shortTermGoals = result.current.goals.filter(goal => {
        const monthsUntilTarget = (goal.targetDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        return monthsUntilTarget <= 6;
      });

      expect(shortTermGoals).toHaveLength(1);
      expect(shortTermGoals[0].name).toBe('Short-term');
    });
  });
});