/* eslint-disable react-refresh/only-export-components */
/**
 * Subscription Context - Manage subscription state and feature access
 * 
 * Features:
 * - Current subscription status
 * - Feature access control
 * - Usage limits tracking
 * - Real-time subscription updates
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useUser } from '@clerk/clerk-react';
import { userIdService } from '../services/userIdService';
import StripeService from '../services/stripeService';
import SubscriptionApiService from '../services/subscriptionApiService';
import { logger } from '../services/loggingService';
import type { 
  UserSubscription, 
  SubscriptionTier, 
  FeatureLimits,
  SubscriptionUsage,
  FeatureFlag
} from '@app-types/subscription';

type UsageFeature = 'accounts' | 'transactions' | 'budgets' | 'goals';

const FEATURE_LIMIT_KEYS: Record<UsageFeature, 'maxAccounts' | 'maxTransactions' | 'maxBudgets' | 'maxGoals'> = {
  accounts: 'maxAccounts',
  transactions: 'maxTransactions',
  budgets: 'maxBudgets',
  goals: 'maxGoals'
};

interface SubscriptionContextType {
  // Subscription state
  subscription: UserSubscription | null;
  tier: SubscriptionTier;
  limits: FeatureLimits;
  usage: SubscriptionUsage | null;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Feature access methods
  hasFeature: (feature: FeatureFlag) => boolean;
  canUseFeature: (feature: UsageFeature, currentCount: number) => boolean;
  getRemainingUsage: (feature: UsageFeature) => number;
  
  // Actions
  refreshSubscription: () => Promise<void>;
  updateUsage: (usage: Partial<SubscriptionUsage>) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps): React.JSX.Element {
  const { user, isSignedIn } = useUser();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get current tier
  const tier: SubscriptionTier = subscription?.tier || 'free';
  
  // Get feature limits for current tier
  const limits = StripeService.getFeatureLimits(tier);

  const loadSubscriptionData = useCallback(async () => {
    if (!user) {
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const subscriptionData = await SubscriptionApiService.getCurrentSubscription(user.id);
      setSubscription(subscriptionData);
      
      // Load usage data from localStorage or API
      const savedUsage = localStorage.getItem(`usage_${user.id}`);
      if (savedUsage) {
        setUsage(JSON.parse(savedUsage));
      } else {
        // Initialize with default usage
        const defaultUsage: SubscriptionUsage = {
          accounts: 0,
          transactions: 0,
          budgets: 0,
          goals: 0,
          lastCalculated: new Date()
        };
        setUsage(defaultUsage);
      }
    } catch (err) {
      logger.error('Error loading subscription data:', err);
      setError('Failed to load subscription information');
      
      // Set free tier as fallback
      setSubscription(null);
      const defaultUsage: SubscriptionUsage = {
        accounts: 0,
        transactions: 0,
        budgets: 0,
        goals: 0,
        lastCalculated: new Date()
      };
      setUsage(defaultUsage);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isSignedIn && user) {
      // Ensure user exists in database first
      const initializeUser = async () => {
        const databaseId = await userIdService.ensureUserExists(
          user.id,
          user.primaryEmailAddress?.emailAddress || '',
          user.firstName || undefined,
          user.lastName || undefined
        );

        if (databaseId) {
          // Initialize user profile if needed
          SubscriptionApiService.initializeUserProfile(
            user.id,
            user.primaryEmailAddress?.emailAddress || '',
            user.fullName || undefined
          ).then(() => {
            loadSubscriptionData();
          }).catch(() => {
            // Profile might already exist, just load data
            loadSubscriptionData();
          });
        }
      };

      initializeUser();
    } else {
      // Reset state when signed out
      setSubscription(null);
      setUsage(null);
      setIsLoading(false);
      setError(null);
    }
  }, [isSignedIn, loadSubscriptionData, user]);

  const refreshSubscription = async () => {
    await loadSubscriptionData();
  };

  const updateUsage = (newUsage: Partial<SubscriptionUsage>) => {
    const baseUsage: SubscriptionUsage = usage ?? {
      accounts: 0,
      transactions: 0,
      budgets: 0,
      goals: 0,
      lastCalculated: new Date()
    };

    const updatedUsage: SubscriptionUsage = {
      ...baseUsage,
      ...newUsage,
      lastCalculated: new Date()
    };
    
    setUsage(updatedUsage);
    
    // Save to localStorage
    if (user?.id) {
      localStorage.setItem(`usage_${user.id}`, JSON.stringify(updatedUsage));
    }
  };

  const hasFeature = (feature: FeatureFlag): boolean => {
    return StripeService.hasFeatureAccess(tier, feature);
  };

  const canUseFeature = (
    feature: UsageFeature,
    currentCount: number
  ): boolean => {
    const limitKey = FEATURE_LIMIT_KEYS[feature];
    const limit = limits[limitKey];
    if (typeof limit !== 'number') {
      return true;
    }
    return StripeService.isWithinLimits(tier, currentCount, limitKey);
  };

  const getRemainingUsage = (
    feature: UsageFeature
  ): number => {
    if (!usage) return 0;
    
    const limitKey = FEATURE_LIMIT_KEYS[feature];
  const limit = limits[limitKey];
  const currentUsage = usage[feature];
  
  // -1 means unlimited
  if (typeof limit !== 'number' || limit === -1) return Infinity;
    
  return Math.max(0, limit - currentUsage);
  };

  const contextValue: SubscriptionContextType = {
    subscription,
    tier,
    limits,
    usage,
    isLoading,
    error,
    hasFeature,
    canUseFeature,
    getRemainingUsage,
    refreshSubscription,
    updateUsage
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// Custom hook for using subscription context
export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

// HOC for feature gating components
interface WithFeatureGateProps {
  feature: FeatureFlag;
  fallback?: ReactNode;
  children: ReactNode;
}

export function FeatureGate({ feature, fallback, children }: WithFeatureGateProps): React.JSX.Element {
  const { hasFeature } = useSubscription();
  
  if (!hasFeature(feature)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
        <div className="text-gray-600 dark:text-gray-400">
          <h3 className="font-medium mb-2">Premium Feature</h3>
          <p className="text-sm mb-4">
            This feature is available with a Premium or Pro subscription.
          </p>
          <button
            onClick={() => window.location.href = '/subscription'}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

// Hook for usage limits
export function useUsageLimit(
  feature: UsageFeature
) {
  const { canUseFeature, getRemainingUsage, limits, usage } = useSubscription();
  
  const currentUsage = usage?.[feature] || 0;
  const canAdd = canUseFeature(feature, currentUsage + 1);
  const remaining = getRemainingUsage(feature);
  const limitKey = FEATURE_LIMIT_KEYS[feature];
  const limit = limits[limitKey];
  const numericLimit = typeof limit === 'number' ? limit : -1;
  const isUnlimited = numericLimit === -1;
  
  return {
    canAdd,
    remaining,
    limit: numericLimit,
    isUnlimited,
    currentUsage,
    percentUsed:
      isUnlimited || numericLimit === 0
        ? 0
        : (currentUsage / numericLimit) * 100
  };
}
