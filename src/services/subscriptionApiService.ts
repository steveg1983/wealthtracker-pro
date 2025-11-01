/**
 * Subscription API Service - Frontend-only subscription management
 * 
 * Features:
 * - Client-side Stripe integration
 * - Supabase direct integration  
 * - Simulates backend API endpoints
 * - Handles subscription lifecycle
 */

import { loadStripe } from '@stripe/stripe-js';
import { useUser } from '@clerk/clerk-react';
import SupabaseSubscriptionService from './supabaseSubscriptionService';
import type { 
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  UpdateSubscriptionRequest,
  UserSubscription,
  BillingHistory,
  PaymentMethod,
  SubscriptionPreview
} from '../types/subscription';
import { toDecimal, toStorageNumber } from '../utils/decimal';

export class SubscriptionApiService {
  private static stripe = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

  /**
   * Create a subscription (simulates backend endpoint)
   * In a real app, this would be a backend API call
   */
  static async createSubscription(
    request: CreateSubscriptionRequest
  ): Promise<CreateSubscriptionResponse> {
    try {
      // In a real implementation, this would:
      // 1. Call your backend API
      // 2. Backend creates Stripe subscription
      // 3. Backend stores in database
      // 4. Returns client secret for payment confirmation

      // For demo purposes, we'll simulate this with client-side operations
      throw new Error(
        'Subscription creation requires a backend API. ' +
        'This demo shows the frontend components only. ' +
        'In production, implement the following backend endpoints:\n' +
        '- POST /api/subscriptions (create subscription)\n' +
        '- PATCH /api/subscriptions/:id (update subscription)\n' +
        '- GET /api/subscriptions/current (get current subscription)\n' +
        '- POST /api/billing/portal (create portal session)'
      );
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription (simulates backend endpoint)
   */
  static async updateSubscription(
    subscriptionId: string,
    request: UpdateSubscriptionRequest
  ): Promise<UserSubscription> {
    try {
      throw new Error(
        'Subscription updates require a backend API. ' +
        'See createSubscription method for implementation guidance.'
      );
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Get current subscription (uses Supabase directly)
   */
  static async getCurrentSubscription(clerkUserId: string): Promise<UserSubscription | null> {
    try {
      // Get user profile to get internal user ID
      const userProfile = await SupabaseSubscriptionService.getUserProfile(clerkUserId);
      if (!userProfile) return null;

      return await SupabaseSubscriptionService.getCurrentSubscription(userProfile.id);
    } catch (error) {
      console.error('Error getting current subscription:', error);
      return null;
    }
  }

  /**
   * Get billing history (simulates backend endpoint)
   */
  static async getBillingHistory(clerkUserId: string): Promise<BillingHistory> {
    try {
      const userProfile = await SupabaseSubscriptionService.getUserProfile(clerkUserId);
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      const [paymentMethods, invoices] = await Promise.all([
        SupabaseSubscriptionService.getPaymentMethods(userProfile.id),
        SupabaseSubscriptionService.getInvoices(userProfile.id)
      ]);

      const subscription = await SupabaseSubscriptionService.getCurrentSubscription(userProfile.id);

      const paidInvoices = invoices.filter(i => i.status === 'paid');
      const totalPaidDecimal = paidInvoices
        .reduce((total, invoice) => total.plus(invoice.amount ?? 0), toDecimal(0));
      const totalPaidCurrency = paidInvoices.length > 0 ? paidInvoices[0].currency ?? null : null;

      return {
        invoices,
        paymentMethods,
        nextBillingDate: subscription?.currentPeriodEnd,
        totalPaid: toStorageNumber(totalPaidDecimal),
        totalPaidCurrency,
      };
    } catch (error) {
      console.error('Error getting billing history:', error);
      throw error;
    }
  }

  /**
   * Create customer portal session (simulates backend endpoint)
   */
  static async createPortalSession(): Promise<string> {
    try {
      throw new Error(
        'Customer portal requires a backend API endpoint.\n' +
        'Implement POST /api/billing/portal that:\n' +
        '1. Gets user from session\n' +
        '2. Creates Stripe portal session\n' +
        '3. Returns portal URL'
      );
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw error;
    }
  }

  /**
   * Demo functions for testing the UI components
   */
  static async createDemoSubscription(
    clerkUserId: string,
    tier: 'premium' | 'pro'
  ): Promise<UserSubscription> {
    try {
      const userProfile = await SupabaseSubscriptionService.getUserProfile(clerkUserId);
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      // Create a demo subscription in the database
      const demoSubscription: Partial<UserSubscription> = {
        userId: userProfile.id,
        tier,
        status: 'trialing',
        stripeCustomerId: `cus_demo_${Date.now()}`,
        stripeSubscriptionId: `sub_demo_${Date.now()}`,
        stripePriceId: tier === 'premium' ? 'price_premium' : 'price_pro',
        trialStart: new Date(),
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        cancelAtPeriodEnd: false
      };

      return await SupabaseSubscriptionService.upsertSubscription(demoSubscription);
    } catch (error) {
      console.error('Error creating demo subscription:', error);
      throw error;
    }
  }

  /**
   * Demo function to cancel subscription
   */
  static async cancelDemoSubscription(clerkUserId: string): Promise<UserSubscription> {
    try {
      const userProfile = await SupabaseSubscriptionService.getUserProfile(clerkUserId);
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      const currentSubscription = await SupabaseSubscriptionService.getCurrentSubscription(userProfile.id);
      if (!currentSubscription) {
        throw new Error('No subscription found');
      }

      const updatedSubscription: Partial<UserSubscription> = {
        ...currentSubscription,
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelAtPeriodEnd: true
      };

      return await SupabaseSubscriptionService.upsertSubscription(updatedSubscription);
    } catch (error) {
      console.error('Error canceling demo subscription:', error);
      throw error;
    }
  }

  /**
   * Initialize user profile (call this when user signs up)
   */
  static async initializeUserProfile(
    clerkUserId: string,
    email: string,
    fullName?: string
  ): Promise<void> {
    try {
      await SupabaseSubscriptionService.createUserProfile(clerkUserId, email, fullName);
      
      // Initialize usage tracking
      const userProfile = await SupabaseSubscriptionService.getUserProfile(clerkUserId);
      if (userProfile) {
        await SupabaseSubscriptionService.refreshUsageCounts(userProfile.id);
      }
    } catch (error) {
      console.error('Error initializing user profile:', error);
      // Don't throw here as this might be called multiple times
    }
  }

  /**
   * Check feature access for current user
   */
  static async checkFeatureAccess(clerkUserId: string, feature: string): Promise<boolean> {
    try {
      const userProfile = await SupabaseSubscriptionService.getUserProfile(clerkUserId);
      if (!userProfile) return false;

      return await SupabaseSubscriptionService.hasFeatureAccess(userProfile.id, feature);
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  /**
   * Get usage information for current user
   */
  static async getUsageInfo(clerkUserId: string) {
    try {
      const userProfile = await SupabaseSubscriptionService.getUserProfile(clerkUserId);
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      const [subscription, usage] = await Promise.all([
        SupabaseSubscriptionService.getCurrentSubscription(userProfile.id),
        SupabaseSubscriptionService.getSubscriptionUsage(userProfile.id)
      ]);

      return {
        subscription,
        usage,
        tier: subscription?.tier || 'free'
      };
    } catch (error) {
      console.error('Error getting usage info:', error);
      throw error;
    }
  }
}

/**
 * Backend API Implementation Guide
 * 
 * To complete the Stripe integration, implement these backend endpoints:
 */

export const BACKEND_IMPLEMENTATION_GUIDE = `
# Stripe Subscription Backend Implementation

## Required API Endpoints

### 1. POST /api/subscriptions
Create a new subscription
- Verify user authentication
- Create Stripe customer if doesn't exist
- Create Stripe subscription with price_id
- Store subscription in database
- Return client_secret for payment confirmation

### 2. PATCH /api/subscriptions/:id
Update existing subscription
- Verify user owns subscription
- Update Stripe subscription
- Update database record
- Return updated subscription

### 3. GET /api/subscriptions/current
Get user's current subscription
- Verify authentication
- Get subscription from database
- Sync with Stripe if needed
- Return subscription data

### 4. POST /api/billing/portal
Create Stripe customer portal session
- Verify authentication
- Get Stripe customer ID
- Create portal session
- Return portal URL

### 5. POST /api/webhooks/stripe
Handle Stripe webhooks
- Verify webhook signature
- Handle subscription events:
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.payment_succeeded
  - invoice.payment_failed
- Update database accordingly

## Environment Variables
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

## Example Express.js Implementation

\`\`\`javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create subscription
app.post('/api/subscriptions', async (req, res) => {
  const { priceId, paymentMethodId } = req.body;
  const userId = req.user.id; // from auth middleware
  
  try {
    // Create or get customer
    const customer = await getOrCreateStripeCustomer(userId);
    
    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
    
    // Save to database
    await saveSubscriptionToDatabase(userId, subscription);
    
    res.json({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      status: subscription.status
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Webhook handler
app.post('/api/webhooks/stripe', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    
    switch (event.type) {
      case 'customer.subscription.updated':
        handleSubscriptionUpdated(event.data.object);
        break;
      // Handle other events...
    }
    
    res.json({received: true});
  } catch (error) {
    res.status(400).send(\`Webhook Error: \${error.message}\`);
  }
});
\`\`\`

## Security Considerations
- Validate all inputs
- Verify user authentication
- Check user permissions
- Validate webhook signatures
- Use HTTPS in production
- Implement rate limiting
- Log all subscription changes
`;

export default SubscriptionApiService;
