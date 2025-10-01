import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { serializeForRedux } from '../../utils/serializeForRedux';
import type { Transaction } from '../../types';
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

const coerceDate = (value: Date | string | null | undefined): Date | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return value instanceof Date ? value : new Date(value);
};

const sanitizeTransactionUpdates = (updates: Partial<Transaction>): Partial<Transaction> => {
  const sanitized: Partial<Transaction> = {};

  if (updates.date !== undefined) {
    const parsed = coerceDate(updates.date);
    if (parsed) {
      sanitized.date = parsed;
    }
  }

  if (updates.reconciledDate !== undefined) {
    const parsed = coerceDate(updates.reconciledDate);
    if (parsed) {
      sanitized.reconciledDate = parsed;
    }
  }

  for (const key of Object.keys(updates) as (keyof Transaction)[]) {
    if (key === 'date' || key === 'reconciledDate') {
      continue;
    }
    const value = updates[key];
    if (value !== undefined) {
      (sanitized as Record<string, unknown>)[key as string] = value;
    }
  }

  return sanitized;
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
      state.transactions = serializeForRedux(action.payload) as any;
      state.error = null;
    },
    addTransaction: (state, action: PayloadAction<Omit<Transaction, 'id'>>) => {
      const baseDate = coerceDate(action.payload.date) ?? new Date();
      const newTransaction: Transaction = {
        ...action.payload,
        id: crypto.randomUUID(),
        date: baseDate,
      };
      state.transactions.push(serializeForRedux(newTransaction) as any);
    },
    updateTransaction: (state, action: PayloadAction<{ id: string; updates: Partial<Transaction> }>) => {
      const index = state.transactions.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        const existing = state.transactions[index];
        if (!existing) {
          return;
        }
        const sanitized = sanitizeTransactionUpdates(action.payload.updates);
        state.transactions[index] = {
          ...existing,
          ...sanitized,
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
      const sanitizedUpdates = sanitizeTransactionUpdates(action.payload.updates);
      state.transactions = state.transactions.map(transaction =>
        idsToUpdate.has(transaction.id)
          ? ({
              ...transaction,
              ...sanitizedUpdates,
            } as Transaction)
          : transaction
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
          state.transactions[index] = serializeForRedux(action.payload) as any;
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
