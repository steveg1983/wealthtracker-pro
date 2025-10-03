import React, { useEffect, memo } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface GoalCelebrationsSectionProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

const GoalCelebrationsSection = memo(function GoalCelebrationsSection({ enabled,
  onEnabledChange
 }: GoalCelebrationsSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('GoalCelebrationsSection component initialized', {
      componentName: 'GoalCelebrationsSection'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Goal Celebrations</h3>
      
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">Enable Celebrations</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Show confetti and celebration messages when you achieve your goals
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
        </label>
      </div>
    </div>
  );
});

export default GoalCelebrationsSection;