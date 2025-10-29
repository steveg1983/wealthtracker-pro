import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import Decimal from 'decimal.js';
import type { Account } from '../../types';
import { getCurrentISOString } from '../../utils/dateHelpers';
import {
  fetchAccountsFromSupabase,
  createAccountInSupabase,
  updateAccountInSupabase,
  deleteAccountFromSupabase
} from '../thunks/supabaseThunks';

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

// Re-export Supabase thunks for external use
export {
  fetchAccountsFromSupabase,
  fetchAccountsFromSupabase as loadAccounts,
  createAccountInSupabase,
  updateAccountInSupabase,
  deleteAccountFromSupabase
} from '../thunks/supabaseThunks';

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
        lastUpdated: getCurrentISOString(),
        updatedAt: getCurrentISOString(),
      };
      state.accounts.push(newAccount);
    },
    updateAccount: (state, action: PayloadAction<{ id: string; updates: Partial<Account> }>) => {
      const index = state.accounts.findIndex(acc => acc.id === action.payload.id);
      if (index !== -1) {
        state.accounts[index] = {
          ...state.accounts[index],
          ...action.payload.updates,
          updatedAt: getCurrentISOString(),
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
        account.updatedAt = getCurrentISOString();
      }
    },
    recalculateAllBalances: (state, action: PayloadAction<any[]>) => {
      // This will be implemented when we have the transactions state
      // For now, just a placeholder
    },
  },
  extraReducers: (builder) => {
    builder
      // Handle fetchAccountsFromSupabase (loadAccounts)
      .addCase(fetchAccountsFromSupabase.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAccountsFromSupabase.fulfilled, (state, action) => {
        state.loading = false;
        state.accounts = action.payload;
      })
      .addCase(fetchAccountsFromSupabase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load accounts';
      })
      // Handle createAccountInSupabase
      .addCase(createAccountInSupabase.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createAccountInSupabase.fulfilled, (state, action) => {
        state.loading = false;
        // Remove any temporary account with the same name
        state.accounts = state.accounts.filter(acc => 
          !(acc.id.startsWith('temp-') && acc.name === action.payload.name)
        );
        // Add the new account from Supabase
        state.accounts.push(action.payload);
      })
      .addCase(createAccountInSupabase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create account';
      })
      // Handle updateAccountInSupabase
      .addCase(updateAccountInSupabase.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateAccountInSupabase.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.accounts.findIndex(acc => acc.id === action.payload.id);
        if (index !== -1) {
          state.accounts[index] = action.payload;
        }
      })
      .addCase(updateAccountInSupabase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update account';
      })
      // Handle deleteAccountFromSupabase
      .addCase(deleteAccountFromSupabase.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteAccountFromSupabase.fulfilled, (state, action) => {
        state.loading = false;
        state.accounts = state.accounts.filter(acc => acc.id !== action.payload);
      })
      .addCase(deleteAccountFromSupabase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete account';
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

export { accountsSlice };
export default accountsSlice.reducer;