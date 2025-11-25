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
import { formatCurrency as formatCurrencyDecimal } from '../utils/currency-decimal';
import type {
  SubscriptionPlan,
  UserSubscription,
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  UpdateSubscriptionRequest,
  SubscriptionPreview,
  PaymentMethod,
  BillingHistory,
  FeatureLimits,
  SubscriptionProduct
} from '../types/subscription';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Logger = Pick<Console, 'warn' | 'error'>;

interface StripeServiceDependencies {
  fetch?: FetchLike | null;
  loadStripe?: typeof loadStripe;
  apiBaseUrl?: string | null;
  locationOrigin?: string | null;
  publishableKey?: string | null;
  premiumPriceId?: string | null;
  proPriceId?: string | null;
  logger?: Logger;
}

interface NormalizedDependencies {
  fetch: FetchLike | null;
  loadStripe: typeof loadStripe;
  apiBaseUrl: string;
  locationOrigin: string;
  publishableKey: string;
  premiumPriceId: string;
  proPriceId: string;
  logger: Logger;
}

export class StripeService {
  private static stripe: Promise<Stripe | null> | null = null;
  private static dependencies: NormalizedDependencies = StripeService.getDefaultDependencies();
  
  static configure(overrides: StripeServiceDependencies = {}): void {
    const normalized = StripeService.normalizeOverrides(overrides);
    this.dependencies = { ...this.dependencies, ...normalized };
    if (overrides.publishableKey !== undefined || overrides.loadStripe !== undefined) {
      this.stripe = null;
    }
  }

  static resetForTesting(): void {
    this.dependencies = StripeService.getDefaultDependencies();
    this.stripe = null;
  }

  private static getDefaultDependencies(): NormalizedDependencies {
    const globalFetch =
      typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null;
    const locationOrigin =
      typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:3000';
    const env = (typeof import.meta !== 'undefined' ? import.meta.env ?? {} : {}) as Record<string, string | undefined>;
    const logger = typeof console !== 'undefined' ? console : { warn: () => {}, error: () => {} };

    return {
      fetch: globalFetch,
      loadStripe,
      apiBaseUrl: env.VITE_API_BASE_URL ?? env.VITE_API_URL ?? 'http://localhost:3000',
      locationOrigin,
      publishableKey: env.VITE_STRIPE_PUBLISHABLE_KEY ?? '',
      premiumPriceId: env.VITE_STRIPE_PREMIUM_PRICE_ID ?? env.STRIPE_PREMIUM_PRICE_ID ?? '',
      proPriceId: env.VITE_STRIPE_PRO_PRICE_ID ?? env.STRIPE_PRO_PRICE_ID ?? '',
      logger
    };
  }

  private static normalizeOverrides(overrides: StripeServiceDependencies): Partial<NormalizedDependencies> {
    const normalized: Partial<NormalizedDependencies> = {};
    if (overrides.fetch !== undefined) {
      normalized.fetch = overrides.fetch;
    }
    if (overrides.loadStripe !== undefined) {
      normalized.loadStripe = overrides.loadStripe!;
    }
    if (overrides.apiBaseUrl !== undefined) {
      normalized.apiBaseUrl = overrides.apiBaseUrl ?? '';
    }
    if (overrides.locationOrigin !== undefined) {
      normalized.locationOrigin = overrides.locationOrigin ?? '';
    }
    if (overrides.publishableKey !== undefined) {
      normalized.publishableKey = overrides.publishableKey ?? '';
    }
    if (overrides.premiumPriceId !== undefined) {
      normalized.premiumPriceId = overrides.premiumPriceId ?? '';
    }
    if (overrides.proPriceId !== undefined) {
      normalized.proPriceId = overrides.proPriceId ?? '';
    }
    if (overrides.logger !== undefined) {
      normalized.logger = overrides.logger;
    }
    return normalized;
  }
  
  /**
   * Initialize Stripe with publishable key
   */
  static getStripe(): Promise<Stripe | null> {
    if (!this.stripe) {
      const publishableKey = this.dependencies.publishableKey;
      if (!publishableKey || publishableKey === '') {
        this.dependencies.logger.warn('Stripe publishable key not configured - payment features will be disabled');
        this.stripe = Promise.resolve(null);
        return this.stripe;
      }
      this.stripe = this.dependencies.loadStripe(publishableKey);
    }
    return this.stripe;
  }

  /**
   * Get subscription plans configuration
   */
  static getSubscriptionPlans(): SubscriptionProduct[] {
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
        accounts: 5,
        transactions: 100,
        budgets: 3,
        goals: 3,
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
        stripePriceId: this.dependencies.premiumPriceId || '',
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
        accounts: -1, // Unlimited
        transactions: -1,
        budgets: -1,
        goals: -1,
        advancedReports: true,
        csvExport: true,
        apiAccess: false,
        prioritySupport: false
      },
      {
        id: 'premium',
        name: 'Premium',
        tier: 'premium',
        description: 'Professional-grade tools for power users and businesses',
        price: 15.99,
        currency: 'gbp',
        interval: 'month',
        stripePriceId: this.dependencies.proPriceId || '',
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
        accounts: -1,
        transactions: -1,
        budgets: -1,
        goals: -1,
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
  static getFeatureLimits(tier: SubscriptionPlan): FeatureLimits {
    const plans = this.getSubscriptionPlans();
    const plan = plans.find(p => p.tier === tier);
    
    if (!plan) {
      // Default to free tier limits
      return {
        accounts: 5,
        transactions: 100,
        budgets: 3,
        goals: 3
      };
    }

    return {
      accounts: plan.maxAccounts || 5,
      transactions: plan.transactions || 100,
      budgets: plan.maxBudgets || 3,
      goals: plan.maxGoals || 3
    };
  }

  /**
   * Check if a feature is available for the user's subscription tier
   */
  static hasFeatureAccess(
    userTier: SubscriptionPlan,
    feature: keyof FeatureLimits
  ): boolean {
    const limits = this.getFeatureLimits(userTier);
    return limits[feature] === -1 || (limits[feature] as number) > 0;
  }

  /**
   * Check if user is within usage limits
   */
  static isWithinLimits(
    userTier: SubscriptionPlan,
    currentUsage: number,
    limitType: 'accounts' | 'transactions' | 'budgets' | 'goals'
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
      const fetchFn = this.ensureFetch();
      const response = await fetchFn(this.resolveUrl('/api/subscriptions/create-checkout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${clerkToken}`
        },
        body: JSON.stringify({
          planType,
          successUrl: `${this.dependencies.locationOrigin}/subscription?success=true`,
          cancelUrl: `${this.dependencies.locationOrigin}/subscription`
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to create checkout: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      this.dependencies.logger.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Create a new subscription (Legacy method for compatibility)
   */
  static async createSubscription(
    _request: CreateSubscriptionRequest
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
      const fetchFn = this.ensureFetch();
      const response = await fetchFn(this.resolveUrl(`/api/subscriptions/${subscriptionId}`), {
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
      this.dependencies.logger.error('Error updating subscription:', error);
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
      const fetchFn = this.ensureFetch();
      const response = await fetchFn(
        this.resolveUrl(`/api/subscriptions/${subscriptionId}/preview?priceId=${encodeURIComponent(newPriceId)}`)
      );

      if (!response.ok) {
        throw new Error(`Failed to get subscription preview: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      this.dependencies.logger.error('Error getting subscription preview:', error);
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
        this.dependencies.logger.warn('No authentication token provided');
        return null;
      }

      const fetchFn = this.ensureFetch();
      const response = await fetchFn(this.resolveUrl('/api/subscriptions/status'), {
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
          plan: data.data.planType as SubscriptionPlan,
          tier: data.data.planType as SubscriptionPlan,
          status: data.data.status,
          stripeCustomerId: data.data.customerId,
          stripeSubscriptionId: data.data.subscriptionId,
          currentPeriodStart: data.data.currentPeriodStart,
          currentPeriodEnd: data.data.currentPeriodEnd,
          trialEnd: data.data.trialEnd,
          cancelAtPeriodEnd: data.data.cancelAtPeriodEnd,
          billingPeriod: 'monthly',
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
      return null;
    } catch (error) {
      this.dependencies.logger.error('Error getting current subscription:', error);
      throw error;
    }
  }

  /**
   * Get billing history
   */
  static async getBillingHistory(): Promise<BillingHistory> {
    try {
      const fetchFn = this.ensureFetch();
      const response = await fetchFn(this.resolveUrl('/api/billing/history'));

      if (!response.ok) {
        throw new Error(`Failed to get billing history: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      this.dependencies.logger.error('Error getting billing history:', error);
      throw error;
    }
  }

  /**
   * Add a new payment method
   */
  static async addPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
    try {
      const fetchFn = this.ensureFetch();
      const response = await fetchFn(this.resolveUrl('/api/billing/payment-methods'), {
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
      this.dependencies.logger.error('Error adding payment method:', error);
      throw error;
    }
  }

  /**
   * Set default payment method
   */
  static async setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      const fetchFn = this.ensureFetch();
      const response = await fetchFn(this.resolveUrl(`/api/billing/payment-methods/${paymentMethodId}/default`), {
        method: 'PUT',
      });

      if (!response.ok) {
        throw new Error(`Failed to set default payment method: ${response.statusText}`);
      }
    } catch (error) {
      this.dependencies.logger.error('Error setting default payment method:', error);
      throw error;
    }
  }

  /**
   * Remove a payment method
   */
  static async removePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      const fetchFn = this.ensureFetch();
      const response = await fetchFn(this.resolveUrl(`/api/billing/payment-methods/${paymentMethodId}`), {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to remove payment method: ${response.statusText}`);
      }
    } catch (error) {
      this.dependencies.logger.error('Error removing payment method:', error);
      throw error;
    }
  }

  /**
   * Create a customer portal session for self-service billing
   */
  static async createPortalSession(): Promise<string> {
    try {
      const fetchFn = this.ensureFetch();
      const response = await fetchFn(this.resolveUrl('/api/billing/portal'), {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to create portal session: ${response.statusText}`);
      }

      const { url } = await response.json();
      return url;
    } catch (error) {
      this.dependencies.logger.error('Error creating portal session:', error);
      throw error;
    }
  }

  /**
   * Format price for display
   */
  static formatPrice(amount: number, currency: string = 'usd'): string {
    return formatCurrencyDecimal(amount, currency.toUpperCase());
  }

  /**
   * Get plan by tier
   */
  static getPlanByTier(tier: SubscriptionPlan): SubscriptionProduct | undefined {
    return this.getSubscriptionPlans().find(plan => plan.tier === tier);
  }

  /**
   * Check if tier is higher than current tier
   */
  static isUpgrade(currentTier: SubscriptionPlan, newTier: SubscriptionPlan): boolean {
    const tierOrder: SubscriptionPlan[] = ['free', 'basic', 'premium', 'enterprise'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const newIndex = tierOrder.indexOf(newTier);
    return newIndex > currentIndex;
  }

  /**
   * Check if tier is lower than current tier
   */
  static isDowngrade(currentTier: SubscriptionPlan, newTier: SubscriptionPlan): boolean {
    const tierOrder: SubscriptionPlan[] = ['free', 'basic', 'premium', 'enterprise'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const newIndex = tierOrder.indexOf(newTier);
    return newIndex < currentIndex;
  }

  private static ensureFetch(): FetchLike {
    if (!this.dependencies.fetch) {
      throw new Error('Fetch API is not available. Provide a fetch implementation via StripeService.configure.');
    }
    return this.dependencies.fetch;
  }

  private static resolveUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    const base = (this.dependencies.apiBaseUrl ?? '').replace(/\/+$/, '');
    if (!path) {
      return base;
    }
    if (path.startsWith('/')) {
      return `${base}${path}`;
    }
    return `${base}/${path}`;
  }
}

// Export default instance
export default StripeService;
