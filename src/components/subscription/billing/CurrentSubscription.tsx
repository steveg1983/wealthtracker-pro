import { memo, useEffect } from 'react';
import { CreditCardIcon, CheckCircleIcon, AlertTriangleIcon } from '../../icons';
import { BillingDashboardService } from '../../../services/billingDashboardService';
import type { UserSubscription } from '../../../types/subscription';
import { logger } from '../../../services/loggingService';

interface CurrentSubscriptionProps {
  subscription: UserSubscription | null;
  onChangePlan: () => void;
  onCancel: () => void;
}

export const CurrentSubscription = memo(function CurrentSubscription({
  subscription,
  onChangePlan,
  onCancel
}: CurrentSubscriptionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('CurrentSubscription component initialized', {
      componentName: 'CurrentSubscription'
    });
  }, []);

  const getStatusBadge = (status: string) => {
    const config = BillingDashboardService.getStatusConfig(status);
    const Icon = config.icon === 'CheckCircleIcon' ? CheckCircleIcon : AlertTriangleIcon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon size={12} />
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (!subscription) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <CreditCardIcon size={20} />
          Current Subscription
        </h3>
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You're currently on the free plan
          </p>
          <button
            onClick={onChangePlan}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Upgrade to Premium
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <CreditCardIcon size={20} />
        Current Subscription
      </h3>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Plan</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {BillingDashboardService.getTierDisplayName(subscription.tier)}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</p>
            <div>{getStatusBadge(subscription.status)}</div>
          </div>
          
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {subscription.status === 'trialing' ? 'Trial ends' : 'Next billing'}
            </p>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {subscription.currentPeriodEnd 
                ? BillingDashboardService.formatDate(subscription.currentPeriodEnd)
                : 'N/A'
              }
            </p>
          </div>
        </div>

        <TrialWarning subscription={subscription} />
        <CancellationNotice subscription={subscription} />
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onChangePlan}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Change Plan
          </button>
          
          {!subscription.cancelAtPeriodEnd && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Cancel Subscription
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

const TrialWarning = memo(function TrialWarning({ 
  subscription 
}: { 
  subscription: UserSubscription 
}) {
  if (subscription.status !== 'trialing' || !subscription.trialEnd) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
      <div className="flex items-start gap-3">
        <CheckCircleIcon size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-gray-900 dark:text-white font-medium">
            Free Trial Active
          </h4>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Your trial ends on {BillingDashboardService.formatDate(subscription.trialEnd)}. 
            Your subscription will automatically continue unless you cancel.
          </p>
        </div>
      </div>
    </div>
  );
});

const CancellationNotice = memo(function CancellationNotice({ 
  subscription 
}: { 
  subscription: UserSubscription 
}) {
  if (!subscription.cancelAtPeriodEnd) return null;

  return (
    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon size={20} className="text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-orange-900 dark:text-orange-300 font-medium">
            Subscription Ending
          </h4>
          <p className="text-orange-800 dark:text-orange-200 text-sm mt-1">
            Your subscription will end on {subscription.currentPeriodEnd 
              ? BillingDashboardService.formatDate(subscription.currentPeriodEnd) 
              : 'the next billing date'
            }. You'll still have access until then.
          </p>
        </div>
      </div>
    </div>
  );
});