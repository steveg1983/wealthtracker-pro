/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Budget } from '../types';
import { createScopedLogger } from '../loggers/scopedLogger';

type BudgetLike = Budget & { category?: string };

function normalizeBudgetCategory<T extends { categoryId?: string; category?: string }>(budget: T): T {
  if (budget.categoryId === undefined && budget.category !== undefined) {
    return { ...budget, categoryId: budget.category };
  }
  return budget;
}

interface BudgetContextType {
  budgets: Budget[];
  addBudget: (budget: Omit<Budget, 'id' | 'createdAt'>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  getBudgetByCategory: (category: string) => Budget | undefined;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);
const logger = createScopedLogger('BudgetContext');

interface BudgetProviderProps {
  children: ReactNode;
  initialBudgets?: Budget[];
}

export function BudgetProvider({ children, initialBudgets = [] }: BudgetProviderProps) {
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const savedBudgets = localStorage.getItem('money_management_budgets');
    if (savedBudgets) {
      try {
        const parsed = JSON.parse(savedBudgets) as BudgetLike[];
        return parsed.map(normalizeBudgetCategory);
      } catch (error) {
        logger.error('Error parsing saved budgets', error);
        return initialBudgets.map(normalizeBudgetCategory);
      }
    }
    return initialBudgets.map(normalizeBudgetCategory);
  });

  // Save budgets to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('money_management_budgets', JSON.stringify(budgets));
  }, [budgets]);

  const addBudget = (budgetData: Omit<Budget, 'id' | 'createdAt'>) => {
    const normalizedData = normalizeBudgetCategory(budgetData as BudgetLike);
    const newBudget: Budget = {
      ...normalizedData,
      id: uuidv4(),
      isActive: normalizedData.isActive !== false,
      createdAt: new Date()
    };
    setBudgets(prev => [...prev, normalizeBudgetCategory(newBudget)]);
  };

  const updateBudget = (id: string, updates: Partial<Budget>) => {
    const normalizedUpdates = normalizeBudgetCategory(updates as BudgetLike);
    setBudgets(prev =>
      prev.map(budget =>
        budget.id === id
          ? normalizeBudgetCategory({ ...budget, ...normalizedUpdates })
          : budget
      )
    );
  };

  const deleteBudget = (id: string) => {
    setBudgets(prev => prev.filter(budget => budget.id !== id));
  };

  const getBudgetByCategory = (category: string) => {
    return budgets.find(budget => {
      const budgetWithCategory = budget as BudgetLike;
      const categoryKey = budgetWithCategory.categoryId ?? budgetWithCategory.category;
      return categoryKey === category && budget.isActive !== false;
    });
  };

  return (
    <BudgetContext.Provider value={{
      budgets,
      addBudget,
      updateBudget,
      deleteBudget,
      getBudgetByCategory
    }}>
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudgets() {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudgets must be used within BudgetProvider');
  }
  return context;
}
