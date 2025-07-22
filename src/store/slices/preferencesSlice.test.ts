/**
 * preferencesSlice Tests
 * Redux slice actions and reducers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { preferencesSlice } from '../src/store/slices/preferencesSlice';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = mockLocalStorage as any;

describe('preferencesSlice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        preferences: preferencesSlice.reducer,
      },
    });
  });

  it('has correct initial state', () => {
    const state = store.getState().preferences;
    expect(state).toBeDefined();
  });

  it('handles add action', () => {
    const newItem = { id: '1', name: 'Test Item' };
    store.dispatch(preferencesSlice.actions.addPreferences(newItem));
    
    const state = store.getState().preferences;
    expect(state.items).toContain(newItem);
  });

  it('handles update action', () => {
    // Test update functionality
  });

  it('handles remove action', () => {
    // Test remove functionality
  });

});
