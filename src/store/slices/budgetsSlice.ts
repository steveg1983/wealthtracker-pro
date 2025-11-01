import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Budget } from '../../types';
import type { SerializedBudget } from '../../types/redux-types';
import { getCurrentISOString } from '../../utils/dateHelpers';
import {
  fetchBudgetsFromSupabase,
  createBudgetInSupabase
} from '../thunks/supabaseThunks';

interface BudgetsState {
  budgets: SerializedBudget[];
  loading: boolean;
  error: string | null;
}

const initialState: BudgetsState = {
  budgets: [],
  loading: false,
  error: null,
};

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
      state.budgets = action.payload as unknown as SerializedBudget[];
      state.error = null;
    },
    addBudget: (state, action: PayloadAction<Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const newBudget = {
        ...action.payload,
        id: crypto.randomUUID(),
        createdAt: getCurrentISOString(),
        updatedAt: getCurrentISOString(),
      };
      state.budgets.push(newBudget as unknown as SerializedBudget);
    },
    updateBudget: (state, action: PayloadAction<{ id: string; updates: Partial<Budget> }>) => {
      const index = state.budgets.findIndex(b => b.id === action.payload.id);
      if (index !== -1) {
        state.budgets[index] = {
          ...state.budgets[index],
          ...action.payload.updates,
          updatedAt: getCurrentISOString(),
        } as unknown as SerializedBudget;
      }
    },
    deleteBudget: (state, action: PayloadAction<string>) => {
      state.budgets = state.budgets.filter(b => b.id !== action.payload);
    },
    updateBudgetSpent: (state, action: PayloadAction<{ id: string; spent: number }>) => {
      const budget = state.budgets.find(b => b.id === action.payload.id);
      if (budget) {
        budget.spent = action.payload.spent;
        budget.updatedAt = getCurrentISOString();
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
        state.budgets = action.payload as unknown as SerializedBudget[];
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
          !(budget.id.startsWith('temp-') && budget.categoryId === action.payload.category)
        );
        // Add the new budget from Supabase
        state.budgets.push(action.payload);
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