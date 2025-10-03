import { createContext } from 'react';
import type { Goal } from '../types';

export type { Goal };

export interface GoalContextType {
  goals: Goal[];
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  getGoalById: (id: string) => Goal | undefined;
  getActiveGoals: () => Goal[];
}

export const GoalContext = createContext<GoalContextType | undefined>(undefined);
