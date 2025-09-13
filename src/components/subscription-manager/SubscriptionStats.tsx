/**
 * Subscription Stats Component
 * Displays summary statistics for subscriptions
 */

import React, { useEffect } from 'react';
import {
  CheckCircleIcon,
  DollarSignIcon,
  CalendarIcon,
  XCircleIcon
} from '../icons';
import { subscriptionManagerService } from '../../services/subscriptionManagerService';
import { logger } from '../../services/loggingService';

interface SubscriptionStatsProps {
  stats: {
    activeCount: number;
    monthlyCost: number;
    dueSoonCount: number;
    cancelledCount: number;
  };
}

const SubscriptionStats = React.memo(({ stats }: SubscriptionStatsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.activeCount}
            </p>
          </div>
          <CheckCircleIcon size={24} className="text-green-500" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Cost</p>
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
              {subscriptionManagerService.formatCurrency(stats.monthlyCost)}
            </p>
          </div>
          <DollarSignIcon size={24} className="text-gray-500" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Due Soon</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {stats.dueSoonCount}
            </p>
          </div>
          <CalendarIcon size={24} className="text-orange-500" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Cancelled</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.cancelledCount}
            </p>
          </div>
          <XCircleIcon size={24} className="text-red-500" />
        </div>
      </div>
    </div>
  );
});

SubscriptionStats.displayName = 'SubscriptionStats';

export default SubscriptionStats;