import { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import Decimal from 'decimal.js';
import type { Goal } from '../../types';
import type { GoalProjection } from './types';

export function useGoalTracker(onDataChange: () => void) {
  const { goals, accounts, transactions, addGoal, updateGoal, deleteGoal } = useApp();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Calculate total savings available for goals
  const totalSavings = useMemo(() => {
    return accounts
      .filter(acc => ['savings', 'investment'].includes(acc.type))
      .reduce((sum, acc) => sum.plus(new Decimal(acc.balance)), new Decimal(0));
  }, [accounts]);

  // Calculate monthly savings rate from recent transactions
  const monthlySavingsRate = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTransactions = transactions.filter(t => 
      new Date(t.date) >= thirtyDaysAgo
    );
    
    const income = recentTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const expenses = recentTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    return Math.max(0, income - expenses);
  }, [transactions]);

  // Group goals by category
  const goalsByCategory = useMemo(() => {
    const grouped: Record<string, Goal[]> = {};
    
    goals.forEach(goal => {
      const category = goal.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(goal);
    });
    
    return grouped;
  }, [goals]);

  // Get unique categories
  const categories = useMemo(() => {
    return ['all', ...new Set(goals.map(g => g.category || 'other'))];
  }, [goals]);

  // Filter goals by selected category
  const filteredGoals = useMemo(() => {
    if (selectedCategory === 'all') return goals;
    return goals.filter(g => (g.category || 'other') === selectedCategory);
  }, [goals, selectedCategory]);

  // Calculate projection for a goal
  const calculateGoalProjection = (goal: Goal): GoalProjection => {
    const currentAmount = new Decimal(goal.currentAmount || 0);
    const targetAmount = new Decimal(goal.targetAmount);
    const remaining = targetAmount.minus(currentAmount);
    
    if (remaining.lte(0)) {
      return {
        monthsToGoal: 0,
        requiredMonthlySaving: 0,
        currentProgress: 100,
        projectedDate: new Date(),
        onTrack: true,
        surplus: currentAmount.minus(targetAmount).toNumber()
      };
    }
    
    const targetDate = new Date(goal.targetDate);
    const today = new Date();
    const monthsRemaining = Math.max(1, 
      (targetDate.getFullYear() - today.getFullYear()) * 12 + 
      (targetDate.getMonth() - today.getMonth())
    );
    
    const requiredMonthlySaving = remaining.dividedBy(monthsRemaining).toNumber();
    const currentProgress = currentAmount.dividedBy(targetAmount).times(100).toNumber();
    
    // Check if on track based on monthly savings rate
    const onTrack = monthlySavingsRate >= requiredMonthlySaving;
    
    // Calculate projected completion date based on current savings rate
    const monthsToGoal = monthlySavingsRate > 0 
      ? Math.ceil(remaining.dividedBy(monthlySavingsRate).toNumber())
      : 999;
    
    const projectedDate = new Date();
    projectedDate.setMonth(projectedDate.getMonth() + monthsToGoal);
    
    return {
      monthsToGoal,
      requiredMonthlySaving,
      currentProgress,
      projectedDate,
      onTrack,
      surplus: 0
    };
  };

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    if (goals.length === 0) return 0;
    
    const totalProgress = goals.reduce((sum, goal) => {
      const current = new Decimal(goal.currentAmount || 0);
      const target = new Decimal(goal.targetAmount);
      return sum + current.dividedBy(target).times(100).toNumber();
    }, 0);
    
    return totalProgress / goals.length;
  }, [goals]);

  const handleCreateGoal = () => {
    setEditingGoal(null);
    setShowCreateModal(true);
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setShowCreateModal(true);
  };

  const handleDeleteGoal = async (goal: Goal) => {
    if (window.confirm(`Are you sure you want to delete the goal "${goal.name}"?`)) {
      try {
        await deleteGoal(goal.id);
        onDataChange();
      } catch (error) {
        console.error('Error deleting goal:', error);
      }
    }
  };

  const handleUpdateProgress = async (goal: Goal, newAmount: number) => {
    try {
      await updateGoal(goal.id, {
        ...goal,
        currentAmount: newAmount
      });
      onDataChange();
    } catch (error) {
      console.error('Error updating goal progress:', error);
    }
  };

  const handleSaveGoal = async (goalData: Omit<Goal, 'id' | 'progress'>) => {
    try {
      if (editingGoal) {
        await updateGoal(editingGoal.id, goalData);
      } else {
        await addGoal(goalData);
      }
      setShowCreateModal(false);
      setEditingGoal(null);
      onDataChange();
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  };

  return {
    goals,
    filteredGoals,
    categories,
    goalsByCategory,
    selectedCategory,
    showCreateModal,
    editingGoal,
    totalSavings,
    monthlySavingsRate,
    overallProgress,
    setSelectedCategory,
    setShowCreateModal,
    setEditingGoal,
    calculateGoalProjection,
    handleCreateGoal,
    handleEditGoal,
    handleDeleteGoal,
    handleUpdateProgress,
    handleSaveGoal
  };
}
