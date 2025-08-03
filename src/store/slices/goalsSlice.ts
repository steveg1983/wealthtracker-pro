import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { Goal } from '../../types';
import { storageAdapter } from '../../services/storageAdapter';
import { getCurrentISOString, toISOString } from '../../utils/dateHelpers';

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

// Async thunk for loading goals from storage
export const loadGoals = createAsyncThunk(
  'goals/load',
  async () => {
    const goals = await storageAdapter.get<Goal[]>('goals') || [];
    return goals;
  }
);

// Async thunk for saving goals to storage
export const saveGoals = createAsyncThunk(
  'goals/save',
  async (goals: Goal[]) => {
    await storageAdapter.set('goals', goals);
    return goals;
  }
);

const goalsSlice = createSlice({
  name: 'goals',
  initialState,
  reducers: {
    setGoals: (state, action: PayloadAction<Goal[]>) => {
      state.goals = action.payload;
      state.error = null;
    },
    addGoal: (state, action: PayloadAction<Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const newGoal: Goal = {
        ...action.payload,
        id: crypto.randomUUID(),
        createdAt: getCurrentISOString(),
        updatedAt: getCurrentISOString(),
      };
      state.goals.push(newGoal);
    },
    updateGoal: (state, action: PayloadAction<{ id: string; updates: Partial<Goal> }>) => {
      const index = state.goals.findIndex(g => g.id === action.payload.id);
      if (index !== -1) {
        state.goals[index] = {
          ...state.goals[index],
          ...action.payload.updates,
          updatedAt: getCurrentISOString(),
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
      // Handle loadGoals
      .addCase(loadGoals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadGoals.fulfilled, (state, action) => {
        state.loading = false;
        state.goals = action.payload;
      })
      .addCase(loadGoals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load goals';
      })
      // Handle saveGoals
      .addCase(saveGoals.fulfilled, (state, action) => {
        state.goals = action.payload;
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