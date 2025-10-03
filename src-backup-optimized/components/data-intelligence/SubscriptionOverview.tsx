import React from 'react';
import {
  CreditCardIcon,
  TrendingUpIcon,
  ClockIcon
} from '../icons';
import type { Subscription } from '../../services/dataIntelligenceService';
type DataIntelligenceStats = {
  lastAnalysisRun: Date;
  categoryAccuracy: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
};

interface SubscriptionOverviewProps {
  subscriptions: Subscription[];
  detectedSubscriptions: Subscription[];
  stats: DataIntelligenceStats;
  onManageSubscriptions: () => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
}

export default function SubscriptionOverview({
  subscriptions,
  detectedSubscriptions,
  stats,
  onManageSubscriptions,
  formatCurrency,
  formatDate
}: SubscriptionOverviewProps): React.JSX.Element {
  const allSubscriptions = [...subscriptions, ...detectedSubscriptions];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Upcoming Renewals */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCardIcon size={20} className="text-green-600 dark:text-green-400" />
            Upcoming Renewals
          </h3>
          <button
            onClick={onManageSubscriptions}
            className="text-sm text-gray-600 dark:text-gray-500 hover:underline"
          >
            Manage
          </button>
        </div>
        
        <div className="space-y-3">
          {allSubscriptions.length === 0 ? (
            <div className="text-center py-4">
              <CreditCardIcon size={32} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No subscriptions detected</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                We'll analyze your transactions to find recurring payments
              </p>
            </div>
          ) : (
            allSubscriptions.slice(0, 3).map((subscription) => {
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
            })
          )}
        </div>
      </div>

      {/* Analysis Summary */}
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
                {stats.categoryAccuracy.toFixed(0)}%
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
  );
}
