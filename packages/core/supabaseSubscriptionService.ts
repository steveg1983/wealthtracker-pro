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

import { ensureSupabaseClient, isSupabaseStub, type SupabaseDatabase } from './supabase';
import type { StructuredLogger } from './serviceFactory';
import { toDecimal } from '@wealthtracker/utils';
import type { UserSubscription, PaymentMethod, Invoice, SubscriptionUsage } from '@wealthtracker/types/subscription';

type SubscriptionLogger = Pick<StructuredLogger, 'debug' | 'info' | 'warn' | 'error'>;

export type { SubscriptionLogger };

const noop = (): void => {
  // noop
};

const createConsoleLogger = (): SubscriptionLogger => {
  if (typeof console === 'undefined') {
    return {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
    };
  }

  return {
    debug: (message: string, data?: unknown, source?: string) =>
      console.debug?.(source ? `[${source}] ${message}` : message, data ?? ''),
    info: (message: string, data?: unknown, source?: string) =>
      console.info?.(source ? `[${source}] ${message}` : message, data ?? ''),
    warn: (message: string, data?: unknown, source?: string) =>
      console.warn?.(source ? `[${source}] ${message}` : message, data ?? ''),
    error: (message: string, error?: unknown, source?: string) =>
      console.error?.(source ? `[${source}] ${message}` : message, error ?? ''),
  };
};

let logger: SubscriptionLogger = createConsoleLogger();

export const configureSupabaseSubscriptionLogger = (customLogger?: SubscriptionLogger): void => {
  logger = customLogger ?? createConsoleLogger();
};

const SERVICE_PREFIX = '[SupabaseSubscriptionService]';

type SubscriptionSupabaseClient = SupabaseDatabase;

type SubscriptionTier = UserSubscription['tier'];
type SubscriptionStatus = UserSubscription['status'];

const SUBSCRIPTION_TIERS: SubscriptionTier[] = ['free', 'premium', 'pro', 'business'];
const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'active',
  'cancelled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'trialing',
  'unpaid',
  'paused'
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const requireString = (record: Record<string, unknown>, field: string): string => {
  const value = record[field];
  if (typeof value === 'string') {
    return value;
  }
  throw new Error(`${SERVICE_PREFIX} Expected "${field}" to be a string`);
};

const optionalString = (record: Record<string, unknown>, field: string): string | undefined => {
  const value = record[field];
  return typeof value === 'string' ? value : undefined;
};

const requireBoolean = (record: Record<string, unknown>, field: string): boolean => {
  const value = record[field];
  if (typeof value === 'boolean') {
    return value;
  }
  throw new Error(`${SERVICE_PREFIX} Expected "${field}" to be a boolean`);
};

const optionalBoolean = (record: Record<string, unknown>, field: string): boolean | undefined => {
  const value = record[field];
  return typeof value === 'boolean' ? value : undefined;
};

const requireNumber = (record: Record<string, unknown>, field: string): number => {
  const value = record[field];
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  throw new Error(`${SERVICE_PREFIX} Expected "${field}" to be a finite number`);
};

const parseOptionalDate = (value: unknown, field: string): Date | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const source = typeof value === 'string' || typeof value === 'number' ? value : undefined;
  if (source === undefined) {
    throw new Error(`${SERVICE_PREFIX} Expected "${field}" to be a string or number`);
  }

  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${SERVICE_PREFIX} Invalid date value for "${field}"`);
  }
  return parsed;
};

const requireDate = (record: Record<string, unknown>, field: string): Date => {
  const value = record[field];
  const parsed = parseOptionalDate(value, field);
  if (!parsed) {
    throw new Error(`${SERVICE_PREFIX} Expected "${field}" to be a valid date`);
  }
  return parsed;
};

const isSubscriptionTier = (value: unknown): value is SubscriptionTier =>
  typeof value === 'string' && SUBSCRIPTION_TIERS.includes(value as SubscriptionTier);

const isSubscriptionStatus = (value: unknown): value is SubscriptionStatus =>
  typeof value === 'string' && SUBSCRIPTION_STATUSES.includes(value as SubscriptionStatus);

const mapSubscriptionRow = (raw: unknown): UserSubscription => {
  if (!isRecord(raw)) {
    throw new Error(`${SERVICE_PREFIX} Invalid subscription row`);
  }

  const id = requireString(raw, 'id');
  const userId = requireString(raw, 'user_id');

  const tierValue = raw.tier;
  if (!isSubscriptionTier(tierValue)) {
    throw new Error(`${SERVICE_PREFIX} Invalid subscription tier "${tierValue as string}"`);
  }

  const statusValue = raw.status;
  if (!isSubscriptionStatus(statusValue)) {
    throw new Error(`${SERVICE_PREFIX} Invalid subscription status "${statusValue as string}"`);
  }

  const stripeCustomerId = optionalString(raw, 'stripe_customer_id');
  const stripeSubscriptionId = optionalString(raw, 'stripe_subscription_id');
  const stripePriceId = optionalString(raw, 'stripe_price_id');
  const cancelAtPeriodEnd = optionalBoolean(raw, 'cancel_at_period_end');

  const createdAt = requireDate(raw, 'created_at');
  const updatedAt = requireDate(raw, 'updated_at');

  const currentPeriodStart = parseOptionalDate(raw.current_period_start, 'current_period_start');
  const currentPeriodEnd = parseOptionalDate(raw.current_period_end, 'current_period_end');
  const trialStart = parseOptionalDate(raw.trial_start, 'trial_start');
  const trialEnd = parseOptionalDate(raw.trial_end, 'trial_end');
  const cancelledAt = parseOptionalDate(raw.cancelled_at, 'cancelled_at');

  return {
    id,
    userId,
    tier: tierValue,
    status: statusValue,
    ...(stripeCustomerId ? { stripeCustomerId } : {}),
    ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
    ...(stripePriceId ? { stripePriceId } : {}),
    ...(currentPeriodStart ? { currentPeriodStart } : {}),
    ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
    ...(trialStart ? { trialStart } : {}),
    ...(trialEnd ? { trialEnd } : {}),
    ...(cancelledAt ? { cancelledAt } : {}),
    ...(cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd } : {}),
    createdAt,
    updatedAt
  };
};

const mapSubscriptionUsageRow = (raw: unknown): SubscriptionUsage => {
  if (!isRecord(raw)) {
    throw new Error(`${SERVICE_PREFIX} Invalid subscription usage row`);
  }

  const lastCalculated = parseOptionalDate(raw.last_calculated, 'last_calculated') ?? new Date();

  return {
    accounts: requireNumber(raw, 'accounts_count'),
    transactions: requireNumber(raw, 'transactions_count'),
    budgets: requireNumber(raw, 'budgets_count'),
    goals: requireNumber(raw, 'goals_count'),
    lastCalculated
  };
};

const mapPaymentMethodRow = (raw: unknown): PaymentMethod => {
  if (!isRecord(raw)) {
    throw new Error(`${SERVICE_PREFIX} Invalid payment method row`);
  }

  const id = requireString(raw, 'stripe_payment_method_id');
  const last4 = requireString(raw, 'last4');
  const brand = requireString(raw, 'brand');
  const expiryMonth = requireNumber(raw, 'expiry_month');
  const expiryYear = requireNumber(raw, 'expiry_year');
  const isDefault = requireBoolean(raw, 'is_default');

  return {
    id,
    last4,
    brand,
    expiryMonth,
    expiryYear,
    isDefault
  };
};

const INVOICE_STATUSES: Invoice['status'][] = ['draft', 'open', 'paid', 'uncollectible', 'void'];

const isInvoiceStatus = (value: unknown): value is Invoice['status'] =>
  typeof value === 'string' && INVOICE_STATUSES.includes(value as Invoice['status']);

const mapInvoiceRow = (raw: unknown): Invoice => {
  if (!isRecord(raw)) {
    throw new Error(`${SERVICE_PREFIX} Invalid invoice row`);
  }

  const id = requireString(raw, 'stripe_invoice_id');
  const amountRaw = raw.amount ?? 0;
  const currency = requireString(raw, 'currency');
  const statusValue = raw.status;
  if (!isInvoiceStatus(statusValue)) {
    throw new Error(`${SERVICE_PREFIX} Invalid invoice status "${statusValue as string}"`);
  }
  const invoiceUrl = optionalString(raw, 'invoice_url');
  const invoicePdf = optionalString(raw, 'invoice_pdf');
  const description = optionalString(raw, 'description');
  const createdAt = requireDate(raw, 'created_at');
  const paidAt = parseOptionalDate(raw.paid_at, 'paid_at');
  const dueDate = parseOptionalDate(raw.due_date, 'due_date');

  return {
    id,
    amount: toDecimal(amountRaw as number | string).toNumber(),
    currency,
    status: statusValue,
    ...(paidAt ? { paidAt } : {}),
    ...(dueDate ? { dueDate } : {}),
    ...(invoiceUrl ? { invoiceUrl } : {}),
    ...(invoicePdf ? { invoicePdf } : {}),
    ...(description ? { description } : {}),
    createdAt
  };
};

// Type guard to check if client is a stub
export class SupabaseSubscriptionService {
  private static async getClient(context: string): Promise<SubscriptionSupabaseClient | null> {
    try {
      const client = await ensureSupabaseClient();
      if (!client || isSupabaseStub(client)) {
        logger.warn(`${SERVICE_PREFIX} Supabase unavailable during ${context}`);
        return null;
      }
      return client;
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

      return mapSubscriptionRow(data);
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

    const userId = subscription.userId;
    if (!userId) {
      throw new Error('Subscription userId is required');
    }

    try {
      const subscriptionData = {
        user_id: userId,
        stripe_subscription_id: subscription.stripeSubscriptionId ?? null,
        stripe_customer_id: subscription.stripeCustomerId ?? null,
        stripe_price_id: subscription.stripePriceId ?? null,
        tier: subscription.tier ?? 'free',
        status: subscription.status ?? 'active',
        current_period_start: subscription.currentPeriodStart?.toISOString() ?? null,
        current_period_end: subscription.currentPeriodEnd?.toISOString() ?? null,
        trial_start: subscription.trialStart?.toISOString() ?? null,
        trial_end: subscription.trialEnd?.toISOString() ?? null,
        cancelled_at: subscription.cancelledAt?.toISOString() ?? null,
        cancel_at_period_end: subscription.cancelAtPeriodEnd ?? false
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

      return mapSubscriptionRow(data);
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

        return mapSubscriptionUsageRow(newData);
      }

      return mapSubscriptionUsageRow(data);
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

      return (data || []).map(mapPaymentMethodRow);
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

      return (data || []).map(mapInvoiceRow);
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
          paid_at: invoice.paidAt ? invoice.paidAt.toISOString() : null,
          due_date: invoice.dueDate ? invoice.dueDate.toISOString() : null,
          invoice_url: invoice.invoiceUrl ?? null,
          invoice_pdf: invoice.invoicePdf ?? null,
          description: invoice.description ?? null
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
          full_name: fullName ?? null,
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
  static async getUserProfile(clerkUserId: string): Promise<Record<string, unknown> | null> {
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
