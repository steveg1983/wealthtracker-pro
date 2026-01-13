import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
  }

  return requireAuth(req)
    .then(() =>
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        env_check: {
          has_truelayer_client_id: !!process.env.TRUELAYER_CLIENT_ID,
          has_truelayer_secret: !!process.env.TRUELAYER_CLIENT_SECRET,
          has_banking_state_secret: !!process.env.BANKING_STATE_SECRET,
          has_redirect_uri: !!process.env.TRUELAYER_REDIRECT_URI,
          environment: process.env.TRUELAYER_ENVIRONMENT || 'not set'
        }
      })
    )
    .catch((error) => {
      if (error instanceof AuthError) {
        return res.status(error.status).json({ error: error.message, code: error.code });
      }
      return res.status(500).json({ error: 'Unexpected error', code: 'internal_error' });
    });
}
