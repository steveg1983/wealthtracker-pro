import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { RecurringTransaction } from '../../types';
import { storageAdapter } from '../../services/storageAdapter';
import { getCurrentISOString, toISOString } from '../../utils/dateHelpers';

interface RecurringTransactionsState {
  recurringTransactions: RecurringTransaction[];
  loading: boolean;
  error: string | null;
}

const initialState: RecurringTransactionsState = {
  recurringTransactions: [],
  loading: false,
  error: null,
};

// Async thunk for loading recurring transactions from storage
export const loadRecurringTransactions = createAsyncThunk(
  'recurringTransactions/load',
  async () => {
    const recurringTransactions = await storageAdapter.get<RecurringTransaction[]>('recurringTransactions') || [];
    return recurringTransactions;
  }
);

// Async thunk for saving recurring transactions to storage
export const saveRecurringTransactions = createAsyncThunk(
  'recurringTransactions/save',
  async (recurringTransactions: RecurringTransaction[]) => {
    await storageAdapter.set('recurringTransactions', recurringTransactions);
    return recurringTransactions;
  }
);

const recurringTransactionsSlice = createSlice({
  name: 'recurringTransactions',
  initialState,
  reducers: {
    setRecurringTransactions: (state, action: PayloadAction<RecurringTransaction[]>) => {
      state.recurringTransactions = action.payload;
      state.error = null;
    },
    addRecurringTransaction: (state, action: PayloadAction<Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const newRecurring: RecurringTransaction = {
        ...action.payload,
        id: crypto.randomUUID(),
        createdAt: new Date(getCurrentISOString()),
        updatedAt: new Date(getCurrentISOString()),
      };
      state.recurringTransactions.push(newRecurring);
    },
    updateRecurringTransaction: (state, action: PayloadAction<{ id: string; updates: Partial<RecurringTransaction> }>) => {
      const index = state.recurringTransactions.findIndex((r: RecurringTransaction) => r.id === action.payload.id);
      if (index !== -1) {
        state.recurringTransactions[index] = {
          ...state.recurringTransactions[index],
          ...action.payload.updates,
          updatedAt: new Date(getCurrentISOString()),
        };
      }
    },
    deleteRecurringTransaction: (state, action: PayloadAction<string>) => {
      state.recurringTransactions = state.recurringTransactions.filter((r: RecurringTransaction) => r.id !== action.payload);
    },
    updateLastProcessed: (state, action: PayloadAction<{ id: string; lastProcessed: Date }>) => {
      const recurring = state.recurringTransactions.find((r: RecurringTransaction) => r.id === action.payload.id);
      if (recurring) {
        const isoString = toISOString(action.payload.lastProcessed);
        if (isoString) {
          recurring.lastProcessed = new Date(isoString);
        }
        recurring.updatedAt = new Date(getCurrentISOString());
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Handle loadRecurringTransactions
      .addCase(loadRecurringTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadRecurringTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.recurringTransactions = action.payload;
      })
      .addCase(loadRecurringTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load recurring transactions';
      })
      // Handle saveRecurringTransactions
      .addCase(saveRecurringTransactions.fulfilled, (state, action) => {
        state.recurringTransactions = action.payload;
      });
  },
});

export const {
  setRecurringTransactions,
  addRecurringTransaction,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  updateLastProcessed,
} = recurringTransactionsSlice.actions;

export default recurringTransactionsSlice.reducer;