import { createContext } from 'react';
import type { Budget } from '../types';

export interface BudgetContextType {
  budgets: Budget[];
  addBudget: (budget: Omit<Budget, 'id' | 'createdAt'>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  getBudgetByCategory: (category: string) => Budget | undefined;
}

export const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

