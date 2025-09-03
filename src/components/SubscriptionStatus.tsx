import React from 'react';
import { 
  CheckIcon as Check,
  XIcon as X,
  AlertCircleIcon as AlertCircle,
  CreditCardIcon as CreditCard,
  CrownIcon as Crown,
  ZapIcon as Zap,
  UsersIcon as Users
} from './icons';
import { useSubscription } from '../contexts/SubscriptionContext';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '../services/loggingService';

interface PlanFeature {
  name: string;
  included: boolean;
}

interface PlanDetails {
  name: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  features: PlanFeature[];
  price?: string;
  badge?: string;
}

const PLAN_DETAILS: Record<string, PlanDetails> = {
  free: {
    name: 'Free',
    icon: Zap,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    features: [
      { name: 'Up to 2 accounts', included: true },
      { name: '30 day transaction history', included: true },
      { name: 'Basic budgeting', included: true },
      { name: 'Manual data entry', included: true },
      { name: 'CSV export', included: true },
      { name: 'Bank sync', included: false },
      { name: 'Unlimited accounts', included: false },
      { name: 'Advanced analytics', included: false },
      { name: 'Priority support', included: false },
    ]
  },
  pro: {
    name: 'Pro',
    icon: Crown,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    price: '£9.99/month',
    badge: 'Most Popular',
    features: [
      { name: 'Unlimited accounts', included: true },
      { name: 'Full transaction history', included: true },
      { name: 'Bank sync (UK banks)', included: true },
      { name: 'Advanced budgeting', included: true },
      { name: 'Investment tracking', included: true },
      { name: 'Custom categories', included: true },
      { name: 'Excel & PDF export', included: true },
      { name: 'Email support', included: true },
      { name: 'Business features', included: false },
    ]
  },
  business: {
    name: 'Business',
    icon: Users,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    price: '£24.99/month',
    features: [
      { name: 'Everything in Pro', included: true },
      { name: 'Multi-user access', included: true },
      { name: 'Business accounts', included: true },
      { name: 'Invoice management', included: true },
      { name: 'Tax reports', included: true },
      { name: 'API access', included: true },
      { name: 'Custom integrations', included: true },
      { name: 'Priority phone support', included: true },
      { name: 'Dedicated account manager', included: true },
    ]
  }
};

export default function SubscriptionStatus(): React.JSX.Element {
  const { 
    subscriptionTier, 
    isLoading, 
    billingCycle,
    nextBillingDate,
    cancelAtPeriodEnd,
    updateSubscription,
    cancelSubscription,
    reactivateSubscription
  } = useSubscription();

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  const currentPlan = PLAN_DETAILS[subscriptionTier] || PLAN_DETAILS.free;
  const Icon = currentPlan.icon;

  const handleUpgrade = async (newTier: 'pro' | 'business'): Promise<void> => {
    try {
      await updateSubscription(newTier);
    } catch (error) {
      logger.error('Failed to upgrade subscription:', error);
    }
  };

  const handleCancel = async (): Promise<void> => {
    if (confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) {
      try {
        await cancelSubscription();
      } catch (error) {
        logger.error('Failed to cancel subscription:', error);
      }
    }
  };

  const handleReactivate = async (): Promise<void> => {
    try {
      await reactivateSubscription();
    } catch (error) {
      logger.error('Failed to reactivate subscription:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Current Subscription
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your subscription and billing
            </p>
          </div>
          <div className={`p-3 rounded-lg ${currentPlan.bgColor}`}>
            <Icon size={24} className={currentPlan.color} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Plan</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">
                {currentPlan.name}
              </span>
              {currentPlan.badge && (
                <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                  {currentPlan.badge}
                </span>
              )}
            </div>
          </div>

          {subscriptionTier !== 'free' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Billing</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentPlan.price} ({billingCycle})
                </span>
              </div>

              {nextBillingDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Next billing</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatDistanceToNow(new Date(nextBillingDate), { addSuffix: true })}
                  </span>
                </div>
              )}

              {cancelAtPeriodEnd && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        Your subscription will end {formatDistanceToNow(new Date(nextBillingDate!), { addSuffix: true })}
                      </p>
                      <button
                        onClick={handleReactivate}
                        className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 hover:underline"
                      >
                        Reactivate subscription
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Plan Features */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Your plan includes:
          </h4>
          <ul className="space-y-2">
            {currentPlan.features.filter(f => f.included).map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check size={16} className="text-green-600 dark:text-green-400 mt-0.5" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {feature.name}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          {subscriptionTier === 'free' && (
            <>
              <button
                onClick={() => handleUpgrade('pro')}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upgrade to Pro
              </button>
              <button
                onClick={() => handleUpgrade('business')}
                className="flex-1 px-4 py-2 border border-purple-600 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
              >
                Upgrade to Business
              </button>
            </>
          )}
          
          {subscriptionTier === 'pro' && (
            <>
              <button
                onClick={() => handleUpgrade('business')}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Upgrade to Business
              </button>
              {!cancelAtPeriodEnd && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Cancel Subscription
                </button>
              )}
            </>
          )}

          {subscriptionTier === 'business' && !cancelAtPeriodEnd && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Cancel Subscription
            </button>
          )}

          <button
            onClick={() => window.open('/billing', '_blank')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <CreditCard size={16} />
            Manage Billing
          </button>
        </div>
      </div>

      {/* Upgrade Options */}
      {subscriptionTier === 'free' && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Unlock Premium Features
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Upgrade to Pro or Business to access unlimited accounts, bank sync, advanced analytics, and more.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Crown size={20} className="text-blue-600" />
                <span className="font-medium text-gray-900 dark:text-white">Pro</span>
                <span className="text-sm text-gray-500">£9.99/mo</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Perfect for individuals managing personal finances
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={20} className="text-purple-600" />
                <span className="font-medium text-gray-900 dark:text-white">Business</span>
                <span className="text-sm text-gray-500">£24.99/mo</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Ideal for small businesses and freelancers
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
