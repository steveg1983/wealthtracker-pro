import React, { useEffect, memo } from 'react';
import { TargetIcon, PlusIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface EmptyGoalsStateProps {
  type: 'no-goals' | 'all-completed';
  onCreateGoal: () => void;
  goalTypeExamples: Array<{
    icon: string;
    title: string;
    description: string;
    bgColor: string;
  }>;
}

const EmptyGoalsState = memo(function EmptyGoalsState({
  type,
  onCreateGoal,
  goalTypeExamples
}: EmptyGoalsStateProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('EmptyGoalsState component initialized', {
      componentName: 'EmptyGoalsState'
    });
  }, []);

  const isNoGoals = type === 'no-goals';

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-12" data-testid="empty-state">
      <div className="text-center">
        {isNoGoals ? (
          <>
            <TargetIcon className="h-24 w-24 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No goals yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Set financial goals to track your progress towards savings targets, debt payoff, or investment milestones.
            </p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              All goals completed!
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Congratulations on achieving your goals! Ready to set new financial targets?
            </p>
          </>
        )}
        
        <button
          onClick={onCreateGoal}
          className="inline-flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <PlusIcon size={20} />
          <span>{isNoGoals ? 'Create Your First Goal' : 'Set a New Goal'}</span>
        </button>
        
        {isNoGoals && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {goalTypeExamples.map((example, index) => (
              <div key={index} className={`p-4 ${example.bgColor} rounded-lg`}>
                <div className="text-2xl mb-2">{example.icon}</div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">{example.title}</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {example.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default EmptyGoalsState;
