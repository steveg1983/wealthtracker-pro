import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { isBankingOpsAdmin } from '../_lib/banking-ops.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { withSentry } from '../_lib/sentry.js';
import { listProviders } from '../_lib/providers/index.js';

/**
 * Whether the bank-feed flow can succeed at all. The client only ever learns
 * 'ok' or 'degraded' — enough to decide whether to offer "Connect a bank",
 * and nothing more; the per-variable inventory below stays ops-admin only.
 */
const isBankingConfigured = (): boolean => {
  // The state secret is shared by every provider — it signs OUR callback
  // token, not theirs — so it gates the whole feature.
  if (!process.env.BANKING_STATE_SECRET) {
    return false;
  }
  // ANY configured provider means the feature works (24 Aug). This used to
  // demand TrueLayer's three variables specifically, so a deploy configured
  // for a different provider would have reported 'degraded' and the client
  // would have hidden "Connect a bank" on a perfectly working install.
  return listProviders().some(provider => provider.isConfigured());
};

function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
  }

  return requireAuth(req)
    .then((auth) => {
      const verdict = {
        status: isBankingConfigured() ? 'ok' : 'degraded',
        timestamp: new Date().toISOString()
      };

      // Which secrets exist and which TrueLayer environment we point at is
      // infrastructure detail: it tells an attacker what to probe and is of no
      // use to a normal user. Ordinary callers get the verdict only.
      if (!isBankingOpsAdmin(auth)) {
        return res.status(200).json(verdict);
      }

      return res.status(200).json({
        ...verdict,
        env_check: {
          has_truelayer_client_id: !!process.env.TRUELAYER_CLIENT_ID,
          has_truelayer_secret: !!process.env.TRUELAYER_CLIENT_SECRET,
          has_banking_state_secret: !!process.env.BANKING_STATE_SECRET,
          has_redirect_uri: !!process.env.TRUELAYER_REDIRECT_URI,
          environment: process.env.TRUELAYER_ENVIRONMENT || 'not set'
        }
      });
    })
    .catch((error) => {
      if (error instanceof AuthError) {
        return res.status(error.status).json({ error: error.message, code: error.code });
      }
      return res.status(500).json({ error: 'Unexpected error', code: 'internal_error' });
    });
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
