import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Goal } from '../../types';
import { ensureDate } from '../../utils/dateHelpers';
import type { DateInput } from '../../utils/dateHelpers';
import {
  fetchGoalsFromSupabase,
  createGoalInSupabase
} from '../thunks/supabaseThunks';

interface GoalsState {
  goals: Goal[];
  loading: boolean;
  error: string | null;
}

const initialState: GoalsState = {
  goals: [],
  loading: false,
  error: null,
};

type GoalDateInput = Omit<Goal, 'createdAt' | 'updatedAt' | 'targetDate'> & {
  createdAt: DateInput;
  updatedAt: DateInput;
  targetDate: DateInput;
};

const normalizeGoal = (goal: GoalDateInput): Goal => ({
  ...goal,
  createdAt: ensureDate(goal.createdAt),
  updatedAt: ensureDate(goal.updatedAt),
  targetDate: ensureDate(goal.targetDate),
});

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
      state.goals = action.payload.map(normalizeGoal);
      state.error = null;
    },
    addGoal: (state, action: PayloadAction<Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const timestamp = new Date();
      const newGoal: Goal = normalizeGoal({
        ...action.payload,
        id: crypto.randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      state.goals.push(newGoal);
    },
    updateGoal: (state, action: PayloadAction<{ id: string; updates: Partial<Goal> }>) => {
      const index = state.goals.findIndex(g => g.id === action.payload.id);
      if (index !== -1) {
        const existing = state.goals[index];
        if (!existing) {
          return;
        }

        const updates = action.payload.updates;
        const merged: Goal = { ...existing };
        const assignIfDefined = <K extends keyof Goal>(key: K) => {
          const value = updates?.[key];
          if (value !== undefined) {
            merged[key] = value;
          }
        };

        assignIfDefined('name');
        assignIfDefined('type');
        assignIfDefined('targetAmount');
        assignIfDefined('currentAmount');
        assignIfDefined('targetDate');
        assignIfDefined('description');
        assignIfDefined('linkedAccountIds');
        assignIfDefined('isActive');
        assignIfDefined('achieved');
        assignIfDefined('progress');
        assignIfDefined('category');
        assignIfDefined('priority');
        assignIfDefined('status');
        assignIfDefined('accountId');
        assignIfDefined('autoContribute');
        assignIfDefined('contributionAmount');
        assignIfDefined('contributionFrequency');
        assignIfDefined('icon');
        assignIfDefined('color');
        assignIfDefined('completedAt');
        assignIfDefined('isCompleted');
        merged.updatedAt = new Date();

        state.goals[index] = normalizeGoal(merged);
      }
    },
    deleteGoal: (state, action: PayloadAction<string>) => {
      state.goals = state.goals.filter(g => g.id !== action.payload);
    },
    updateGoalProgress: (state, action: PayloadAction<{ id: string; currentAmount: number }>) => {
      const goal = state.goals.find(g => g.id === action.payload.id);
      if (goal) {
        goal.currentAmount = action.payload.currentAmount;
        goal.updatedAt = new Date();
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
        state.goals = action.payload.map(normalizeGoal);
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
        state.goals.push(normalizeGoal(action.payload));
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
