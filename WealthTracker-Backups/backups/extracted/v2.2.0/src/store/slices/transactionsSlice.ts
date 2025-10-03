import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { serializeForRedux } from '../../utils/serializeForRedux';
import Decimal from 'decimal.js';
import type { Transaction } from '../../types';
import { getCurrentISOString, toISOString } from '../../utils/dateHelpers';
import {
  fetchTransactionsFromSupabase,
  createTransactionInSupabase,
  updateTransactionInSupabase,
  deleteTransactionFromSupabase
} from '../thunks/supabaseThunks';

interface TransactionsState {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
}

const initialState: TransactionsState = {
  transactions: [],
  loading: false,
  error: null,
};

// Re-export Supabase thunks for external use
export {
  fetchTransactionsFromSupabase,
  fetchTransactionsFromSupabase as loadTransactions,
  createTransactionInSupabase,
  updateTransactionInSupabase,
  deleteTransactionFromSupabase
} from '../thunks/supabaseThunks';

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    setTransactions: (state, action: PayloadAction<Transaction[]>) => {
      state.transactions = serializeForRedux(action.payload) as Transaction[];
      state.error = null;
    },
    addTransaction: (state, action: PayloadAction<Omit<Transaction, 'id'>>) => {
      const newTransaction: Transaction = {
        ...action.payload,
        id: crypto.randomUUID(),
        date: toISOString(action.payload.date) || getCurrentISOString(),
      };
      state.transactions.push(serializeForRedux(newTransaction) as Transaction);
    },
    updateTransaction: (state, action: PayloadAction<{ id: string; updates: Partial<Transaction> }>) => {
      const index = state.transactions.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        state.transactions[index] = {
          ...state.transactions[index],
          ...action.payload.updates,
        };
      }
    },
    deleteTransaction: (state, action: PayloadAction<string>) => {
      state.transactions = state.transactions.filter(t => t.id !== action.payload);
    },
    bulkDeleteTransactions: (state, action: PayloadAction<string[]>) => {
      const idsToDelete = new Set(action.payload);
      state.transactions = state.transactions.filter(t => !idsToDelete.has(t.id));
    },
    bulkUpdateTransactions: (state, action: PayloadAction<{ ids: string[]; updates: Partial<Transaction> }>) => {
      const idsToUpdate = new Set(action.payload.ids);
      state.transactions = state.transactions.map(t => 
        idsToUpdate.has(t.id) 
          ? { ...t, ...action.payload.updates, updatedAt: getCurrentISOString() }
          : t
      );
    },
  },
  extraReducers: (builder) => {
    builder
      // Handle fetchTransactionsFromSupabase (loadTransactions)
      .addCase(fetchTransactionsFromSupabase.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactionsFromSupabase.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchTransactionsFromSupabase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load transactions';
      })
      // Handle createTransactionInSupabase
      .addCase(createTransactionInSupabase.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createTransactionInSupabase.fulfilled, (state, action) => {
        state.loading = false;
        // Remove any temporary transaction with the same data
        state.transactions = state.transactions.filter(txn => 
          !(txn.id.startsWith('temp-') && 
            txn.description === action.payload.description &&
            txn.amount === action.payload.amount &&
            txn.accountId === action.payload.accountId)
        );
        // Add the new transaction from Supabase
        state.transactions.push(action.payload);
      })
      .addCase(createTransactionInSupabase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create transaction';
      })
      // Handle updateTransactionInSupabase
      .addCase(updateTransactionInSupabase.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateTransactionInSupabase.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.transactions.findIndex(txn => txn.id === action.payload.id);
        if (index !== -1) {
          state.transactions[index] = serializeForRedux(action.payload) as Transaction;
        }
      })
      .addCase(updateTransactionInSupabase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update transaction';
      })
      // Handle deleteTransactionFromSupabase
      .addCase(deleteTransactionFromSupabase.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteTransactionFromSupabase.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = state.transactions.filter(txn => txn.id !== action.payload);
      })
      .addCase(deleteTransactionFromSupabase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete transaction';
      });
  },
});

export const {
  setTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  bulkDeleteTransactions,
  bulkUpdateTransactions,
} = transactionsSlice.actions;

export { transactionsSlice };

export default transactionsSlice.reducer;
