/**
 * Goal Celebrations Module
 * Handles goal progress celebrations and milestone notifications
 */

import type { Goal } from '../../types';
import type { Notification } from '../../contexts/NotificationContext';
import type { GoalCelebrationConfig } from './types';
import { logger } from '../loggingService';

export class GoalCelebrations {
  private config: GoalCelebrationConfig;
  private celebrationEmojis = ['🎉', '🎊', '🥳', '🏆', '✨', '🌟', '💫', '🎯'];

  constructor(config: GoalCelebrationConfig) {
    this.config = config;
  }

  /**
   * Check goal progress and generate celebrations
   */
  checkGoalProgress(goals: Goal[], previousGoals?: Goal[]): Notification[] {
    const notifications: Notification[] = [];

    goals.forEach(goal => {
      const currentProgress = this.calculateGoalProgress(goal);
      const previousGoal = previousGoals?.find(g => g.id === goal.id);
      const previousProgress = previousGoal ? this.calculateGoalProgress(previousGoal) : 0;

      // Check for milestone achievements
      if (this.config.enableMilestoneNotifications) {
        const milestoneNotification = this.checkGoalMilestone(
          goal, 
          currentProgress, 
          previousProgress
        );
        if (milestoneNotification) {
          notifications.push(milestoneNotification);
        }
      }

      // Check for goal completion
      if (this.config.enableCompletionCelebration && 
          currentProgress >= 100 && 
          previousProgress < 100) {
        const completionNotification = this.createGoalCompletionNotification(goal);
        notifications.push(completionNotification);
      }

      // Check for progress reminders
      if (this.config.enableProgressReminders) {
        const reminderNotification = this.checkProgressReminder(
          goal, 
          currentProgress
        );
        if (reminderNotification) {
          notifications.push(reminderNotification);
        }
      }
    });

    return notifications;
  }

  /**
   * Check for milestone achievements
   */
  private checkGoalMilestone(
    goal: Goal,
    currentProgress: number,
    previousProgress: number
  ): Notification | null {
    const milestones = this.config.milestonePercentages;
    
    for (const milestone of milestones) {
      if (currentProgress >= milestone && 
          previousProgress < milestone && 
          milestone < 100) {
        
        const emoji = this.getRandomCelebrationEmoji();
        const encouragement = this.getEncouragementMessage(milestone);
        
        return {
          id: `goal-milestone-${goal.id}-${milestone}`,
          type: 'success',
          title: `${emoji} ${milestone}% Goal Progress!`,
          message: `${encouragement} You're ${milestone}% of the way to "${goal.name}"!`,
          timestamp: new Date(),
          read: false,
          action: {
            label: 'View Goal',
            onClick: () => {
              window.location.href = '/goals';
            }
          }
        };
      }
    }

    return null;
  }

  /**
   * Create goal completion notification
   */
  private createGoalCompletionNotification(goal: Goal): Notification {
    const celebrationMessage = this.getCompletionMessage(goal);
    
    return {
      id: `goal-completed-${goal.id}`,
      type: 'success',
      title: '🏆 Goal Achieved!',
      message: celebrationMessage,
      timestamp: new Date(),
      read: false,
      action: {
        label: 'View Achievement',
        onClick: () => {
          window.location.href = '/goals';
        }
      }
    };
  }

  /**
   * Check for progress reminders
   */
  private checkProgressReminder(
    goal: Goal,
    currentProgress: number
  ): Notification | null {
    // Check if goal is behind schedule
    const targetDate = new Date(goal.targetDate);
    const startDate = new Date(goal.createdAt);
    const now = new Date();
    
    const totalDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const expectedProgress = (daysElapsed / totalDays) * 100;
    
    // If significantly behind (more than 20% behind expected)
    if (currentProgress < expectedProgress - 20 && currentProgress < 90) {
      return {
        id: `goal-reminder-${goal.id}-${Date.now()}`,
        type: 'info',
        title: '📅 Goal Reminder',
        message: `Your goal "${goal.name}" needs attention. You're ${
          Math.round(expectedProgress - currentProgress)
        }% behind schedule.`,
        timestamp: new Date(),
        read: false,
        action: {
          label: 'Update Progress',
          onClick: () => {
            window.location.href = `/goals/${goal.id}`;
          }
        }
      };
    }

    return null;
  }

  /**
   * Check for streak achievements
   */
  checkStreakAchievement(
    goal: Goal,
    contributions: Array<{ date: Date; amount: number }>
  ): Notification | null {
    if (!this.config.enableStreaks) return null;

    // Calculate consecutive days with contributions
    const sortedContributions = contributions
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    
    let currentStreak = 0;
    let lastDate = new Date();
    
    for (const contribution of sortedContributions) {
      const daysDiff = Math.floor(
        (lastDate.getTime() - contribution.date.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysDiff <= 1) {
        currentStreak++;
        lastDate = contribution.date;
      } else {
        break;
      }
    }

    // Celebrate streak milestones (7, 14, 30, 60, 90, 365 days)
    const streakMilestones = [7, 14, 30, 60, 90, 365];
    
    if (streakMilestones.includes(currentStreak)) {
      return {
        id: `streak-${goal.id}-${currentStreak}`,
        type: 'success',
        title: `🔥 ${currentStreak}-Day Streak!`,
        message: `Amazing! You've contributed to "${goal.name}" for ${currentStreak} days in a row!`,
        timestamp: new Date(),
        read: false,
        action: {
          label: 'View Progress',
          onClick: () => {
            window.location.href = `/goals/${goal.id}`;
          }
        }
      };
    }

    return null;
  }

  /**
   * Calculate goal progress percentage
   */
  private calculateGoalProgress(goal: Goal): number {
    if (goal.targetAmount === 0) return 0;
    return Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
  }

  /**
   * Get random celebration emoji
   */
  private getRandomCelebrationEmoji(): string {
    return this.celebrationEmojis[
      Math.floor(Math.random() * this.celebrationEmojis.length)
    ];
  }

  /**
   * Get encouragement message based on milestone
   */
  private getEncouragementMessage(milestone: number): string {
    const messages: Record<number, string[]> = {
      25: ['Great start!', 'You\'re making progress!', 'Keep it up!'],
      50: ['Halfway there!', 'You\'re doing amazing!', 'Fantastic progress!'],
      75: ['Almost there!', 'The finish line is in sight!', 'Outstanding effort!']
    };
    
    const options = messages[milestone] || ['Great job!'];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Get completion message for goal
   */
  private getCompletionMessage(goal: Goal): string {
    const messages = [
      `Congratulations! You've completed "${goal.name}"! Time to celebrate! 🎉`,
      `Amazing achievement! "${goal.name}" is complete! You did it! 🌟`,
      `Success! You've reached your goal "${goal.name}"! Well done! 🏆`,
      `Incredible! "${goal.name}" achieved! Your dedication paid off! 💪`
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GoalCelebrationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export const createGoalCelebrations = (config: GoalCelebrationConfig) => 
  new GoalCelebrations(config);