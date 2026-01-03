import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env_check: {
      has_truelayer_client_id: !!process.env.TRUELAYER_CLIENT_ID,
      has_truelayer_secret: !!process.env.TRUELAYER_CLIENT_SECRET,
      has_banking_state_secret: !!process.env.BANKING_STATE_SECRET,
      has_redirect_uri: !!process.env.TRUELAYER_REDIRECT_URI,
      environment: process.env.TRUELAYER_ENVIRONMENT || 'not set'
    }
  });
}
