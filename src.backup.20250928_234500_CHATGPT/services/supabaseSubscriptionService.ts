/**
 * Supabase Subscription Service - Database operations for subscription management
 *
 * Features:
 * - CRUD operations for subscription data
 * - Usage tracking and limits
 * - Payment method management
 * - Invoice history
 * - Feature access checks
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureSupabaseClient } from '../lib/supabase';
import { lazyLogger as logger } from './serviceFactory';
import type {
  UserSubscription,
  PaymentMethod,
  Invoice,
  SubscriptionUsage
} from '../types/subscription';

const SERVICE_PREFIX = '[SupabaseSubscriptionService]';

type SubscriptionSupabaseClient = SupabaseClient<any>;

export class SupabaseSubscriptionService {
  private static async getClient(context: string): Promise<SubscriptionSupabaseClient | null> {
    try {
      const client = await ensureSupabaseClient();
      if (!client || (client as any).__isStub) {
        logger.warn(`${SERVICE_PREFIX} Supabase unavailable during ${context}`);
        return null;
      }
      return client as SubscriptionSupabaseClient;
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Failed to resolve Supabase client for ${context}`, error);
      return null;
    }
  }

  /**
   * Get current subscription for a user
   */
  static async getCurrentSubscription(userId: string): Promise<UserSubscription | null> {
    const client = await this.getClient('getCurrentSubscription');
    if (!client) {
      return null;
    }

    try {
      const { data, error } = await client
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        userId: data.user_id,
        tier: data.tier,
        status: data.status,
        stripeCustomerId: data.stripe_customer_id,
        stripeSubscriptionId: data.stripe_subscription_id,
        stripePriceId: data.stripe_price_id,
        ...(data.current_period_start && { currentPeriodStart: new Date(data.current_period_start) }),
        ...(data.current_period_end && { currentPeriodEnd: new Date(data.current_period_end) }),
        ...(data.trial_start && { trialStart: new Date(data.trial_start) }),
        ...(data.trial_end && { trialEnd: new Date(data.trial_end) }),
        ...(data.cancelled_at && { cancelledAt: new Date(data.cancelled_at) }),
        cancelAtPeriodEnd: data.cancel_at_period_end,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error getting current subscription`, error);
      throw error;
    }
  }

  /**
   * Create or update subscription
   */
  static async upsertSubscription(subscription: Partial<UserSubscription>): Promise<UserSubscription> {
    const client = await this.getClient('upsertSubscription');
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    try {
      const subscriptionData = {
        user_id: subscription.userId,
        stripe_subscription_id: subscription.stripeSubscriptionId,
        stripe_customer_id: subscription.stripeCustomerId,
        stripe_price_id: subscription.stripePriceId,
        tier: subscription.tier,
        status: subscription.status,
        current_period_start: subscription.currentPeriodStart?.toISOString(),
        current_period_end: subscription.currentPeriodEnd?.toISOString(),
        trial_start: subscription.trialStart?.toISOString(),
        trial_end: subscription.trialEnd?.toISOString(),
        cancelled_at: subscription.cancelledAt?.toISOString(),
        cancel_at_period_end: subscription.cancelAtPeriodEnd
      };

      const { data, error } = await client
        .from('subscriptions')
        .upsert(subscriptionData, {
          onConflict: 'stripe_subscription_id'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        id: data.id,
        userId: data.user_id,
        tier: data.tier,
        status: data.status,
        stripeCustomerId: data.stripe_customer_id,
        stripeSubscriptionId: data.stripe_subscription_id,
        stripePriceId: data.stripe_price_id,
        ...(data.current_period_start && { currentPeriodStart: new Date(data.current_period_start) }),
        ...(data.current_period_end && { currentPeriodEnd: new Date(data.current_period_end) }),
        ...(data.trial_start && { trialStart: new Date(data.trial_start) }),
        ...(data.trial_end && { trialEnd: new Date(data.trial_end) }),
        ...(data.cancelled_at && { cancelledAt: new Date(data.cancelled_at) }),
        cancelAtPeriodEnd: data.cancel_at_period_end,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error upserting subscription`, error);
      throw error;
    }
  }

  /**
   * Get subscription usage for a user
   */
  static async getSubscriptionUsage(userId: string): Promise<SubscriptionUsage> {
    const client = await this.getClient('getSubscriptionUsage');
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    try {
      const { data, error } = await client
        .from('subscription_usage')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        const { data: newData, error: insertError } = await client
          .from('subscription_usage')
          .insert({
            user_id: userId,
            accounts_count: 0,
            transactions_count: 0,
            budgets_count: 0,
            goals_count: 0
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        return {
          accounts: newData.accounts_count,
          transactions: newData.transactions_count,
          budgets: newData.budgets_count,
          goals: newData.goals_count,
          lastCalculated: new Date(newData.last_calculated)
        };
      }

      return {
        accounts: data.accounts_count,
        transactions: data.transactions_count,
        budgets: data.budgets_count,
        goals: data.goals_count,
        lastCalculated: new Date(data.last_calculated)
      };
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error getting subscription usage`, error);
      throw error;
    }
  }

  /**
   * Update subscription usage
   */
  static async updateSubscriptionUsage(
    userId: string,
    usage: Partial<Omit<SubscriptionUsage, 'lastCalculated'>>
  ): Promise<void> {
    const client = await this.getClient('updateSubscriptionUsage');
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    try {
      const updateData: Record<string, unknown> = {
        last_calculated: new Date().toISOString()
      };

      if (usage.accounts !== undefined) updateData.accounts_count = usage.accounts;
      if (usage.transactions !== undefined) updateData.transactions_count = usage.transactions;
      if (usage.budgets !== undefined) updateData.budgets_count = usage.budgets;
      if (usage.goals !== undefined) updateData.goals_count = usage.goals;

      const { error } = await client
        .from('subscription_usage')
        .upsert(
          {
            user_id: userId,
            ...updateData
          },
          {
            onConflict: 'user_id'
          }
        );

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error updating subscription usage`, error);
      throw error;
    }
  }

  /**
   * Refresh usage counts from actual data
   */
  static async refreshUsageCounts(userId: string): Promise<void> {
    const client = await this.getClient('refreshUsageCounts');
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    try {
      const { error } = await client.rpc('update_usage_counts', {
        p_user_id: userId
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error refreshing usage counts`, error);
      throw error;
    }
  }

  /**
   * Check if user has access to a feature
   */
  static async hasFeatureAccess(userId: string, feature: string): Promise<boolean> {
    const client = await this.getClient('hasFeatureAccess');
    if (!client) {
      return false;
    }

    try {
      const { data, error } = await client.rpc('has_feature_access', {
        p_user_id: userId,
        p_feature: feature
      });

      if (error) {
        throw error;
      }
      return Boolean(data);
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error checking feature access`, error);
      return false;
    }
  }

  /**
   * Get payment methods for a user
   */
  static async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    const client = await this.getClient('getPaymentMethods');
    if (!client) {
      return [];
    }

    try {
      const { data, error } = await client
        .from('payment_methods')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map(pm => ({
        id: pm.stripe_payment_method_id,
        last4: pm.last4,
        brand: pm.brand,
        expiryMonth: pm.expiry_month,
        expiryYear: pm.expiry_year,
        isDefault: pm.is_default
      }));
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error getting payment methods`, error);
      throw error;
    }
  }

  /**
   * Add payment method
   */
  static async addPaymentMethod(
    userId: string,
    paymentMethod: Omit<PaymentMethod, 'isDefault'>
  ): Promise<void> {
    const client = await this.getClient('addPaymentMethod');
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    try {
      const { error } = await client
        .from('payment_methods')
        .insert({
          user_id: userId,
          stripe_payment_method_id: paymentMethod.id,
          last4: paymentMethod.last4,
          brand: paymentMethod.brand,
          expiry_month: paymentMethod.expiryMonth,
          expiry_year: paymentMethod.expiryYear,
          is_default: false
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error adding payment method`, error);
      throw error;
    }
  }

  /**
   * Set default payment method
   */
  static async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    const client = await this.getClient('setDefaultPaymentMethod');
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    try {
      await client
        .from('payment_methods')
        .update({ is_default: false })
        .eq('user_id', userId);

      const { error } = await client
        .from('payment_methods')
        .update({ is_default: true })
        .eq('user_id', userId)
        .eq('stripe_payment_method_id', paymentMethodId);

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error setting default payment method`, error);
      throw error;
    }
  }

  /**
   * Remove payment method
   */
  static async removePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    const client = await this.getClient('removePaymentMethod');
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    try {
      const { error } = await client
        .from('payment_methods')
        .delete()
        .eq('user_id', userId)
        .eq('stripe_payment_method_id', paymentMethodId);

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error removing payment method`, error);
      throw error;
    }
  }

  /**
   * Get invoices for a user
   */
  static async getInvoices(userId: string): Promise<Invoice[]> {
    const client = await this.getClient('getInvoices');
    if (!client) {
      return [];
    }

    try {
      const { data, error } = await client
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map(invoice => {
        const baseInvoice = {
          id: invoice.stripe_invoice_id,
          amount: parseFloat(invoice.amount),
          currency: invoice.currency,
          status: invoice.status,
          invoiceUrl: invoice.invoice_url,
          invoicePdf: invoice.invoice_pdf,
          description: invoice.description,
          createdAt: new Date(invoice.created_at)
        };

        const withPaidAt = invoice.paid_at
          ? { ...baseInvoice, paidAt: new Date(invoice.paid_at) }
          : baseInvoice;

        return invoice.due_date
          ? { ...withPaidAt, dueDate: new Date(invoice.due_date) }
          : withPaidAt;
      });
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error getting invoices`, error);
      throw error;
    }
  }

  /**
   * Add invoice
   */
  static async addInvoice(userId: string, invoice: Omit<Invoice, 'createdAt'>): Promise<void> {
    const client = await this.getClient('addInvoice');
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    try {
      const { error } = await client
        .from('invoices')
        .insert({
          user_id: userId,
          stripe_invoice_id: invoice.id,
          amount: invoice.amount,
          currency: invoice.currency,
          status: invoice.status,
          paid_at: invoice.paidAt?.toISOString(),
          due_date: invoice.dueDate?.toISOString(),
          invoice_url: invoice.invoiceUrl,
          invoice_pdf: invoice.invoicePdf,
          description: invoice.description
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error adding invoice`, error);
      throw error;
    }
  }

  /**
   * Create user profile (for new users)
   */
  static async createUserProfile(clerkUserId: string, email: string, fullName?: string): Promise<void> {
    const client = await this.getClient('createUserProfile');
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    try {
      const { error } = await client
        .from('user_profiles')
        .insert({
          clerk_user_id: clerkUserId,
          email,
          full_name: fullName,
          subscription_tier: 'free',
          subscription_status: 'active'
        });

      if (error && error.code !== '23505') {
        throw error;
      }
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error creating user profile`, error);
      throw error;
    }
  }

  /**
   * Get user profile by Clerk ID
   */
  static async getUserProfile(clerkUserId: string): Promise<any> {
    const client = await this.getClient('getUserProfile');
    if (!client) {
      return null;
    }

    try {
      const { data, error } = await client
        .from('user_profiles')
        .select('*')
        .eq('clerk_user_id', clerkUserId)
        .single();

      if (error) {
        throw error;
      }
      return data;
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error getting user profile`, error);
      throw error;
    }
  }
}

export default SupabaseSubscriptionService;
