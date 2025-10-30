// Subscription types

export type SubscriptionPlan = 'free' | 'basic' | 'premium' | 'enterprise';
export type BillingPeriod = 'monthly' | 'yearly';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: 'active' | 'inactive' | 'cancelled' | 'past_due';
  billingPeriod: BillingPeriod;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
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
  limits: {
    accounts: number;
    transactions: number;
    budgets: number;
    goals: number;
  };
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