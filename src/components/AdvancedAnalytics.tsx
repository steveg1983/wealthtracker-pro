import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { advancedAnalyticsService, type SpendingAnomaly, type SpendingPrediction, type SavingsOpportunity, type FinancialInsight } from '../services/advancedAnalyticsService';
import { 
  AlertTriangleIcon, 
  TrendingUpIcon, 
  LightbulbIcon, 
  PiggyBankIcon, 
  // BarChart3Icon, // Currently unused
  AlertCircleIcon,
  CheckCircleIcon,
  InfoIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from './icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { format } from 'date-fns';

type TabType = 'anomalies' | 'predictions' | 'opportunities' | 'insights';

export default function AdvancedAnalytics() {
  const { transactions, accounts, budgets, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [activeTab, setActiveTab] = useState<TabType>('insights');
  const [anomalies, setAnomalies] = useState<SpendingAnomaly[]>([]);
  const [predictions, setPredictions] = useState<SpendingPrediction[]>([]);
  const [opportunities, setOpportunities] = useState<SavingsOpportunity[]>([]);
  const [insights, setInsights] = useState<FinancialInsight[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeData = useCallback(async () => {
    setIsAnalyzing(true);
    
    try {
      // Run all analyses
      const [
        detectedAnomalies,
        spendingPredictions,
        savingsOpportunities,
        financialInsights
      ] = await Promise.all([
        Promise.resolve(advancedAnalyticsService.detectSpendingAnomalies(transactions)),
        Promise.resolve(advancedAnalyticsService.predictFutureSpending(transactions, categories)),
        Promise.resolve(advancedAnalyticsService.identifySavingsOpportunities(transactions, accounts)),
        Promise.resolve(advancedAnalyticsService.generateInsights(transactions, accounts, budgets))
      ]);
      
      setAnomalies(detectedAnomalies);
      setPredictions(spendingPredictions);
      setOpportunities(savingsOpportunities);
      setInsights(financialInsights);
    } finally {
      setIsAnalyzing(false);
    }
  }, [transactions, accounts, budgets, categories]);

  useEffect(() => {
    analyzeData();
  }, [analyzeData]);

  const getSeverityColor = (severity: 'low' | 'medium' | 'high' | 'critical') => {
    switch (severity) {
      case 'critical':
        return 'text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/30';
      case 'high':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low':
        return 'text-gray-600 dark:text-gray-500 bg-blue-50 dark:bg-gray-900/20';
    }
  };

  const getDifficultyColor = (difficulty: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-600 dark:text-green-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'hard':
        return 'text-red-600 dark:text-red-400';
    }
  };

  const getImpactIcon = (impact: 'positive' | 'negative' | 'neutral') => {
    switch (impact) {
      case 'positive':
        return <CheckCircleIcon size={20} className="text-green-600 dark:text-green-400" />;
      case 'negative':
        return <AlertCircleIcon size={20} className="text-red-600 dark:text-red-400" />;
      case 'neutral':
        return <InfoIcon size={20} className="text-gray-600 dark:text-gray-500" />;
    }
  };

  const tabs = [
    { id: 'insights' as TabType, label: 'Insights', icon: LightbulbIcon, count: insights.length },
    { id: 'anomalies' as TabType, label: 'Anomalies', icon: AlertTriangleIcon, count: anomalies.length },
    { id: 'predictions' as TabType, label: 'Predictions', icon: TrendingUpIcon, count: predictions.length },
    { id: 'opportunities' as TabType, label: 'Opportunities', icon: PiggyBankIcon, count: opportunities.length }
  ];

  return (
    <div className="space-y-6">
      {/* Header with AI indicator */}
      <div className="bg-gradient-to-r from-purple-600 to-gray-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">AI-Powered Analytics</h2>
            <p className="text-purple-100">
              Advanced insights powered by machine learning algorithms
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isAnalyzing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
            <span className="text-sm">
              {isAnalyzing ? 'Analyzing...' : 'Up to date'}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[120px] px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-primary shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-4">
            {insights.length > 0 ? (
              insights.map(insight => (
                <div
                  key={insight.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl p-4"
                >
                  <div className="flex items-start gap-4">
                    {getImpactIcon(insight.impact)}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {insight.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {insight.description}
                      </p>
                      {insight.actionable && (
                        <button className="mt-2 text-sm text-gray-600 dark:text-gray-500 hover:underline">
                          Take action →
                        </button>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      insight.priority === 'high' 
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        : insight.priority === 'medium'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}>
                      {insight.priority} priority
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <LightbulbIcon size={48} className="mx-auto mb-3 opacity-50" />
                <p>No insights available yet. Add more transactions to get started.</p>
              </div>
            )}
          </div>
        )}

        {/* Anomalies Tab */}
        {activeTab === 'anomalies' && (
          <div className="space-y-4">
            {anomalies.length > 0 ? (
              anomalies.map(anomaly => (
                <div
                  key={anomaly.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getSeverityColor(anomaly.severity)}`}>
                          {anomaly.severity} severity
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {format(anomaly.date, 'MMM d, yyyy')}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {anomaly.description}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {anomaly.reason}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-gray-700 dark:text-gray-300">
                          Category: {anomaly.category}
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                          {anomaly.percentageAboveNormal}% above normal
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCurrency(anomaly.amount)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <AlertTriangleIcon size={48} className="mx-auto mb-3 opacity-50" />
                <p>No spending anomalies detected. Your spending patterns look normal!</p>
              </div>
            )}
          </div>
        )}

        {/* Predictions Tab */}
        {activeTab === 'predictions' && (
          <div className="space-y-4">
            {predictions.length > 0 ? (
              <>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-4 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>Next Month Forecast:</strong> Based on your spending patterns, 
                    we predict your expenses for each category next month.
                  </p>
                </div>
                {predictions.map(prediction => (
                  <div
                    key={prediction.category}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {prediction.category}
                      </h3>
                      <div className="flex items-center gap-2">
                        {prediction.trend === 'increasing' ? (
                          <ArrowUpIcon size={16} className="text-red-600 dark:text-red-400" />
                        ) : prediction.trend === 'decreasing' ? (
                          <ArrowDownIcon size={16} className="text-green-600 dark:text-green-400" />
                        ) : (
                          <span className="w-4 h-0.5 bg-gray-400" />
                        )}
                        <span className={`text-sm ${
                          prediction.trend === 'increasing' 
                            ? 'text-red-600 dark:text-red-400'
                            : prediction.trend === 'decreasing'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {prediction.trend}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Predicted</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatCurrency(prediction.predictedAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Avg</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatCurrency(prediction.monthlyAverage)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-gray-600 h-2 rounded-full"
                            style={{ width: `${prediction.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {Math.round(prediction.confidence * 100)}% confidence
                        </span>
                      </div>
                    </div>
                    {prediction.recommendation && (
                      <p className="mt-3 text-sm text-gray-600 dark:text-gray-500">
                        💡 {prediction.recommendation}
                      </p>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <TrendingUpIcon size={48} className="mx-auto mb-3 opacity-50" />
                <p>Not enough data to make predictions yet. Keep tracking your expenses!</p>
              </div>
            )}
          </div>
        )}

        {/* Opportunities Tab */}
        {activeTab === 'opportunities' && (
          <div className="space-y-4">
            {opportunities.length > 0 ? (
              <>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <strong>Total Potential Savings:</strong> {formatCurrency(
                      opportunities.reduce((sum, opp) => sum.plus(opp.potentialSavings), toDecimal(0))
                    )} per year
                  </p>
                </div>
                {opportunities.map(opportunity => (
                  <div
                    key={opportunity.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {opportunity.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {opportunity.description}
                        </p>
                      </div>
                      <span className={`text-sm font-medium ${getDifficultyColor(opportunity.difficulty)}`}>
                        {opportunity.difficulty}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Potential savings</p>
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(opportunity.potentialSavings)}/year
                        </p>
                      </div>
                      <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">
                        {opportunity.actionRequired}
                      </button>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <PiggyBankIcon size={48} className="mx-auto mb-3 opacity-50" />
                <p>No savings opportunities identified yet. We'll keep analyzing your spending!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}