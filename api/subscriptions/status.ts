import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { applyRateLimit } from '../_lib/rate-limit.js';
import { withSentry } from '../_lib/sentry.js';

interface SubscriptionRow {
  id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  tier: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean | null;
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
  }

  if (await applyRateLimit(req, res, { name: 'subscription-status', limit: 60, windowMs: 60_000 })) {
    return;
  }

  try {
    const auth = await requireAuth(req);
    const supabase = getServiceRoleSupabase();

    // Subscription state comes from the DATABASE (kept current by the
    // signature-verified Stripe webhook) — never from the client.
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, stripe_subscription_id, stripe_customer_id, tier, status, current_period_start, current_period_end, trial_end, cancel_at_period_end')
      .eq('user_id', auth.userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[subscription-status] Lookup failed', { code: error.code, message: error.message });
      return res.status(500).json({ error: 'Failed to load subscription', code: 'internal_error' });
    }

    const row = data as SubscriptionRow | null;
    const isActive = row && ['active', 'trialing', 'past_due'].includes(row.status);

    if (!row || !isActive) {
      return res.status(200).json({
        success: true,
        data: { hasSubscription: false, planType: 'free' }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        hasSubscription: true,
        subscriptionId: row.stripe_subscription_id,
        customerId: row.stripe_customer_id,
        planType: row.tier,
        status: row.status,
        currentPeriodStart: row.current_period_start,
        currentPeriodEnd: row.current_period_end,
        trialEnd: row.trial_end,
        cancelAtPeriodEnd: row.cancel_at_period_end ?? false
      }
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error('[subscription-status] Failed', error);
    return res.status(500).json({ error: 'Failed to load subscription status', code: 'internal_error' });
  }
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
