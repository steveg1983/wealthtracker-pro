import { memo, useEffect } from 'react';
import { 
  CreditCardIcon,
  TrendingUpIcon,
  SearchIcon,
  BarChart3Icon,
  AlertCircleIcon,
  BellIcon,
  XIcon,
  CheckIcon
} from '../icons';
import { DataInsightsService } from '../../services/dataInsightsService';
import type { SpendingInsight } from '../../services/dataIntelligenceService';

type InsightView = SpendingInsight & { dismissed?: boolean; actionable?: boolean };
import { useLogger } from '../services/ServiceProvider';

interface InsightCardProps {
  insight: InsightView;
  onDismiss: (id: string) => void;
  onAccept?: (id: string) => void;
}

export const InsightCard = memo(function InsightCard({ insight,
  onDismiss,
  onAccept
 }: InsightCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('InsightCard component initialized', {
      componentName: 'InsightCard'
    });
  }, []);

  const iconConfig = DataInsightsService.getInsightIconConfig(insight.type);
  const severityStyles = DataInsightsService.getSeverityStyles(insight.severity);
  const relativeTime = DataInsightsService.getRelativeTime(insight.createdAt);

  const getIcon = () => {
    switch (iconConfig.icon) {
      case 'CreditCard': return <CreditCardIcon size={20} className={iconConfig.color} />;
      case 'TrendingUp': return <TrendingUpIcon size={20} className={iconConfig.color} />;
      case 'Search': return <SearchIcon size={20} className={iconConfig.color} />;
      case 'BarChart3': return <BarChart3Icon size={20} className={iconConfig.color} />;
      case 'AlertCircle': return <AlertCircleIcon size={20} className={iconConfig.color} />;
      default: return <BellIcon size={20} className={iconConfig.color} />;
    }
  };

  return (
    <div className={`p-4 border-l-4 rounded-lg ${severityStyles.border} ${
      insight.dismissed ? 'opacity-60' : ''
    } bg-white dark:bg-gray-800 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-gray-900 dark:text-white">
                {insight.title}
              </h4>
              <span className={`text-xs px-2 py-0.5 rounded-full ${severityStyles.badge}`}>
                {insight.severity}
              </span>
              {insight.category && (
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                  {insight.category}
                </span>
              )}
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {insight.description}
            </p>
            
            {insight.amount && (
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Amount: ${insight.amount.toFixed(2)}
              </div>
            )}
            
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {relativeTime}
            </div>
          </div>
        </div>
        
        {!insight.dismissed && (
          <div className="flex items-center gap-2 ml-4">
            {insight.actionable && onAccept && (
              <button
                onClick={() => onAccept(insight.id)}
                className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                title="Accept suggestion"
              >
                <CheckIcon size={18} />
              </button>
            )}
            <button
              onClick={() => onDismiss(insight.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Dismiss"
            >
              <XIcon size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
