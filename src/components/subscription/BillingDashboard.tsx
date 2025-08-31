/**
 * BillingDashboard Component - Comprehensive subscription management
 * 
 * Features:
 * - Current subscription status
 * - Billing history
 * - Payment methods management
 * - Plan upgrades/downgrades
 * - Cancel subscription
 */

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import StripeService from '../../services/stripeService';
import type { 
  UserSubscription, 
  BillingHistory, 
  PaymentMethod,
  SubscriptionTier 
} from '../../types/subscription';
import { 
import { logger } from '../../services/loggingService';
  CreditCardIcon, 
  CalendarIcon, 
  DollarSignIcon,
  DownloadIcon,
  EditIcon,
  TrashIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  LinkIcon,
  PlusIcon,
  SettingsIcon
} from '../icons';

interface BillingDashboardProps {
  className?: string;
}

export default function BillingDashboard({
  className = ''
}: BillingDashboardProps): React.JSX.Element {
  const { user } = useUser();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [subscriptionData, billingData] = await Promise.all([
        StripeService.getCurrentSubscription(),
        StripeService.getBillingHistory()
      ]);
      
      setSubscription(subscriptionData);
      setBillingHistory(billingData);
    } catch (err) {
      logger.error('Error loading billing data:', err);
      setError('Failed to load billing information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    
    setIsProcessing(true);
    try {
      await StripeService.cancelSubscription(subscription.stripeSubscriptionId!, true);
      await loadBillingData();
      setShowCancelModal(false);
    } catch (err) {
      logger.error('Error canceling subscription:', err);
      setError('Failed to cancel subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const portalUrl = await StripeService.createPortalSession();
      window.open(portalUrl, '_blank');
    } catch (err) {
      logger.error('Error creating portal session:', err);
      setError('Failed to open billing portal');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200', icon: CheckCircleIcon },
      trialing: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200', icon: CheckCircleIcon },
      past_due: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200', icon: AlertTriangleIcon },
      cancelled: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', icon: AlertTriangleIcon },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.cancelled;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon size={12} />
        {status.replace('_', ' ')}
      </span>
    );
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getTierDisplayName = (tier: SubscriptionTier) => {
    const plan = StripeService.getPlanByTier(tier);
    return plan?.name || tier;
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading billing information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <AlertTriangleIcon size={20} className="text-red-600 dark:text-red-400" />
          <div>
            <h3 className="text-red-800 dark:text-red-200 font-medium">
              Error Loading Billing Information
            </h3>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">
              {error}
            </p>
            <button
              onClick={loadBillingData}
              className="text-red-800 dark:text-red-200 underline text-sm mt-2 hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Billing & Subscription
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your subscription and billing information
          </p>
        </div>
        <button
          onClick={handleManageBilling}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <SettingsIcon size={16} />
          Manage Billing
          <LinkIcon size={14} />
        </button>
      </div>

      {/* Current Subscription */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <CreditCardIcon size={20} />
          Current Subscription
        </h3>

        {subscription ? (
          <div className="space-y-6">
            {/* Subscription Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Plan</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {getTierDisplayName(subscription.tier)}
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
                    ? formatDate(subscription.currentPeriodEnd)
                    : 'N/A'
                  }
                </p>
              </div>
            </div>

            {/* Trial Warning */}
            {subscription.status === 'trialing' && subscription.trialEnd && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircleIcon size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-blue-900 dark:text-blue-300 font-medium">
                      Free Trial Active
                    </h4>
                    <p className="text-blue-800 dark:text-blue-200 text-sm mt-1">
                      Your trial ends on {formatDate(subscription.trialEnd)}. 
                      Your subscription will automatically continue unless you cancel.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cancellation Notice */}
            {subscription.cancelAtPeriodEnd && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangleIcon size={20} className="text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-orange-900 dark:text-orange-300 font-medium">
                      Subscription Ending
                    </h4>
                    <p className="text-orange-800 dark:text-orange-200 text-sm mt-1">
                      Your subscription will end on {subscription.currentPeriodEnd 
                        ? formatDate(subscription.currentPeriodEnd) 
                        : 'the next billing date'
                      }. You'll still have access until then.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowChangeModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Change Plan
              </button>
              
              {!subscription.cancelAtPeriodEnd && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You're currently on the free plan
            </p>
            <button
              onClick={() => setShowChangeModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upgrade to Premium
            </button>
          </div>
        )}
      </div>

      {/* Payment Methods */}
      {billingHistory?.paymentMethods && billingHistory.paymentMethods.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Payment Methods
          </h3>
          
          <div className="space-y-3">
            {billingHistory.paymentMethods.map((method) => (
              <div key={method.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <CreditCardIcon size={20} className="text-gray-600 dark:text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      •••• •••• •••• {method.last4}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {method.brand.toUpperCase()} • Expires {method.expiryMonth}/{method.expiryYear}
                    </p>
                  </div>
                  {method.isDefault && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      Default
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    <EditIcon size={16} />
                  </button>
                  <button className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Billing History */}
      {billingHistory?.invoices && billingHistory.invoices.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Billing History
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Date
                  </th>
                  <th className="text-left py-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Description
                  </th>
                  <th className="text-left py-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Amount
                  </th>
                  <th className="text-left py-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Status
                  </th>
                  <th className="text-right py-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Download
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {billingHistory.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="py-4 text-sm text-gray-900 dark:text-white">
                      {formatDate(invoice.createdAt)}
                    </td>
                    <td className="py-4 text-sm text-gray-900 dark:text-white">
                      {invoice.description || 'Subscription payment'}
                    </td>
                    <td className="py-4 text-sm text-gray-900 dark:text-white">
                      {formatPrice(invoice.amount)}
                    </td>
                    <td className="py-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        invoice.status === 'paid' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      {invoice.invoicePdf && (
                        <a
                          href={invoice.invoicePdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                          <DownloadIcon size={16} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Cancel Subscription
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to cancel your subscription? You'll continue to have access 
              until the end of your current billing period.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={isProcessing}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={isProcessing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Canceling...
                  </>
                ) : (
                  'Cancel Subscription'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}