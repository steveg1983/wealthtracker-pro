import React, { useEffect, memo } from 'react';
import { 
  DatabaseIcon,
  SearchIcon,
  CreditCardIcon,
  TrendingUpIcon,
  BellIcon,
  CheckCircleIcon,
  ClockIcon
} from '../icons';
import KeyStatistics from './overview/KeyStatistics';
import RecentInsights from './overview/RecentInsights';
import SubscriptionOverview from './overview/SubscriptionOverview';
import AnalysisSummary from './overview/AnalysisSummary';
import type { SpendingInsight, Subscription } from '../../services/dataIntelligenceService';
type DataIntelligenceStats = {
  totalMerchants: number;
  enrichedMerchants: number;
  categoryAccuracy: number;
  activeSubscriptions: number;
  monthlySubscriptionCost: number;
  patternsDetected: number;
  lastAnalysisRun: Date;
  cancelledSubscriptions: number;
};
import { dataIntelligencePageService } from '../../services/dataIntelligencePageService';
import { useLogger } from '../services/ServiceProvider';

interface OverviewTabProps {
  hasTransactionData: boolean;
  stats: DataIntelligenceStats | null;
  insights: SpendingInsight[];
  subscriptions: Subscription[];
  detectedSubscriptions: Subscription[];
  onTabChange: (tab: string) => void;
}

const OverviewTab = memo(function OverviewTab({ hasTransactionData,
  stats,
  insights,
  subscriptions,
  detectedSubscriptions,
  onTabChange
 }: OverviewTabProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('OverviewTab component initialized', {
      componentName: 'OverviewTab'
    });
  }, []);

  // Empty state when no transactions
  if (!hasTransactionData) {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-8 text-center">
          <DatabaseIcon size={48} className="mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">
            No Transaction Data Available
          </h3>
          <p className="text-amber-700 dark:text-amber-300 mb-4">
            Add some transactions to start analyzing your spending patterns, detecting subscriptions, and gaining insights.
          </p>
          <button
            onClick={() => window.location.href = '/transactions'}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            Go to Transactions
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400">Loading data intelligence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <KeyStatistics 
        stats={stats} 
        detectedSubscriptions={detectedSubscriptions}
        insights={insights}
      />
      
      <RecentInsights 
        insights={insights}
        onViewAll={() => onTabChange('insights')}
      />
      
      {/* Detected Subscriptions Alert */}
      {detectedSubscriptions.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircleIcon size={20} className="text-green-600 dark:text-green-400" />
            <div className="flex-1">
              <p className="font-medium text-green-900 dark:text-green-100">
                {detectedSubscriptions.length} New Subscription{detectedSubscriptions.length > 1 ? 's' : ''} Detected!
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                We found recurring payments in your transactions. Review them in the Subscriptions tab.
              </p>
            </div>
            <button
              onClick={() => onTabChange('subscriptions')}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
            >
              Review
            </button>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SubscriptionOverview
          subscriptions={subscriptions}
          detectedSubscriptions={detectedSubscriptions}
          formatCurrency={dataIntelligencePageService.formatCurrency}
          formatDate={dataIntelligencePageService.formatDate}
          onManage={() => onTabChange('subscriptions')}
        />
        
        <AnalysisSummary
          stats={stats}
          formatDate={dataIntelligencePageService.formatDate}
        />
      </div>
    </div>
  );
});

export default OverviewTab;
