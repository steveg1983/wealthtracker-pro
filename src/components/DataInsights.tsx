import React, { useState, useEffect } from 'react';
import { dataIntelligenceService } from '../services/dataIntelligenceService';
import type { SpendingInsight } from '../services/dataIntelligenceService';
import { 
import { logger } from '../services/loggingService';
  BellIcon,
  AlertCircleIcon,
  TrendingUpIcon,
  SearchIcon,
  BarChart3Icon,
  CreditCardIcon,
  XIcon,
  CheckIcon,
  RefreshCwIcon,
  FilterIcon,
  SortIcon,
  EyeIcon,
  EyeOffIcon
} from './icons';

interface DataInsightsProps {
  onDataChange?: () => void;
}

export default function DataInsights({ onDataChange }: DataInsightsProps) {
  const [insights, setInsights] = useState<SpendingInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'severity' | 'category'>('createdAt');
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = () => {
    setIsLoading(true);
    try {
      const loadedInsights = dataIntelligenceService.getInsights();
      setInsights(loadedInsights);
    } catch (error) {
      logger.error('Error loading insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismissInsight = (insightId: string) => {
    dataIntelligenceService.dismissInsight(insightId);
    loadInsights();
    onDataChange?.();
  };

  const getInsightIcon = (type: SpendingInsight['type']) => {
    switch (type) {
      case 'subscription_alert':
        return <CreditCardIcon size={20} className="text-blue-600 dark:text-blue-400" />;
      case 'spending_spike':
        return <TrendingUpIcon size={20} className="text-red-600 dark:text-red-400" />;
      case 'new_merchant':
        return <SearchIcon size={20} className="text-green-600 dark:text-green-400" />;
      case 'category_trend':
        return <BarChart3Icon size={20} className="text-purple-600 dark:text-purple-400" />;
      case 'duplicate_transaction':
        return <AlertCircleIcon size={20} className="text-orange-600 dark:text-orange-400" />;
      default:
        return <BellIcon size={20} className="text-gray-600 dark:text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: SpendingInsight['severity']) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getSeverityBorderColor = (severity: SpendingInsight['severity']) => {
    switch (severity) {
      case 'high':
        return 'border-l-red-500';
      case 'medium':
        return 'border-l-yellow-500';
      case 'low':
        return 'border-l-blue-500';
      default:
        return 'border-l-gray-500';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const insightTypes = ['all', 'subscription_alert', 'spending_spike', 'new_merchant', 'category_trend', 'duplicate_transaction'];
  
  const filteredInsights = insights
    .filter(insight => {
      if (!showDismissed && insight.dismissed) return false;
      
      const matchesSeverity = filter === 'all' || insight.severity === filter;
      const matchesType = typeFilter === 'all' || insight.type === typeFilter;
      
      return matchesSeverity && matchesType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'createdAt':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'severity': {
          const severityOrder = { high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        }
        case 'category':
          return (a.category || '').localeCompare(b.category || '');
        default:
          return 0;
      }
    });

  const insightStats = {
    total: insights.filter(i => !i.dismissed).length,
    high: insights.filter(i => i.severity === 'high' && !i.dismissed).length,
    medium: insights.filter(i => i.severity === 'medium' && !i.dismissed).length,
    low: insights.filter(i => i.severity === 'low' && !i.dismissed).length,
    actionable: insights.filter(i => i.actionable && !i.dismissed).length
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCwIcon size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BellIcon size={20} className="text-orange-600 dark:text-orange-400" />
            Data Insights
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            AI-powered insights and alerts about your spending patterns
          </p>
        </div>
        <button
          onClick={loadInsights}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <RefreshCwIcon size={16} />
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {insightStats.total}
              </p>
            </div>
            <BellIcon size={24} className="text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">High Priority</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {insightStats.high}
              </p>
            </div>
            <AlertCircleIcon size={24} className="text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Medium</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {insightStats.medium}
              </p>
            </div>
            <AlertCircleIcon size={24} className="text-yellow-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Low Priority</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {insightStats.low}
              </p>
            </div>
            <AlertCircleIcon size={24} className="text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Actionable</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {insightStats.actionable}
              </p>
            </div>
            <CheckIcon size={24} className="text-green-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <FilterIcon size={16} className="text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="all">All Severities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            {insightTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <SortIcon size={16} className="text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="createdAt">Date Created</option>
            <option value="severity">Severity</option>
            <option value="category">Category</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              showDismissed 
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {showDismissed ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
            {showDismissed ? 'Hide Dismissed' : 'Show Dismissed'}
          </button>
        </div>
      </div>

      {/* Insights List */}
      <div className="space-y-4">
        {filteredInsights.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
            <BellIcon size={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No insights found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {filter === 'all' && typeFilter === 'all' 
                ? "You're all caught up! No active insights at the moment."
                : "No insights match your current filters."}
            </p>
          </div>
        ) : (
          filteredInsights.map((insight) => (
            <div
              key={insight.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 ${getSeverityBorderColor(insight.severity)} ${
                insight.dismissed ? 'opacity-60' : ''
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {getInsightIcon(insight.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {insight.title}
                        </h4>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(insight.severity)}`}>
                          {insight.severity}
                        </span>
                        {insight.actionable && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                            Actionable
                          </span>
                        )}
                        {insight.dismissed && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                            Dismissed
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-600 dark:text-gray-400 mb-3">
                        {insight.description}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>{formatDate(insight.createdAt)}</span>
                        {insight.category && (
                          <>
                            <span>•</span>
                            <span className="font-medium">{insight.category}</span>
                          </>
                        )}
                        {insight.merchant && (
                          <>
                            <span>•</span>
                            <span>{insight.merchant}</span>
                          </>
                        )}
                        {insight.amount && (
                          <>
                            <span>•</span>
                            <span className="font-medium">{formatCurrency(insight.amount)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {!insight.dismissed && (
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleDismissInsight(insight.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Dismiss insight"
                      >
                        <XIcon size={16} />
                      </button>
                    </div>
                  )}
                </div>
                
                {insight.actionable && !insight.dismissed && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <CheckIcon size={16} className="text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        Recommended Action
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Review this insight and take appropriate action if needed.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {filteredInsights.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>
              Showing {filteredInsights.length} of {insights.length} insights
            </span>
            <span>
              {insightStats.actionable} actionable items require attention
            </span>
          </div>
        </div>
      )}
    </div>
  );
}