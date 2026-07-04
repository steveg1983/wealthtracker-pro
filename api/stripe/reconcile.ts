import type { VercelRequest, VercelResponse } from '@vercel/node';
import type Stripe from 'stripe';
import { getStripe, getTierForPriceId, mapStripeStatus } from '../_lib/stripe.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { getRequiredEnv, getOptionalEnv } from '../_lib/env.js';
import { captureServerError } from '../_lib/sentry.js';

/**
 * Daily reconciliation between Stripe (source of truth) and the local
 * subscriptions table. Catches drift from missed/failed webhooks.
 *
 * Invoked by Vercel Cron (see vercel.json "crons"). Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` when the CRON_SECRET env var is set.
 */

interface SubscriptionRow {
  id: string;
  stripe_subscription_id: string;
  tier: string;
  status: string;
  cancel_at_period_end: boolean | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization ?? '';
  const cronSecret = getRequiredEnv('CRON_SECRET');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' });
  }

  // Stripe is an optional/known-pending integration. When it isn't configured,
  // getStripe() would throw getRequiredEnv('STRIPE_SECRET_KEY') OUTSIDE the
  // try/catch below — an unhandled crash (FUNCTION_INVOCATION_FAILED) that also
  // bypasses Sentry capture. There are no subscriptions to reconcile without
  // Stripe, so skip cleanly (green cron) rather than crash daily.
  if (!getOptionalEnv('STRIPE_SECRET_KEY')) {
    console.warn('[stripe-reconcile] STRIPE_SECRET_KEY not configured — skipping reconciliation');
    return res.status(200).json({ skipped: 'stripe_not_configured', checked: 0, corrected: 0, failures: [] });
  }

  const stripe = getStripe();
  const supabase = getServiceRoleSupabase();

  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, stripe_subscription_id, tier, status, cancel_at_period_end')
    .in('status', ['active', 'trialing', 'past_due', 'incomplete'])
    .not('stripe_subscription_id', 'is', null)
    .limit(500);

  if (error) {
    console.error('[stripe-reconcile] DB read failed', { code: error.code, message: error.message });
    await captureServerError(new Error(`reconcile DB read failed: ${error.message}`), {
      cron: 'stripe-reconcile',
      code: error.code
    });
    return res.status(500).json({ error: 'Failed to load subscriptions', code: 'internal_error' });
  }

  const rows = (data ?? []) as SubscriptionRow[];
  let checked = 0;
  let corrected = 0;
  const failures: string[] = [];

  for (const row of rows) {
    checked += 1;
    try {
      const subscription: Stripe.Subscription =
        await stripe.subscriptions.retrieve(row.stripe_subscription_id);

      const item = subscription.items.data[0];
      const priceId = item?.price?.id ?? null;
      const stripeTier = (priceId && getTierForPriceId(priceId)) ?? row.tier;
      const stripeStatus = mapStripeStatus(subscription.status);
      const isEnded = stripeStatus === 'cancelled' || stripeStatus === 'incomplete_expired';
      const expectedTier = isEnded ? 'free' : stripeTier;

      const drifted =
        row.status !== stripeStatus ||
        row.tier !== expectedTier ||
        (row.cancel_at_period_end ?? false) !== (subscription.cancel_at_period_end ?? false);

      if (drifted) {
        const periodEnd = item?.current_period_end ?? null;
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            tier: expectedTier,
            status: stripeStatus,
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            cancelled_at: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', row.id);

        if (updateError) {
          failures.push(`${row.stripe_subscription_id}: ${updateError.message}`);
        } else {
          corrected += 1;
          console.warn('[stripe-reconcile] Corrected drift', {
            subscription: row.stripe_subscription_id,
            from: { tier: row.tier, status: row.status },
            to: { tier: expectedTier, status: stripeStatus }
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      // Subscription deleted in Stripe but live locally is itself drift.
      if (message.includes('No such subscription')) {
        await supabase
          .from('subscriptions')
          .update({ tier: 'free', status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', row.id);
        corrected += 1;
      } else {
        failures.push(`${row.stripe_subscription_id}: ${message}`);
      }
    }
  }

  console.log('[stripe-reconcile] Complete', { checked, corrected, failures: failures.length });
  if (failures.length > 0) {
    // Subscriptions that couldn't be reconciled = latent entitlement drift.
    await captureServerError(new Error(`reconcile completed with ${failures.length} failure(s)`), {
      cron: 'stripe-reconcile',
      checked,
      corrected,
      failureCount: failures.length
    });
  }
  return res.status(200).json({ checked, corrected, failures });
}
