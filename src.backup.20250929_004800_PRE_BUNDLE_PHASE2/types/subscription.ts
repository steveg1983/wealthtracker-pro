export type SubscriptionTier = 'free' | 'premium' | 'pro' | 'business';

export type SubscriptionStatus = 
  | 'active' 
  | 'cancelled' 
  | 'incomplete' 
  | 'incomplete_expired' 
  | 'past_due' 
  | 'trialing' 
  | 'unpaid'
  | 'paused';

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  stripePriceId: string;
  features: string[];
  isPopular?: boolean;
  maxAccounts?: number;
  maxTransactions?: number;
  maxBudgets?: number;
  maxGoals?: number;
  advancedReports?: boolean;
  csvExport?: boolean;
  apiAccess?: boolean;
  prioritySupport?: boolean;
}

export interface UserSubscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelledAt?: Date;
  cancelAtPeriodEnd?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionUsage {
  accounts: number;
  transactions: number;
  budgets: number;
  goals: number;
  lastCalculated: Date;
}

export interface FeatureLimits {
  maxAccounts: number;
  maxTransactions: number;
  maxBudgets: number;
  maxGoals: number;
  advancedReports: boolean;
  csvExport: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

export interface PaymentMethod {
  id: string;
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  paidAt?: Date;
  dueDate?: Date;
  invoiceUrl?: string;
  invoicePdf?: string;
  description?: string;
  createdAt: Date;
}

export interface BillingHistory {
  invoices: Invoice[];
  paymentMethods: PaymentMethod[];
  nextBillingDate?: Date;
  totalPaid: number;
}

// Stripe-specific types for frontend integration
export interface StripeConfig {
  publishableKey: string;
  premiumPriceId: string;
  proPriceId: string;
}

export interface CreateSubscriptionRequest {
  priceId: string;
  paymentMethodId?: string;
}

export interface CreateSubscriptionResponse {
  subscriptionId: string;
  clientSecret?: string;
  status: SubscriptionStatus;
}

export interface UpdateSubscriptionRequest {
  priceId?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface SubscriptionPreview {
  immediateTotal: number;
  nextInvoiceTotal: number;
  proratedTotal?: number;
  currency: string;
}
