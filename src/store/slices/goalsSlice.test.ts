/**
 * goalsSlice Tests
 * Redux slice actions and reducers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadGoals } from '../src/store/slices/goalsSlice';

// Mock crypto
const mockCrypto = {
  getRandomValues: vi.fn(),
  subtle: {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
  },
};
global.crypto = mockCrypto as any;

describe('goalsSlice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        goals: goalsSlice.reducer,
      },
    });
  });

  it('has correct initial state', () => {
    const state = store.getState().goals;
    expect(state).toBeDefined();
  });

  it('handles add action', () => {
    const newItem = { id: '1', name: 'Test Item' };
    store.dispatch(goalsSlice.actions.addGoals(newItem));
    
    const state = store.getState().goals;
    expect(state.items).toContain(newItem);
  });

  it('handles update action', () => {
    // Test update functionality
  });

  it('handles remove action', () => {
    // Test remove functionality
  });

});
