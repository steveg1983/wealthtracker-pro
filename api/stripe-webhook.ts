import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

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
  }
  return statusMap[stripeStatus] || 'unknown'
}

function getPlanFromSubscription(subscription: Stripe.Subscription): 'free' | 'pro' | 'business' {
  const priceId = subscription.items.data[0]?.price.id
  const PRICE_IDS = {
    pro: ['price_pro_monthly', 'price_pro_yearly'],
    business: ['price_business_monthly', 'price_business_yearly']
  }
  if (PRICE_IDS.pro.includes(priceId)) return 'pro'
  if (PRICE_IDS.business.includes(priceId)) return 'business'
  return 'free'
}

async function buffer(readable: any): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).send('Method Not Allowed')
  }

  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!stripeSecret || !webhookSecret) {
      return res.status(500).json({ error: 'Stripe env vars not set' })
    }

    // Use project Stripe type's expected apiVersion
    const stripe = new Stripe(stripeSecret, { apiVersion: '2025-07-30.basil' as any })
    const rawBody = (await buffer(req)).toString()
    const sig = req.headers['stripe-signature'] as string
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err?.message)
      return res.status(400).send(`Webhook Error: ${err?.message || 'Invalid signature'}`)
    }

    const supabase = getSupabaseAdmin()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.client_reference_id && session.customer) {
          const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('clerk_id', session.client_reference_id)
            .single()
          if (user?.id) {
            await supabase
              .from('users')
              .update({
                stripe_customer_id: String(session.customer),
                subscription_status: 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('id', user.id)
          }
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const status = mapStripeStatus(subscription.status)
        const tier = getPlanFromSubscription(subscription)
        const customerId = String(subscription.customer)
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()
        if (user?.id) {
          await supabase
            .from('users')
            .update({ subscription_status: status, subscription_tier: tier, updated_at: new Date().toISOString() })
            .eq('id', user.id)
        }
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = String(subscription.customer)
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()
        if (user?.id) {
          await supabase
            .from('users')
            .update({ subscription_status: 'canceled', subscription_tier: 'free', updated_at: new Date().toISOString() })
            .eq('id', user.id)
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = String(invoice.customer)
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()
        if (user?.id) {
          await supabase
            .from('users')
            .update({ subscription_status: 'past_due', updated_at: new Date().toISOString() })
            .eq('id', user.id)
        }
        break
      }
      default:
        break
    }

    return res.status(200).json({ received: true })
  } catch (err: any) {
    console.error('Webhook handler error:', err?.message)
    return res.status(500).json({ error: 'Internal error' })
  }
}
