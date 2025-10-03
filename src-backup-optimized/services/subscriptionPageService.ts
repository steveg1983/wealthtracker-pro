/**
 * Subscription Page Service
 * Business logic for subscription management
 */

import StripeService from './stripeService';
import { lazyLogger as logger } from './serviceFactory';
import type { SubscriptionPlan, UserSubscription } from '../types/subscription';

export type ViewMode = 'plans' | 'payment' | 'billing' | 'success';

interface CheckoutResult {
  success: boolean;
  url?: string;
  error?: string;
}

interface CancellationResult {
  success: boolean;
  error?: string;
}

class SubscriptionPageService {
  /**
   * Load current user subscription
   */
  async loadSubscription(token: string): Promise<UserSubscription | null> {
    try {
      return await StripeService.getCurrentSubscription(token);
    } catch (err) {
      logger.error('Error loading subscription:', err);
      throw new Error('Failed to load subscription information');
    }
  }

  /**
   * Create checkout session for paid plan
   */
  async createCheckout(
    plan: SubscriptionPlan,
    token: string
  ): Promise<CheckoutResult> {
    try {
      const { url } = await StripeService.createCheckoutSession(
        plan.tier as 'premium' | 'pro',
        token
      );
      
      return {
        success: !!url,
        url,
        error: url ? undefined : 'Failed to create checkout session'
      };
    } catch (err) {
      logger.error('Error creating checkout:', err);
      return {
        success: false,
        error: 'Failed to start checkout process'
      };
    }
  }

  /**
   * Cancel current subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    token: string
  ): Promise<CancellationResult> {
    try {
      const result = await StripeService.cancelSubscription(subscriptionId, token);
      return result;
    } catch (err) {
      logger.error('Error cancelling subscription:', err);
      return {
        success: false,
        error: 'Failed to cancel subscription. Please try again or contact support.'
      };
    }
  }

  /**
   * Handle free plan selection
   */
  async handleFreePlan(
    currentSubscription: UserSubscription | null,
    getToken: () => Promise<string | null>
  ): Promise<{ success: boolean; error?: string }> {
    if (!currentSubscription) {
      return { success: true };
    }

    const token = await getToken();
    if (!token) {
      return {
        success: false,
        error: 'Failed to get authentication token'
      };
    }

    if (!currentSubscription.stripeSubscriptionId) {
      return {
        success: false,
        error: 'No active subscription found'
      };
    }
    
    return this.cancelSubscription(currentSubscription.stripeSubscriptionId, token);
  }

  /**
   * Handle paid plan selection
   */
  async handlePaidPlan(
    plan: SubscriptionPlan,
    getToken: () => Promise<string | null>
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    const token = await getToken();
    if (!token) {
      return {
        success: false,
        error: 'Failed to get authentication token'
      };
    }

    const result = await this.createCheckout(plan, token);
    
    if (result.success && result.url) {
      window.location.href = result.url;
    }
    
    return result;
  }

  /**
   * Get current subscription tier
   */
  getCurrentTier(subscription: UserSubscription | null): string {
    return subscription?.tier || 'free';
  }

  /**
   * Determine initial view mode
   */
  getInitialView(
    defaultView: ViewMode,
    hasSubscription: boolean
  ): ViewMode {
    if (hasSubscription && defaultView === 'plans') {
      return 'billing';
    }
    return defaultView;
  }

  /**
   * Get view title
   */
  getViewTitle(view: ViewMode, planName?: string): string {
    const titles = {
      plans: 'Choose Your Plan',
      payment: `Upgrade to ${planName || 'Premium'}`,
      billing: 'Billing & Subscription',
      success: 'Welcome to Premium!'
    };
    return titles[view];
  }

  /**
   * Get premium features list
   */
  getPremiumFeatures(): string[] {
    return [
      'Unlimited accounts & transactions',
      'Advanced analytics & reports',
      'CSV export functionality',
      'Investment portfolio tracking',
      'Budget recommendations',
      'Financial goal tracking',
      'Priority support',
      'Data sync across devices'
    ];
  }

  /**
   * Validate authentication
   */
  validateAuth(isSignedIn: boolean, session: any): { valid: boolean; error?: string } {
    if (!isSignedIn) {
      return {
        valid: false,
        error: 'Please sign in to manage your subscription'
      };
    }
    
    if (!session) {
      return {
        valid: false,
        error: 'Authentication required. Please sign in again.'
      };
    }
    
    return { valid: true };
  }
}

export const subscriptionPageService = new SubscriptionPageService();