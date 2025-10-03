# Stripe Webhook Setup Guide

This guide explains how to set up Stripe webhooks to handle subscription events in your backend.

## Overview

Webhooks are essential for keeping your database in sync with Stripe subscription events. When a subscription is created, updated, cancelled, or when payments succeed/fail, Stripe will send webhook events to your backend.

## Required Webhook Events

Configure these events in your Stripe Dashboard → Webhooks:

### Subscription Events
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription modified (plan change, etc.)
- `customer.subscription.deleted` - Subscription cancelled
- `customer.subscription.trial_will_end` - Trial ending soon

### Payment Events  
- `invoice.payment_succeeded` - Successful payment
- `invoice.payment_failed` - Failed payment
- `customer.subscription.trial_end` - Trial ended

### Customer Events
- `customer.created` - New customer created
- `customer.updated` - Customer information updated
- `customer.deleted` - Customer deleted

## Backend Implementation

### 1. Create Webhook Endpoint

```javascript
// Express.js example
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.post('/api/webhooks/stripe', 
  express.raw({ type: 'application/json' }), 
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    try {
      const event = stripe.webhooks.constructEvent(
        req.body, 
        sig, 
        process.env.STRIPE_WEBHOOK_SECRET
      );
      
      console.log('Received webhook:', event.type);
      
      switch (event.type) {
        case 'customer.subscription.created':
          await handleSubscriptionCreated(event.data.object);
          break;
          
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;
          
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;
          
        case 'invoice.payment_succeeded':
          await handlePaymentSucceeded(event.data.object);
          break;
          
        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;
          
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }
);
```

### 2. Handle Subscription Events

```javascript
async function handleSubscriptionCreated(subscription) {
  const { customer, status, current_period_start, current_period_end, trial_start, trial_end } = subscription;
  
  // Get user by Stripe customer ID
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('stripe_customer_id', customer)
    .single();
    
  if (!userProfile) {
    console.error('User not found for customer:', customer);
    return;
  }
  
  // Create subscription record
  await supabase
    .from('subscriptions')
    .insert({
      user_id: userProfile.id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customer,
      stripe_price_id: subscription.items.data[0].price.id,
      tier: getTierFromPriceId(subscription.items.data[0].price.id),
      status: status,
      current_period_start: new Date(current_period_start * 1000).toISOString(),
      current_period_end: new Date(current_period_end * 1000).toISOString(),
      trial_start: trial_start ? new Date(trial_start * 1000).toISOString() : null,
      trial_end: trial_end ? new Date(trial_end * 1000).toISOString() : null
    });
}

async function handleSubscriptionUpdated(subscription) {
  const { id, status, current_period_start, current_period_end, cancel_at_period_end, canceled_at } = subscription;
  
  await supabase
    .from('subscriptions')
    .update({
      status: status,
      current_period_start: new Date(current_period_start * 1000).toISOString(),
      current_period_end: new Date(current_period_end * 1000).toISOString(),
      cancel_at_period_end: cancel_at_period_end,
      cancelled_at: canceled_at ? new Date(canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', id);
}

async function handleSubscriptionDeleted(subscription) {
  await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handlePaymentSucceeded(invoice) {
  const { customer, amount_paid, currency, status, subscription } = invoice;
  
  // Get user by customer ID
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('stripe_customer_id', customer)
    .single();
    
  if (!userProfile) return;
  
  // Record invoice
  await supabase
    .from('invoices')
    .insert({
      user_id: userProfile.id,
      stripe_invoice_id: invoice.id,
      amount: amount_paid / 100, // Convert from cents
      currency: currency,
      status: status,
      paid_at: new Date().toISOString(),
      description: invoice.description || 'Subscription payment'
    });
}

function getTierFromPriceId(priceId) {
  // Map your Stripe price IDs to tiers
  const priceMap = {
    'price_premium_monthly': 'premium',
    'price_pro_monthly': 'pro',
    // Add your actual price IDs here
  };
  
  return priceMap[priceId] || 'free';
}
```

### 3. Webhook Security

Always verify webhook signatures:

```javascript
function verifyWebhookSignature(payload, signature, secret) {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    throw new Error('Invalid webhook signature');
  }
}
```

## Environment Variables

Set these in your backend environment:

```bash
STRIPE_SECRET_KEY=sk_live_...  # or sk_test_... for testing
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Testing Webhooks

### Local Development

1. Install Stripe CLI:
   ```bash
   npm install -g stripe-cli
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to local development:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. Test specific events:
   ```bash
   stripe trigger customer.subscription.created
   stripe trigger invoice.payment_succeeded
   ```

### Production

1. Add webhook endpoint in Stripe Dashboard
2. Configure the endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
3. Select the events listed above
4. Copy the webhook signing secret to your environment variables

## Error Handling

Always implement proper error handling:

```javascript
app.post('/api/webhooks/stripe', async (req, res) => {
  try {
    // Process webhook
    await processWebhook(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    
    // Log to monitoring service (Sentry, etc.)
    logError(error, { eventType: event.type, eventId: event.id });
    
    // Return error status to trigger Stripe retry
    res.status(500).json({ error: 'Processing failed' });
  }
});
```

## Monitoring

Monitor webhook delivery in:
- Stripe Dashboard → Webhooks → Events
- Your application logs
- Error tracking service (Sentry, Bugsnag, etc.)

## Database Schema

Make sure your database schema matches the webhook data structure. See `supabase/subscription-migration.sql` for the complete schema.

## Next Steps

1. Set up your backend API endpoints
2. Configure webhook endpoint in Stripe Dashboard  
3. Test with Stripe CLI
4. Deploy to production
5. Monitor webhook delivery and errors

For more details, see the official Stripe documentation:
https://stripe.com/docs/webhooks