import { Stripe } from 'stripe';
import { supabase } from './supabase';
import { logger } from '../services/loggingService';

// Webhook event types we handle
export const HANDLED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'payment_method.attached',
  'payment_method.detached',
] as const;

export type HandledEvent = typeof HANDLED_EVENTS[number];

interface WebhookHandlerResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Process Stripe webhook events
 */
export async function processWebhookEvent(
  event: Stripe.Event
): Promise<WebhookHandlerResult> {
  try {
    logger.info('Processing webhook event', { type: event.type });

    switch (event.type) {
      case 'checkout.session.completed':
        return await handleCheckoutSessionCompleted(event);
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        return await handleSubscriptionUpdate(event);
      
      case 'customer.subscription.deleted':
        return await handleSubscriptionDeleted(event);
      
      case 'invoice.paid':
        return await handleInvoicePaid(event);
      
      case 'invoice.payment_failed':
        return await handlePaymentFailed(event);
      
      case 'payment_method.attached':
        return await handlePaymentMethodAttached(event);
      
      case 'payment_method.detached':
        return await handlePaymentMethodDetached(event);
      
      default:
        logger.warn('Unhandled Stripe event type', { type: event.type });
        return { success: true, message: 'Event type not handled' };
    }
  } catch (error) {
    logger.error('Webhook processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Handle successful checkout session
 */
async function handleCheckoutSessionCompleted(
  event: Stripe.CheckoutSessionCompletedEvent
): Promise<WebhookHandlerResult> {
  const session = event.data.object;
  
  if (!session.customer || !session.subscription) {
    return { success: false, error: 'Missing customer or subscription' };
  }

  // Update user's subscription in database
  // Resolve the user by the client reference (assumed Clerk ID) then update by user ID
  let userId: string | null = null;
  if (session.client_reference_id && supabase) {
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', session.client_reference_id as string)
      .single();
    userId = user?.id ?? null;
  }

  const { error } = userId && supabase
    ? await supabase
        .from('users')
        .update({
          stripe_customer_id: session.customer as string,
          // Store subscription status/tier on users for quick access
          subscription_status: 'active',
          subscription_tier: getPlanFromPriceId(session.amount_total || 0),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
    : { error: null } as any;

  if (error) {
    logger.error('Failed to update user subscription:', error);
    return { success: false, error: error.message };
  }

  // Send welcome email (would integrate with email service)
  await sendSubscriptionEmail(session.customer_email!, 'welcome');

  return { success: true, message: 'Checkout session processed' };
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdate(
  event: Stripe.CustomerSubscriptionUpdatedEvent | Stripe.CustomerSubscriptionCreatedEvent
): Promise<WebhookHandlerResult> {
  const subscription = event.data.object;
  
  // Map Stripe status to our status
  const status = mapStripeStatus(subscription.status);
  const tier = getPlanFromSubscription(subscription);

  // Find user by Stripe customer ID
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, user_id')
    .eq('stripe_customer_id', subscription.customer as string)
    .single();

  if (userError || !user) {
    return { success: false, error: 'User not found' };
  }

  // Update subscription details
  const { error } = await supabase
    .from('users')
    .update({
      subscription_status: status,
      subscription_tier: tier,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  // Log subscription event
  await logSubscriptionEvent(user.user_id, event.type, subscription);

  return { success: true, message: 'Subscription updated' };
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionDeleted(
  event: Stripe.CustomerSubscriptionDeletedEvent
): Promise<WebhookHandlerResult> {
  const subscription = event.data.object;

  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  // Find user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, user_id')
    .eq('stripe_customer_id', subscription.customer as string)
    .single();

  if (userError || !user) {
    return { success: false, error: 'User not found' };
  }

  // Downgrade to free tier
  const { error } = await supabase
    .from('users')
    .update({
      subscription_status: 'canceled',
      subscription_tier: 'free',
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  // Send cancellation email
  await sendSubscriptionEmail(user.email, 'canceled');

  // Log event
  await logSubscriptionEvent(user.user_id, 'subscription.canceled', subscription);

  return { success: true, message: 'Subscription canceled' };
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaid(
  event: Stripe.InvoicePaidEvent
): Promise<WebhookHandlerResult> {
  const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription };

  if (!invoice.subscription) {
    return { success: true, message: 'One-time payment, no subscription to update' };
  }

  // Record payment in database
  if (!supabase) {
    logger.warn('Supabase not configured, skipping payment recording');
    return { success: true, message: 'Payment processed (no database)' };
  }
  
  const { error } = await supabase
    .from('payments')
    .insert({
      stripe_invoice_id: invoice.id,
      stripe_customer_id: invoice.customer as string,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'succeeded',
      paid_at: new Date(invoice.created * 1000).toISOString()
    });

  if (error) {
    logger.error('Failed to record payment:', error);
  }

  return { success: true, message: 'Payment recorded' };
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(
  event: Stripe.InvoicePaymentFailedEvent
): Promise<WebhookHandlerResult> {
  const invoice = event.data.object;

  if (!supabase) {
    logger.warn('Supabase not configured, skipping payment failed handling');
    return { success: true, message: 'Payment failed noted (no database)' };
  }

  // Find user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, user_id')
    .eq('stripe_customer_id', invoice.customer as string)
    .single();

  if (userError || !user) {
    return { success: false, error: 'User not found' };
  }

  // Update subscription status
  const { error } = await supabase
    .from('users')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (error) {
    logger.error('Failed to update subscription status:', error);
  }

  // Send payment failed email
  await sendSubscriptionEmail(user.email, 'payment_failed');

  // Log event
  await logSubscriptionEvent(user.user_id, 'payment.failed', invoice);

  return { success: true, message: 'Payment failure handled' };
}

/**
 * Handle payment method attachment
 */
async function handlePaymentMethodAttached(
  event: Stripe.PaymentMethodAttachedEvent
): Promise<WebhookHandlerResult> {
  const paymentMethod = event.data.object;

  if (!supabase) {
    logger.warn('Supabase not configured, skipping payment method attachment');
    return { success: true, message: 'Payment method attached (no database)' };
  }

  // Update user's default payment method
  // Optional: store limited payment method info on users if columns exist.
  // To avoid schema drift, only update status fields here.
  const { error } = await supabase
    .from('users')
    .update({
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', paymentMethod.customer as string);

  if (error) {
    logger.error('Failed to update payment method:', error);
  }

  return { success: true, message: 'Payment method attached' };
}

/**
 * Handle payment method removal
 */
async function handlePaymentMethodDetached(
  event: Stripe.PaymentMethodDetachedEvent
): Promise<WebhookHandlerResult> {
  const paymentMethod = event.data.object;
  
  // Note: paymentMethod.customer is null after detachment
  // Would need to track this differently if needed
  
  return { success: true, message: 'Payment method detached' };
}

// Helper functions

function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  const statusMap: Record<Stripe.Subscription.Status, string> = {
    'active': 'active',
    'past_due': 'past_due',
    'unpaid': 'unpaid',
    'canceled': 'canceled',
    'incomplete': 'incomplete',
    'incomplete_expired': 'expired',
    'trialing': 'trialing',
    'paused': 'paused',
  };
  
  return statusMap[stripeStatus] || 'unknown';
}

function getPlanFromPriceId(amount: number): 'free' | 'pro' | 'business' {
  // Map price amounts to tiers (in cents)
  if (amount === 999) return 'pro'; // £9.99
  if (amount === 2499) return 'business'; // £24.99
  return 'free';
}

function getPlanFromSubscription(subscription: Stripe.Subscription): 'free' | 'pro' | 'business' {
  const priceId = subscription.items.data[0]?.price.id;
  
  // These would be your actual Stripe price IDs
  const PRICE_IDS = {
    pro: ['price_pro_monthly', 'price_pro_yearly'],
    business: ['price_business_monthly', 'price_business_yearly']
  };
  
  if (PRICE_IDS.pro.includes(priceId)) return 'pro';
  if (PRICE_IDS.business.includes(priceId)) return 'business';
  return 'free';
}

async function sendSubscriptionEmail(
  email: string,
  type: 'welcome' | 'canceled' | 'payment_failed'
): Promise<void> {
  // Integration with email service (SendGrid, AWS SES, etc.)
  logger.info('Would send email', { type, email });
  
  // In production, you would:
  // 1. Use an email service API
  // 2. Use email templates
  // 3. Include relevant subscription details
  // 4. Handle email delivery errors
}

async function logSubscriptionEvent(
  userId: string,
  eventType: string,
  data: any
): Promise<void> {
  try {
    if (!supabase) {
      logger.warn('Supabase not configured, skipping event logging');
      return;
    }
    
    await supabase.from('subscription_events').insert({
      user_id: userId,
      event_type: eventType,
      event_data: data,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to log subscription event:', error);
  }
}
