import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { RecurringTransaction } from '../../types';
import type { SerializedRecurringTransaction } from '../../types/redux-types';
import { storageAdapter } from '../../services/storageAdapter';
import { getCurrentISOString, toISOString } from '../../utils/dateHelpers';

interface RecurringTransactionsState {
  recurringTransactions: SerializedRecurringTransaction[];
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
      state.recurringTransactions = action.payload as unknown as SerializedRecurringTransaction[];
      state.error = null;
    },
    addRecurringTransaction: (state, action: PayloadAction<Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const newRecurring: RecurringTransaction = {
        ...action.payload,
        id: crypto.randomUUID(),
        createdAt: getCurrentISOString(),
        updatedAt: getCurrentISOString(),
      };
      state.recurringTransactions.push(newRecurring as unknown as SerializedRecurringTransaction);
    },
    updateRecurringTransaction: (state, action: PayloadAction<{ id: string; updates: Partial<RecurringTransaction> }>) => {
      const index = state.recurringTransactions.findIndex((r: SerializedRecurringTransaction) => r.id === action.payload.id);
      if (index !== -1) {
        state.recurringTransactions[index] = {
          ...state.recurringTransactions[index],
          ...action.payload.updates,
          updatedAt: getCurrentISOString(),
        } as unknown as SerializedRecurringTransaction;
      }
    },
    deleteRecurringTransaction: (state, action: PayloadAction<string>) => {
      state.recurringTransactions = state.recurringTransactions.filter((r: SerializedRecurringTransaction) => r.id !== action.payload);
    },
    updateLastProcessed: (state, action: PayloadAction<{ id: string; lastProcessed: Date }>) => {
      const recurring = state.recurringTransactions.find((r: SerializedRecurringTransaction) => r.id === action.payload.id);
      if (recurring) {
        recurring.lastProcessed = toISOString(action.payload.lastProcessed);
        recurring.updatedAt = getCurrentISOString();
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
        state.recurringTransactions = action.payload as unknown as SerializedRecurringTransaction[];
      })
      .addCase(loadRecurringTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load recurring transactions';
      })
      // Handle saveRecurringTransactions
      .addCase(saveRecurringTransactions.fulfilled, (state, action) => {
        state.recurringTransactions = action.payload as unknown as SerializedRecurringTransaction[];
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