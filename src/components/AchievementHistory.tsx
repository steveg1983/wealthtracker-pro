/**
 * AchievementHistory Component - Display user achievements and milestones
 *
 * Features:
 * - Achievement timeline
 * - Badge display
 * - Progress tracking
 * - Celebration effects
 */

import React, { useState, useEffect } from 'react';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'financial' | 'goals' | 'habits' | 'milestones';
  unlockedAt: Date;
  points: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface AchievementHistoryProps {
  userId?: string;
  className?: string;
  showAll?: boolean;
  maxItems?: number;
}

// Mock achievements data
const mockAchievements: Achievement[] = [
  {
    id: 'first-goal',
    title: 'Goal Setter',
    description: 'Created your first financial goal',
    icon: '🎯',
    category: 'goals',
    unlockedAt: new Date('2024-01-15'),
    points: 100,
    rarity: 'common'
  },
  {
    id: 'emergency-fund',
    title: 'Safety First',
    description: 'Built an emergency fund worth 3 months of expenses',
    icon: '🛡️',
    category: 'financial',
    unlockedAt: new Date('2024-02-20'),
    points: 500,
    rarity: 'rare'
  },
  {
    id: 'budget-master',
    title: 'Budget Master',
    description: 'Stayed within budget for 3 consecutive months',
    icon: '📊',
    category: 'habits',
    unlockedAt: new Date('2024-03-10'),
    points: 300,
    rarity: 'rare'
  },
  {
    id: 'goal-achieved',
    title: 'Goal Crusher',
    description: 'Achieved your first savings goal',
    icon: '🏆',
    category: 'goals',
    unlockedAt: new Date('2024-03-25'),
    points: 750,
    rarity: 'epic'
  }
];

export default function AchievementHistory({
  userId,
  className = '',
  showAll = false,
  maxItems = 10
}: AchievementHistoryProps): React.JSX.Element {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Load achievements
  useEffect(() => {
    const loadAchievements = async () => {
      setIsLoading(true);
      try {

        // In a real implementation, this would fetch from API
        // For now, use mock data
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API call

        // Sort by unlock date (newest first)
        const sortedAchievements = [...mockAchievements].sort(
          (a, b) => b.unlockedAt.getTime() - a.unlockedAt.getTime()
        );

        setAchievements(sortedAchievements);
      } catch (error) {
        setAchievements([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadAchievements();
  }, [userId]);

  // Filter achievements by category
  const filteredAchievements = achievements.filter(achievement => {
    if (selectedCategory === 'all') return true;
    return achievement.category === selectedCategory;
  });

  // Limit items if not showing all
  const displayedAchievements = showAll
    ? filteredAchievements
    : filteredAchievements.slice(0, maxItems);

  const getRarityColor = (rarity: Achievement['rarity']): string => {
    switch (rarity) {
      case 'common':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
      case 'rare':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200';
      case 'epic':
        return 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200';
      case 'legendary':
        return 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const categories = [
    { id: 'all', label: 'All', icon: '📋' },
    { id: 'financial', label: 'Financial', icon: '💰' },
    { id: 'goals', label: 'Goals', icon: '🎯' },
    { id: 'habits', label: 'Habits', icon: '🔥' },
    { id: 'milestones', label: 'Milestones', icon: '🏁' }
  ];

  const totalPoints = achievements.reduce((sum, achievement) => sum + achievement.points, 0);

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-3">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Achievement History
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Total Points: <span className="font-semibold text-blue-600 dark:text-blue-400">{totalPoints.toLocaleString()}</span>
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
              selectedCategory === category.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <span className="mr-1">{category.icon}</span>
            {category.label}
          </button>
        ))}
      </div>

      {/* Achievements List */}
      {displayedAchievements.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏆</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No achievements yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Keep using WealthTracker to unlock achievements and earn points!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedAchievements.map((achievement, index) => (
            <div
              key={achievement.id}
              className="flex items-center space-x-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Achievement Icon */}
              <div className="text-3xl">{achievement.icon}</div>

              {/* Achievement Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {achievement.title}
                  </h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getRarityColor(achievement.rarity)}`}>
                    {achievement.rarity}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {achievement.description}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    Unlocked {achievement.unlockedAt.toLocaleDateString()}
                  </span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    +{achievement.points} points
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show More Button */}
      {!showAll && filteredAchievements.length > maxItems && (
        <div className="text-center">
          <button
            onClick={() => {/* In a real app, this would expand the list or navigate to full view */}}
            className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors duration-200"
          >
            View All Achievements ({filteredAchievements.length - maxItems} more)
          </button>
        </div>
      )}
    </div>
  );
}