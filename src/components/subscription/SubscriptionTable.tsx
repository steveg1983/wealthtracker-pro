import React, { useEffect, memo } from 'react';
import type { Subscription } from '../../services/dataIntelligenceService';
import { subscriptionManagerService } from '../../services/subscriptionManagerService';
import { logger } from '../../services/loggingService';
import { 
  EditIcon,
  TrashIcon,
  CreditCardIcon,
  CheckCircleIcon,
  XCircleIcon,
  StopIcon,
  ClockIcon,
  AlertCircleIcon
} from '../icons';

interface SubscriptionTableProps {
  subscriptions: Subscription[];
  onEdit: (subscription: Subscription) => void;
  onDelete: (id: string) => void;
}

const SubscriptionTable = memo(function SubscriptionTable({
  subscriptions,
  onEdit,
  onDelete
}: SubscriptionTableProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SubscriptionTable component initialized', {
      componentName: 'SubscriptionTable'
    });
  }, []);

  if (subscriptions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="text-center py-8">
          <CreditCardIcon size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400">No subscriptions found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto" role="region" aria-label="Subscriptions table">
        <table className="w-full" role="table" aria-label="Active subscriptions">
          <caption className="sr-only">List of active subscriptions with payment details and status</caption>
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr role="row">
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" role="columnheader">
                Merchant
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" role="columnheader">
                Amount
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" role="columnheader">
                Frequency
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" role="columnheader">
                Next Payment
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" role="columnheader">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" role="columnheader">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {subscriptions.map((subscription) => {
              const daysUntilRenewal = subscriptionManagerService.getDaysUntilRenewal(subscription.nextPaymentDate);
              const statusColor = subscriptionManagerService.getStatusColor(subscription.status);
              const statusIcon = getStatusIcon(subscription.status);
              const renewalColor = subscriptionManagerService.getRenewalStatusColor(subscription);
              const renewalText = subscriptionManagerService.getRenewalStatusText(daysUntilRenewal);

              return (
                <tr key={subscription.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50" role="row">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {subscription.merchantName}
                      </div>
                      {subscription.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {subscription.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-gray-900 dark:text-white font-medium">
                      {subscriptionManagerService.formatCurrency(subscription.amount)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-gray-900 dark:text-white capitalize">
                      {subscription.frequency}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm ${renewalColor}`}>
                      {subscriptionManagerService.formatDate(subscription.nextPaymentDate)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {renewalText}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                      {statusIcon}
                      {subscription.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(subscription)}
                        className="text-gray-600 dark:text-gray-500 hover:text-blue-900 dark:hover:text-gray-300"
                        aria-label={`Edit ${subscription.merchantName} subscription`}
                      >
                        <EditIcon size={16} />
                      </button>
                      <button
                        onClick={() => onDelete(subscription.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        aria-label={`Delete ${subscription.merchantName} subscription`}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// Helper function to get status icon component
function getStatusIcon(status: Subscription['status']): React.ReactElement {
  const iconColor = subscriptionManagerService.getStatusIconColor(status);
  
  switch (status) {
    case 'active':
      return <CheckCircleIcon size={16} className={iconColor} />;
    case 'cancelled':
      return <XCircleIcon size={16} className={iconColor} />;
    case 'paused':
      return <StopIcon size={16} className={iconColor} />;
    case 'trial':
      return <ClockIcon size={16} className={iconColor} />;
    default:
      return <AlertCircleIcon size={16} className={iconColor} />;
  }
}

export default SubscriptionTable;