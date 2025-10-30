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
export interface BillingHistory {
  id: string;
  subscriptionId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  paidAt?: Date;
  failureReason?: string;
  invoiceUrl?: string;
  receiptUrl?: string;
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
  subscriptionId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  dueDate: Date;
  paidAt?: Date;
  invoiceUrl?: string;
  pdfUrl?: string;
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