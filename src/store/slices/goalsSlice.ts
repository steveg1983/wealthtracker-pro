import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Goal } from '../../types';
import type { SerializedGoal } from '../../types/redux-types';
import { serializeGoal, serializeGoals } from '../../types/redux-types';
import { getCurrentISOString } from '../../utils/dateHelpers';
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
      state.goals = serializeGoals(action.payload);
      state.error = null;
    },
    addGoal: (state, action: PayloadAction<Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const now = getCurrentISOString();
      const newGoal: Goal = {
        ...action.payload,
        id: crypto.randomUUID(),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      };
      state.goals.push(serializeGoal(newGoal));
    },
    updateGoal: (state, action: PayloadAction<{ id: string; updates: Partial<Goal> }>) => {
      const index = state.goals.findIndex(g => g.id === action.payload.id);
      if (index !== -1) {
        // Extract date fields to handle separately
        const { targetDate, createdAt, updatedAt: _, ...nonDateUpdates } = action.payload.updates;

        state.goals[index] = {
          ...state.goals[index],
          ...nonDateUpdates,
          updatedAt: getCurrentISOString(),
          ...(targetDate !== undefined && { targetDate: targetDate instanceof Date ? targetDate.toISOString() : targetDate }),
          ...(createdAt !== undefined && { createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt }),
        };
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
        state.goals = serializeGoals(action.payload);
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
        const serializedPayload = serializeGoal(action.payload);
        // Remove any temporary goal with the same name
        state.goals = state.goals.filter(goal =>
          !(goal.id.startsWith('temp-') && goal.name === serializedPayload.name)
        );
        // Add the new goal from Supabase
        state.goals.push(serializedPayload);
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
