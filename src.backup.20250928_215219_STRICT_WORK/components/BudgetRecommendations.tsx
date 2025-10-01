import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { budgetRecommendationService, type BudgetAnalysis, type BudgetRecommendation } from '../services/budgetRecommendationService';
import { 
  LightbulbIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowRightIcon,
  CheckIcon,
  SettingsIcon,
  DownloadIcon,
  InfoIcon,
  PiggyBankIcon,
  AlertTriangleIcon
} from './icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

export default function BudgetRecommendations() {
  const { transactions, categories, budgets, updateBudget, addBudget } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [analysis, setAnalysis] = useState<BudgetAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedRecommendations, setSelectedRecommendations] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState(budgetRecommendationService.getConfig());

  useEffect(() => {
    analyzeAndRecommend();
  }, [transactions, categories, budgets]);

  const analyzeAndRecommend = () => {
    setLoading(true);
    try {
      const result = budgetRecommendationService.analyzeBudgets(
        transactions,
        categories,
        budgets
      );
      setAnalysis(result);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRecommendation = (recommendation: BudgetRecommendation) => {
    const existingBudget = budgets.find(b => b.categoryId === recommendation.categoryId);
    
    if (existingBudget) {
      updateBudget(existingBudget.id, { amount: recommendation.recommendedBudget });
    } else {
      addBudget({
        name: `${recommendation.categoryName} Budget`,
        categoryId: recommendation.categoryId,
        amount: recommendation.recommendedBudget,
        period: 'monthly',
        rollover: false,
        isActive: true
      });
    }
    
    // Re-analyze after applying
    setTimeout(analyzeAndRecommend, 100);
  };

  const handleApplySelected = () => {
    const recommendations = analysis?.recommendations.filter(r => 
      selectedRecommendations.has(r.categoryId)
    ) || [];
    
    const updates = budgetRecommendationService.applyRecommendations(recommendations);
    
    updates.forEach(({ categoryId, amount }) => {
      const existingBudget = budgets.find(b => b.categoryId === categoryId);
      const category = categories.find(c => c.id === categoryId);
      
      if (existingBudget) {
        updateBudget(existingBudget.id, { amount });
      } else if (category) {
        addBudget({
          name: `${category.name} Budget`,
          categoryId: categoryId,
          amount,
          period: 'monthly',
          rollover: false,
          isActive: true
        });
      }
    });
    
    setSelectedRecommendations(new Set());
    setTimeout(analyzeAndRecommend, 100);
  };

  const handleExport = () => {
    if (!analysis) return;
    
    const content = budgetRecommendationService.exportRecommendations(analysis);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-recommendations-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateConfig = (key: keyof typeof config, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    budgetRecommendationService.saveConfig(newConfig);
    setTimeout(analyzeAndRecommend, 100);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreEmoji = (score: number) => {
    if (score >= 80) return '🎯';
    if (score >= 60) return '📊';
    return '⚠️';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">
          No budget analysis available
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Score */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Budget Recommendations</h2>
            <p className="text-indigo-100">
              AI-powered budget optimization based on your spending patterns
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              title="Settings"
            >
              <SettingsIcon size={20} />
            </button>
            <button
              onClick={handleExport}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              title="Export Report"
            >
              <DownloadIcon size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-indigo-100">Budget Health</span>
              <span className="text-2xl">{getScoreEmoji(analysis.score)}</span>
            </div>
            <p className={`text-3xl font-bold ${getScoreColor(analysis.score)}`}>
              {analysis.score}/100
            </p>
          </div>

          <div className="bg-white/20 rounded-lg p-4">
            <p className="text-sm text-indigo-100 mb-2">Current Budget</p>
            <p className="text-2xl font-bold">{formatCurrency(analysis.totalCurrentBudget)}</p>
          </div>

          <div className="bg-white/20 rounded-lg p-4">
            <p className="text-sm text-indigo-100 mb-2">Recommended</p>
            <p className="text-2xl font-bold">{formatCurrency(analysis.totalRecommendedBudget)}</p>
          </div>

          <div className="bg-white/20 rounded-lg p-4">
            <p className="text-sm text-indigo-100 mb-2">Potential Savings</p>
            <p className="text-2xl font-bold text-green-300">
              {formatCurrency(analysis.totalPotentialSavings)}
            </p>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Recommendation Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Analysis Period
              </label>
              <select
                value={config.lookbackMonths}
                onChange={(e) => updateConfig('lookbackMonths', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value={3}>Last 3 months</option>
                <option value={6}>Last 6 months</option>
                <option value={12}>Last 12 months</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recommendation Style
              </label>
              <select
                value={config.aggressiveness}
                onChange={(e) => updateConfig('aggressiveness', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="conservative">Conservative (75th percentile)</option>
                <option value="moderate">Moderate (65th percentile)</option>
                <option value="aggressive">Aggressive (50th percentile)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minimum Confidence
              </label>
              <select
                value={config.minConfidence}
                onChange={(e) => updateConfig('minConfidence', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value={0.6}>60%</option>
                <option value={0.7}>70%</option>
                <option value={0.8}>80%</option>
                <option value={0.9}>90%</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeSeasonality}
                  onChange={(e) => updateConfig('includeSeasonality', e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span className="text-sm">Include seasonal adjustments</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Insights */}
      {analysis.insights.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Insights</h3>
          {analysis.insights.map((insight, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                insight.impact === 'positive' 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : insight.impact === 'negative'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {insight.type === 'achievement' ? (
                    <CheckIcon size={20} className="text-green-600 dark:text-green-400" />
                  ) : insight.type === 'opportunity' ? (
                    <PiggyBankIcon size={20} className="text-gray-600 dark:text-gray-500" />
                  ) : (
                    <AlertTriangleIcon size={20} className="text-yellow-600 dark:text-yellow-400" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {insight.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {insight.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Recommendations</h3>
            {selectedRecommendations.size > 0 && (
              <button
                onClick={handleApplySelected}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Apply {selectedRecommendations.size} Selected
              </button>
            )}
          </div>

          {analysis.recommendations.map(recommendation => (
            <div
              key={recommendation.categoryId}
              className="bg-white dark:bg-gray-800 rounded-xl shadow p-4"
            >
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={selectedRecommendations.has(recommendation.categoryId)}
                  onChange={(e) => {
                    const newSelected = new Set(selectedRecommendations);
                    if (e.target.checked) {
                      newSelected.add(recommendation.categoryId);
                    } else {
                      newSelected.delete(recommendation.categoryId);
                    }
                    setSelectedRecommendations(newSelected);
                  }}
                  className="mt-1 rounded text-indigo-600"
                />

                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {recommendation.categoryName}
                      </h4>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Current:</span>
                          <span className="font-medium">
                            {recommendation.currentBudget 
                              ? formatCurrency(recommendation.currentBudget)
                              : 'No budget'
                            }
                          </span>
                        </div>
                        <ArrowRightIcon size={16} className="text-gray-400" />
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Recommended:</span>
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(recommendation.recommendedBudget)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleApplyRecommendation(recommendation)}
                      className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      Apply
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <span>Avg spending:</span>
                        <span className="font-medium">{formatCurrency(recommendation.averageSpending)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {recommendation.spendingTrend === 'increasing' ? (
                          <TrendingUpIcon size={14} className="text-red-500" />
                        ) : recommendation.spendingTrend === 'decreasing' ? (
                          <TrendingDownIcon size={14} className="text-green-500" />
                        ) : null}
                        <span>{recommendation.spendingTrend} {recommendation.trendPercentage}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Confidence:</span>
                        <span className="font-medium">{Math.round(recommendation.confidence * 100)}%</span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <InfoIcon size={14} className="inline mr-1" />
                      {recommendation.reasoning}
                    </p>

                    {recommendation.potentialSavings && (
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                        <PiggyBankIcon size={14} className="inline mr-1" />
                        Potential savings: {formatCurrency(recommendation.potentialSavings)}/month
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {analysis.recommendations.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
          <CheckIcon className="mx-auto text-green-500 mb-3" size={48} />
          <h3 className="text-lg font-semibold mb-2">No Recommendations Available</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Your budgets are well-aligned with your spending patterns!
          </p>
        </div>
      )}
    </div>
  );
}
