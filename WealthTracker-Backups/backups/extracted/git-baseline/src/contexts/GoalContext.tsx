/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../services/loggingService';

interface Goal {
  id: string;
  name: string;
  type: 'savings' | 'debt-payoff' | 'investment' | 'custom';
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  description?: string;
  linkedAccountIds?: string[];
  isActive: boolean;
  createdAt: Date;
}

interface GoalContextType {
  goals: Goal[];
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  getGoalById: (id: string) => Goal | undefined;
  getActiveGoals: () => Goal[];
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

interface GoalProviderProps {
  children: ReactNode;
  initialGoals?: Goal[];
}

export function GoalProvider({ children, initialGoals = [] }: GoalProviderProps) {
  const [goals, setGoals] = useState<Goal[]>(() => {
    const savedGoals = localStorage.getItem('money_management_goals');
    if (savedGoals) {
      try {
        const parsed = JSON.parse(savedGoals);
        return parsed.map((goal: Goal) => ({
          ...goal,
          targetDate: new Date(goal.targetDate),
          createdAt: new Date(goal.createdAt)
        }));
      } catch (error) {
        logger.error('Error parsing saved goals:', error);
        return initialGoals;
      }
    }
    return initialGoals;
  });

  // Save goals to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('money_management_goals', JSON.stringify(goals));
  }, [goals]);

  const addGoal = (goalData: Omit<Goal, 'id' | 'createdAt'>) => {
    const newGoal: Goal = {
      ...goalData,
      id: uuidv4(),
      createdAt: new Date()
    };
    setGoals(prev => [...prev, newGoal]);
  };

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    setGoals(prev => prev.map(goal => 
      goal.id === id 
        ? { ...goal, ...updates }
        : goal
    ));
  };

  const deleteGoal = (id: string) => {
    setGoals(prev => prev.filter(goal => goal.id !== id));
  };

  const getGoalById = (id: string) => {
    return goals.find(goal => goal.id === id);
  };

  const getActiveGoals = () => {
    return goals.filter(goal => goal.isActive);
  };

  return (
    <GoalContext.Provider value={{
      goals,
      addGoal,
      updateGoal,
      deleteGoal,
      getGoalById,
      getActiveGoals
    }}>
      {children}
    </GoalContext.Provider>
  );
}

export function useGoals() {
  const context = useContext(GoalContext);
  if (!context) {
    throw new Error('useGoals must be used within GoalProvider');
  }
  return context;
}