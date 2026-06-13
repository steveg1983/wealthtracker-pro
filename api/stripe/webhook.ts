import type { VercelRequest, VercelResponse } from '@vercel/node';
import type Stripe from 'stripe';
import { getStripe, getTierForPriceId, mapStripeStatus } from '../_lib/stripe.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { getRequiredEnv } from '../_lib/env.js';

// Stripe signature verification requires the RAW request body — disable
// Vercel's automatic JSON parsing for this route.
export const config = {
  api: {
    bodyParser: false
  }
};

const readRawBody = (req: VercelRequest): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

/** Resolve the internal users row for a Stripe customer. */
const findUserForCustomer = async (
  customerId: string,
  metadataClerkId?: string | null
): Promise<{ id: string; clerk_id: string } | null> => {
  const supabase = getServiceRoleSupabase();

  const byCustomer = await supabase
    .from('users')
    .select('id, clerk_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (byCustomer.data) {
    return byCustomer.data as { id: string; clerk_id: string };
  }

  if (metadataClerkId) {
    const byClerk = await supabase
      .from('users')
      .select('id, clerk_id')
      .eq('clerk_id', metadataClerkId)
      .maybeSingle();
    if (byClerk.data) {
      // Backfill the customer link for future lookups.
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', (byClerk.data as { id: string }).id);
      return byClerk.data as { id: string; clerk_id: string };
    }
  }

  return null;
};

/** Upsert the local subscription row from a Stripe subscription object. */
const syncSubscription = async (subscription: Stripe.Subscription): Promise<void> => {
  const supabase = getServiceRoleSupabase();

  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  const user = await findUserForCustomer(
    customerId,
    subscription.metadata?.clerk_id ?? null
  );
  if (!user) {
    throw new Error(`No user found for Stripe customer ${customerId}`);
  }

  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;
  const tier = (priceId && getTierForPriceId(priceId))
    ?? (subscription.metadata?.tier === 'pro' ? 'pro' : 'premium');

  const status = mapStripeStatus(subscription.status);
  const isEnded = status === 'cancelled' || status === 'incomplete_expired';

  const periodStart = item?.current_period_start ?? null;
  const periodEnd = item?.current_period_end ?? null;

  const row = {
    user_id: user.id,
    user_id_text: user.clerk_id,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    stripe_price_id: priceId,
    tier: isEnded ? 'free' : tier,
    status,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    cancelled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString()
  };

  // Upsert keyed on the Stripe subscription id.
  const existing = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();

  if (existing.data) {
    const { error } = await supabase
      .from('subscriptions')
      .update(row)
      .eq('id', (existing.data as { id: string }).id);
    if (error) throw new Error(`subscriptions update failed: ${error.message}`);
  } else {
    const { error } = await supabase.from('subscriptions').insert(row);
    if (error) throw new Error(`subscriptions insert failed: ${error.message}`);
  }
  // The sync_user_subscription DB trigger propagates tier/status to
  // user_profiles automatically.
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
  }

  const stripe = getStripe();
  const webhookSecret = getRequiredEnv('STRIPE_WEBHOOK_SECRET');

  let event: Stripe.Event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      return res.status(400).json({ error: 'Missing signature', code: 'invalid_signature' });
    }
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('[stripe-webhook] Signature verification failed', error);
    return res.status(400).json({ error: 'Invalid signature', code: 'invalid_signature' });
  }

  const supabase = getServiceRoleSupabase();

  // Idempotency: subscription_logs.event_id is UNIQUE. A duplicate delivery
  // hits the conflict — but a conflict alone does NOT mean the event was
  // handled. The row is inserted processed:false BEFORE handling, so if a
  // previous attempt threw (e.g. the Clerk-created users row didn't exist
  // yet), the row sits at processed:false while Stripe retries. Acking those
  // retries unconditionally permanently dropped the event — a paying
  // customer's tier was never written (audit finding #6). Only short-circuit
  // when the prior attempt actually finished (processed:true); otherwise fall
  // through and reprocess.
  const logInsert = await supabase
    .from('subscription_logs')
    .insert({
      event_id: event.id,
      event_type: event.type,
      processed: false,
      payload: { type: event.type, created: event.created }
    });

  if (logInsert.error) {
    if (logInsert.error.code === '23505') {
      const existingEvent = await supabase
        .from('subscription_logs')
        .select('processed')
        .eq('event_id', event.id)
        .maybeSingle();

      if (existingEvent.error) {
        console.error('[stripe-webhook] Failed to check duplicate event state', {
          code: existingEvent.error.code,
          message: existingEvent.error.message
        });
        // 500 → Stripe retries; better than guessing the processed state.
        return res.status(500).json({ error: 'Failed to check event state', code: 'internal_error' });
      }

      if ((existingEvent.data as { processed: boolean | null } | null)?.processed) {
        // Genuinely already handled — acknowledge so Stripe stops retrying.
        return res.status(200).json({ received: true, duplicate: true });
      }
      // processed:false → the earlier attempt failed mid-handling. Fall
      // through and reprocess this retry; the row already exists.
    } else {
      console.error('[stripe-webhook] Failed to record event', {
        code: logInsert.error.code,
        message: logInsert.error.message
      });
      return res.status(500).json({ error: 'Failed to record event', code: 'internal_error' });
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.subscription) {
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(subscription);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object);
        break;
      }

      case 'invoice.payment_failed': {
        // Subscription status moves to past_due via subscription.updated;
        // record the failure for support visibility.
        console.warn('[stripe-webhook] invoice.payment_failed', {
          invoice: event.data.object.id
        });
        break;
      }

      default:
        // Acknowledged but not handled — logged via subscription_logs.
        break;
    }

    await supabase
      .from('subscription_logs')
      .update({ processed: true })
      .eq('event_id', event.id);

    return res.status(200).json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'processing failed';
    console.error('[stripe-webhook] Event processing failed', { type: event.type, message });
    await supabase
      .from('subscription_logs')
      .update({ error_message: message })
      .eq('event_id', event.id);
    // 500 → Stripe retries with backoff; idempotency guard makes retries safe.
    return res.status(500).json({ error: 'Event processing failed', code: 'internal_error' });
  }
}
