import Stripe from 'stripe';
import type { IncomingHttpHeaders } from 'node:http';
import type { Readable } from 'node:stream';
import { processWebhookEvent, HANDLED_EVENTS, configureStripeWebhookLogger } from '../lib/stripe-webhooks';
import { createConsoleBridgeLogger } from '../loggers/scopedLogger';

const webhookLogger = createConsoleBridgeLogger('StripeWebhook');
configureStripeWebhookLogger(webhookLogger);

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-08-27.basil',
});

interface ExpressRequestLike {
  headers: IncomingHttpHeaders;
  body: string | Buffer;
}

interface ExpressResponseLike {
  status: (code: number) => ExpressResponseLike;
  json: (body: unknown) => ExpressResponseLike | void;
  send: (body: unknown) => ExpressResponseLike | void;
}

interface NextApiRequestLike extends ExpressRequestLike, AsyncIterable<Uint8Array | string> {
  method?: string;
}

interface NextApiResponseLike {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => NextApiResponseLike;
  end: (body?: string) => void;
  send: (body: unknown) => void;
  json: (body: unknown) => void;
}

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
  return async (req: ExpressRequestLike, res: ExpressResponseLike) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

    let event: Stripe.Event;

    try {
      // Construct event from raw body
      event = stripe.webhooks.constructEvent(
        req.body, // Should be raw body string
        sig || '',
        webhookSecret
      );
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Unknown webhook error');
      webhookLogger.error('Webhook signature verification failed', error);
      return res.status(400).send(`Webhook Error: ${error.message}`);
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
export async function handleNextJsWebhook(req: NextApiRequestLike, res: NextApiResponseLike) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf.toString(),
      sig || '',
      webhookSecret
    );
  } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Unknown webhook error');
      webhookLogger.error('Webhook signature verification failed', error);
      return res.status(400).send(`Webhook Error: ${error.message}`);
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
  const sig = request.headers.get('stripe-signature') ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Unknown webhook error');
    webhookLogger.error('Webhook signature verification failed', error);
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
async function buffer(readable: Readable | AsyncIterable<Uint8Array | string>) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// ============================================
// Testing Helper
// ============================================
export function createTestWebhookEvent(
  type: Stripe.Event.Type,
  dataObject: Stripe.Event.Data.Object
): Stripe.Event {
  return {
    id: 'evt_test_' + Date.now(),
    object: 'event' as const,
    api_version: '2023-10-16' as Stripe.Event['api_version'],
    created: Math.floor(Date.now() / 1000),
    data: {
      object: dataObject,
      previous_attributes: {}
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null
    },
    type
  } as Stripe.Event;
}
