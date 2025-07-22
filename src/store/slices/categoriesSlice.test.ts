/**
 * categoriesSlice Tests
 * Redux slice actions and reducers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadCategories } from '../src/store/slices/categoriesSlice';

// Mock crypto
const mockCrypto = {
  getRandomValues: vi.fn(),
  subtle: {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
  },
};
global.crypto = mockCrypto as any;

describe('categoriesSlice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        categories: categoriesSlice.reducer,
      },
    });
  });

  it('has correct initial state', () => {
    const state = store.getState().categories;
    expect(state).toBeDefined();
  });

  it('handles add action', () => {
    const newItem = { id: '1', name: 'Test Item' };
    store.dispatch(categoriesSlice.actions.addCategories(newItem));
    
    const state = store.getState().categories;
    expect(state.items).toContain(newItem);
  });

  it('handles update action', () => {
    // Test update functionality
  });

  it('handles remove action', () => {
    // Test remove functionality
  });

});
