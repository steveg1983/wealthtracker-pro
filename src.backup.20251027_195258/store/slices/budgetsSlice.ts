import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Budget } from '../../types';
import { ensureDate } from '../../utils/dateHelpers';
import type { DateInput } from '../../utils/dateHelpers';
import {
  fetchBudgetsFromSupabase,
  createBudgetInSupabase
} from '../thunks/supabaseThunks';

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

type BudgetDateInput = Omit<Budget, 'createdAt' | 'updatedAt'> & {
  createdAt: DateInput;
  updatedAt: DateInput;
};

const normalizeBudget = (budget: BudgetDateInput): Budget => ({
  ...budget,
  createdAt: ensureDate(budget.createdAt),
  updatedAt: ensureDate(budget.updatedAt),
});

// Re-export Supabase thunks for external use
export {
  fetchBudgetsFromSupabase,
  fetchBudgetsFromSupabase as loadBudgets,
  createBudgetInSupabase
} from '../thunks/supabaseThunks';

const budgetsSlice = createSlice({
  name: 'budgets',
  initialState,
  reducers: {
    setBudgets: (state, action: PayloadAction<Budget[]>) => {
      state.budgets = action.payload.map(normalizeBudget);
      state.error = null;
    },
    addBudget: (state, action: PayloadAction<Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const newBudget: Budget = {
        ...action.payload,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.budgets.push(normalizeBudget(newBudget));
    },
    updateBudget: (state, action: PayloadAction<{ id: string; updates: Partial<Budget> }>) => {
      const index = state.budgets.findIndex(b => b.id === action.payload.id);
      if (index !== -1) {
        const existing = state.budgets[index];
        if (!existing) {
          return;
        }

        const merged: Budget = { ...existing };
        const updates = action.payload.updates;
        const assignIfDefined = <K extends keyof Budget>(key: K) => {
          const value = updates?.[key];
          if (value !== undefined) {
            merged[key] = value;
          }
        };

        assignIfDefined('categoryId');
        assignIfDefined('amount');
        assignIfDefined('period');
        assignIfDefined('isActive');
        assignIfDefined('name');
        assignIfDefined('color');
        assignIfDefined('spent');
        assignIfDefined('budgeted');
        assignIfDefined('limit');
        assignIfDefined('startDate');
        assignIfDefined('endDate');
        assignIfDefined('rollover');
        assignIfDefined('rolloverAmount');
        assignIfDefined('alertThreshold');
        assignIfDefined('notes');

        merged.updatedAt = new Date();
        state.budgets[index] = normalizeBudget(merged);
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
      // Handle fetchBudgetsFromSupabase (loadBudgets)
      .addCase(fetchBudgetsFromSupabase.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBudgetsFromSupabase.fulfilled, (state, action) => {
        state.loading = false;
        state.budgets = action.payload.map(normalizeBudget);
      })
      .addCase(fetchBudgetsFromSupabase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load budgets';
      })
      // Handle createBudgetInSupabase
      .addCase(createBudgetInSupabase.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createBudgetInSupabase.fulfilled, (state, action) => {
        state.loading = false;
        // Remove any temporary budget with the same category
        state.budgets = state.budgets.filter(budget => 
          !(budget.id.startsWith('temp-') && budget.categoryId === action.payload.categoryId)
        );
        // Add the new budget from Supabase
        state.budgets.push(normalizeBudget(action.payload));
      })
      .addCase(createBudgetInSupabase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create budget';
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

export { budgetsSlice };

export default budgetsSlice.reducer;
