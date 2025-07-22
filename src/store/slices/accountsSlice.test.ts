/**
 * accountsSlice Tests
 * Redux slice actions and reducers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadAccounts } from '../src/store/slices/accountsSlice';

// Mock crypto
const mockCrypto = {
  getRandomValues: vi.fn(),
  subtle: {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
  },
};
global.crypto = mockCrypto as any;

describe('accountsSlice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        accounts: accountsSlice.reducer,
      },
    });
  });

  it('has correct initial state', () => {
    const state = store.getState().accounts;
    expect(state).toBeDefined();
  });

  it('handles add action', () => {
    const newItem = { id: '1', name: 'Test Item' };
    store.dispatch(accountsSlice.actions.addAccounts(newItem));
    
    const state = store.getState().accounts;
    expect(state.items).toContain(newItem);
  });

  it('handles update action', () => {
    // Test update functionality
  });

  it('handles remove action', () => {
    // Test remove functionality
  });

});
