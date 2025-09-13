import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { householdService } from '../services/householdService';
import { sharedFinanceService, type SharedBudget, type SharedGoal, type BudgetApproval } from '../services/sharedFinanceService';
import type { Transaction } from '../types';

interface Activity {
  id: string;
  memberName: string;
  details: string;
  timestamp: Date;
}

export function useSharedFinances() {
  const { transactions, categories, addBudget, addGoal } = useApp();
  const [household] = useState(householdService.getHousehold());
  const [currentMember] = useState(household?.members[0]); // Assume first member is current user
  
  const [sharedBudgets, setSharedBudgets] = useState<SharedBudget[]>([]);
  const [sharedGoals, setSharedGoals] = useState<SharedGoal[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<BudgetApproval[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const loadSharedData = useCallback(() => {
    if (!household) return;
    
    const budgets = sharedFinanceService.getHouseholdBudgets(household.id, currentMember?.id);
    setSharedBudgets(budgets);
    
    const goals = sharedFinanceService.getHouseholdGoals(household.id, currentMember?.id);
    setSharedGoals(goals);
    
    const approvals = sharedFinanceService.getPendingApprovals(household.id);
    setPendingApprovals(approvals);
    
    const recentActivities = sharedFinanceService.getRecentActivities(household.id);
    setActivities(recentActivities);
  }, [household, currentMember?.id]);

  useEffect(() => {
    if (household) {
      loadSharedData();
    }
  }, [household, transactions, loadSharedData]);

  const handleCreateBudget = useCallback((budgetData: {
    name: string;
    category: string;
    amount: string;
    period: 'monthly' | 'weekly' | 'yearly';
    approvalRequired: boolean;
    approvalThreshold: string;
  }) => {
    if (!household || !currentMember) throw new Error('No household or member');

    try {
      sharedFinanceService.createSharedBudget(
        {
          name: budgetData.name,
          categoryId: budgetData.category,
          amount: Number(budgetData.amount),
          period: budgetData.period,
          isActive: true,
          spent: 0,
          updatedAt: new Date()
        },
        household.id,
        currentMember.id,
        currentMember.name,
        undefined, // Share with all by default
        [currentMember.id], // Creator can edit
        budgetData.approvalRequired,
        Number(budgetData.approvalThreshold)
      );

      // Also create in main app context
      addBudget({
        name: budgetData.name,
        categoryId: budgetData.category,
        amount: Number(budgetData.amount),
        period: budgetData.period,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      loadSharedData();
    } catch (error) {
      throw error;
    }
  }, [household, currentMember, addBudget, loadSharedData]);

  const handleCreateGoal = useCallback((goalData: {
    name: string;
    targetAmount: string;
    targetDate: string;
    category: string;
    description: string;
    isHouseholdGoal: boolean;
  }) => {
    if (!household || !currentMember) throw new Error('No household or member');

    try {
      sharedFinanceService.createSharedGoal(
        {
          name: goalData.name,
          type: 'savings' as const,
          targetAmount: Number(goalData.targetAmount),
          currentAmount: 0,
          targetDate: new Date(goalData.targetDate),
          category: goalData.category,
          description: goalData.description,
          isActive: true,
          progress: 0,
          completedAt: undefined,
          updatedAt: new Date()
        },
        household.id,
        currentMember.id,
        currentMember.name,
        goalData.isHouseholdGoal
      );

      // Also create in main app context
      addGoal({
        name: goalData.name,
        type: 'savings' as const,
        targetAmount: Number(goalData.targetAmount),
        currentAmount: 0,
        targetDate: new Date(goalData.targetDate),
        category: goalData.category,
        description: goalData.description,
        isActive: true
      });

      loadSharedData();
    } catch (error) {
      throw error;
    }
  }, [household, currentMember, addGoal, loadSharedData]);

  const handleContributeToGoal = useCallback((goalId: string, amount: number) => {
    if (!currentMember) return;

    try {
      sharedFinanceService.updateGoalProgress(
        goalId,
        currentMember.id,
        currentMember.name,
        amount
      );
      loadSharedData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unknown error');
    }
  }, [currentMember, loadSharedData]);

  const handleReviewApproval = useCallback((approvalId: string, approved: boolean) => {
    if (!currentMember) return;

    try {
      sharedFinanceService.reviewApproval(
        approvalId,
        currentMember.id,
        approved,
        approved ? 'Approved' : 'Rejected'
      );
      loadSharedData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unknown error');
    }
  }, [currentMember, loadSharedData]);

  const calculateBudgetSpending = useCallback((budget: SharedBudget): number => {
    const now = new Date();
    const spending = sharedFinanceService.calculateBudgetSpending(
      budget.id,
      transactions,
      now
    );
    
    let total = 0;
    spending.forEach(amount => total += amount);
    return total;
  }, [transactions]);

  const getMemberSpending = useCallback((budget: SharedBudget): Map<string, number> => {
    const now = new Date();
    return sharedFinanceService.calculateBudgetSpending(
      budget.id,
      transactions,
      now
    );
  }, [transactions]);

  return {
    household,
    currentMember,
    sharedBudgets,
    sharedGoals,
    pendingApprovals,
    activities,
    categories,
    handleCreateBudget,
    handleCreateGoal,
    handleContributeToGoal,
    handleReviewApproval,
    calculateBudgetSpending,
    getMemberSpending
  };
}