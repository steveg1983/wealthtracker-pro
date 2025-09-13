import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from './useCurrencyDecimal';
import { useNotifications } from '../contexts/NotificationContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { goalsPageService } from '../services/goalsPageService';
import type { Goal } from '../types';

export function useGoalsPage() {
  const { goals, accounts, deleteGoal, getDecimalGoals, getDecimalAccounts } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { addNotification, checkGoalProgress } = useNotifications();
  const { enableGoalCelebrations } = usePreferences();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [showConfetti, setShowConfetti] = useState(false);
  const [celebratingGoal, setCelebratingGoal] = useState<Goal | null>(null);
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const [showAchievements, setShowAchievements] = useState(false);
  const [previousGoals, setPreviousGoals] = useState<Goal[]>([]);

  const decimalGoals = getDecimalGoals();
  const decimalAccounts = getDecimalAccounts();
  
  const activeGoals = goals.filter(g => g.isActive);
  const completedGoals = goals.filter(g => 
    !g.isActive || goalsPageService.getProgressPercentage(g, decimalGoals) >= 100
  );

  const stats = goalsPageService.calculateGoalStats(goals, decimalGoals);

  // Track goal progress changes for notifications
  useEffect(() => {
    if (goals.length > 0 && previousGoals.length > 0) {
      checkGoalProgress(goals, previousGoals);
    }
    setPreviousGoals([...goals]);
  }, [goals, checkGoalProgress]);

  // Check for achievements
  useEffect(() => {
    activeGoals.forEach(goal => {
      const progress = goalsPageService.getProgressPercentage(goal, decimalGoals);
      
      goalsPageService.checkForAchievements(
        goal,
        progress,
        enableGoalCelebrations,
        (achievedGoal, message) => {
          setCelebrationMessage(message);
          setCelebratingGoal(achievedGoal);
          setShowConfetti(true);
          
          addNotification({
            type: 'success',
            title: 'Goal Achieved! <�',
            message: `Congratulations! You've achieved your goal: ${achievedGoal.name}`,
          });
        },
        (milestoneGoal, milestoneMsg) => {
          addNotification({
            type: 'info',
            title: 'Goal Progress',
            message: `${milestoneGoal.name}: ${milestoneMsg}`
          });
        }
      );
    });
  }, [activeGoals, decimalGoals, addNotification, enableGoalCelebrations]);

  const handleEdit = useCallback((goal: Goal) => {
    setEditingGoal(goal);
    setIsModalOpen(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (confirm('Are you sure you want to delete this goal?')) {
      deleteGoal(id);
    }
  }, [deleteGoal]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingGoal(undefined);
  }, []);

  const getProgressPercentage = useCallback((goal: Goal) => {
    return goalsPageService.getProgressPercentage(goal, decimalGoals);
  }, [decimalGoals]);

  const getDaysRemaining = useCallback((targetDate: Date) => {
    return goalsPageService.getDaysRemaining(targetDate);
  }, []);

  const getLinkedAccountsBalance = useCallback((linkedAccountIds?: string[]) => {
    return goalsPageService.getLinkedAccountsBalance(linkedAccountIds, decimalAccounts);
  }, [decimalAccounts]);

  const getGoalIcon = useCallback((type: Goal['type']) => {
    return goalsPageService.getGoalIcon(type);
  }, []);

  const getProgressColorClass = useCallback((progress: number) => {
    return goalsPageService.getProgressColorClass(progress);
  }, []);

  const getDaysRemainingColorClass = useCallback((daysRemaining: number) => {
    return goalsPageService.getDaysRemainingColorClass(daysRemaining);
  }, []);

  return {
    // State
    isModalOpen,
    setIsModalOpen,
    editingGoal,
    showConfetti,
    setShowConfetti,
    celebratingGoal,
    setCelebratingGoal,
    celebrationMessage,
    showAchievements,
    setShowAchievements,
    
    // Data
    goals,
    activeGoals,
    completedGoals,
    stats,
    
    // Handlers
    handleEdit,
    handleDelete,
    handleCloseModal,
    
    // Utilities
    formatCurrency,
    getProgressPercentage,
    getDaysRemaining,
    getLinkedAccountsBalance,
    getGoalIcon,
    getProgressColorClass,
    getDaysRemainingColorClass,
    getGoalTypeExamples: goalsPageService.getGoalTypeExamples
  };
}