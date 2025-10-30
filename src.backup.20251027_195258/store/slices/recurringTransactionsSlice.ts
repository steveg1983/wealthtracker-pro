import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RecurringTransaction } from '../../types';
import { storageAdapter } from '../../services/storageAdapter';

const ensureDate = (value: Date | string | null | undefined): Date | undefined => {
  if (!value) {
    return undefined;
  }
  return value instanceof Date ? value : new Date(value);
};

const stamp = () => new Date();

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
      const {
        startDate,
        nextDate,
        endDate,
        lastProcessed,
        ...rest
      } = action.payload;

      const timestamp = stamp();
      const newRecurring: RecurringTransaction = {
        ...rest,
        id: crypto.randomUUID(),
        startDate: ensureDate(startDate) ?? timestamp,
        nextDate: ensureDate(nextDate) ?? timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const end = ensureDate(endDate);
      if (end) {
        newRecurring.endDate = end;
      }

      const processed = ensureDate(lastProcessed);
      if (processed) {
        newRecurring.lastProcessed = processed;
      }

      state.recurringTransactions.push(newRecurring);
    },
    updateRecurringTransaction: (state, action: PayloadAction<{ id: string; updates: Partial<RecurringTransaction> }>) => {
      const index = state.recurringTransactions.findIndex((r: RecurringTransaction) => r.id === action.payload.id);
      if (index !== -1) {
        const existing = state.recurringTransactions[index];
        if (!existing) {
          return;
        }

        const {
          startDate,
          nextDate,
          endDate,
          lastProcessed,
          ...other
        } = action.payload.updates;

        const sanitizedUpdates: Partial<RecurringTransaction> = {};
        for (const key of Object.keys(other) as (keyof typeof other)[]) {
          const value = other[key];
          if (value !== undefined) {
            (sanitizedUpdates as Record<string, unknown>)[key as string] = value;
          }
        }

        const updated: RecurringTransaction = {
          ...existing,
          ...sanitizedUpdates,
          updatedAt: stamp(),
        };

        if (startDate !== undefined) {
          const parsed = ensureDate(startDate);
          updated.startDate = parsed ?? existing.startDate;
        }

        if (nextDate !== undefined) {
          const parsed = ensureDate(nextDate);
          updated.nextDate = parsed ?? existing.nextDate;
        }

        if (endDate !== undefined) {
          const parsed = ensureDate(endDate);
          if (parsed) {
            updated.endDate = parsed;
          } else {
            delete updated.endDate;
          }
        }

        if (lastProcessed !== undefined) {
          const parsed = ensureDate(lastProcessed);
          if (parsed) {
            updated.lastProcessed = parsed;
          } else {
            delete updated.lastProcessed;
          }
        }

        state.recurringTransactions[index] = updated;
      }
    },
    deleteRecurringTransaction: (state, action: PayloadAction<string>) => {
      state.recurringTransactions = state.recurringTransactions.filter((r: RecurringTransaction) => r.id !== action.payload);
    },
    updateLastProcessed: (state, action: PayloadAction<{ id: string; lastProcessed: Date }>) => {
      const recurring = state.recurringTransactions.find((r: RecurringTransaction) => r.id === action.payload.id);
      if (recurring) {
        const parsed = ensureDate(action.payload.lastProcessed);
        if (parsed) {
          recurring.lastProcessed = parsed;
        } else {
          delete recurring.lastProcessed;
        }
        recurring.updatedAt = stamp();
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

export { recurringTransactionsSlice };
export default recurringTransactionsSlice.reducer;
