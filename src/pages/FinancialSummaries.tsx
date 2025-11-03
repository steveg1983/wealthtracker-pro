import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { financialSummaryService } from '../services/financialSummaryService';
import PageWrapper from '../components/PageWrapper';
import FinancialSummary from '../components/FinancialSummary';
import { CalendarIcon, BarChart3Icon, TrendingUpIcon } from '../components/icons';
import { format } from 'date-fns';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { formatDecimal } from '../utils/decimal-format';

export default function FinancialSummaries() {
  const { transactions, accounts, budgets, goals } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');
  const [showHistory, setShowHistory] = useState(false);
  const formatPercentage = (value: number, decimals: number = 1) => {
    return formatDecimal(value, decimals);
  };
  
  // Check if summaries should be generated
  useEffect(() => {
    if (financialSummaryService.shouldGenerateSummary('weekly')) {
      const weeklySummary = financialSummaryService.generateWeeklySummary(
        transactions, accounts, budgets, goals
      );
      financialSummaryService.saveSummary(weeklySummary);
    }
    
    if (financialSummaryService.shouldGenerateSummary('monthly')) {
      const monthlySummary = financialSummaryService.generateMonthlySummary(
        transactions, accounts, budgets, goals
      );
      financialSummaryService.saveSummary(monthlySummary);
    }
  }, [transactions, accounts, budgets, goals]);

  const summaryHistory = financialSummaryService.getSummaryHistory()
    .filter(s => s.period === activeTab)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return (
    <PageWrapper
      title="Financial Summaries"
      rightContent={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
          >
            <BarChart3Icon size={20} />
            {showHistory ? 'Hide' : 'Show'} History
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'weekly'
                ? 'bg-white dark:bg-gray-700 text-primary shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <CalendarIcon size={16} />
            Weekly
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'monthly'
                ? 'bg-white dark:bg-gray-700 text-primary shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <CalendarIcon size={16} />
            Monthly
          </button>
        </div>

        {/* Current Summary */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Current {activeTab === 'weekly' ? 'Week' : 'Month'}
          </h2>
          <FinancialSummary period={activeTab} />
        </div>

        {/* History */}
        {showHistory && summaryHistory.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Previous Summaries
            </h2>
            <div className="space-y-4">
              {summaryHistory.map((summary, index) => (
                <div
                  key={index}
                  className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {format(new Date(summary.startDate), 'MMM d')} - {format(new Date(summary.endDate), 'MMM d, yyyy')}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {summary.period === 'weekly' ? 'Weekly' : 'Monthly'} Summary
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Net Income</p>
                      <p className={`text-lg font-bold ${
                        summary.netIncome.greaterThanOrEqualTo(0)
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {formatCurrency(summary.netIncome)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Income</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(summary.totalIncome)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Expenses</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(summary.totalExpenses)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Savings Rate</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {`${formatPercentage(summary.savingsRate, 1)}%`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {showHistory && summaryHistory.length === 0 && (
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-12">
            <div className="text-center">
              <TrendingUpIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Historical Summaries
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {activeTab === 'weekly' 
                  ? 'Weekly summaries will appear here as they are generated each Monday.'
                  : 'Monthly summaries will appear here as they are generated on the 1st of each month.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
