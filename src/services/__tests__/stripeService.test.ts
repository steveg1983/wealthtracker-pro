import { describe, it, expect, vi, afterEach } from 'vitest';
import StripeService from '../stripeService';

const createJsonResponse = (body: unknown, init?: ResponseInit): Response => {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
};

describe('StripeService (deterministic)', () => {
  afterEach(() => {
    StripeService.resetForTesting();
  });

  it('creates checkout sessions using injected dependencies', async () => {
    const fetchSpy = vi.fn(async () =>
      createJsonResponse({ data: { sessionId: 'sess_123', url: 'https://checkout' } })
    );

    StripeService.configure({
      fetch: fetchSpy,
      apiBaseUrl: 'https://api.test',
      locationOrigin: 'https://app.test'
    });

    const result = await StripeService.createCheckoutSession('premium', 'token-abc');

    expect(result).toEqual({ sessionId: 'sess_123', url: 'https://checkout' });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.test/api/subscriptions/create-checkout',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          planType: 'premium',
          successUrl: 'https://app.test/subscription?success=true',
          cancelUrl: 'https://app.test/subscription'
        })
      })
    );
  });

  it('parses current subscription responses via injected fetch', async () => {
    const payload = {
      success: true,
      data: {
        hasSubscription: true,
        planType: 'premium',
        status: 'active',
        subscriptionId: 'sub_123',
        customerId: 'cus_456',
        currentPeriodStart: '2025-01-01',
        currentPeriodEnd: '2025-02-01',
        trialEnd: null,
        cancelAtPeriodEnd: false
      }
    };

    const fetchSpy = vi.fn(async () => createJsonResponse(payload));

    StripeService.configure({
      fetch: fetchSpy,
      apiBaseUrl: 'https://api.test'
    });

    const subscription = await StripeService.getCurrentSubscription('token-xyz');

    expect(subscription?.stripeSubscriptionId).toBe('sub_123');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.test/api/subscriptions/status',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-xyz' })
      })
    );
  });

  it('returns plan metadata with injected price ids', () => {
    StripeService.configure({
      premiumPriceId: 'price_premium',
      proPriceId: 'price_pro'
    });

    const plans = StripeService.getSubscriptionPlans();
    const premium = plans.find(p => p.name === 'Premium' && p.interval === 'month');
    expect(premium?.stripePriceId).toBe('price_premium');
  });
});
