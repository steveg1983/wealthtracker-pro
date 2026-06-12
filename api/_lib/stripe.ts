import Stripe from 'stripe';
import { getRequiredEnv, getOptionalEnv } from './env.js';

let stripe: Stripe | null = null;

/** Lazily-initialised Stripe client (server-only secret key). */
export const getStripe = (): Stripe => {
  if (!stripe) {
    const key = getRequiredEnv('STRIPE_SECRET_KEY');
    stripe = new Stripe(key, {
      // Pin the API version the integration was written against.
      apiVersion: '2025-08-27.basil',
      typescript: true
    });
  }
  return stripe;
};

export type PaidTier = 'premium' | 'pro';

/**
 * Server-side price configuration. Prices are NEVER trusted from the client —
 * the client sends only a plan type; the price ID is resolved here.
 */
export const getPriceIdForTier = (tier: PaidTier): string => {
  switch (tier) {
    case 'premium':
      return getRequiredEnv('STRIPE_PRICE_PREMIUM_MONTHLY');
    case 'pro':
      return getRequiredEnv('STRIPE_PRICE_PRO_MONTHLY');
  }
};

/** Reverse mapping: price ID → tier, for webhook processing. */
export const getTierForPriceId = (priceId: string): PaidTier | null => {
  if (priceId === getOptionalEnv('STRIPE_PRICE_PREMIUM_MONTHLY')) return 'premium';
  if (priceId === getOptionalEnv('STRIPE_PRICE_PRO_MONTHLY')) return 'pro';
  return null;
};

/**
 * Map Stripe subscription status to the database vocabulary.
 * Note: the DB constraint uses British 'cancelled'; Stripe uses 'canceled'.
 */
export const mapStripeStatus = (status: Stripe.Subscription.Status): string => {
  switch (status) {
    case 'canceled':
      return 'cancelled';
    case 'active':
    case 'incomplete':
    case 'incomplete_expired':
    case 'past_due':
    case 'trialing':
    case 'unpaid':
    case 'paused':
      return status;
    default:
      return 'incomplete';
  }
};
