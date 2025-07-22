/**
 * budgetsSlice Tests
 * Redux slice actions and reducers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadBudgets } from '../src/store/slices/budgetsSlice';

// Mock crypto
const mockCrypto = {
  getRandomValues: vi.fn(),
  subtle: {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
  },
};
global.crypto = mockCrypto as any;

describe('budgetsSlice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        budgets: budgetsSlice.reducer,
      },
    });
  });

  it('has correct initial state', () => {
    const state = store.getState().budgets;
    expect(state).toBeDefined();
  });

  it('handles add action', () => {
    const newItem = { id: '1', name: 'Test Item' };
    store.dispatch(budgetsSlice.actions.addBudgets(newItem));
    
    const state = store.getState().budgets;
    expect(state.items).toContain(newItem);
  });

  it('handles update action', () => {
    // Test update functionality
  });

  it('handles remove action', () => {
    // Test remove functionality
  });

});
