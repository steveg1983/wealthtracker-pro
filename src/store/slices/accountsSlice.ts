import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import Decimal from 'decimal.js';
import type { Account } from '../../types';
import { storageAdapter } from '../../services/storageAdapter';

interface AccountsState {
  accounts: Account[];
  loading: boolean;
  error: string | null;
}

const initialState: AccountsState = {
  accounts: [],
  loading: false,
  error: null,
};

// Async thunk for loading accounts from storage
export const loadAccounts = createAsyncThunk(
  'accounts/load',
  async () => {
    const accounts = await storageAdapter.get<Account[]>('accounts') || [];
    return accounts;
  }
);

// Async thunk for saving accounts to storage
export const saveAccounts = createAsyncThunk(
  'accounts/save',
  async (accounts: Account[]) => {
    await storageAdapter.set('accounts', accounts);
    return accounts;
  }
);

const accountsSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {
    setAccounts: (state, action: PayloadAction<Account[]>) => {
      state.accounts = action.payload;
      state.error = null;
    },
    addAccount: (state, action: PayloadAction<Omit<Account, 'id' | 'lastUpdated'>>) => {
      const newAccount: Account = {
        ...action.payload,
        id: crypto.randomUUID(),
        lastUpdated: new Date(),
        updatedAt: new Date(),
      };
      state.accounts.push(newAccount);
    },
    updateAccount: (state, action: PayloadAction<{ id: string; updates: Partial<Account> }>) => {
      const index = state.accounts.findIndex(acc => acc.id === action.payload.id);
      if (index !== -1) {
        state.accounts[index] = {
          ...state.accounts[index],
          ...action.payload.updates,
          updatedAt: new Date(),
        };
      }
    },
    deleteAccount: (state, action: PayloadAction<string>) => {
      state.accounts = state.accounts.filter(acc => acc.id !== action.payload);
    },
    updateAccountBalance: (state, action: PayloadAction<{ id: string; balance: number }>) => {
      const account = state.accounts.find(acc => acc.id === action.payload.id);
      if (account) {
        account.balance = action.payload.balance;
        account.updatedAt = new Date();
      }
    },
    recalculateAllBalances: (state, action: PayloadAction<any[]>) => {
      // This will be implemented when we have the transactions state
      // For now, just a placeholder
    },
  },
  extraReducers: (builder) => {
    builder
      // Handle loadAccounts
      .addCase(loadAccounts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadAccounts.fulfilled, (state, action) => {
        state.loading = false;
        state.accounts = action.payload;
      })
      .addCase(loadAccounts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load accounts';
      })
      // Handle saveAccounts
      .addCase(saveAccounts.fulfilled, (state, action) => {
        state.accounts = action.payload;
      });
  },
});

export const {
  setAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  updateAccountBalance,
  recalculateAllBalances,
} = accountsSlice.actions;

export default accountsSlice.reducer;