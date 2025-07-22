import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { Budget } from '../../types';
import { storageAdapter } from '../../services/storageAdapter';

interface BudgetsState {
  budgets: Budget[];
  loading: boolean;
  error: string | null;
}

const initialState: BudgetsState = {
  budgets: [],
  loading: false,
  error: null,
};

// Async thunk for loading budgets from storage
export const loadBudgets = createAsyncThunk(
  'budgets/load',
  async () => {
    const budgets = await storageAdapter.get<Budget[]>('budgets') || [];
    return budgets;
  }
);

// Async thunk for saving budgets to storage
export const saveBudgets = createAsyncThunk(
  'budgets/save',
  async (budgets: Budget[]) => {
    await storageAdapter.set('budgets', budgets);
    return budgets;
  }
);

const budgetsSlice = createSlice({
  name: 'budgets',
  initialState,
  reducers: {
    setBudgets: (state, action: PayloadAction<Budget[]>) => {
      state.budgets = action.payload;
      state.error = null;
    },
    addBudget: (state, action: PayloadAction<Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const newBudget: Budget = {
        ...action.payload,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.budgets.push(newBudget);
    },
    updateBudget: (state, action: PayloadAction<{ id: string; updates: Partial<Budget> }>) => {
      const index = state.budgets.findIndex(b => b.id === action.payload.id);
      if (index !== -1) {
        state.budgets[index] = {
          ...state.budgets[index],
          ...action.payload.updates,
          updatedAt: new Date(),
        };
      }
    },
    deleteBudget: (state, action: PayloadAction<string>) => {
      state.budgets = state.budgets.filter(b => b.id !== action.payload);
    },
    updateBudgetSpent: (state, action: PayloadAction<{ id: string; spent: number }>) => {
      const budget = state.budgets.find(b => b.id === action.payload.id);
      if (budget) {
        budget.spent = action.payload.spent;
        budget.updatedAt = new Date();
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Handle loadBudgets
      .addCase(loadBudgets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadBudgets.fulfilled, (state, action) => {
        state.loading = false;
        state.budgets = action.payload;
      })
      .addCase(loadBudgets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load budgets';
      })
      // Handle saveBudgets
      .addCase(saveBudgets.fulfilled, (state, action) => {
        state.budgets = action.payload;
      });
  },
});

export const {
  setBudgets,
  addBudget,
  updateBudget,
  deleteBudget,
  updateBudgetSpent,
} = budgetsSlice.actions;

export default budgetsSlice.reducer;