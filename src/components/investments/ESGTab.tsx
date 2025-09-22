import React, { useEffect, memo } from 'react';
import { LeafIcon } from '../icons';
import type { ESGScore } from '../../services/investmentEnhancementService';
import { useLogger } from '../services/ServiceProvider';

interface ESGTabProps {
  esgScores: ESGScore[];
  getESGRatingClass: (rating: string) => string;
}

const ESGTab = memo(function ESGTab({ esgScores,
  getESGRatingClass
 }: ESGTabProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ESGTab component initialized', {
      componentName: 'ESGTab'
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4">
        <h3 className="font-semibold text-teal-900 dark:text-teal-100 mb-2">ESG Scoring</h3>
        <p className="text-sm text-teal-700 dark:text-teal-200">
          Environmental, Social, and Governance ratings for your investments.
        </p>
      </div>

      {esgScores.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <LeafIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p>No ESG data available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {esgScores.map((score, index) => (
            <ESGScoreCard key={index} score={score} getESGRatingClass={getESGRatingClass} />
          ))}
        </div>
      )}
    </div>
  );
});

const ESGScoreCard = memo(function ESGScoreCard({
  score,
  getESGRatingClass
}: {
  score: ESGScore;
  getESGRatingClass: (rating: string) => string;
}): React.JSX.Element {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">{score.name}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">{score.symbol}</p>
        </div>
        <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${getESGRatingClass(score.rating)}`}>
          {score.rating}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <ScoreBar label="Environmental" value={score.environmental} color="bg-green-500" />
        <ScoreBar label="Social" value={score.social} color="bg-gray-500" />
        <ScoreBar label="Governance" value={score.governance} color="bg-purple-500" />
      </div>
      
      {score.controversies.length > 0 && (
        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded">
          <p className="text-xs text-red-700 dark:text-red-300">
            � {score.controversies.join(', ')}
          </p>
        </div>
      )}
    </div>
  );
});

const ScoreBar = memo(function ScoreBar({
  label,
  value,
  color
}: {
  label: string;
  value: number;
  color: string;
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className={`${color} h-2 rounded-full`} 
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {value}
        </span>
      </div>
    </div>
  );
});

export default ESGTab;