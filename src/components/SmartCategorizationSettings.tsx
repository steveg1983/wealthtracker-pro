import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { smartCategorizationService } from '../services/smartCategorizationService';
import { 
  LightbulbIcon, 
  CheckCircleIcon, 
  InfoIcon,
  RefreshCwIcon,
  BarChart3Icon,
  MagicWandIcon
} from './icons';
import { LoadingButton } from './loading/LoadingState';

export default function SmartCategorizationSettings() {
  const { transactions, categories, updateTransaction } = useApp();
  const [isLearning, setIsLearning] = useState(false);
  const [stats, setStats] = useState({
    patternsLearned: 0,
    merchantsKnown: 0,
    keywordsIdentified: 0
  });
  const [autoCategorizeResult, setAutoCategorizeResult] = useState<{
    count: number;
    confidence: number;
  } | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(80);

  useEffect(() => {
    // Learn from existing transactions on mount
    if (transactions.length > 0 && categories.length > 0) {
      smartCategorizationService.learnFromTransactions(transactions, categories);
      setStats(smartCategorizationService.getStats());
    }
  }, []);

  const handleLearnPatterns = async () => {
    setIsLearning(true);
    setAutoCategorizeResult(null);
    
    try {
      // Simulate async learning process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      smartCategorizationService.learnFromTransactions(transactions, categories);
      setStats(smartCategorizationService.getStats());
    } finally {
      setIsLearning(false);
    }
  };

  const handleAutoCategorize = async () => {
    const uncategorized = transactions.filter(t => !t.category);
    const results = smartCategorizationService.autoCategorize(
      uncategorized, 
      confidenceThreshold / 100
    );

    // Apply categorizations
    results.forEach(({ transaction, categoryId }) => {
      updateTransaction(transaction.id, { category: categoryId });
    });

    const avgConfidence = results.length > 0
      ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
      : 0;

    setAutoCategorizeResult({
      count: results.length,
      confidence: avgConfidence
    });
  };

  const uncategorizedCount = transactions.filter(t => !t.category).length;

  return (
    <div className="space-y-6">
      {/* Learning Status */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <LightbulbIcon className="text-indigo-600 dark:text-indigo-400 mt-1" size={24} />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Smart Categorization
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              AI-powered categorization learns from your transaction history to automatically 
              suggest and apply categories to new transactions.
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3Icon size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.patternsLearned}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Patterns Learned</p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.merchantsKnown}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Known Merchants</p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.keywordsIdentified}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Keywords</p>
              </div>
            </div>

            <LoadingButton
              onClick={handleLearnPatterns}
              isLoading={isLearning}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <RefreshCwIcon size={16} />
              Re-learn Patterns
            </LoadingButton>
          </div>
        </div>
      </div>

      {/* Auto-Categorization */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
        <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
          Auto-Categorization
        </h4>
        
        {uncategorizedCount > 0 ? (
          <>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <InfoIcon className="text-yellow-600 dark:text-yellow-400 mt-0.5" size={20} />
                <div>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    You have <strong>{uncategorizedCount}</strong> uncategorized transactions.
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    Smart categorization can automatically assign categories based on learned patterns.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confidence Threshold: {confidenceThreshold}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Only categorize transactions when confidence is above this threshold
                </p>
              </div>

              <button
                onClick={handleAutoCategorize}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <MagicWandIcon size={16} />
                Auto-Categorize Transactions
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <CheckCircleIcon className="mx-auto text-green-500 mb-3" size={48} />
            <p className="text-gray-600 dark:text-gray-400">
              All transactions are already categorized!
            </p>
          </div>
        )}

        {autoCategorizeResult && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="text-green-600 dark:text-green-400" size={20} />
              <p className="text-sm text-green-800 dark:text-green-200">
                Successfully categorized <strong>{autoCategorizeResult.count}</strong> transactions
                with an average confidence of <strong>{Math.round(autoCategorizeResult.confidence * 100)}%</strong>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* How it Works */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-6">
        <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
          How Smart Categorization Works
        </h4>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-start gap-3">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">1.</span>
            <p><strong>Pattern Learning:</strong> Analyzes your existing categorized transactions to identify patterns in merchant names, keywords, and amounts.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">2.</span>
            <p><strong>Suggestion Engine:</strong> When you add new transactions, it suggests categories based on similarity to learned patterns.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">3.</span>
            <p><strong>Confidence Scoring:</strong> Each suggestion includes a confidence score based on how closely it matches known patterns.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">4.</span>
            <p><strong>Continuous Learning:</strong> The system improves over time as you categorize more transactions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}