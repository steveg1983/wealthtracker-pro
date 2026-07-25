// Subscription types

// Canonical tier vocabulary — must match the DB CHECK constraints
// (subscriptions_tier_check: 'free' | 'premium' | 'pro').
export type SubscriptionPlan = 'free' | 'premium' | 'pro';
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
  // What the plan actually grants. -1 means unlimited.
  //
  // These are required, and there is deliberately no `maxAccounts`/`maxBudgets`/
  // `maxGoals` alias. Two names for one concept is precisely what broke this:
  // the plans only ever set `accounts`/`budgets`/`goals`, while
  // getFeatureLimits read the optional `max*` spellings, got `undefined` from
  // every plan, and fell back to Free's numbers for paying customers.
  accounts: number;
  transactions: number;
  budgets: number;
  goals: number;
  advancedReports: boolean;
  csvExport: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

// What a tier allows, one entry per gateable feature.
//
// -1 means unlimited; 0 means the tier does not include the feature at all.
// Every key is required on purpose: an optional key here is a gate that
// answers `undefined`, and whichever way the caller reads that it is wrong —
// either it locks a paying customer out of what they bought, or it waves a
// free user through. If a new gateable feature is added, every tier must say
// what it allows.
export interface FeatureLimits {
  accounts: number;
  transactions: number;
  budgets: number;
  goals: number;
  customReports: number;
  apiCalls: number;
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
