/**
 * PricingPlans Component - Beautiful subscription plan selection
 * 
 * Features:
 * - Free, Premium, and Pro tiers
 * - Stripe integration for payments
 * - Feature comparison
 * - Responsive design
 */

import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import StripeService from '../../services/stripeService';
import type { SubscriptionPlan, SubscriptionTier } from '../../types/subscription';
import { logger } from '../../services/loggingService';
import { 
  CheckIcon, 
  XIcon, 
  StarIcon, 
  CreditCardIcon,
  ArrowRightIcon
} from '../icons';

interface PricingPlansProps {
  currentTier?: SubscriptionTier;
  onSelectPlan: (plan: SubscriptionPlan) => void;
  showFreePlan?: boolean;
  className?: string;
}

export default function PricingPlans({ 
  currentTier = 'free', 
  onSelectPlan, 
  showFreePlan = true,
  className = '' 
}: PricingPlansProps): React.JSX.Element {
  const { user } = useUser();
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const plans = StripeService.getSubscriptionPlans();
  const displayPlans = showFreePlan ? plans : plans.filter(p => p.tier !== 'free');

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (plan.tier === currentTier) return;
    if (plan.tier === 'free') return; // Free plan doesn't need payment

    setLoadingPlan(plan.id);
    try {
      await onSelectPlan(plan);
    } catch (error) {
      logger.error('Error selecting plan:', error);
    } finally {
      setLoadingPlan(null);
    }
  };

  const getPlanButtonText = (plan: SubscriptionPlan) => {
    if (plan.tier === 'free') {
      return currentTier === 'free' ? 'Current Plan' : 'Downgrade to Free';
    }
    
    if (plan.tier === currentTier) {
      return 'Current Plan';
    }

    const isUpgrade = StripeService.isUpgrade(currentTier, plan.tier);
    return isUpgrade ? 'Upgrade' : 'Change Plan';
  };

  const getPlanButtonStyle = (plan: SubscriptionPlan) => {
    if (plan.tier === currentTier) {
      return 'bg-gray-100 text-gray-500 cursor-not-allowed';
    }
    
    if (plan.isPopular) {
      return 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700';
    }
    
    return 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50';
  };

  const formatPrice = (price: number) => {
    if (price === 0) return 'Free';
    return StripeService.formatPrice(price);
  };

  const getYearlyPrice = (monthlyPrice: number) => {
    const yearlyPrice = monthlyPrice * 12 * 0.8; // 20% discount for yearly
    return StripeService.formatPrice(yearlyPrice);
  };

  const getYearlyDiscount = (monthlyPrice: number) => {
    const yearlyPrice = monthlyPrice * 12 * 0.8;
    const monthlySavings = (monthlyPrice * 12) - yearlyPrice;
    return StripeService.formatPrice(monthlySavings);
  };

  return (
    <div className={`max-w-7xl mx-auto ${className}`}>
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Choose Your Plan
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          Select the perfect plan for your financial management needs
        </p>

        {/* Billing Toggle */}
        <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setBillingInterval('month')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingInterval === 'month'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('year')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingInterval === 'year'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span>Yearly</span>
            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
        {displayPlans.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl border-2 transition-all duration-200 ${
              plan.isPopular
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10 scale-105'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            } ${plan.tier === currentTier ? 'ring-2 ring-green-500' : ''}`}
          >
            {/* Popular Badge */}
            {plan.isPopular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                  <StarIcon size={14} />
                  Most Popular
                </div>
              </div>
            )}

            {/* Current Plan Badge */}
            {plan.tier === currentTier && (
              <div className="absolute -top-4 right-4">
                <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                  <CheckIcon size={14} />
                  Current
                </div>
              </div>
            )}

            <div className="p-8">
              {/* Plan Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mb-6">
                  {plan.price === 0 ? (
                    <div className="text-4xl font-bold text-gray-900 dark:text-white">
                      Free
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl font-bold text-gray-900 dark:text-white">
                        {billingInterval === 'month' ? formatPrice(plan.price) : getYearlyPrice(plan.price)}
                        <span className="text-lg font-normal text-gray-600 dark:text-gray-400">
                          /{billingInterval === 'month' ? 'month' : 'year'}
                        </span>
                      </div>
                      {billingInterval === 'year' && (
                        <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                          Save {getYearlyDiscount(plan.price)} per year
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={plan.tier === currentTier || loadingPlan === plan.id}
                  className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${getPlanButtonStyle(plan)}`}
                >
                  {loadingPlan === plan.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {plan.tier === 'free' && <StarIcon size={16} />}
                      {plan.tier !== 'free' && plan.tier !== currentTier && <CreditCardIcon size={16} />}
                      {getPlanButtonText(plan)}
                      {plan.tier !== currentTier && <ArrowRightIcon size={16} />}
                    </>
                  )}
                </button>
              </div>

              {/* Features List */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-white text-center">
                  What's included:
                </h4>
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckIcon size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300 text-sm">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Limits Display for Free Plan */}
                {plan.tier === 'free' && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h5 className="font-medium text-gray-900 dark:text-white mb-3 text-sm">
                      Usage Limits:
                    </h5>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="text-center">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {plan.maxAccounts}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">Accounts</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {plan.maxTransactions}/mo
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">Transactions</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {plan.maxBudgets}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">Budgets</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {plan.maxGoals}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">Goals</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ or Additional Info */}
      <div className="mt-16 text-center">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Need help choosing?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
            Start with our free plan and upgrade anytime as your needs grow. 
            All paid plans include a 14-day free trial with full access to premium features.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <CheckIcon size={16} className="text-green-500" />
              Cancel anytime
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon size={16} className="text-green-500" />
              14-day free trial
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon size={16} className="text-green-500" />
              Secure payments
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon size={16} className="text-green-500" />
              Data export anytime
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}