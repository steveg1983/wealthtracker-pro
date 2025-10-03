import { createContext } from 'react';
import type { UserSubscription, SubscriptionTier, FeatureLimits, SubscriptionUsage } from '../types/subscription';
import type { ReactNode } from 'react';

export interface SubscriptionContextType {
  subscription: UserSubscription | null;
  tier: SubscriptionTier;
  limits: FeatureLimits;
  usage: SubscriptionUsage | null;
  subscriptionTier?: SubscriptionTier;
  billingCycle?: 'monthly' | 'yearly';
  nextBillingDate?: Date | string;
  cancelAtPeriodEnd?: boolean;
  isLoading: boolean;
  error: string | null;
  hasFeature: (feature: keyof FeatureLimits) => boolean;
  canUseFeature: (feature: 'accounts' | 'transactions' | 'budgets' | 'goals', currentCount: number) => boolean;
  getRemainingUsage: (feature: 'accounts' | 'transactions' | 'budgets' | 'goals') => number;
  refreshSubscription: () => Promise<void>;
  updateUsage: (usage: Partial<SubscriptionUsage>) => void;
  updateSubscription?: (tier: SubscriptionTier) => Promise<void>;
  cancelSubscription?: () => Promise<void>;
  reactivateSubscription?: () => Promise<void>;
}

export const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

