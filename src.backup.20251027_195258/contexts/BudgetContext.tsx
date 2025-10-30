/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Budget } from '../types';
import { logger } from '../services/loggingService';

interface BudgetContextType {
  budgets: Budget[];
  addBudget: (budget: Omit<Budget, 'id' | 'createdAt'>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  getBudgetByCategory: (category: string) => Budget | undefined;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

interface BudgetProviderProps {
  children: ReactNode;
  initialBudgets?: Budget[];
}

export function BudgetProvider({ children, initialBudgets = [] }: BudgetProviderProps) {
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const savedBudgets = localStorage.getItem('money_management_budgets');
    if (savedBudgets) {
      try {
        return JSON.parse(savedBudgets);
      } catch (error) {
        logger.error('Error parsing saved budgets:', error);
        return initialBudgets;
      }
    }
    return initialBudgets;
  });

  // Save budgets to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('money_management_budgets', JSON.stringify(budgets));
  }, [budgets]);

  const addBudget = (budgetData: Omit<Budget, 'id' | 'createdAt'>) => {
    const newBudget: Budget = {
      ...budgetData,
      id: uuidv4(),
      isActive: budgetData.isActive !== false,
      createdAt: new Date()
    };
    setBudgets(prev => [...prev, newBudget]);
  };

  const updateBudget = (id: string, updates: Partial<Budget>) => {
    setBudgets(prev => prev.map(budget => 
      budget.id === id 
        ? { ...budget, ...updates }
        : budget
    ));
  };

  const deleteBudget = (id: string) => {
    setBudgets(prev => prev.filter(budget => budget.id !== id));
  };

  const getBudgetByCategory = (category: string) => {
    return budgets.find(budget => budget.categoryId === category && budget.isActive !== false);
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