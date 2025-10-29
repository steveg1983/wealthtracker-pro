import React from 'react';
import { goalAchievementService } from '../services/goalAchievementService';
import { CheckCircleIcon, CalendarIcon } from './icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

export default function AchievementHistory() {
  const { formatCurrency } = useCurrencyDecimal();
  const achievements = goalAchievementService.getAchievements();
  const stats = goalAchievementService.getAchievementStats();

  const getGoalIcon = (type: string) => {
    switch (type) {
      case 'savings':
        return '💰';
      case 'debt-payoff':
        return '💳';
      case 'investment':
        return '📈';
      case 'custom':
        return '🎯';
      default:
        return '🎯';
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Achievement Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Total Achieved</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
            <span className="text-2xl">🏆</span>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">This Month</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.thisMonth}</p>
            </div>
            <span className="text-2xl">📅</span>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">This Year</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.thisYear}</p>
            </div>
            <span className="text-2xl">🎊</span>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Savings Goals</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.byType.savings || 0}
              </p>
            </div>
            <span className="text-2xl">💰</span>
          </div>
        </div>
      </div>

      {/* Achievement Timeline */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Achievement Timeline
        </h3>

        {achievements.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircleIcon size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              No achievements yet. Keep working towards your goals!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {achievements
              .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())
              .map((achievement, index) => (
                <div
                  key={`${achievement.goalId}-${index}`}
                  className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl"
                >
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-800/50 rounded-full flex items-center justify-center">
                      <span className="text-xl">{getGoalIcon(achievement.type)}</span>
                    </div>
                  </div>
                  <div className="flex-grow">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {achievement.goalName}
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <span className="flex items-center gap-1">
                        <CalendarIcon size={14} />
                        {formatDate(achievement.achievedAt)}
                      </span>
                      <span className="capitalize">
                        {achievement.type.replace('-', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(achievement.targetAmount)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}