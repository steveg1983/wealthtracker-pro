import React, { useEffect, memo } from 'react';
import { InfoIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface InsightsBarProps {
  insights: string[];
}

const InsightsBar = memo(function InsightsBar({ insights  }: InsightsBarProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('InsightsBar component initialized', {
      componentName: 'InsightsBar'
    });
  }, []);
  if (insights.length === 0) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-6 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
      <div className="flex items-start gap-3">
        <InfoIcon size={20} className="text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="space-y-2">
          {insights.map((insight, index) => (
            <p key={index} className="text-sm text-gray-600 dark:text-gray-400">
              {insight}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
});

export default InsightsBar;
