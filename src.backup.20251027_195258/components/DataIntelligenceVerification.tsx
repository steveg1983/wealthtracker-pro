import React, { useState, useEffect, useCallback } from 'react';
import { dataIntelligenceService } from '../services/dataIntelligenceService';
import { useApp } from '../contexts/AppContextSupabase';
import type { Transaction } from '../types';
import {
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  DatabaseIcon
} from './icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { Decimal, formatPercentageFromRatio } from '@wealthtracker/utils';
import type { DecimalInstance } from '@wealthtracker/utils';

interface VerificationResult {
  component: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

const getDateRange = (transactions: Transaction[]): string => {
  if (transactions.length === 0) return 'No data';
  const dates = transactions.map(t => new Date(t.date).getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  return `${minDate.toLocaleDateString()} to ${maxDate.toLocaleDateString()}`;
};

const getAverageConfidence = (merchants: Array<{ confidence?: number }>): DecimalInstance => {
  if (merchants.length === 0) return new Decimal(0);
  const sum = merchants.reduce((acc, m) => acc.plus(m.confidence ?? 0), new Decimal(0));
  return sum.dividedBy(merchants.length);
};

export default function DataIntelligenceVerification() {
  const { transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastVerification, setLastVerification] = useState<Date | null>(null);

  const runVerification = useCallback(async () => {
    setIsVerifying(true);
    const results: VerificationResult[] = [];

    try {
      // 1. Verify transaction data availability
      if (!transactions || transactions.length === 0) {
        results.push({
          component: 'Transaction Data',
          status: 'warning',
          message: 'No transactions available',
          details: 'Add transactions to enable full data intelligence features'
        });
      } else {
        results.push({
          component: 'Transaction Data',
          status: 'success',
          message: `${transactions.length} transactions loaded`,
          details: `Data spans from ${getDateRange(transactions)}`
        });

        // 2. Verify merchant learning
        const merchants = dataIntelligenceService.getMerchantData();
        if (merchants.length === 0) {
          results.push({
            component: 'Merchant Learning',
            status: 'warning',
            message: 'No merchants learned yet',
            details: 'System will learn from your transactions automatically'
          });
        } else {
          const averageConfidence = getAverageConfidence(merchants);
          results.push({
            component: 'Merchant Learning',
            status: 'success',
            message: `${merchants.length} merchants identified`,
            details: `Average confidence: ${formatPercentageFromRatio(averageConfidence, 0)}`
          });
        }

        // 3. Verify subscription detection
        const subscriptions = dataIntelligenceService.detectSubscriptions(transactions);
        if (subscriptions.length === 0) {
          results.push({
            component: 'Subscription Detection',
            status: 'warning',
            message: 'No subscriptions detected',
            details: 'Add more transaction history for better detection'
          });
        } else {
          const totalMonthly = subscriptions
            .filter(s => s.frequency === 'monthly')
            .reduce((sum, s) => sum + s.amount, 0);
          
          results.push({
            component: 'Subscription Detection',
            status: 'success',
            message: `${subscriptions.length} subscriptions found`,
            details: `Monthly total: ${formatCurrency(new Decimal(totalMonthly).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber())}`
          });
        }

        // 4. Verify spending patterns
        const patterns = dataIntelligenceService.analyzeSpendingPatterns(transactions);
        if (patterns.length === 0) {
          results.push({
            component: 'Spending Patterns',
            status: 'warning',
            message: 'No patterns detected',
            details: 'Need at least 3 months of data for pattern detection'
          });
        } else {
          results.push({
            component: 'Spending Patterns',
            status: 'success',
            message: `${patterns.length} patterns identified`,
            details: `${patterns.filter(p => p.isActive).length} active patterns`
          });
        }

        // 5. Verify insights generation
        const insights = dataIntelligenceService.generateInsights(transactions);
        if (insights.length === 0) {
          results.push({
            component: 'Insights Generation',
            status: 'warning',
            message: 'No insights generated',
            details: 'More transaction data needed for meaningful insights'
          });
        } else {
          const highPriority = insights.filter(i => i.severity === 'high').length;
          results.push({
            component: 'Insights Generation',
            status: 'success',
            message: `${insights.length} insights generated`,
            details: highPriority > 0 ? `${highPriority} high priority` : 'All insights reviewed'
          });
        }

        // 6. Verify data persistence
        try {
          const stats = dataIntelligenceService.getStats();
          results.push({
            component: 'Data Persistence',
            status: 'success',
            message: 'Data storage working',
            details: `Last analyzed: ${stats.lastAnalysisRun ? new Date(stats.lastAnalysisRun).toLocaleString() : 'Never'}`
          });
        } catch (error) {
          results.push({
            component: 'Data Persistence',
            status: 'error',
            message: 'Storage error',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }

        // 7. Verify category smart detection
        const categories = dataIntelligenceService.getSmartCategories();
        if (categories.length === 0) {
          results.push({
            component: 'Smart Categories',
            status: 'warning',
            message: 'No smart categories',
            details: 'System will create categories as it learns'
          });
        } else {
          results.push({
            component: 'Smart Categories',
            status: 'success',
            message: `${categories.length} smart categories`,
            details: `Auto-categorization active`
          });
        }
      }

    } catch (error) {
      results.push({
        component: 'System Health',
        status: 'error',
        message: 'Verification failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    setVerificationResults(results);
    setLastVerification(new Date());
    setIsVerifying(false);
  }, [transactions, formatCurrency]);

  const getStatusIcon = (status: VerificationResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon size={20} className="text-green-600" />;
      case 'warning':
        return <AlertCircleIcon size={20} className="text-yellow-600" />;
      case 'error':
        return <XCircleIcon size={20} className="text-red-600" />;
    }
  };

  const getStatusColor = (status: VerificationResult['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    }
  };

  useEffect(() => {
    // Auto-run verification on mount if we have transactions
    if (transactions && transactions.length > 0) {
      runVerification();
    }
  }, [transactions, runVerification]);

  const successCount = verificationResults.filter(r => r.status === 'success').length;
  const warningCount = verificationResults.filter(r => r.status === 'warning').length;
  const errorCount = verificationResults.filter(r => r.status === 'error').length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Data Intelligence Verification
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Verify that all data intelligence components are working with production data
            </p>
          </div>
          <button
            onClick={runVerification}
            disabled={isVerifying}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCwIcon size={16} className={isVerifying ? 'animate-spin' : ''} />
            {isVerifying ? 'Verifying...' : 'Run Verification'}
          </button>
        </div>

        {lastVerification && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Last verified: {lastVerification.toLocaleString()}
          </p>
        )}
      </div>

      {/* Summary Stats */}
      {verificationResults.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircleIcon size={16} className="text-green-600 dark:text-green-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Passed</span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {successCount}
            </p>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertCircleIcon size={16} className="text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Warnings</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
              {warningCount}
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <XCircleIcon size={16} className="text-red-600 dark:text-red-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Errors</span>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {errorCount}
            </p>
          </div>
        </div>
      )}

      {/* Verification Results */}
      <div className="space-y-3">
        {verificationResults.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <DatabaseIcon size={48} className="mx-auto mb-4 opacity-50" />
            <p>Click "Run Verification" to check system status</p>
          </div>
        ) : (
          verificationResults.map((result, index) => (
            <div
              key={index}
              className={`border rounded-lg p-4 ${getStatusColor(result.status)}`}
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {result.component}
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    {result.message}
                  </p>
                  {result.details && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {result.details}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recommendations */}
      {verificationResults.length > 0 && (warningCount > 0 || errorCount > 0) && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            Recommendations
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            {transactions?.length === 0 && (
              <li>• Import or add transactions to enable data intelligence features</li>
            )}
            {transactions && transactions.length < 100 && (
              <li>• Add more transaction history for better pattern detection</li>
            )}
            {warningCount > 2 && (
              <li>• Continue using the app to improve data intelligence accuracy</li>
            )}
            {errorCount > 0 && (
              <li>• Check browser console for detailed error information</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
