/**
 * @component StatsSection
 * @description Display merchant enrichment statistics with visual indicators
 */

import { memo, useEffect } from 'react';
import { 
  BarChart3Icon, 
  TrendingUpIcon, 
  CheckCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '../icons';
import type { StatsSectionProps } from './types';
import { useLogger } from '../services/ServiceProvider';

export const StatsSection = memo(function StatsSection({ stats,
  onToggle,
  isExpanded = true
 }: StatsSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('StatsSection component initialized', {
      componentName: 'StatsSection'
    });
  }, []);

  
  const enrichmentRate = stats.totalMerchants > 0 
    ? ((stats.enrichedCount / stats.totalMerchants) * 100).toFixed(1)
    : '0';

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggle}
        role="button"
        aria-expanded={isExpanded}
        aria-label="Toggle statistics"
      >
        <div className="flex items-center gap-2">
          <BarChart3Icon size={20} className="text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Enrichment Statistics
          </h3>
        </div>
        {onToggle && (
          isExpanded ? (
            <ChevronUpIcon size={16} className="text-gray-500" />
          ) : (
            <ChevronDownIcon size={16} className="text-gray-500" />
          )
        )}
      </div>
      
      {isExpanded && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <CheckCircleIcon size={14} className="text-green-600" />
              <span className="text-xs text-gray-500">Enriched</span>
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {stats.enrichedCount}
            </div>
            <div className="text-xs text-gray-500">
              {enrichmentRate}% complete
            </div>
          </div>
          
          <div>
            <div className="flex items-center gap-1 mb-1">
              <ClockIcon size={14} className="text-yellow-600" />
              <span className="text-xs text-gray-500">Pending</span>
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {stats.pendingCount}
            </div>
          </div>
          
          <div>
            <div className="flex items-center gap-1 mb-1">
              <TrendingUpIcon size={14} className="text-blue-600" />
              <span className="text-xs text-gray-500">Avg Confidence</span>
            </div>
            <div className={`text-lg font-semibold ${getConfidenceColor(stats.averageConfidence)}`}>
              {stats.averageConfidence.toFixed(0)}%
            </div>
          </div>
          
          <div>
            <div className="flex items-center gap-1 mb-1">
              <BarChart3Icon size={14} className="text-purple-600" />
              <span className="text-xs text-gray-500">Categories</span>
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {stats.categoriesUsed}
            </div>
          </div>
          
          <div>
            <div className="flex items-center gap-1 mb-1">
              <BarChart3Icon size={14} className="text-gray-600" />
              <span className="text-xs text-gray-500">Total</span>
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {stats.totalMerchants}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});