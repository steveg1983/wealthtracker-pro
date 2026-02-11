import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { SerializedTransaction } from '../../types/redux-types';
import { serializeTransaction, serializeTransactions } from '../../types/redux-types';
import type { Transaction } from '../../types';
import { getCurrentISOString } from '../../utils/dateHelpers';
import {
  fetchTransactionsFromSupabase,
  createTransactionInSupabase,
  updateTransactionInSupabase,
  deleteTransactionFromSupabase
} from '../thunks/supabaseThunks';

interface TransactionsState {
  transactions: SerializedTransaction[];
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
      state.transactions = serializeTransactions(action.payload);
      state.error = null;
    },
    addTransaction: (state, action: PayloadAction<Omit<Transaction, 'id'>>) => {
      const now = getCurrentISOString();
      const newTransaction: Transaction = {
        ...action.payload,
        id: crypto.randomUUID(),
        date: action.payload.date instanceof Date ? action.payload.date : new Date(action.payload.date),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      };
      state.transactions.push(serializeTransaction(newTransaction));
    },
    updateTransaction: (state, action: PayloadAction<{ id: string; updates: Partial<Transaction> }>) => {
      const index = state.transactions.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        // Extract date fields to handle separately
        const { date, reconciledDate, createdAt, updatedAt: _, ...nonDateUpdates } = action.payload.updates;

        state.transactions[index] = {
          ...state.transactions[index],
          ...nonDateUpdates,
          updatedAt: getCurrentISOString(),
          ...(date !== undefined && { date: date instanceof Date ? date.toISOString() : date }),
          ...(reconciledDate !== undefined && { reconciledDate: reconciledDate instanceof Date ? reconciledDate.toISOString() : reconciledDate }),
          ...(createdAt !== undefined && { createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt }),
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
      const { date, reconciledDate, createdAt, updatedAt: _, ...nonDateUpdates } = action.payload.updates;
      const now = getCurrentISOString();

      state.transactions = state.transactions.map(t =>
        idsToUpdate.has(t.id)
          ? {
              ...t,
              ...nonDateUpdates,
              updatedAt: now,
              ...(date !== undefined && { date: date instanceof Date ? date.toISOString() : date }),
              ...(reconciledDate !== undefined && { reconciledDate: reconciledDate instanceof Date ? reconciledDate.toISOString() : reconciledDate }),
              ...(createdAt !== undefined && { createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt }),
            }
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
        // Data from Supabase has dates as ISO strings, use serializer to ensure proper typing
        state.transactions = serializeTransactions(action.payload);
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
        const serializedPayload = serializeTransaction(action.payload);
        // Remove any temporary transaction with the same data
        state.transactions = state.transactions.filter(txn =>
          !(txn.id.startsWith('temp-') &&
            txn.description === serializedPayload.description &&
            txn.amount === serializedPayload.amount &&
            txn.accountId === serializedPayload.accountId)
        );
        // Add the new transaction from Supabase
        state.transactions.push(serializedPayload);
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
        const serializedPayload = serializeTransaction(action.payload);
        const index = state.transactions.findIndex(txn => txn.id === serializedPayload.id);
        if (index !== -1) {
          state.transactions[index] = serializedPayload;
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
