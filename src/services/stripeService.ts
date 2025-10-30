/**
 * Stripe Service - Premium subscription management for WealthTracker
 * 
 * Features:
 * - Subscription creation and management
 * - Payment processing with Stripe Elements
 * - Webhook handling for real-time updates
 * - Feature access control
 * - Billing management
 */

import { loadStripe, Stripe } from '@stripe/stripe-js';
import type {
  SubscriptionTier,
  SubscriptionPlan,
  UserSubscription,
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  UpdateSubscriptionRequest,
  SubscriptionPreview,
  PaymentMethod,
  Invoice,
  BillingHistory,
  FeatureLimits
} from '../types/subscription';

export class StripeService {
  private static stripe: Promise<Stripe | null> | null = null;
  
  /**
   * Initialize Stripe with publishable key
   */
  static getStripe(): Promise<Stripe | null> {
    if (!this.stripe) {
      const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        throw new Error('Stripe publishable key not found in environment variables');
      }
      this.stripe = loadStripe(publishableKey);
    }
    return this.stripe;
  }

  /**
   * Get subscription plans configuration
   */
  static getSubscriptionPlans(): any[] {
    return [
      {
        id: 'free',
        name: 'Free',
        tier: 'free',
        description: 'Perfect for getting started with personal finance',
        price: 0,
        currency: 'gbp',
        interval: 'month',
        stripePriceId: '',
        features: [
          '5 accounts maximum',
          '100 transactions per month',
          '3 budgets',
          '3 financial goals',
          'Basic reporting',
          'Mobile app access'
        ],
        maxAccounts: 5,
        maxTransactions: 100,
        maxBudgets: 3,
        maxGoals: 3,
        advancedReports: false,
        csvExport: false,
        apiAccess: false,
        prioritySupport: false
      },
      {
        id: 'premium',
        name: 'Premium',
        tier: 'premium',
        description: 'Advanced features for serious financial management',
        price: 7.99,
        currency: 'gbp',
        interval: 'month',
        stripePriceId: import.meta.env.STRIPE_PREMIUM_PRICE_ID || '',
        features: [
          'Unlimited accounts',
          'Unlimited transactions',
          'Unlimited budgets',
          'Unlimited goals',
          'Advanced analytics',
          'CSV export',
          'Investment tracking',
          'Bill reminders',
          'Email support'
        ],
        isPopular: true,
        maxAccounts: -1, // Unlimited
        maxTransactions: -1,
        maxBudgets: -1,
        maxGoals: -1,
        advancedReports: true,
        csvExport: true,
        apiAccess: false,
        prioritySupport: false
      },
      {
        id: 'pro',
        name: 'Pro',
        tier: 'pro',
        description: 'Professional-grade tools for power users and businesses',
        price: 15.99,
        currency: 'gbp',
        interval: 'month',
        stripePriceId: import.meta.env.STRIPE_PRO_PRICE_ID || '',
        features: [
          'Everything in Premium',
          'API access',
          'Custom reports',
          'Advanced forecasting',
          'Multi-currency support',
          'Priority support',
          'Custom categories',
          'Bulk operations',
          'White-label options'
        ],
        maxAccounts: -1,
        maxTransactions: -1,
        maxBudgets: -1,
        maxGoals: -1,
        advancedReports: true,
        csvExport: true,
        apiAccess: true,
        prioritySupport: true
      }
    ];
  }

  /**
   * Get feature limits for a subscription tier
   */
  static getFeatureLimits(tier: SubscriptionTier): FeatureLimits {
    const plans = this.getSubscriptionPlans();
    const plan = plans.find(p => p.tier === tier);
    
    if (!plan) {
      // Default to free tier limits
      return {
        maxAccounts: 5,
        maxTransactions: 100,
        maxBudgets: 3,
        maxGoals: 3,
        advancedReports: false,
        csvExport: false,
        apiAccess: false,
        prioritySupport: false
      };
    }

    return {
      maxAccounts: plan.maxAccounts || 5,
      maxTransactions: plan.maxTransactions || 100,
      maxBudgets: plan.maxBudgets || 3,
      maxGoals: plan.maxGoals || 3,
      advancedReports: plan.advancedReports || false,
      csvExport: plan.csvExport || false,
      apiAccess: plan.apiAccess || false,
      prioritySupport: plan.prioritySupport || false
    };
  }

  /**
   * Check if a feature is available for the user's subscription tier
   */
  static hasFeatureAccess(
    userTier: SubscriptionTier,
    feature: keyof FeatureLimits
  ): boolean {
    const limits = this.getFeatureLimits(userTier);
    return limits[feature] === true || limits[feature] === -1;
  }

  /**
   * Check if user is within usage limits
   */
  static isWithinLimits(
    userTier: SubscriptionTier,
    currentUsage: number,
    limitType: 'maxAccounts' | 'maxTransactions' | 'maxBudgets' | 'maxGoals'
  ): boolean {
    const limits = this.getFeatureLimits(userTier);
    const limit = limits[limitType];
    
    // -1 means unlimited
    if (limit === -1) return true;
    
    return currentUsage < limit;
  }

  /**
   * Create a checkout session for subscription
   */
  static async createCheckoutSession(
    planType: 'premium' | 'pro',
    clerkToken: string
  ): Promise<{ sessionId: string; url: string }> {
    try {
      const response = await fetch('http://localhost:3000/api/subscriptions/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${clerkToken}`
        },
        body: JSON.stringify({
          planType,
          successUrl: `${window.location.origin}/subscription?success=true`,
          cancelUrl: `${window.location.origin}/subscription`
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to create checkout: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Create a new subscription (Legacy method for compatibility)
   */
  static async createSubscription(
    request: CreateSubscriptionRequest
  ): Promise<CreateSubscriptionResponse> {
    // This method is not used anymore - we use createCheckoutSession instead
    throw new Error('Use createCheckoutSession instead');
  }

  /**
   * Update an existing subscription
   */
  static async updateSubscription(
    subscriptionId: string,
    request: UpdateSubscriptionRequest
  ): Promise<UserSubscription> {
    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to update subscription: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<UserSubscription> {
    return this.updateSubscription(subscriptionId, { cancelAtPeriodEnd });
  }

  /**
   * Get subscription preview for plan change
   */
  static async getSubscriptionPreview(
    subscriptionId: string,
    newPriceId: string
  ): Promise<SubscriptionPreview> {
    try {
      const response = await fetch(
        `/api/subscriptions/${subscriptionId}/preview?priceId=${newPriceId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to get subscription preview: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting subscription preview:', error);
      throw error;
    }
  }

  /**
   * Get user's current subscription
   */
  static async getCurrentSubscription(clerkToken?: string): Promise<UserSubscription | null> {
    try {
      // If no token provided, we can't make the request
      if (!clerkToken) {
        console.warn('No authentication token provided');
        return null;
      }

      const response = await fetch('http://localhost:3000/api/subscriptions/status', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${clerkToken}`
        }
      });

      if (response.status === 404) {
        return null; // No subscription found
      }

      if (!response.ok) {
        throw new Error(`Failed to get current subscription: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success && data.data.hasSubscription) {
        return {
          id: data.data.subscriptionId,
          userId: '',
          tier: data.data.planType as SubscriptionTier,
          status: data.data.status,
          stripeCustomerId: data.data.customerId,
          stripeSubscriptionId: data.data.subscriptionId,
          currentPeriodStart: data.data.currentPeriodStart,
          currentPeriodEnd: data.data.currentPeriodEnd,
          trialEnd: data.data.trialEnd,
          cancelAtPeriodEnd: data.data.cancelAtPeriodEnd
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting current subscription:', error);
      throw error;
    }
  }

  /**
   * Get billing history
   */
  static async getBillingHistory(): Promise<BillingHistory> {
    try {
      const response = await fetch('/api/billing/history');

      if (!response.ok) {
        throw new Error(`Failed to get billing history: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting billing history:', error);
      throw error;
    }
  }

  /**
   * Add a new payment method
   */
  static async addPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
    try {
      const response = await fetch('/api/billing/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentMethodId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add payment method: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error adding payment method:', error);
      throw error;
    }
  }

  /**
   * Set default payment method
   */
  static async setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      const response = await fetch(`/api/billing/payment-methods/${paymentMethodId}/default`, {
        method: 'PUT',
      });

      if (!response.ok) {
        throw new Error(`Failed to set default payment method: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error setting default payment method:', error);
      throw error;
    }
  }

  /**
   * Remove a payment method
   */
  static async removePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      const response = await fetch(`/api/billing/payment-methods/${paymentMethodId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to remove payment method: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error removing payment method:', error);
      throw error;
    }
  }

  /**
   * Create a customer portal session for self-service billing
   */
  static async createPortalSession(): Promise<string> {
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to create portal session: ${response.statusText}`);
      }

      const { url } = await response.json();
      return url;
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw error;
    }
  }

  /**
   * Format price for display
   */
  static formatPrice(amount: number, currency: string = 'usd'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  }

  /**
   * Get plan by tier
   */
  static getPlanByTier(tier: SubscriptionTier): SubscriptionPlan | undefined {
    return this.getSubscriptionPlans().find(plan => plan.tier === tier);
  }

  /**
   * Check if tier is higher than current tier
   */
  static isUpgrade(currentTier: SubscriptionTier, newTier: SubscriptionTier): boolean {
    const tierOrder: SubscriptionTier[] = ['free', 'premium', 'pro'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const newIndex = tierOrder.indexOf(newTier);
    return newIndex > currentIndex;
  }

  /**
   * Check if tier is lower than current tier
   */
  static isDowngrade(currentTier: SubscriptionTier, newTier: SubscriptionTier): boolean {
    const tierOrder: SubscriptionTier[] = ['free', 'premium', 'pro'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const newIndex = tierOrder.indexOf(newTier);
    return newIndex < currentIndex;
  }
}

// Export default instance
export default StripeService;