import React, { useState, useEffect } from 'react';
import { dataIntelligenceService } from '../../services/dataIntelligenceService';
import type { DataIntelligenceStats, SpendingInsight } from '../../services/dataIntelligenceService';
import { 
  DatabaseIcon,
  BellIcon,
  CreditCardIcon,
  TrendingUpIcon,
  SearchIcon,
  RefreshCwIcon,
  ArrowRightIcon
} from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { toDecimal, Decimal } from '../../utils/decimal';

interface DataIntelligenceWidgetProps {
  size?: 'small' | 'medium' | 'large';
  settings?: {
    showInsights?: boolean;
    showSubscriptions?: boolean;
    maxInsights?: number;
  };
}

export default function DataIntelligenceWidget({ 
  size = 'medium', 
  settings = {} 
}: DataIntelligenceWidgetProps) {
  const [stats, setStats] = useState<DataIntelligenceStats | null>(null);
  const [insights, setInsights] = useState<SpendingInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { formatCurrency } = useCurrencyDecimal();

  const {
    showInsights = true,
    showSubscriptions = true,
    maxInsights = 3
  } = settings;

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const statsData = dataIntelligenceService.getStats();
      const insightsData = dataIntelligenceService.getInsights();
      
      setStats(statsData);
      setInsights(insightsData.slice(0, maxInsights));
    } catch (error) {
      console.error('Error loading data intelligence data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [maxInsights]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatAmount = React.useCallback((amount: number) => {
    return formatCurrency(toDecimal(amount));
  }, [formatCurrency]);

  const formatPercentage = React.useCallback((value: number, decimals: number = 1) => {
    return toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toString();
  }, []);

  const getInsightIcon = (type: SpendingInsight['type']) => {
    switch (type) {
      case 'subscription_alert':
        return <CreditCardIcon size={14} className="text-blue-600 dark:text-blue-400" />;
      case 'spending_spike':
        return <TrendingUpIcon size={14} className="text-red-600 dark:text-red-400" />;
      case 'new_merchant':
        return <SearchIcon size={14} className="text-green-600 dark:text-green-400" />;
      default:
        return <BellIcon size={14} className="text-gray-600 dark:text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: SpendingInsight['severity']) => {
    switch (severity) {
      case 'high':
        return 'text-red-600 dark:text-red-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'low':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCwIcon size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <DatabaseIcon size={32} className="mx-auto mb-2 opacity-50" />
          <div className="text-sm">No data available</div>
        </div>
      </div>
    );
  }

  if (size === 'small') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <DatabaseIcon size={16} className="text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-gray-900 dark:text-white text-sm">Data Intelligence</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3 flex-1">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {stats.totalMerchants}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Merchants</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {stats.activeSubscriptions}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Subscriptions</div>
          </div>
        </div>

        {insights.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1">
              <BellIcon size={12} className="text-orange-600 dark:text-orange-400" />
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                {insights.length} insight{insights.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (size === 'large') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DatabaseIcon size={20} className="text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-gray-900 dark:text-white">Data Intelligence</span>
          </div>
          <button
            onClick={loadData}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <RefreshCwIcon size={14} />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {stats.totalMerchants}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Merchants</div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {stats.activeSubscriptions}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Active Subs</div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {stats.patternsDetected}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Patterns</div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {insights.length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Insights</div>
          </div>
        </div>

        {showSubscriptions && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Monthly Subscriptions</span>
             <span className="text-sm font-bold text-green-600 dark:text-green-400">
                {formatAmount(stats.monthlySubscriptionCost)}
              </span>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {formatPercentage(stats.categoryAccuracy)}% categorization accuracy
            </div>
          </div>
        )}

        {showInsights && insights.length > 0 && (
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <BellIcon size={14} className="text-orange-600 dark:text-orange-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">Recent Insights</span>
            </div>
            <div className="space-y-2">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {getInsightIcon(insight.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {insight.title}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {insight.description}
                      </div>
                      <div className={`text-xs font-medium ${getSeverityColor(insight.severity)}`}>
                        {insight.severity}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-gray-200 dark:border-gray-700">
          <button className="w-full flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
            <span>View Data Intelligence</span>
            <ArrowRightIcon size={12} />
          </button>
        </div>
      </div>
    );
  }

  // Medium size (default)
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DatabaseIcon size={18} className="text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-gray-900 dark:text-white">Data Intelligence</span>
        </div>
        <button
          onClick={loadData}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <RefreshCwIcon size={12} />
        </button>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {stats.totalMerchants}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Merchants</div>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <div className="text-xl font-bold text-green-600 dark:text-green-400">
            {stats.activeSubscriptions}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Active Subs</div>
        </div>
      </div>

      {showSubscriptions && (
        <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            Monthly Cost: {formatAmount(stats.monthlySubscriptionCost)}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {formatPercentage(stats.categoryAccuracy)}% accuracy
          </div>
        </div>
      )}

      {showInsights && insights.length > 0 && (
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <BellIcon size={12} className="text-orange-600 dark:text-orange-400" />
            <span className="text-xs font-medium text-gray-900 dark:text-white">
              {insights.length} Insight{insights.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1">
            {insights.slice(0, 2).map((insight) => (
              <div
                key={insight.id}
                className="p-2 bg-gray-50 dark:bg-gray-800 rounded"
              >
                <div className="flex items-center gap-2">
                  {getInsightIcon(insight.type)}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {insight.title}
                    </div>
                    <div className={`text-xs ${getSeverityColor(insight.severity)}`}>
                      {insight.severity}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pt-2 border-t border-gray-200 dark:border-gray-700">
        <button className="w-full flex items-center justify-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
          <span>View Details</span>
          <ArrowRightIcon size={10} />
        </button>
      </div>
    </div>
  );
}
