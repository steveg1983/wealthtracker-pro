/**
 * Subscription Table Component
 * Displays subscriptions in a table format
 */

import React, { useEffect } from 'react';
import type { Subscription } from '../../services/dataIntelligenceService';
import { subscriptionManagerService } from '../../services/subscriptionManagerService';
import { useLogger } from '../services/ServiceProvider';
import {
  EditIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  StopIcon,
  ClockIcon,
  AlertCircleIcon,
  CreditCardIcon
} from '../icons';

interface SubscriptionTableProps {
  subscriptions: Subscription[];
  onEdit: (subscription: Subscription) => void;
  onDelete: (id: string) => void;
}

const SubscriptionTable = React.memo(({
  subscriptions,
  onEdit,
  onDelete
}: SubscriptionTableProps) => {
  const getStatusIcon = (status: Subscription['status']) => {
    const iconName = subscriptionManagerService.getStatusIconName(status);
    const iconColor = subscriptionManagerService.getStatusIconColor(status);
    
    switch (iconName) {
      case 'CheckCircleIcon':
        return <CheckCircleIcon size={16} className={iconColor} />;
      case 'XCircleIcon':
        return <XCircleIcon size={16} className={iconColor} />;
      case 'StopIcon':
        return <StopIcon size={16} className={iconColor} />;
      case 'ClockIcon':
        return <ClockIcon size={16} className={iconColor} />;
      default:
        return <AlertCircleIcon size={16} className={iconColor} />;
    }
  };

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
          <caption className="sr-only">
            List of active subscriptions with payment details and status
          </caption>
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr role="row">
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Merchant
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Amount
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Frequency
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Next Payment
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {subscriptions.map((subscription) => {
              const daysUntilRenewal = subscriptionManagerService.getDaysUntilRenewal(
                subscription.nextPaymentDate
              );
              const renewalStatusColor = subscriptionManagerService.getRenewalStatusColor(subscription);
              const renewalStatusText = subscriptionManagerService.getRenewalStatusText(daysUntilRenewal);
              const statusColor = subscriptionManagerService.getStatusColor(subscription.status);

              return (
                <tr key={subscription.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
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
                    <div className={`text-sm ${renewalStatusColor}`}>
                      {subscriptionManagerService.formatDate(subscription.nextPaymentDate)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {renewalStatusText}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                      {getStatusIcon(subscription.status)}
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

SubscriptionTable.displayName = 'SubscriptionTable';

export default SubscriptionTable;