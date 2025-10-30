import { Stripe } from 'stripe';
import { supabase } from './supabase';

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
    console.log(`Processing webhook event: ${event.type}`);

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
        console.log(`Unhandled event type: ${event.type}`);
        return { success: true, message: 'Event type not handled' };
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
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
  const { error } = await supabase!
    .from('user_profiles')
    .update({
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      subscription_status: 'active',
      subscription_tier: getPlanFromPriceId(session.amount_total || 0),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', session.client_reference_id!);

  if (error) {
    console.error('Failed to update user subscription:', error);
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
  const { data: user, error: userError } = await supabase!
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', subscription.customer as string)
    .single();

  if (userError || !user) {
    return { success: false, error: 'User not found' };
  }

  // Update subscription details
  const { error } = await supabase!
    .from('user_profiles')
    .update({
      subscription_status: status,
      subscription_tier: tier,
      subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.user_id);

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

  // Find user
  const { data: user, error: userError } = await supabase!
    .from('user_profiles')
    .select('user_id, email')
    .eq('stripe_customer_id', subscription.customer as string)
    .single();

  if (userError || !user) {
    return { success: false, error: 'User not found' };
  }

  // Downgrade to free tier
  const { error } = await supabase!
    .from('user_profiles')
    .update({
      subscription_status: 'canceled',
      subscription_tier: 'free',
      subscription_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.user_id);

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
  const invoice = event.data.object;

  if (!invoice.subscription) {
    return { success: true, message: 'One-time payment, no subscription to update' };
  }

  // Record payment in database
  const { error } = await supabase!
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
    console.error('Failed to record payment:', error);
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

  // Find user
  const { data: user, error: userError } = await supabase!
    .from('user_profiles')
    .select('user_id, email')
    .eq('stripe_customer_id', invoice.customer as string)
    .single();

  if (userError || !user) {
    return { success: false, error: 'User not found' };
  }

  // Update subscription status
  const { error } = await supabase!
    .from('user_profiles')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.user_id);

  if (error) {
    console.error('Failed to update subscription status:', error);
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

  // Update user's default payment method
  const { error } = await supabase!
    .from('user_profiles')
    .update({
      has_payment_method: true,
      payment_method_last4: paymentMethod.card?.last4,
      payment_method_brand: paymentMethod.card?.brand,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', paymentMethod.customer as string);

  if (error) {
    console.error('Failed to update payment method:', error);
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
  console.log(`Would send ${type} email to ${email}`);
  
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
    await supabase.from('subscription_events').insert({
      user_id: userId,
      event_type: eventType,
      event_data: data,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log subscription event:', error);
  }
}