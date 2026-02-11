import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Budget } from '../../types';
import type { SerializedBudget } from '../../types/redux-types';
import { serializeBudget, serializeBudgets } from '../../types/redux-types';
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
      state.budgets = serializeBudgets(action.payload);
      state.error = null;
    },
    addBudget: (state, action: PayloadAction<Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const now = getCurrentISOString();
      const newBudget: Budget = {
        ...action.payload,
        id: crypto.randomUUID(),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      };
      state.budgets.push(serializeBudget(newBudget));
    },
    updateBudget: (state, action: PayloadAction<{ id: string; updates: Partial<Budget> }>) => {
      const index = state.budgets.findIndex(b => b.id === action.payload.id);
      if (index !== -1) {
        // Extract date fields to handle separately
        const { createdAt, updatedAt: _, ...nonDateUpdates } = action.payload.updates;

        state.budgets[index] = {
          ...state.budgets[index],
          ...nonDateUpdates,
          updatedAt: getCurrentISOString(),
          ...(createdAt !== undefined && { createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt }),
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
        state.budgets = serializeBudgets(action.payload);
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
        const serializedPayload = serializeBudget(action.payload);
        // Remove any temporary budget with the same category
        state.budgets = state.budgets.filter(budget =>
          !(budget.id.startsWith('temp-') && budget.categoryId === serializedPayload.categoryId)
        );
        // Add the new budget from Supabase
        state.budgets.push(serializedPayload);
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
