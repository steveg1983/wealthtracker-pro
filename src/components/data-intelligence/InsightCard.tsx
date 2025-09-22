import React, { useEffect, memo } from 'react';
import { 
  CreditCardIcon,
  TrendingUpIcon,
  SearchIcon,
  BarChart3Icon,
  AlertCircleIcon,
  BellIcon
} from '../icons';
import type { SpendingInsight } from '../../services/dataIntelligenceService';
import { dataIntelligencePageService } from '../../services/dataIntelligencePageService';
import { useLogger } from '../services/ServiceProvider';

interface InsightCardProps {
  insight: SpendingInsight;
}

const InsightCard = memo(function InsightCard({ insight  }: InsightCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('InsightCard component initialized', {
      componentName: 'InsightCard'
    });
  }, []);

  const getInsightIcon = (type: SpendingInsight['type']) => {
    switch (type) {
      case 'subscription_alert':
        return <CreditCardIcon size={16} className="text-gray-600 dark:text-gray-500" />;
      case 'spending_spike':
        return <TrendingUpIcon size={16} className="text-red-600 dark:text-red-400" />;
      case 'new_merchant':
        return <SearchIcon size={16} className="text-green-600 dark:text-green-400" />;
      case 'category_trend':
        return <BarChart3Icon size={16} className="text-purple-600 dark:text-purple-400" />;
      case 'duplicate_transaction':
        return <AlertCircleIcon size={16} className="text-orange-600 dark:text-orange-400" />;
      default:
        return <BellIcon size={16} className="text-gray-600 dark:text-gray-400" />;
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="flex-shrink-0 mt-1">
        {getInsightIcon(insight.type)}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium text-gray-900 dark:text-white">
            {insight.title}
          </h4>
          <span className={`px-2 py-1 text-xs rounded-full ${
            dataIntelligencePageService.getInsightSeverityColor(insight.severity)
          }`}>
            {insight.severity}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {insight.description}
        </p>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {dataIntelligencePageService.formatDate(insight.createdAt)}
      </div>
    </div>
  );
});

export default InsightCard;