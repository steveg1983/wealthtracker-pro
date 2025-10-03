import StripeService from './stripeService';
import { lazyLogger as logger } from './serviceFactory';
import type { 
  UserSubscription, 
  BillingHistory, 
  PaymentMethod,
  SubscriptionTier,
  Invoice 
} from '../types/subscription';

export interface BillingData {
  subscription: UserSubscription | null;
  billingHistory: BillingHistory | null;
}

export interface StatusConfig {
  color: string;
  icon: any;
}

/**
 * Service for managing billing dashboard operations
 */
export class BillingDashboardService {
  /**
   * Load all billing data
   */
  static async loadBillingData(): Promise<BillingData> {
    try {
      const [subscription, billingHistory] = await Promise.all([
        StripeService.getCurrentSubscription(),
        StripeService.getBillingHistory()
      ]);
      
      return { subscription, billingHistory };
    } catch (error) {
      logger.error('Error loading billing data:', error);
      throw new Error('Failed to load billing information');
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(subscriptionId: string, clerkToken: string): Promise<void> {
    try {
      await StripeService.cancelSubscription(subscriptionId, clerkToken, true);
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Create billing portal session
   */
  static async createPortalSession(): Promise<string> {
    try {
      return await StripeService.createPortalSession();
    } catch (error) {
      logger.error('Error creating portal session:', error);
      throw new Error('Failed to open billing portal');
    }
  }

  /**
   * Get status badge configuration
   */
  static getStatusConfig(status: string): StatusConfig {
    const statusConfigs = {
      active: { 
        color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200', 
        icon: 'CheckCircleIcon' 
      },
      trialing: { 
        color: 'bg-blue-100 text-blue-800 dark:bg-gray-900/20 dark:text-blue-200', 
        icon: 'CheckCircleIcon' 
      },
      past_due: { 
        color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200', 
        icon: 'AlertTriangleIcon' 
      },
      cancelled: { 
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', 
        icon: 'AlertTriangleIcon' 
      },
    };

    return statusConfigs[status as keyof typeof statusConfigs] || statusConfigs.cancelled;
  }

  /**
   * Format date for display
   */
  static formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Format price for display
   */
  static formatPrice(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Get tier display name
   */
  static getTierDisplayName(tier: SubscriptionTier): string {
    const plan = StripeService.getPlanByTier(tier);
    return plan?.name || tier;
  }

  /**
   * Check if subscription is ending
   */
  static isSubscriptionEnding(subscription: UserSubscription): boolean {
    return subscription.cancelAtPeriodEnd === true;
  }

  /**
   * Check if in trial period
   */
  static isInTrial(subscription: UserSubscription): boolean {
    return subscription.status === 'trialing';
  }

  /**
   * Get trial end date
   */
  static getTrialEndDate(subscription: UserSubscription): Date | null {
    return subscription.trialEnd || null;
  }

  /**
   * Get next billing date
   */
  static getNextBillingDate(subscription: UserSubscription): Date | null {
    return subscription.currentPeriodEnd || null;
  }

  /**
   * Check if has payment methods
   */
  static hasPaymentMethods(billingHistory: BillingHistory | null): boolean {
    return !!(billingHistory?.paymentMethods && billingHistory.paymentMethods.length > 0);
  }

  /**
   * Check if has invoices
   */
  static hasInvoices(billingHistory: BillingHistory | null): boolean {
    return !!(billingHistory?.invoices && billingHistory.invoices.length > 0);
  }

  /**
   * Get default payment method
   */
  static getDefaultPaymentMethod(methods: PaymentMethod[]): PaymentMethod | undefined {
    return methods.find(m => m.isDefault);
  }

  /**
   * Format card display
   */
  static formatCardDisplay(method: PaymentMethod): string {
    return `•••• •••• •••• ${method.last4}`;
  }

  /**
   * Format card expiry
   */
  static formatCardExpiry(method: PaymentMethod): string {
    return `${method.brand.toUpperCase()} • Expires ${method.expiryMonth}/${method.expiryYear}`;
  }

  /**
   * Get invoice status color
   */
  static getInvoiceStatusColor(status: string): string {
    return status === 'paid' 
      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
  }
}