import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { RecurringTransaction } from '../../types';
import type { SerializedRecurringTransaction } from '../../types/redux-types';
import { serializeRecurringTransaction, serializeRecurringTransactions } from '../../types/redux-types';
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
      state.recurringTransactions = serializeRecurringTransactions(action.payload);
      state.error = null;
    },
    addRecurringTransaction: (state, action: PayloadAction<Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const now = getCurrentISOString();
      const newRecurring: RecurringTransaction = {
        ...action.payload,
        id: crypto.randomUUID(),
        createdAt: new Date(now),
        updatedAt: new Date(now),
        startDate: action.payload.startDate instanceof Date ? action.payload.startDate : new Date(action.payload.startDate),
        endDate: action.payload.endDate ? (action.payload.endDate instanceof Date ? action.payload.endDate : new Date(action.payload.endDate)) : undefined,
        lastProcessed: action.payload.lastProcessed ? (action.payload.lastProcessed instanceof Date ? action.payload.lastProcessed : new Date(action.payload.lastProcessed)) : undefined,
        nextDate: action.payload.nextDate instanceof Date ? action.payload.nextDate : new Date(action.payload.nextDate)
      };
      state.recurringTransactions.push(serializeRecurringTransaction(newRecurring));
    },
    updateRecurringTransaction: (state, action: PayloadAction<{ id: string; updates: Partial<RecurringTransaction> }>) => {
      const index = state.recurringTransactions.findIndex((r: SerializedRecurringTransaction) => r.id === action.payload.id);
      if (index !== -1) {
        // Extract date fields to handle separately
        const { startDate, endDate, nextDate, lastProcessed, createdAt, updatedAt: _, ...nonDateUpdates } = action.payload.updates;

        state.recurringTransactions[index] = {
          ...state.recurringTransactions[index],
          ...nonDateUpdates,
          updatedAt: getCurrentISOString(),
          ...(startDate !== undefined && { startDate: startDate instanceof Date ? startDate.toISOString() : startDate }),
          ...(endDate !== undefined && { endDate: endDate instanceof Date ? endDate.toISOString() : endDate }),
          ...(nextDate !== undefined && { nextDate: nextDate instanceof Date ? nextDate.toISOString() : nextDate }),
          ...(lastProcessed !== undefined && { lastProcessed: lastProcessed instanceof Date ? lastProcessed.toISOString() : lastProcessed }),
          ...(createdAt !== undefined && { createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt }),
        };
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
        state.recurringTransactions = serializeRecurringTransactions(action.payload);
      })
      .addCase(loadRecurringTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load recurring transactions';
      })
      // Handle saveRecurringTransactions
      .addCase(saveRecurringTransactions.fulfilled, (state, action) => {
        state.recurringTransactions = serializeRecurringTransactions(action.payload);
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
