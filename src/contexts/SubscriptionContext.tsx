/**
 * Subscription Context - Manage subscription state and feature access
 * 
 * Features:
 * - Current subscription status
 * - Feature access control
 * - Usage limits tracking
 * - Real-time subscription updates
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from '@clerk/clerk-react';
import { userIdService } from '../services/userIdService';
import StripeService from '../services/stripeService';
import SubscriptionApiService from '../services/subscriptionApiService';
import { logger } from '../services/loggingService';
import type { 
  UserSubscription, 
  SubscriptionTier, 
  FeatureLimits,
  SubscriptionUsage 
} from '../types/subscription';

interface SubscriptionContextType {
  // Subscription state
  subscription: UserSubscription | null;
  tier: SubscriptionTier;
  limits: FeatureLimits;
  usage: SubscriptionUsage | null;
  subscriptionTier?: SubscriptionTier;
  billingCycle?: 'monthly' | 'yearly';
  nextBillingDate?: Date | string;
  cancelAtPeriodEnd?: boolean;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Feature access methods
  hasFeature: (feature: keyof FeatureLimits) => boolean;
  canUseFeature: (feature: 'accounts' | 'transactions' | 'budgets' | 'goals', currentCount: number) => boolean;
  getRemainingUsage: (feature: 'accounts' | 'transactions' | 'budgets' | 'goals') => number;
  
  // Actions
  refreshSubscription: () => Promise<void>;
  updateUsage: (usage: Partial<SubscriptionUsage>) => void;
  updateSubscription?: (tier: SubscriptionTier) => Promise<void>;
  cancelSubscription?: () => Promise<void>;
  reactivateSubscription?: () => Promise<void>;
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
  }, [isSignedIn, user]);

  const loadSubscriptionData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const subscriptionData = await SubscriptionApiService.getCurrentSubscription(user!.id);
      setSubscription(subscriptionData);
      
      // Load usage data from localStorage or API
      const savedUsage = localStorage.getItem(`usage_${user?.id}`);
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
  };

  const refreshSubscription = async () => {
    await loadSubscriptionData();
  };

  const updateUsage = (newUsage: Partial<SubscriptionUsage>) => {
    const updatedUsage = {
      ...usage,
      ...newUsage,
      lastCalculated: new Date()
    } as SubscriptionUsage;
    
    setUsage(updatedUsage);
    
    // Save to localStorage
    if (user?.id) {
      localStorage.setItem(`usage_${user.id}`, JSON.stringify(updatedUsage));
    }
  };

  const hasFeature = (feature: keyof FeatureLimits): boolean => {
    return StripeService.hasFeatureAccess(tier, feature);
  };

  const canUseFeature = (
    feature: 'accounts' | 'transactions' | 'budgets' | 'goals',
    currentCount: number
  ): boolean => {
    const limitKey = `max${feature.charAt(0).toUpperCase() + feature.slice(1)}` as keyof FeatureLimits;
    return StripeService.isWithinLimits(tier, currentCount, limitKey as any);
  };

  const getRemainingUsage = (
    feature: 'accounts' | 'transactions' | 'budgets' | 'goals'
  ): number => {
    if (!usage) return 0;
    
    const limitKey = `max${feature.charAt(0).toUpperCase() + feature.slice(1)}` as keyof FeatureLimits;
    const limit = limits[limitKey] as number;
    const currentUsage = usage[feature];
    
    // -1 means unlimited
    if (limit === -1) return Infinity;
    
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
  feature: keyof FeatureLimits;
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
  feature: 'accounts' | 'transactions' | 'budgets' | 'goals'
) {
  const { canUseFeature, getRemainingUsage, limits, usage } = useSubscription();
  
  const currentUsage = usage?.[feature] || 0;
  const canAdd = canUseFeature(feature, currentUsage + 1);
  const remaining = getRemainingUsage(feature);
  const limitKey = `max${feature.charAt(0).toUpperCase() + feature.slice(1)}` as keyof FeatureLimits;
  const limit = limits[limitKey] as number;
  const isUnlimited = limit === -1;
  
  return {
    canAdd,
    remaining,
    limit,
    isUnlimited,
    currentUsage,
    percentUsed: isUnlimited ? 0 : (currentUsage / limit) * 100
  };
}