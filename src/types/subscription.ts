// Subscription types

export type SubscriptionPlan = 'free' | 'basic' | 'premium' | 'enterprise';
export type BillingPeriod = 'monthly' | 'yearly';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';
export type SubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  tier?: SubscriptionPlan; // Alias for plan for backward compatibility
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  trialStart?: Date;
  trialEnd?: Date;
  cancelledAt?: Date;
}

// Alias for compatibility
export type UserSubscription = Subscription;

// Subscription tier with extended properties
export interface SubscriptionTier {
  id: string;
  name: string;
  plan: SubscriptionPlan;
  displayName: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: string[];
  limits: FeatureLimits;
  highlighted?: boolean;
  popular?: boolean;
}

export interface SubscriptionProduct {
  id: string;
  name: string;
  tier: SubscriptionPlan;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  stripePriceId?: string;
  features: string[];
  isPopular?: boolean;
  accounts?: number;
  maxAccounts?: number;
  transactions?: number;
  budgets?: number;
  maxBudgets?: number;
  goals?: number;
  maxGoals?: number;
  advancedReports?: boolean;
  csvExport?: boolean;
  apiAccess?: boolean;
  prioritySupport?: boolean;
}

// Feature limits for each plan
export interface FeatureLimits {
  accounts: number;
  transactions: number;
  budgets: number;
  goals: number;
  categories?: number;
  tags?: number;
  attachments?: number;
  customReports?: number;
  apiCalls?: number;
  teamMembers?: number;
}

// Billing history entry
export interface BillingInvoice {
  id: string;
  amount: number;
  currency?: string;
  status: PaymentStatus | string;
  description?: string | null;
  createdAt: Date | string;
  dueDate?: Date | string;
  paidAt?: Date | string;
  invoiceUrl?: string | null;
  invoicePdf?: string | null;
}

export interface BillingHistory {
  invoices: BillingInvoice[];
  paymentMethods: PaymentMethod[];
  nextBillingDate?: Date | string | null;
  totalPaid?: number;
  totalPaidCurrency?: string | null;
}

export interface PricingPlan {
  id: string;
  name: string;
  plan: SubscriptionPlan;
  price: {
    monthly: number;
    yearly: number;
  };
  features: string[];
  limits: FeatureLimits;
  highlighted?: boolean;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  last4: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  subscriptionId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus | string;
  dueDate?: Date;
  paidAt?: Date;
  invoiceUrl?: string | null;
  invoicePdf?: string | null;
  description?: string | null;
  createdAt?: Date;
}

export interface UsageMetrics {
  accounts: number;
  transactions: number;
  budgets: number;
  goals: number;
  storage: number; // in MB
}

export interface BillingDetails {
  name: string;
  email: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  taxId?: string;
}

// Subscription usage tracking
export interface SubscriptionUsage {
  subscriptionId: string;
  period: {
    start: Date;
    end: Date;
  };
  usage: UsageMetrics;
  limits: FeatureLimits;
  percentageUsed: {
    accounts: number;
    transactions: number;
    budgets: number;
    goals: number;
    storage: number;
  };
}

// API Request/Response types
export interface CreateSubscriptionRequest {
  userId: string;
  plan: SubscriptionPlan;
  billingPeriod: BillingPeriod;
  paymentMethodId?: string;
}

export interface CreateSubscriptionResponse {
  subscription: Subscription;
  clientSecret?: string;
}

export interface UpdateSubscriptionRequest {
  plan?: SubscriptionPlan;
  billingPeriod?: BillingPeriod;
  cancelAtPeriodEnd?: boolean;
}

export interface SubscriptionPreview {
  plan: SubscriptionPlan;
  billingPeriod: BillingPeriod;
  price: number;
  nextBillingDate: Date;
  prorationAmount?: number;
}
