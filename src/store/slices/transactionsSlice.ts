import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import Decimal from 'decimal.js';
import type { Transaction } from '../../types';
import { storageAdapter } from '../../services/storageAdapter';

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

// Async thunk for loading transactions from storage
export const loadTransactions = createAsyncThunk(
  'transactions/load',
  async () => {
    const transactions = await storageAdapter.get<Transaction[]>('transactions') || [];
    return transactions;
  }
);

// Async thunk for saving transactions to storage
export const saveTransactions = createAsyncThunk(
  'transactions/save',
  async (transactions: Transaction[]) => {
    await storageAdapter.set('transactions', transactions);
    return transactions;
  }
);

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    setTransactions: (state, action: PayloadAction<Transaction[]>) => {
      state.transactions = action.payload;
      state.error = null;
    },
    addTransaction: (state, action: PayloadAction<Omit<Transaction, 'id'>>) => {
      const newTransaction: Transaction = {
        ...action.payload,
        id: crypto.randomUUID(),
        date: action.payload.date || new Date(),
      };
      state.transactions.push(newTransaction);
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
          ? { ...t, ...action.payload.updates, updatedAt: new Date() }
          : t
      );
    },
  },
  extraReducers: (builder) => {
    builder
      // Handle loadTransactions
      .addCase(loadTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = action.payload;
      })
      .addCase(loadTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load transactions';
      })
      // Handle saveTransactions
      .addCase(saveTransactions.fulfilled, (state, action) => {
        state.transactions = action.payload;
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

export default transactionsSlice.reducer;