import { calculateGoalProgress } from '../utils/calculations-decimal';
import { toDecimal } from '../utils/decimal';
import { goalAchievementService } from './goalAchievementService';
import type { Goal } from '../types';
import type { DecimalGoal, DecimalAccount, DecimalInstance } from '../types/decimal-types';

export interface GoalStats {
  activeCount: number;
  completedCount: number;
  totalTargetAmount: DecimalInstance;
  totalCurrentAmount: DecimalInstance;
  overallProgress: number;
}

class GoalsPageService {
  getProgressPercentage(goal: Goal, decimalGoals: DecimalGoal[]): number {
    const decimalGoal = decimalGoals.find((g: DecimalGoal) => g.id === goal.id);
    if (!decimalGoal) return 0;
    return calculateGoalProgress(decimalGoal);
  }

  getDaysRemaining(targetDate: Date): number {
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  getLinkedAccountsBalance(
    linkedAccountIds: string[] | undefined,
    decimalAccounts: DecimalAccount[]
  ): DecimalInstance {
    if (!linkedAccountIds || linkedAccountIds.length === 0) return toDecimal(0);
    
    return linkedAccountIds.reduce((total, accountId) => {
      const account = decimalAccounts.find((a: DecimalAccount) => a.id === accountId);
      return account ? total.plus(account.balance) : total;
    }, toDecimal(0));
  }

  getGoalIcon(type: Goal['type']): string {
    switch (type) {
      case 'savings':
        return '=°';
      case 'debt-payoff':
        return '=³';
      case 'investment':
        return '=È';
      case 'custom':
        return '<¯';
    }
  }

  getProgressColorClass(progress: number): string {
    if (progress >= 100) return 'bg-green-600';
    if (progress >= 75) return 'bg-gray-600';
    if (progress >= 50) return 'bg-yellow-600';
    return 'bg-gray-400';
  }

  getDaysRemainingColorClass(daysRemaining: number): string {
    return daysRemaining < 30 ? 'text-red-600' : 'text-gray-600 dark:text-gray-400';
  }

  calculateGoalStats(goals: Goal[], decimalGoals: DecimalGoal[]): GoalStats {
    const activeGoals = goals.filter(g => g.isActive);
    const completedGoals = goals.filter(g => !g.isActive || this.getProgressPercentage(g, decimalGoals) >= 100);
    
    const activeDecimalGoals = decimalGoals.filter((g: DecimalGoal) => {
      const regularGoal = goals.find(rg => rg.id === g.id);
      return regularGoal?.isActive;
    });
    
    const totalTargetAmount = activeDecimalGoals.reduce(
      (sum: DecimalInstance, goal: DecimalGoal) => sum.plus(goal.targetAmount), 
      toDecimal(0)
    );
    
    const totalCurrentAmount = activeDecimalGoals.reduce(
      (sum: DecimalInstance, goal: DecimalGoal) => sum.plus(goal.currentAmount), 
      toDecimal(0)
    );
    
    const overallProgress = totalTargetAmount.greaterThan(0) 
      ? totalCurrentAmount.dividedBy(totalTargetAmount).times(100).toNumber() 
      : 0;

    return {
      activeCount: activeGoals.length,
      completedCount: completedGoals.length,
      totalTargetAmount,
      totalCurrentAmount,
      overallProgress
    };
  }

  checkForAchievements(
    goal: Goal,
    progress: number,
    enableCelebrations: boolean,
    onAchievement: (goal: Goal, message: string) => void,
    onMilestone: (goal: Goal, message: string) => void
  ): void {
    if (!enableCelebrations) return;

    // Check for achievement
    if (progress >= 100 && !goalAchievementService.hasBeenCelebrated(goal.id)) {
      goalAchievementService.recordAchievement(goal);
      goalAchievementService.markAsCelebrated(goal.id);
      
      const message = goalAchievementService.getCelebrationMessage(goal);
      onAchievement(goal, message);
    }
    
    // Check for milestones
    const milestoneMessage = goalAchievementService.getMilestoneMessage(progress);
    const milestoneKey = `milestone-${goal.id}-${Math.floor(progress / 25) * 25}`;
    
    if (milestoneMessage && !sessionStorage.getItem(milestoneKey)) {
      sessionStorage.setItem(milestoneKey, 'true');
      onMilestone(goal, milestoneMessage);
    }
  }

  getGoalTypeExamples(): Array<{
    icon: string;
    title: string;
    description: string;
    bgColor: string;
  }> {
    return [
      {
        icon: '=°',
        title: 'Savings Goal',
        description: 'Build your emergency fund or save for a big purchase',
        bgColor: 'bg-blue-50 dark:bg-gray-900/20'
      },
      {
        icon: '=³',
        title: 'Debt Payoff',
        description: 'Track progress on paying down credit cards or loans',
        bgColor: 'bg-green-50 dark:bg-green-900/20'
      },
      {
        icon: '=È',
        title: 'Investment',
        description: 'Monitor your investment portfolio growth targets',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20'
      }
    ];
  }
}

export const goalsPageService = new GoalsPageService();