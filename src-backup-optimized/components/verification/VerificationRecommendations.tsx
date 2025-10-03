/**
 * Verification Recommendations Component
 * World-class recommendations with actionable insights
 */

import React, { useEffect, memo } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface VerificationRecommendationsProps {
  recommendations: string[];
  hasIssues: boolean;
}

/**
 * Premium recommendations panel with institutional guidance
 */
export const VerificationRecommendations = memo(function VerificationRecommendations({ recommendations,
  hasIssues
 }: VerificationRecommendationsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('VerificationRecommendations component initialized', {
      componentName: 'VerificationRecommendations'
    });
  }, []);

  if (!hasIssues || recommendations.length === 0) {
    return <div />;
  }

  return (
    <div className="mt-6 p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
      <RecommendationsHeader />
      <RecommendationsList recommendations={recommendations} />
    </div>
  );
});

/**
 * Recommendations header
 */
const RecommendationsHeader = memo(function RecommendationsHeader(): React.JSX.Element {
  return (
    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
      Recommendations
    </h4>
  );
});

/**
 * Recommendations list
 */
const RecommendationsList = memo(function RecommendationsList({
  recommendations
}: {
  recommendations: string[];
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
      {recommendations.map((recommendation, index) => (
        <RecommendationItem key={index} text={recommendation} />
      ))}
    </ul>
  );
});

/**
 * Individual recommendation item
 */
const RecommendationItem = memo(function RecommendationItem({
  text
}: {
  text: string;
}): React.JSX.Element {
  const logger = useLogger();
  return <li>• {text}</li>;
});