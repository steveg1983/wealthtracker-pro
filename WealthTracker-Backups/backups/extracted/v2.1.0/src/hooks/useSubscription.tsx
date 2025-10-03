/**
 * useSubscription Hook - Check subscription status and feature access
 */

import { useState, useEffect } from 'react';
import { useSession } from '@clerk/clerk-react';
import StripeService from '../services/stripeService';
import type { UserSubscription, SubscriptionTier } from '../types/subscription';
import { logger } from '../services/loggingService';

interface UseSubscriptionReturn {
  subscription: UserSubscription | null;
  tier: SubscriptionTier;
  isLoading: boolean;
  error: string | null;
  hasFeatureAccess: (feature: string) => boolean;
  isWithinLimits: (usage: number, limitType: string) => boolean;
  canUpgrade: boolean;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const { session } = useSession();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      loadSubscription();
    } else {
      setIsLoading(false);
    }
  }, [session]);

  const loadSubscription = async () => {
    if (!session) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await session.getToken();
      if (token) {
        const sub = await StripeService.getCurrentSubscription(token);
        setSubscription(sub);
      }
    } catch (err) {
      logger.error('Failed to load subscription:', err);
      setError('Failed to load subscription information');
    } finally {
      setIsLoading(false);
    }
  };

  const tier: SubscriptionTier = subscription?.tier || 'free';

  const hasFeatureAccess = (feature: string): boolean => {
    const featureTiers: Record<string, SubscriptionTier[]> = {
      // Basic features (all tiers)
      'basic_accounts': ['free', 'premium', 'pro'],
      'basic_transactions': ['free', 'premium', 'pro'],
      'basic_budgets': ['free', 'premium', 'pro'],
      'basic_goals': ['free', 'premium', 'pro'],
      'basic_reports': ['free', 'premium', 'pro'],
      
      // Premium features
      'unlimited_accounts': ['premium', 'pro'],
      'unlimited_transactions': ['premium', 'pro'],
      'unlimited_budgets': ['premium', 'pro'],
      'unlimited_goals': ['premium', 'pro'],
      'advanced_analytics': ['premium', 'pro'],
      'csv_export': ['premium', 'pro'],
      'investment_tracking': ['premium', 'pro'],
      'bank_connections': ['premium', 'pro'],
      'bill_reminders': ['premium', 'pro'],
      
      // Pro features
      'api_access': ['pro'],
      'custom_reports': ['pro'],
      'advanced_forecasting': ['pro'],
      'multi_currency': ['pro'],
      'priority_support': ['pro'],
      'white_label': ['pro'],
      'bulk_operations': ['pro']
    };

    const allowedTiers = featureTiers[feature];
    if (!allowedTiers) return false;

    return allowedTiers.includes(tier);
  };

  const isWithinLimits = (usage: number, limitType: string): boolean => {
    const limits = StripeService.getFeatureLimits(tier);
    
    switch (limitType) {
      case 'accounts':
        return limits.maxAccounts === -1 || usage < limits.maxAccounts;
      case 'transactions':
        return limits.maxTransactions === -1 || usage < limits.maxTransactions;
      case 'budgets':
        return limits.maxBudgets === -1 || usage < limits.maxBudgets;
      case 'goals':
        return limits.maxGoals === -1 || usage < limits.maxGoals;
      default:
        return true;
    }
  };

  const canUpgrade = tier !== 'pro';

  return {
    subscription,
    tier,
    isLoading,
    error,
    hasFeatureAccess,
    isWithinLimits,
    canUpgrade,
    refresh: loadSubscription
  };
}

/**
 * Component to wrap premium features
 */
interface PremiumFeatureProps {
  feature: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PremiumFeature({ feature, fallback, children }: PremiumFeatureProps) {
  const { hasFeatureAccess } = useSubscription();

  if (!hasFeatureAccess(feature)) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This feature requires a premium subscription
        </p>
        <a
          href="/subscription"
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
        >
          Upgrade Now
        </a>
      </div>
    );
  }

  return <>{children}</>;
}

