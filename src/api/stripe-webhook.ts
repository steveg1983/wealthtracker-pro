import { Stripe } from 'stripe';
import { processWebhookEvent, HANDLED_EVENTS } from '../lib/stripe-webhooks';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

/**
 * Stripe webhook endpoint handler
 * This would typically be implemented in your backend (Express, Next.js API routes, etc.)
 * 
 * Example implementation for different frameworks:
 */

// ============================================
// Express.js Implementation
// ============================================
export function createExpressWebhookHandler() {
  return async (req: any, res: any) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    let event: Stripe.Event;

    try {
      // Construct event from raw body
      event = stripe.webhooks.constructEvent(
        req.body, // Should be raw body string
        sig,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Process the event
    const result = await processWebhookEvent(event);

    if (result.success) {
      res.json({ received: true, message: result.message });
    } else {
      res.status(400).json({ error: result.error });
    }
  };
}

// ============================================
// Next.js API Route Implementation
// ============================================
export async function handleNextJsWebhook(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf.toString(),
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Process the event
  const result = await processWebhookEvent(event);

  if (result.success) {
    res.json({ received: true, message: result.message });
  } else {
    res.status(400).json({ error: result.error });
  }
}

// ============================================
// Vercel Edge Function Implementation
// ============================================
export async function handleVercelEdgeWebhook(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response(
      JSON.stringify({ error: 'Webhook signature verification failed' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Process the event
  const result = await processWebhookEvent(event);

  if (result.success) {
    return new Response(
      JSON.stringify({ received: true, message: result.message }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } else {
    return new Response(
      JSON.stringify({ error: result.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================
// Webhook Configuration Helper
// ============================================
export function getWebhookConfig() {
  return {
    endpoint: '/api/webhooks/stripe',
    events: HANDLED_EVENTS,
    description: 'Handles Stripe subscription and payment events',
    headers: {
      'stripe-signature': 'Required for webhook signature verification'
    },
    env: {
      STRIPE_SECRET_KEY: 'Your Stripe secret key',
      STRIPE_WEBHOOK_SECRET: 'Your webhook endpoint secret from Stripe Dashboard'
    }
  };
}

// Helper function for Next.js to get raw body
async function buffer(readable: any) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// ============================================
// Testing Helper
// ============================================
export function createTestWebhookEvent(
  type: string,
  data: any
): Stripe.Event {
  return {
    id: 'evt_test_' + Date.now(),
    object: 'event',
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: data,
      previous_attributes: {}
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null
    },
    type: type as any
  };
}