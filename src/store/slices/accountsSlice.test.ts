/**
 * accountsSlice Tests
 * Redux slice actions and reducers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import accountsSlice, { addAccount, updateAccount, deleteAccount } from './accountsSlice';

// Mock crypto.randomUUID
global.crypto = {
  ...global.crypto,
  randomUUID: vi.fn(() => 'test-uuid-' + Math.random()),
};

// Mock storageAdapter
vi.mock('../../services/storageAdapter', () => ({
  storageAdapter: {
    get: vi.fn().mockResolvedValue([]),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('accountsSlice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        accounts: accountsSlice,
      },
    });
  });

  it('has correct initial state', () => {
    const state = store.getState().accounts;
    expect(state).toBeDefined();
    expect(state.accounts).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBe(null);
  });

  it('handles add action', () => {
    const newAccount = {
      name: 'Test Account',
      type: 'checking' as const,
      balance: '1000',
      currency: 'USD',
    };
    
    store.dispatch(addAccount(newAccount));
    
    const state = store.getState().accounts;
    expect(state.accounts).toHaveLength(1);
    expect(state.accounts[0]).toMatchObject(newAccount);
    expect(state.accounts[0].id).toBeDefined();
  });

  it('handles update action', () => {
    // First add an account
    const account = {
      name: 'Original Account',
      type: 'checking' as const,
      balance: '1000',
      currency: 'USD',
    };
    
    store.dispatch(addAccount(account));
    const id = store.getState().accounts.accounts[0].id;
    
    // Update it
    store.dispatch(updateAccount({ id, updates: { name: 'Updated Account' } }));
    
    const state = store.getState().accounts;
    expect(state.accounts[0].name).toBe('Updated Account');
  });

  it('handles remove action', () => {
    // First add an account
    const account = {
      name: 'To be deleted',
      type: 'checking' as const,
      balance: '1000',
      currency: 'USD',
    };
    
    store.dispatch(addAccount(account));
    const id = store.getState().accounts.accounts[0].id;
    
    // Delete it
    store.dispatch(deleteAccount(id));
    
    const state = store.getState().accounts;
    expect(state.accounts).toHaveLength(0);
  });

});
