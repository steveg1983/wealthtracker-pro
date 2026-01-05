import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (_req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env_check: {
      has_truelayer_client_id: !!process.env.TRUELAYER_CLIENT_ID,
      has_truelayer_secret: !!process.env.TRUELAYER_CLIENT_SECRET,
      has_banking_state_secret: !!process.env.BANKING_STATE_SECRET,
      has_redirect_uri: !!process.env.TRUELAYER_REDIRECT_URI,
      environment: process.env.TRUELAYER_ENVIRONMENT || 'not set',
      redirect_uri: process.env.TRUELAYER_REDIRECT_URI // Show actual value for debugging
    }
  });
}
