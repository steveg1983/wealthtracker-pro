/**
 * GoalAchievementService Tests
 * Tests for the goal achievement tracking and celebration service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { goalAchievementService } from './goalAchievementService';
import type { Goal } from '../types';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] || null)
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Test data
const mockGoal: Goal = {
  id: 'goal1',
  name: 'Emergency Fund',
  type: 'savings',
  targetAmount: 10000,
  currentAmount: 10000,
  targetDate: new Date('2025-12-31'),
  isActive: true
};

const mockGoals: Goal[] = [
  mockGoal,
  {
    id: 'goal2',
    name: 'Credit Card Payoff',
    type: 'debt-payoff',
    targetAmount: 5000,
    currentAmount: 5000,
    targetDate: new Date('2025-06-30'),
    isActive: true
  },
  {
    id: 'goal3',
    name: 'Investment Portfolio',
    type: 'investment',
    targetAmount: 50000,
    currentAmount: 50000,
    targetDate: new Date('2025-12-31'),
    isActive: true
  },
  {
    id: 'goal4',
    name: 'Custom Goal',
    type: 'custom',
    targetAmount: 1000,
    currentAmount: 1000,
    targetDate: new Date('2025-03-31'),
    isActive: true
  }
];

describe('GoalAchievementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-21'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getAchievements', () => {
    it('returns empty array when no achievements', () => {
      const achievements = goalAchievementService.getAchievements();
      expect(achievements).toEqual([]);
    });

    it('returns stored achievements', () => {
      const mockAchievements = [
        {
          goalId: 'goal1',
          goalName: 'Test Goal',
          achievedAt: new Date('2025-01-01'),
          type: 'savings' as const,
          targetAmount: 1000
        }
      ];
      
      mockLocalStorage.setItem('goalAchievements', JSON.stringify(mockAchievements));
      
      const achievements = goalAchievementService.getAchievements();
      expect(achievements).toHaveLength(1);
      expect(achievements[0].goalId).toBe('goal1');
    });

    it('handles malformed data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValueOnce('invalid-json');
      
      const achievements = goalAchievementService.getAchievements();
      expect(achievements).toEqual([]);
    });

    it('handles localStorage errors', () => {
      mockLocalStorage.getItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });
      
      const achievements = goalAchievementService.getAchievements();
      expect(achievements).toEqual([]);
    });
  });

  describe('recordAchievement', () => {
    it('records new achievement', () => {
      goalAchievementService.recordAchievement(mockGoal);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'goalAchievements',
        expect.stringContaining('goal1')
      );
      
      const achievements = goalAchievementService.getAchievements();
      expect(achievements).toHaveLength(1);
      expect(achievements[0]).toMatchObject({
        goalId: 'goal1',
        goalName: 'Emergency Fund',
        type: 'savings',
        targetAmount: 10000
      });
    });

    it('sets achievement date to current date', () => {
      goalAchievementService.recordAchievement(mockGoal);
      
      const achievements = goalAchievementService.getAchievements();
      expect(new Date(achievements[0].achievedAt)).toEqual(new Date('2025-01-21'));
    });

    it('prevents duplicate achievements', () => {
      goalAchievementService.recordAchievement(mockGoal);
      goalAchievementService.recordAchievement(mockGoal);
      
      const achievements = goalAchievementService.getAchievements();
      expect(achievements).toHaveLength(1);
    });

    it('preserves existing achievements', () => {
      goalAchievementService.recordAchievement(mockGoals[0]);
      goalAchievementService.recordAchievement(mockGoals[1]);
      
      const achievements = goalAchievementService.getAchievements();
      expect(achievements).toHaveLength(2);
      expect(achievements.map(a => a.goalId)).toContain('goal1');
      expect(achievements.map(a => a.goalId)).toContain('goal2');
    });
  });

  describe('hasBeenCelebrated', () => {
    it('returns false for uncelebrated goals', () => {
      expect(goalAchievementService.hasBeenCelebrated('goal1')).toBe(false);
    });

    it('returns true for celebrated goals', () => {
      mockLocalStorage.setItem('celebratedGoals', JSON.stringify(['goal1', 'goal2']));
      
      expect(goalAchievementService.hasBeenCelebrated('goal1')).toBe(true);
      expect(goalAchievementService.hasBeenCelebrated('goal2')).toBe(true);
    });

    it('returns false for non-celebrated goals in list', () => {
      mockLocalStorage.setItem('celebratedGoals', JSON.stringify(['goal1']));
      
      expect(goalAchievementService.hasBeenCelebrated('goal2')).toBe(false);
    });

    it('handles malformed data', () => {
      mockLocalStorage.getItem.mockReturnValueOnce('invalid-json');
      
      expect(goalAchievementService.hasBeenCelebrated('goal1')).toBe(false);
    });

    it('handles localStorage errors', () => {
      mockLocalStorage.getItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });
      
      expect(goalAchievementService.hasBeenCelebrated('goal1')).toBe(false);
    });
  });

  describe('markAsCelebrated', () => {
    it('marks goal as celebrated', () => {
      goalAchievementService.markAsCelebrated('goal1');
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'celebratedGoals',
        JSON.stringify(['goal1'])
      );
    });

    it('adds to existing celebrated goals', () => {
      mockLocalStorage.setItem('celebratedGoals', JSON.stringify(['goal1']));
      
      goalAchievementService.markAsCelebrated('goal2');
      
      const stored = mockLocalStorage.getItem('celebratedGoals');
      const celebratedIds = JSON.parse(stored!);
      expect(celebratedIds).toEqual(['goal1', 'goal2']);
    });

    it('prevents duplicate celebration entries', () => {
      mockLocalStorage.setItem('celebratedGoals', JSON.stringify(['goal1']));
      
      goalAchievementService.markAsCelebrated('goal1');
      
      const stored = mockLocalStorage.getItem('celebratedGoals');
      const celebratedIds = JSON.parse(stored!);
      expect(celebratedIds).toEqual(['goal1']);
    });

    it('handles localStorage errors silently', () => {
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });
      
      expect(() => goalAchievementService.markAsCelebrated('goal1')).not.toThrow();
    });
  });

  describe('getCelebrationMessage', () => {
    it('returns message for savings goals', () => {
      const message = goalAchievementService.getCelebrationMessage(mockGoals[0]);
      
      expect(message).toMatch(/savings|saving/i);
      expect(message).toContain('🎉');
    });

    it('returns message for debt-payoff goals', () => {
      const message = goalAchievementService.getCelebrationMessage(mockGoals[1]);
      
      expect(message).toMatch(/debt|payoff|paying off/i);
    });

    it('returns message for investment goals', () => {
      const message = goalAchievementService.getCelebrationMessage(mockGoals[2]);
      
      expect(message).toMatch(/investment|portfolio/i);
    });

    it('returns message for custom goals', () => {
      const message = goalAchievementService.getCelebrationMessage(mockGoals[3]);
      
      expect(message).toMatch(/goal|custom/i);
    });

    it('returns random messages from pool', () => {
      const messages = new Set<string>();
      
      // Get messages multiple times to check randomization
      for (let i = 0; i < 10; i++) {
        messages.add(goalAchievementService.getCelebrationMessage(mockGoals[0]));
      }
      
      // Should get different messages (unless very unlucky)
      expect(messages.size).toBeGreaterThan(1);
    });
  });

  describe('getAchievementStats', () => {
    beforeEach(() => {
      // Set up achievements across different time periods
      const achievements = [
        {
          goalId: 'goal1',
          goalName: 'Goal 1',
          achievedAt: new Date('2025-01-15'), // This month
          type: 'savings' as const,
          targetAmount: 1000
        },
        {
          goalId: 'goal2',
          goalName: 'Goal 2',
          achievedAt: new Date('2025-01-10'), // This month
          type: 'savings' as const,
          targetAmount: 2000
        },
        {
          goalId: 'goal3',
          goalName: 'Goal 3',
          achievedAt: new Date('2024-12-15'), // Last month
          type: 'debt-payoff' as const,
          targetAmount: 3000
        },
        {
          goalId: 'goal4',
          goalName: 'Goal 4',
          achievedAt: new Date('2024-06-01'), // Last year
          type: 'investment' as const,
          targetAmount: 4000
        }
      ];
      
      mockLocalStorage.setItem('goalAchievements', JSON.stringify(achievements));
    });

    it('calculates total achievements', () => {
      const stats = goalAchievementService.getAchievementStats();
      expect(stats.total).toBe(4);
    });

    it('groups achievements by type', () => {
      const stats = goalAchievementService.getAchievementStats();
      
      expect(stats.byType).toEqual({
        'savings': 2,
        'debt-payoff': 1,
        'investment': 1
      });
    });

    it('counts achievements this month', () => {
      const stats = goalAchievementService.getAchievementStats();
      expect(stats.thisMonth).toBe(2); // goal1 and goal2
    });

    it('counts achievements this year', () => {
      const stats = goalAchievementService.getAchievementStats();
      expect(stats.thisYear).toBe(2); // goal1 and goal2 (2025)
    });

    it('handles empty achievements', () => {
      mockLocalStorage.clear();
      
      const stats = goalAchievementService.getAchievementStats();
      
      expect(stats).toEqual({
        total: 0,
        byType: {},
        thisMonth: 0,
        thisYear: 0
      });
    });

    it('handles achievements on month boundaries', () => {
      vi.setSystemTime(new Date('2025-01-31')); // End of month
      
      const achievements = [{
        goalId: 'goal5',
        goalName: 'Goal 5',
        achievedAt: new Date('2025-01-01'), // Start of month
        type: 'savings' as const,
        targetAmount: 1000
      }];
      
      mockLocalStorage.setItem('goalAchievements', JSON.stringify(achievements));
      
      const stats = goalAchievementService.getAchievementStats();
      expect(stats.thisMonth).toBe(1);
    });
  });

  describe('getMilestoneMessage', () => {
    it('returns 25% milestone message', () => {
      const message = goalAchievementService.getMilestoneMessage(25);
      expect(message).toContain('25%');
      expect(message).toContain('🎯');
    });

    it('returns 50% milestone message', () => {
      const message = goalAchievementService.getMilestoneMessage(50);
      expect(message).toContain('Halfway');
      expect(message).toContain('💪');
    });

    it('returns 75% milestone message', () => {
      const message = goalAchievementService.getMilestoneMessage(75);
      expect(message).toContain('75%');
      expect(message).toContain('🚀');
    });

    it('returns 90% milestone message', () => {
      const message = goalAchievementService.getMilestoneMessage(90);
      expect(message).toContain('close');
      expect(message).toContain('🌟');
    });

    it('returns null for non-milestone progress', () => {
      expect(goalAchievementService.getMilestoneMessage(10)).toBeNull();
      expect(goalAchievementService.getMilestoneMessage(35)).toBeNull();
      expect(goalAchievementService.getMilestoneMessage(60)).toBeNull();
      expect(goalAchievementService.getMilestoneMessage(85)).toBeNull();
      expect(goalAchievementService.getMilestoneMessage(100)).toBeNull();
    });

    it('only triggers within threshold range', () => {
      // Just before threshold
      expect(goalAchievementService.getMilestoneMessage(24.9)).toBeNull();
      
      // In threshold range
      expect(goalAchievementService.getMilestoneMessage(25)).not.toBeNull();
      expect(goalAchievementService.getMilestoneMessage(29.9)).not.toBeNull();
      
      // Just after threshold
      expect(goalAchievementService.getMilestoneMessage(30)).toBeNull();
    });
  });
});