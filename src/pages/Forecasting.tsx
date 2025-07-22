import React, { useState } from 'react';
import PageWrapper from '../components/PageWrapper';
import CashFlowForecast from '../components/CashFlowForecast';
import SeasonalTrends from '../components/SeasonalTrends';
import { useApp } from '../contexts/AppContext';
import { 
  LineChartIcon, 
  CalendarIcon, 
  AlertCircleIcon,
  TrendingUpIcon,
  BarChart3Icon
} from '../components/icons';

export default function Forecasting() {
  const { accounts } = useApp();
  const [activeTab, setActiveTab] = useState<'forecast' | 'seasonal'>('forecast');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  return (
    <PageWrapper
      title="Financial Forecasting"
    >
      {/* Account Filter */}
      <div className="mb-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Filter by Accounts
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedAccountIds([])}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedAccountIds.length === 0
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All Accounts
          </button>
          {accounts.map(account => (
            <button
              key={account.id}
              onClick={() => {
                if (selectedAccountIds.includes(account.id)) {
                  setSelectedAccountIds(prev => prev.filter(id => id !== account.id));
                } else {
                  setSelectedAccountIds(prev => [...prev, account.id]);
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedAccountIds.includes(account.id)
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {account.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab('forecast')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'forecast'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <LineChartIcon size={16} />
          Cash Flow Forecast
        </button>
        <button
          onClick={() => setActiveTab('seasonal')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'seasonal'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <CalendarIcon size={16} />
          Seasonal Trends
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'forecast' && (
        <CashFlowForecast 
          accountIds={selectedAccountIds.length > 0 ? selectedAccountIds : undefined}
        />
      )}

      {activeTab === 'seasonal' && (
        <div className="space-y-6">
          <SeasonalTrends />
          
          {/* Tips Section */}
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                  <TrendingUpIcon className="text-primary" size={24} />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Improve Your Financial Future
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">
                      Based on Forecast
                    </h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <li>• Set up automatic savings transfers</li>
                      <li>• Review and adjust recurring expenses</li>
                      <li>• Plan for irregular expenses</li>
                      <li>• Build emergency fund for low months</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">
                      Seasonal Planning
                    </h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <li>• Save extra during high-income months</li>
                      <li>• Budget for seasonal expenses</li>
                      <li>• Track holiday spending patterns</li>
                      <li>• Adjust goals based on trends</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature Info */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircleIcon className="text-blue-600 dark:text-blue-400 mt-1" size={20} />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              About Financial Forecasting
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
              Our forecasting engine analyzes your transaction history to identify patterns and predict future cash flow. 
              The accuracy improves with more historical data.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-1">Pattern Detection</h4>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Automatically identifies recurring income and expenses based on frequency and amount
                </p>
              </div>
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-1">Confidence Scores</h4>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Higher scores indicate more consistent patterns in your transaction history
                </p>
              </div>
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-1">Adjustable Forecast</h4>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Edit or remove detected patterns to customize your forecast
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}