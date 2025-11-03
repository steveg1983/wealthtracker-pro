import React, { useState, useEffect, useMemo } from 'react';
import { dataIntelligenceService } from '../services/dataIntelligenceService';
import { 
  DatabaseIcon,
  TrendingUpIcon,
  BellIcon,
  CreditCardIcon,
  TagIcon,
  BarChart3Icon,
  SearchIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  DollarSignIcon,
  EyeIcon,
  ShieldIcon
} from '../components/icons';
import PageWrapper from '../components/PageWrapper';
import SubscriptionManager from '../components/SubscriptionManager';
import MerchantEnrichment from '../components/MerchantEnrichment';
import SpendingPatterns from '../components/SpendingPatterns';
import DataInsights from '../components/DataInsights';
import type { DataIntelligenceStats, SpendingInsight, Subscription } from '../services/dataIntelligenceService';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { formatCurrencyWhole } from '../utils/currency-decimal';
import { toDecimal, Decimal } from '../utils/decimal';
import type { DecimalInstance } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';

type ActiveTab = 'overview' | 'subscriptions' | 'merchants' | 'patterns' | 'insights';

export default function DataIntelligence() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [stats, setStats] = useState<DataIntelligenceStats | null>(null);
  const [insights, setInsights] = useState<SpendingInsight[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { displayCurrency } = useCurrencyDecimal();

  const formatPercentage = useMemo(() => {
    return (value: DecimalInstance | number, decimals: number = 1) => {
      return formatDecimal(value, decimals);
    };
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      setStats(dataIntelligenceService.getStats());
      setInsights(dataIntelligenceService.getInsights());
      setSubscriptions(dataIntelligenceService.getSubscriptions());
    } catch (error) {
      console.error('Error loading data intelligence data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataChange = () => {
    loadData();
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      // Simulate analysis process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, this would analyze transactions
      // For now, we'll just refresh the data
      loadData();
    } catch (error) {
      console.error('Error running analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = useMemo(() => {
    return (amount: number) => {
      const rounded = toDecimal(amount).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      return formatCurrencyWhole(rounded, displayCurrency);
    };
  }, [displayCurrency]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getInsightSeverityColor = (severity: SpendingInsight['severity']) => {
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

  const getInsightIcon = (type: SpendingInsight['type']) => {
    switch (type) {
      case 'subscription_alert':
        return <CreditCardIcon size={16} className="text-blue-600 dark:text-blue-400" />;
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

  if (isLoading) {
    return (
      <PageWrapper title="Data Intelligence">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-gray-500 dark:text-gray-400">Loading data intelligence...</div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Data Intelligence">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 dark:from-green-800 dark:to-blue-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Data Intelligence</h1>
              <p className="text-green-100">
                Smart insights, subscription management, and spending pattern analysis
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCwIcon size={16} className={isAnalyzing ? 'animate-spin' : ''} />
                {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
              </button>
              <DatabaseIcon size={48} className="text-white/80" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BarChart3Icon size={16} />
                  Overview
                </div>
              </button>
              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'subscriptions'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CreditCardIcon size={16} />
                  Subscriptions
                </div>
              </button>
              <button
                onClick={() => setActiveTab('merchants')}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'merchants'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <SearchIcon size={16} />
                  Merchants
                </div>
              </button>
              <button
                onClick={() => setActiveTab('patterns')}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'patterns'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <TrendingUpIcon size={16} />
                  Patterns
                </div>
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'insights'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BellIcon size={16} />
                  Insights
                  {insights.length > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {insights.length}
                    </span>
                  )}
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Key Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Merchants</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {stats.totalMerchants}
                    </p>
                  </div>
                  <SearchIcon size={24} className="text-blue-500" />
                </div>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {stats.enrichedMerchants} enriched ({`${formatPercentage(stats.categoryAccuracy, 1)}%`})
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Active Subscriptions</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {stats.activeSubscriptions}
                    </p>
                  </div>
                  <CreditCardIcon size={24} className="text-green-500" />
                </div>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {formatCurrency(stats.monthlySubscriptionCost)}/month
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Patterns Detected</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {stats.patternsDetected}
                    </p>
                  </div>
                  <TrendingUpIcon size={24} className="text-purple-500" />
                </div>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Spending patterns
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Active Insights</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {insights.length}
                    </p>
                  </div>
                  <BellIcon size={24} className="text-orange-500" />
                </div>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Actionable insights
                </div>
              </div>
            </div>

            {/* Recent Insights */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <BellIcon size={20} className="text-orange-600 dark:text-orange-400" />
                  Recent Insights
                </h3>
                <button
                  onClick={() => setActiveTab('insights')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View All
                </button>
              </div>
              
              {insights.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircleIcon size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400">No active insights</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {insights.slice(0, 3).map((insight) => (
                    <div
                      key={insight.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getInsightIcon(insight.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {insight.title}
                          </h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${getInsightSeverityColor(insight.severity)}`}>
                            {insight.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {insight.description}
                        </p>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(insight.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subscription Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <CreditCardIcon size={20} className="text-green-600 dark:text-green-400" />
                    Upcoming Renewals
                  </h3>
                  <button
                    onClick={() => setActiveTab('subscriptions')}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Manage
                  </button>
                </div>
                
                <div className="space-y-3">
                  {subscriptions.slice(0, 3).map((subscription) => {
                    const daysUntilRenewal = Math.ceil(
                      (subscription.nextPaymentDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    
                    return (
                      <div
                        key={subscription.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            daysUntilRenewal <= 3 ? 'bg-red-500' : 
                            daysUntilRenewal <= 7 ? 'bg-yellow-500' : 'bg-green-500'
                          }`} />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {subscription.merchantName}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {formatCurrency(subscription.amount)} {subscription.frequency}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {daysUntilRenewal} days
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(subscription.nextPaymentDate)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <TrendingUpIcon size={20} className="text-purple-600 dark:text-purple-400" />
                    Analysis Summary
                  </h3>
                  <ClockIcon size={16} className="text-gray-400" />
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Last Analysis:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(stats.lastAnalysisRun)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Data Quality:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 transition-all duration-300"
                          style={{ width: `${stats.categoryAccuracy}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {`${formatPercentage(stats.categoryAccuracy, 0)}%`}
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                          {stats.activeSubscriptions}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">
                          {stats.cancelledSubscriptions}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Cancelled</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <SubscriptionManager onDataChange={handleDataChange} />
        )}

        {activeTab === 'merchants' && (
          <MerchantEnrichment onDataChange={handleDataChange} />
        )}

        {activeTab === 'patterns' && (
          <SpendingPatterns onDataChange={handleDataChange} />
        )}

        {activeTab === 'insights' && (
          <DataInsights onDataChange={handleDataChange} />
        )}
      </div>
    </PageWrapper>
  );
}
