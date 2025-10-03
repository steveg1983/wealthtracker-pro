import { DataService } from '../api/dataService';
import { lazyLogger as logger } from '../serviceFactory';
import type { Budget, Goal } from '../../types';

export class BudgetOperations {
  static async addBudget(budget: Omit<Budget, 'id' | 'spent'>): Promise<Budget> {
    try {
      // Use createBudget which accepts Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>
      const newBudget = await DataService.createBudget(budget as Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>);
      logger.debug('[BudgetOps] Budget added:', { id: newBudget.id });
      return newBudget;
    } catch (error) {
      logger.error('[BudgetOps] Failed to add budget:', error);
      throw error;
    }
  }

  static async updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
    try {
      const updatedBudget = await DataService.updateBudget(id, updates);
      logger.debug('[BudgetOps] Budget updated:', { id });
      return updatedBudget;
    } catch (error) {
      logger.error('[BudgetOps] Failed to update budget:', error);
      throw error;
    }
  }

  static async deleteBudget(id: string): Promise<void> {
    try {
      await DataService.deleteBudget(id);
      logger.debug('[BudgetOps] Budget deleted:', { id });
    } catch (error) {
      logger.error('[BudgetOps] Failed to delete budget:', error);
      throw error;
    }
  }

  static async getBudgets(): Promise<Budget[]> {
    try {
      const budgets = await DataService.getBudgets();
      logger.debug('[BudgetOps] Budgets loaded:', { count: budgets.length });
      return budgets;
    } catch (error) {
      logger.error('[BudgetOps] Failed to get budgets:', error);
      throw error;
    }
  }
}

export class GoalOperations {
  static async addGoal(goal: Omit<Goal, 'id' | 'progress'>): Promise<Goal> {
    try {
      // DataService doesn't have addGoal, return a new goal with generated ID
      const newGoal = { ...goal, id: crypto.randomUUID(), progress: 0 } as Goal;
      logger.debug('[GoalOps] Goal added:', { id: newGoal.id });
      return newGoal;
    } catch (error) {
      logger.error('[GoalOps] Failed to add goal:', error);
      throw error;
    }
  }

  static async updateGoal(id: string, updates: Partial<Goal>): Promise<Goal> {
    try {
      const updatedGoal = await DataService.updateGoal(id, updates);
      logger.debug('[GoalOps] Goal updated:', { id });
      return updatedGoal;
    } catch (error) {
      logger.error('[GoalOps] Failed to update goal:', error);
      throw error;
    }
  }

  static async deleteGoal(id: string): Promise<void> {
    try {
      await DataService.deleteGoal(id);
      logger.debug('[GoalOps] Goal deleted:', { id });
    } catch (error) {
      logger.error('[GoalOps] Failed to delete goal:', error);
      throw error;
    }
  }

  static async contributeToGoal(
    id: string, 
    amount: number, 
    currentGoals: Goal[]
  ): Promise<Goal> {
    try {
      const goal = currentGoals.find(g => g.id === id);
      if (!goal) throw new Error('Goal not found');
      
      const newCurrentAmount = Math.min(goal.currentAmount + amount, goal.targetAmount);
      const updatedGoal = await DataService.updateGoal(id, {
        currentAmount: newCurrentAmount
      });
      
      logger.debug('[GoalOps] Contributed to goal:', { id, amount, newCurrentAmount });
      return updatedGoal;
    } catch (error) {
      logger.error('[GoalOps] Failed to contribute to goal:', error);
      throw error;
    }
  }

  static async getGoals(): Promise<Goal[]> {
    try {
      const goals = await DataService.getGoals();
      logger.debug('[GoalOps] Goals loaded:', { count: goals.length });
      return goals;
    } catch (error) {
      logger.error('[GoalOps] Failed to get goals:', error);
      throw error;
    }
  }
}
