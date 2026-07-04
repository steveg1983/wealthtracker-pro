import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders, isRedirectUrlAllowed } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { getStripe } from '../_lib/stripe.js';
import { applyRateLimit } from '../_lib/rate-limit.js';

interface PortalRequest {
  returnUrl?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
  }

  if (await applyRateLimit(req, res, { name: 'billing-portal', limit: 10, windowMs: 60_000 })) {
    return;
  }

  try {
    const auth = await requireAuth(req);
    const supabase = getServiceRoleSupabase();

    const userResult = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', auth.userId)
      .maybeSingle();

    const customerId = (userResult.data as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
    if (!customerId) {
      return res.status(404).json({ error: 'No billing account found', code: 'not_found' });
    }

    const body = (req.body ?? {}) as PortalRequest;
    const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
    // The Origin header is attacker-controllable, so the derived fallback must
    // pass the same allowlist as a caller-supplied returnUrl — otherwise it is
    // an open redirect into the Stripe portal return flow.
    const candidateFallback = origin ? `${origin}/subscription` : undefined;
    const fallbackReturn = candidateFallback && isRedirectUrlAllowed(candidateFallback)
      ? candidateFallback
      : undefined;
    const returnUrl = typeof body.returnUrl === 'string' && isRedirectUrlAllowed(body.returnUrl)
      ? body.returnUrl
      : fallbackReturn;

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      ...(returnUrl ? { return_url: returnUrl } : {})
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error('[billing-portal] Failed', error);
    return res.status(500).json({ error: 'Failed to create portal session', code: 'internal_error' });
  }
}
