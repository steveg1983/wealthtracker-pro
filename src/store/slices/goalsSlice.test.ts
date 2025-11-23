/**
 * goalsSlice Tests
 * Redux slice actions and reducers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import goalsReducer, { addGoal, updateGoal, deleteGoal, setGoals, updateGoalProgress } from './goalsSlice';
import type { Goal } from '../../types';

// Mock storageAdapter
vi.mock('../../services/storageAdapter', () => ({
  storageAdapter: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Mock dateHelpers
vi.mock('../../utils/dateHelpers', () => ({
  getCurrentISOString: () => '2024-01-01T00:00:00.000Z',
  toISOString: (date: Date) => date.toISOString(),
}));

// Mock crypto.randomUUID
global.crypto = {
  ...global.crypto,
  randomUUID: vi.fn(() => 'test-uuid-' + Math.random()),
};

describe('goalsSlice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        goals: goalsReducer,
      },
    });
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = store.getState().goals;
    expect(state).toEqual({
      goals: [],
      loading: false,
      error: null,
    });
  });

  it('handles setGoals action', () => {
    const testGoals: Goal[] = [
      {
        id: '1',
        name: 'Emergency Fund',
        description: 'Build 6 months of expenses',
        targetAmount: 10000,
        currentAmount: 5000,
        targetDate: '2024-12-31',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    
    store.dispatch(setGoals(testGoals));
    
    const state = store.getState().goals;
    expect(state.goals).toEqual(testGoals);
    expect(state.error).toBeNull();
  });

  it('handles addGoal action', () => {
    const newGoal = {
      name: 'Vacation Fund',
      description: 'Save for summer vacation',
      targetAmount: 3000,
      currentAmount: 0,
      targetDate: '2024-07-01',
    };
    
    store.dispatch(addGoal(newGoal));
    
    const state = store.getState().goals;
    expect(state.goals).toHaveLength(1);
    expect(state.goals[0]).toMatchObject({
      ...newGoal,
      id: expect.stringContaining('test-uuid-'),
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('handles updateGoal action', () => {
    // First add a goal
    const initialGoal: Goal = {
      id: 'goal-1',
      name: 'House Down Payment',
      description: 'Save for house down payment',
      targetAmount: 50000,
      currentAmount: 10000,
      targetDate: '2025-12-31',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    
    store.dispatch(setGoals([initialGoal]));
    
    // Update the goal
    store.dispatch(updateGoal({
      id: 'goal-1',
      updates: {
        currentAmount: 15000,
        targetAmount: 60000,
      },
    }));
    
    const state = store.getState().goals;
    expect(state.goals[0]).toMatchObject({
      ...initialGoal,
      currentAmount: 15000,
      targetAmount: 60000,
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('handles deleteGoal action', () => {
    const goals: Goal[] = [
      {
        id: 'goal-1',
        name: 'Goal 1',
        targetAmount: 1000,
        currentAmount: 0,
        targetDate: '2024-12-31',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'goal-2',
        name: 'Goal 2',
        targetAmount: 2000,
        currentAmount: 0,
        targetDate: '2024-12-31',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    
    store.dispatch(setGoals(goals));
    store.dispatch(deleteGoal('goal-1'));
    
    const state = store.getState().goals;
    expect(state.goals).toHaveLength(1);
    expect(state.goals[0].id).toBe('goal-2');
  });

  it('handles updateGoalProgress action', () => {
    const goal: Goal = {
      id: 'goal-1',
      name: 'Investment Goal',
      targetAmount: 100000,
      currentAmount: 25000,
      targetDate: '2025-12-31',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    
    store.dispatch(setGoals([goal]));
    store.dispatch(updateGoalProgress({ id: 'goal-1', currentAmount: 35000 }));
    
    const state = store.getState().goals;
    expect(state.goals[0].currentAmount).toBe(35000);
    expect(state.goals[0].updatedAt).toBe('2024-01-01T00:00:00.000Z');
  });
});
