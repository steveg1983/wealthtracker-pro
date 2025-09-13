import React, { useEffect, memo } from 'react';
import { CreditCardIcon } from '../../icons';
import type { Subscription } from '../../../services/dataIntelligenceService';
import { dataIntelligencePageService } from '../../../services/dataIntelligencePageService';
import { logger } from '../../../services/loggingService';

interface SubscriptionOverviewProps {
  subscriptions: Subscription[];
  detectedSubscriptions: Subscription[];
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
  onManage: () => void;
}

const SubscriptionOverview = memo(function SubscriptionOverview({
  subscriptions,
  detectedSubscriptions,
  formatCurrency,
  formatDate,
  onManage
}: SubscriptionOverviewProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SubscriptionOverview component initialized', {
      componentName: 'SubscriptionOverview'
    });
  }, []);

  const allSubscriptions = [...subscriptions, ...detectedSubscriptions];
  const upcomingRenewals = allSubscriptions
    .sort((a, b) => a.nextPaymentDate.getTime() - b.nextPaymentDate.getTime())
    .slice(0, 3);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <CreditCardIcon size={20} className="text-green-600 dark:text-green-400" />
          Upcoming Renewals
        </h3>
        <button
          onClick={onManage}
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
          upcomingRenewals.map((subscription) => {
            const daysUntilRenewal = dataIntelligencePageService.calculateDaysUntilRenewal(subscription.nextPaymentDate);
            const urgencyColor = dataIntelligencePageService.getRenewalStatusColor(daysUntilRenewal);
            
            return (
              <div
                key={subscription.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${urgencyColor}`} />
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
  );
});

export default SubscriptionOverview;
