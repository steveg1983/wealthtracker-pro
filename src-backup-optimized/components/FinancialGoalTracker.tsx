/**
 * Financial Goal Tracker Component
 * Tracks and manages financial goals using real data from AppContext
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useAuth } from '@clerk/clerk-react';
import { useRegionalCurrency } from '../hooks/useRegionalSettings';
import { financialPlanningService } from '../services/financialPlanningService';
import Decimal from 'decimal.js';
import {
  TargetIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  TrendingUpIcon,
  CalendarIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
  DollarSignIcon,
  PiggyBankIcon,
  HomeIcon,
  CarIcon,
  GraduationCapIcon,
  PalmtreeIcon,
  RingIcon,
  HeartIcon
} from './icons';
import type { Goal } from '../types';

interface FinancialGoalTrackerProps {
  onDataChange: () => void;
}

interface GoalProjection {
  monthsToGoal: number;
  requiredMonthlySaving: number;
  currentProgress: number;
  projectedDate: Date;
  onTrack: boolean;
  surplus: number;
}

export default function FinancialGoalTracker({ onDataChange }: FinancialGoalTrackerProps): React.JSX.Element {
  const { goals, accounts, transactions, addGoal, updateGoal, deleteGoal } = useApp();
  const { userId } = useAuth();
  const { formatCurrency } = useRegionalCurrency();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

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

  // Get goal icon based on category
  const getGoalIcon = (category?: string) => {
    switch (category) {
      case 'home': return HomeIcon;
      case 'car': return CarIcon;
      case 'education': return GraduationCapIcon;
      case 'vacation': return PalmtreeIcon;
      case 'wedding': return RingIcon;
      case 'emergency': return HeartIcon;
      case 'retirement': return PiggyBankIcon;
      default: return TargetIcon;
    }
  };

  // Get category color
  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'home': return 'text-gray-600 bg-blue-50 border-blue-200';
      case 'car': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'education': return 'text-green-600 bg-green-50 border-green-200';
      case 'vacation': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'wedding': return 'text-pink-600 bg-pink-50 border-pink-200';
      case 'emergency': return 'text-red-600 bg-red-50 border-red-200';
      case 'retirement': return 'text-indigo-600 bg-indigo-50 border-indigo-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Goals</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track your progress towards financial goals
          </p>
        </div>
        <button
          onClick={handleCreateGoal}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          <PlusIcon size={16} />
          Add Goal
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Goals</h3>
            <TargetIcon size={20} className="text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{goals.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Active goals
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Overall Progress</h3>
            <TrendingUpIcon size={20} className="text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
            {overallProgress.toFixed(1)}%
          </p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
            <div 
              className="bg-gray-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, overallProgress)}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Saved</h3>
            <PiggyBankIcon size={20} className="text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(
              goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0)
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Across all goals
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Savings</h3>
            <DollarSignIcon size={20} className="text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(monthlySavingsRate)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Available for goals
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === category
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {category === 'all' ? 'All Goals' : category.charAt(0).toUpperCase() + category.slice(1)}
            {category !== 'all' && goalsByCategory[category] && (
              <span className="ml-1.5 text-xs opacity-80">
                ({goalsByCategory[category].length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Goals Grid */}
      {filteredGoals.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
          <TargetIcon size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No goals yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Start by creating your first financial goal
          </p>
          <button
            onClick={handleCreateGoal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <PlusIcon size={16} />
            Create Your First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredGoals.map(goal => {
            const projection = calculateGoalProjection(goal);
            const Icon = getGoalIcon(goal.category);
            const categoryStyle = getCategoryColor(goal.category);
            
            return (
              <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                {/* Goal Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg border ${categoryStyle}`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {goal.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {goal.category || 'Other'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditGoal(goal)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-500"
                    >
                      <EditIcon size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal)}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {formatCurrency(goal.currentAmount || 0)}
                    </span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {formatCurrency(goal.targetAmount)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all duration-300 ${
                        projection.currentProgress >= 100 
                          ? 'bg-green-500' 
                          : projection.onTrack 
                            ? 'bg-gray-500' 
                            : 'bg-yellow-500'
                      }`}
                      style={{ width: `${Math.min(100, projection.currentProgress)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {projection.currentProgress.toFixed(1)}% complete
                  </p>
                </div>

                {/* Goal Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <CalendarIcon size={14} />
                      Target Date
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date(goal.targetDate).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <ClockIcon size={14} />
                      Time Remaining
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {projection.monthsToGoal < 999 
                        ? `${projection.monthsToGoal} months`
                        : 'Calculate savings rate'
                      }
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <DollarSignIcon size={14} />
                      Monthly Need
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(projection.requiredMonthlySaving)}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  {projection.currentProgress >= 100 ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircleIcon size={16} />
                      <span className="text-sm font-medium">Goal Achieved!</span>
                    </div>
                  ) : projection.onTrack ? (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-500">
                      <TrendingUpIcon size={16} />
                      <span className="text-sm font-medium">On Track</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                      <AlertCircleIcon size={16} />
                      <span className="text-sm font-medium">Needs Attention</span>
                    </div>
                  )}
                  
                  {/* Quick Update Button */}
                  <button
                    onClick={() => {
                      const newAmount = window.prompt(
                        'Update current amount saved:',
                        String(goal.currentAmount || 0)
                      );
                      if (newAmount && !isNaN(Number(newAmount))) {
                        handleUpdateProgress(goal, Number(newAmount));
                      }
                    }}
                    className="text-sm text-gray-600 dark:text-gray-500 hover:underline"
                  >
                    Update
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <GoalModal
          goal={editingGoal}
          onClose={() => {
            setShowCreateModal(false);
            setEditingGoal(null);
          }}
          onSave={async (goalData) => {
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
          }}
        />
      )}
    </div>
  );
}

// Goal Modal Component
interface GoalModalProps {
  goal: Goal | null;
  onClose: () => void;
  onSave: (goal: Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
}

function GoalModal({ goal, onClose, onSave }: GoalModalProps) {
  const { formatCurrency } = useRegionalCurrency();
  const [formData, setFormData] = useState({
    name: goal?.name || '',
    category: goal?.category || 'other',
    targetAmount: goal?.targetAmount || 0,
    currentAmount: goal?.currentAmount || 0,
    targetDate: goal?.targetDate ? new Date(goal.targetDate).toISOString().split('T')[0] : '',
    description: goal?.description || ''
  });

  const categories = [
    { value: 'home', label: 'Home', icon: HomeIcon },
    { value: 'car', label: 'Car', icon: CarIcon },
    { value: 'education', label: 'Education', icon: GraduationCapIcon },
    { value: 'vacation', label: 'Vacation', icon: PalmtreeIcon },
    { value: 'wedding', label: 'Wedding', icon: RingIcon },
    { value: 'emergency', label: 'Emergency Fund', icon: HeartIcon },
    { value: 'retirement', label: 'Retirement', icon: PiggyBankIcon },
    { value: 'other', label: 'Other', icon: TargetIcon }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      targetDate: new Date(formData.targetDate),
      type: 'custom' as const,
      isActive: true,
      progress: (formData.currentAmount / formData.targetAmount) * 100
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {goal ? 'Edit Goal' : 'Create New Goal'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <PlusIcon size={20} className="rotate-45" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Goal Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., Dream Home Down Payment"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Amount
              </label>
              <input
                type="number"
                value={formData.targetAmount || ''}
                onChange={(e) => setFormData({ ...formData, targetAmount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                step="1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Amount Saved
              </label>
              <input
                type="number"
                value={formData.currentAmount || ''}
                onChange={(e) => setFormData({ ...formData, currentAmount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                step="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Date
              </label>
              <input
                type="date"
                value={formData.targetDate}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={3}
                placeholder="Add notes about this goal..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              {goal ? 'Update' : 'Create'} Goal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}