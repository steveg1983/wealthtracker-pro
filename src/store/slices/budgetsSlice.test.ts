/**
 * budgetsSlice Tests
 * Redux slice actions and reducers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import budgetsReducer, { addBudget, updateBudget, deleteBudget, setBudgets, updateBudgetSpent, loadBudgets, saveBudgets } from './budgetsSlice';
import type { Budget } from '../../types';

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
}));

// Mock crypto.randomUUID
global.crypto = {
  ...global.crypto,
  randomUUID: vi.fn(() => 'test-uuid-' + Math.random()),
};

describe('budgetsSlice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        budgets: budgetsReducer,
      },
    });
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = store.getState().budgets;
    expect(state).toEqual({
      budgets: [],
      loading: false,
      error: null,
    });
  });

  it('handles setBudgets action', () => {
    const testBudgets: Budget[] = [
      {
        id: '1',
        name: 'Food',
        amount: 500,
        spent: 250,
        categoryId: 'cat-1',
        period: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    
    store.dispatch(setBudgets(testBudgets));
    
    const state = store.getState().budgets;
    expect(state.budgets).toEqual(testBudgets);
    expect(state.error).toBeNull();
  });

  it('handles addBudget action', () => {
    const newBudget = {
      name: 'Groceries',
      amount: 600,
      spent: 0,
      categoryId: 'cat-2',
      period: 'monthly' as const,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    };
    
    store.dispatch(addBudget(newBudget));
    
    const state = store.getState().budgets;
    expect(state.budgets).toHaveLength(1);
    expect(state.budgets[0]).toMatchObject({
      ...newBudget,
      id: expect.stringContaining('test-uuid-'),
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('handles updateBudget action', () => {
    // First add a budget
    const initialBudget: Budget = {
      id: 'budget-1',
      name: 'Entertainment',
      amount: 300,
      spent: 100,
      categoryId: 'cat-3',
      period: 'monthly',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    
    store.dispatch(setBudgets([initialBudget]));
    
    // Update the budget
    store.dispatch(updateBudget({
      id: 'budget-1',
      updates: {
        amount: 400,
        spent: 150,
      },
    }));
    
    const state = store.getState().budgets;
    expect(state.budgets[0]).toMatchObject({
      ...initialBudget,
      amount: 400,
      spent: 150,
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('handles deleteBudget action', () => {
    const budgets: Budget[] = [
      {
        id: 'budget-1',
        name: 'Budget 1',
        amount: 100,
        spent: 0,
        categoryId: 'cat-1',
        period: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'budget-2',
        name: 'Budget 2',
        amount: 200,
        spent: 0,
        categoryId: 'cat-2',
        period: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    
    store.dispatch(setBudgets(budgets));
    store.dispatch(deleteBudget('budget-1'));
    
    const state = store.getState().budgets;
    expect(state.budgets).toHaveLength(1);
    expect(state.budgets[0].id).toBe('budget-2');
  });

  it('handles updateBudgetSpent action', () => {
    const budget: Budget = {
      id: 'budget-1',
      name: 'Travel',
      amount: 1000,
      spent: 200,
      categoryId: 'cat-4',
      period: 'monthly',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    
    store.dispatch(setBudgets([budget]));
    store.dispatch(updateBudgetSpent({ id: 'budget-1', spent: 350 }));
    
    const state = store.getState().budgets;
    expect(state.budgets[0].spent).toBe(350);
    expect(state.budgets[0].updatedAt).toBe('2024-01-01T00:00:00.000Z');
  });
});
