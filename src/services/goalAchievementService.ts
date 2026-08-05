/**
 * The trophy shelf: which goals have been reached, and the confetti "already
 * shown" flag.
 *
 * It deliberately does NOT decide when a milestone has been passed any more.
 * It used to, with bands ("25% ≤ progress < 30%"), running alongside
 * notificationService's threshold-crossing logic — so a goal that stopped
 * inside a band re-announced its milestone on every recompute, while one that
 * jumped straight from 20% to 35% announced nothing at all. Milestones and
 * completion notifications now have exactly one owner: notificationService.
 */

import type { Goal } from '../types';

interface AchievementData {
  goalId: string;
  goalName: string;
  achievedAt: Date;
  type: Goal['type'];
  targetAmount: number;
}

class GoalAchievementService {
  private readonly STORAGE_KEY = 'goalAchievements';
  private readonly CELEBRATED_KEY = 'celebratedGoals';

  /**
   * Get all achievements
   */
  getAchievements(): AchievementData[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Record a goal achievement (idempotent per goal).
   *
   * `achievedAt` defaults to now, but callers pass the goal's stored
   * completion date when it has one — the trophy shelf on a second device
   * should show WHEN the goal was reached, not when that device first noticed.
   */
  recordAchievement(goal: Goal, achievedAt: Date = new Date()): void {
    const achievements = this.getAchievements();

    // Check if already recorded
    if (achievements.some(a => a.goalId === goal.id)) {
      return;
    }

    achievements.push({
      goalId: goal.id,
      goalName: goal.name,
      achievedAt,
      type: goal.type,
      targetAmount: goal.targetAmount
    });

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(achievements));
  }

  /**
   * Forget everything stored about a goal — called when the goal is deleted.
   *
   * Without this, the trophy shelf kept showing goals that no longer exist,
   * and the "already celebrated" flag survived to suppress the confetti for a
   * NEW goal that happened to reuse the id.
   */
  forgetGoal(goalId: string): void {
    try {
      const achievements = this.getAchievements().filter(a => a.goalId !== goalId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(achievements));

      const celebrated = localStorage.getItem(this.CELEBRATED_KEY);
      const celebratedIds: unknown = celebrated ? JSON.parse(celebrated) : [];
      if (Array.isArray(celebratedIds)) {
        localStorage.setItem(
          this.CELEBRATED_KEY,
          JSON.stringify(celebratedIds.filter(id => id !== goalId))
        );
      }
    } catch {
      // A goal that cannot be forgotten must not stop it being deleted.
    }
  }

  /**
   * Check if a goal has been celebrated
   */
  hasBeenCelebrated(goalId: string): boolean {
    try {
      const celebrated = localStorage.getItem(this.CELEBRATED_KEY);
      const celebratedIds = celebrated ? JSON.parse(celebrated) : [];
      return celebratedIds.includes(goalId);
    } catch {
      return false;
    }
  }

  /**
   * Mark a goal as celebrated
   */
  markAsCelebrated(goalId: string): void {
    try {
      const celebrated = localStorage.getItem(this.CELEBRATED_KEY);
      const celebratedIds = celebrated ? JSON.parse(celebrated) : [];
      
      if (!celebratedIds.includes(goalId)) {
        celebratedIds.push(goalId);
        localStorage.setItem(this.CELEBRATED_KEY, JSON.stringify(celebratedIds));
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Get celebration message based on goal type
   */
  getCelebrationMessage(goal: Goal): string {
    const messages: Record<Goal['type'], string[]> = {
      savings: [
        "Amazing! You've reached your savings goal! 🎉",
        "Congratulations! Your dedication to saving has paid off! 💰",
        "Well done! You've successfully hit your savings target! 🌟"
      ],
      'debt-payoff': [
        "Fantastic! You're one step closer to being debt-free! 🎊",
        "Incredible achievement! Your debt reduction goal is complete! 💪",
        "Congratulations on paying off your debt! Freedom awaits! 🚀"
      ],
      investment: [
        "Excellent! Your investment goal has been achieved! 📈",
        "Well done! Your portfolio has reached its target! 💎",
        "Success! Your investment strategy is paying off! 🏆"
      ],
      custom: [
        "Goal achieved! Your hard work has paid off! 🎯",
        "Congratulations! You've successfully completed your goal! ⭐",
        "Amazing progress! Your custom goal is now complete! 🎉"
      ]
    };

    const typeMessages = messages[goal.type];
    return typeMessages[Math.floor(Math.random() * typeMessages.length)];
  }

  /**
   * Get achievement statistics
   */
  getAchievementStats() {
    const achievements = this.getAchievements();
    
    return {
      total: achievements.length,
      byType: achievements.reduce((acc, achievement) => {
        acc[achievement.type] = (acc[achievement.type] || 0) + 1;
        return acc;
      }, {} as Record<Goal['type'], number>),
      thisMonth: achievements.filter(a => {
        const achievedDate = new Date(a.achievedAt);
        const now = new Date();
        return achievedDate.getMonth() === now.getMonth() && 
               achievedDate.getFullYear() === now.getFullYear();
      }).length,
      thisYear: achievements.filter(a => {
        const achievedDate = new Date(a.achievedAt);
        const now = new Date();
        return achievedDate.getFullYear() === now.getFullYear();
      }).length
    };
  }
}

export const goalAchievementService = new GoalAchievementService();