import React, { useEffect } from 'react';
import { TrendingUpIcon, PlusIcon } from '../../icons';
import type { CreditScoreEntry } from '../../DebtManagement';
import { logger } from '../../../services/loggingService';

interface CreditScoreHistoryProps {
  creditScores: CreditScoreEntry[];
  onAddScore: () => void;
}

export function CreditScoreHistory({ creditScores, onAddScore }: CreditScoreHistoryProps): React.JSX.Element {
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <h4 className="font-medium text-gray-900 dark:text-white mb-4">Score History</h4>
      
      {creditScores.length === 0 ? (
        <div className="text-center py-12">
          <TrendingUpIcon className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No credit scores recorded
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Start tracking your credit score to monitor your financial health
          </p>
          <button
            onClick={onAddScore}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            <PlusIcon size={16} />
            Add Your First Score
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {creditScores.map((score, index) => (
            <div key={score.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {score.score}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {score.provider.toUpperCase()} • {score.date.toLocaleDateString()}
                </p>
                {score.notes && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {score.notes}
                  </p>
                )}
              </div>
              <div className="text-right">
                {index < creditScores.length - 1 && (
                  <p className={`text-sm font-medium ${
                    score.score > creditScores[index + 1].score
                      ? 'text-green-600 dark:text-green-400'
                      : score.score < creditScores[index + 1].score
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {score.score > creditScores[index + 1].score ? '+' : ''}
                    {score.score - creditScores[index + 1].score}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}