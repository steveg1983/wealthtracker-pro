import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders, isRedirectUrlAllowed } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { getStripe, getPriceIdForTier, type PaidTier } from '../_lib/stripe.js';
import { applyRateLimit } from '../_lib/rate-limit.js';

interface CreateCheckoutRequest {
  planType?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
  }

  if (applyRateLimit(req, res, { name: 'create-checkout', limit: 10, windowMs: 60_000 })) {
    return;
  }

  try {
    const auth = await requireAuth(req);
    const body = (req.body ?? {}) as CreateCheckoutRequest;

    // The client sends only a plan TYPE. The price is resolved server-side —
    // client-supplied prices are never trusted.
    const planType = body.planType === 'pro' ? 'pro' : body.planType === 'premium' ? 'premium' : null;
    if (!planType) {
      return res.status(400).json({ error: 'planType must be premium or pro', code: 'invalid_request' });
    }

    // Redirect URLs must point at our own origins (open-redirect guard).
    const successUrl = typeof body.successUrl === 'string' && isRedirectUrlAllowed(body.successUrl)
      ? body.successUrl
      : null;
    const cancelUrl = typeof body.cancelUrl === 'string' && isRedirectUrlAllowed(body.cancelUrl)
      ? body.cancelUrl
      : null;
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'Invalid redirect URLs', code: 'invalid_request' });
    }

    const stripe = getStripe();
    const supabase = getServiceRoleSupabase();

    // Reuse the user's Stripe customer if one exists; create + persist otherwise.
    const userResult = await supabase
      .from('users')
      .select('id, email, stripe_customer_id')
      .eq('id', auth.userId)
      .maybeSingle();

    if (userResult.error || !userResult.data) {
      console.error('[create-checkout] User lookup failed', userResult.error);
      return res.status(500).json({ error: 'Failed to load user', code: 'internal_error' });
    }

    const user = userResult.data as { id: string; email: string; stripe_customer_id: string | null };

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { clerk_id: auth.clerkUserId, user_id: user.id }
      });
      customerId = customer.id;
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: getPriceIdForTier(planType as PaidTier), quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: { clerk_id: auth.clerkUserId, user_id: user.id, tier: planType }
      },
      metadata: { clerk_id: auth.clerkUserId, user_id: user.id, tier: planType }
    });

    return res.status(200).json({
      success: true,
      data: { sessionId: session.id, url: session.url }
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error('[create-checkout] Failed', error);
    return res.status(500).json({ error: 'Failed to create checkout session', code: 'internal_error' });
  }
}
