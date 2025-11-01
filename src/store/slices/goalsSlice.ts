import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Goal } from '../../types';
import type { SerializedGoal } from '../../types/redux-types';
import { getCurrentISOString, toISOString } from '../../utils/dateHelpers';
import {
  fetchGoalsFromSupabase,
  createGoalInSupabase
} from '../thunks/supabaseThunks';

interface GoalsState {
  goals: SerializedGoal[];
  loading: boolean;
  error: string | null;
}

const initialState: GoalsState = {
  goals: [],
  loading: false,
  error: null,
};

// Re-export Supabase thunks for external use
export {
  fetchGoalsFromSupabase,
  fetchGoalsFromSupabase as loadGoals,
  createGoalInSupabase
} from '../thunks/supabaseThunks';

const goalsSlice = createSlice({
  name: 'goals',
  initialState,
  reducers: {
    setGoals: (state, action: PayloadAction<Goal[]>) => {
      state.goals = action.payload as unknown as SerializedGoal[];
      state.error = null;
    },
    addGoal: (state, action: PayloadAction<Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const newGoal = {
        ...action.payload,
        id: crypto.randomUUID(),
        createdAt: getCurrentISOString(),
        updatedAt: getCurrentISOString(),
      };
      state.goals.push(newGoal as unknown as SerializedGoal);
    },
    updateGoal: (state, action: PayloadAction<{ id: string; updates: Partial<Goal> }>) => {
      const index = state.goals.findIndex(g => g.id === action.payload.id);
      if (index !== -1) {
        state.goals[index] = {
          ...state.goals[index],
          ...action.payload.updates,
          updatedAt: getCurrentISOString(),
        } as unknown as SerializedGoal;
      }
    },
    deleteGoal: (state, action: PayloadAction<string>) => {
      state.goals = state.goals.filter(g => g.id !== action.payload);
    },
    updateGoalProgress: (state, action: PayloadAction<{ id: string; currentAmount: number }>) => {
      const goal = state.goals.find(g => g.id === action.payload.id);
      if (goal) {
        goal.currentAmount = action.payload.currentAmount;
        goal.updatedAt = getCurrentISOString();
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Handle fetchGoalsFromSupabase (loadGoals)
      .addCase(fetchGoalsFromSupabase.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGoalsFromSupabase.fulfilled, (state, action) => {
        state.loading = false;
        state.goals = action.payload as unknown as SerializedGoal[];
      })
      .addCase(fetchGoalsFromSupabase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load goals';
      })
      // Handle createGoalInSupabase
      .addCase(createGoalInSupabase.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createGoalInSupabase.fulfilled, (state, action) => {
        state.loading = false;
        // Remove any temporary goal with the same name
        state.goals = state.goals.filter(goal => 
          !(goal.id.startsWith('temp-') && goal.name === action.payload.name)
        );
        // Add the new goal from Supabase
        state.goals.push(action.payload);
      })
      .addCase(createGoalInSupabase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create goal';
      });
  },
});

export const {
  setGoals,
  addGoal,
  updateGoal,
  deleteGoal,
  updateGoalProgress,
} = goalsSlice.actions;

export { goalsSlice };

export default goalsSlice.reducer;