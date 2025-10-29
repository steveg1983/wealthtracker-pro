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

import { supabase } from '../lib/supabase';
import type { 
  UserSubscription, 
  SubscriptionTier, 
  SubscriptionStatus,
  PaymentMethod,
  Invoice,
  SubscriptionUsage 
} from '../types/subscription';

export class SupabaseSubscriptionService {
  /**
   * Get current subscription for a user
   */
  static async getCurrentSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      if (!data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        tier: data.tier,
        status: data.status,
        stripeCustomerId: data.stripe_customer_id,
        stripeSubscriptionId: data.stripe_subscription_id,
        stripePriceId: data.stripe_price_id,
        currentPeriodStart: data.current_period_start ? new Date(data.current_period_start) : undefined,
        currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : undefined,
        trialStart: data.trial_start ? new Date(data.trial_start) : undefined,
        trialEnd: data.trial_end ? new Date(data.trial_end) : undefined,
        cancelledAt: data.cancelled_at ? new Date(data.cancelled_at) : undefined,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      console.error('Error getting current subscription:', error);
      throw error;
    }
  }

  /**
   * Create or update subscription
   */
  static async upsertSubscription(subscription: Partial<UserSubscription>): Promise<UserSubscription> {
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

      const { data, error } = await supabase
        .from('subscriptions')
        .upsert(subscriptionData, {
          onConflict: 'stripe_subscription_id'
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        tier: data.tier,
        status: data.status,
        stripeCustomerId: data.stripe_customer_id,
        stripeSubscriptionId: data.stripe_subscription_id,
        stripePriceId: data.stripe_price_id,
        currentPeriodStart: data.current_period_start ? new Date(data.current_period_start) : undefined,
        currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : undefined,
        trialStart: data.trial_start ? new Date(data.trial_start) : undefined,
        trialEnd: data.trial_end ? new Date(data.trial_end) : undefined,
        cancelledAt: data.cancelled_at ? new Date(data.cancelled_at) : undefined,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      console.error('Error upserting subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription usage for a user
   */
  static async getSubscriptionUsage(userId: string): Promise<SubscriptionUsage> {
    try {
      const { data, error } = await supabase
        .from('subscription_usage')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        // Create initial usage record
        const { data: newData, error: insertError } = await supabase
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

        if (insertError) throw insertError;
        
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
      console.error('Error getting subscription usage:', error);
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
    try {
      const updateData: any = {
        last_calculated: new Date().toISOString()
      };

      if (usage.accounts !== undefined) updateData.accounts_count = usage.accounts;
      if (usage.transactions !== undefined) updateData.transactions_count = usage.transactions;
      if (usage.budgets !== undefined) updateData.budgets_count = usage.budgets;
      if (usage.goals !== undefined) updateData.goals_count = usage.goals;

      const { error } = await supabase
        .from('subscription_usage')
        .upsert({
          user_id: userId,
          ...updateData
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating subscription usage:', error);
      throw error;
    }
  }

  /**
   * Refresh usage counts from actual data
   */
  static async refreshUsageCounts(userId: string): Promise<void> {
    try {
      // Call the database function to update usage counts
      const { error } = await supabase.rpc('update_usage_counts', {
        p_user_id: userId
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error refreshing usage counts:', error);
      throw error;
    }
  }

  /**
   * Check if user has access to a feature
   */
  static async hasFeatureAccess(userId: string, feature: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('has_feature_access', {
        p_user_id: userId,
        p_feature: feature
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking feature access:', error);
      // Default to false for safety
      return false;
    }
  }

  /**
   * Get payment methods for a user
   */
  static async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(pm => ({
        id: pm.stripe_payment_method_id,
        last4: pm.last4,
        brand: pm.brand,
        expiryMonth: pm.expiry_month,
        expiryYear: pm.expiry_year,
        isDefault: pm.is_default
      }));
    } catch (error) {
      console.error('Error getting payment methods:', error);
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
    try {
      const { error } = await supabase
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

      if (error) throw error;
    } catch (error) {
      console.error('Error adding payment method:', error);
      throw error;
    }
  }

  /**
   * Set default payment method
   */
  static async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    try {
      // First, unset all as default
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('user_id', userId);

      // Then set the specified one as default
      const { error } = await supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('user_id', userId)
        .eq('stripe_payment_method_id', paymentMethodId);

      if (error) throw error;
    } catch (error) {
      console.error('Error setting default payment method:', error);
      throw error;
    }
  }

  /**
   * Remove payment method
   */
  static async removePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('user_id', userId)
        .eq('stripe_payment_method_id', paymentMethodId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing payment method:', error);
      throw error;
    }
  }

  /**
   * Get invoices for a user
   */
  static async getInvoices(userId: string): Promise<Invoice[]> {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(invoice => ({
        id: invoice.stripe_invoice_id,
        amount: parseFloat(invoice.amount),
        currency: invoice.currency,
        status: invoice.status,
        paidAt: invoice.paid_at ? new Date(invoice.paid_at) : undefined,
        dueDate: invoice.due_date ? new Date(invoice.due_date) : undefined,
        invoiceUrl: invoice.invoice_url,
        invoicePdf: invoice.invoice_pdf,
        description: invoice.description,
        createdAt: new Date(invoice.created_at)
      }));
    } catch (error) {
      console.error('Error getting invoices:', error);
      throw error;
    }
  }

  /**
   * Add invoice
   */
  static async addInvoice(userId: string, invoice: Omit<Invoice, 'createdAt'>): Promise<void> {
    try {
      const { error } = await supabase
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

      if (error) throw error;
    } catch (error) {
      console.error('Error adding invoice:', error);
      throw error;
    }
  }

  /**
   * Create user profile (for new users)
   */
  static async createUserProfile(clerkUserId: string, email: string, fullName?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .insert({
          clerk_user_id: clerkUserId,
          email: email,
          full_name: fullName,
          subscription_tier: 'free',
          subscription_status: 'active'
        });

      if (error && error.code !== '23505') { // 23505 = unique violation (user already exists)
        throw error;
      }
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  /**
   * Get user profile by Clerk ID
   */
  static async getUserProfile(clerkUserId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('clerk_user_id', clerkUserId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }
}

export default SupabaseSubscriptionService;