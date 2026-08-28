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

describe('StripeService feature limits', () => {
  afterEach(() => {
    StripeService.resetForTesting();
  });

  it('gives each tier its own limits instead of handing everyone the free ones', () => {
    // The regression this pins: getFeatureLimits read `plan.maxAccounts` etc.,
    // which no plan ever set, so premium and pro silently received Free's
    // numbers through the fallbacks.
    const free = StripeService.getFeatureLimits('free');
    const premium = StripeService.getFeatureLimits('premium');
    const pro = StripeService.getFeatureLimits('pro');

    expect(free).toEqual({
      accounts: 5,
      transactions: 100,
      budgets: 3,
      goals: 3,
      customReports: 0,
      apiCalls: 0
    });
    expect(premium).not.toEqual(free);
    expect(pro).not.toEqual(free);
  });

  it.each<'accounts' | 'transactions' | 'budgets' | 'goals'>([
    'accounts',
    'transactions',
    'budgets',
    'goals'
  ])('sells the paid tiers unlimited %s', (quota) => {
    expect(StripeService.getFeatureLimits('premium')[quota]).toBe(-1);
    expect(StripeService.getFeatureLimits('pro')[quota]).toBe(-1);
    expect(StripeService.getFeatureLimits('free')[quota]).toBeGreaterThan(0);
  });

  it('reports exactly what each plan declares, so the two cannot drift apart', () => {
    const plans = StripeService.getSubscriptionPlans();

    for (const plan of plans) {
      const limits = StripeService.getFeatureLimits(plan.tier);
      expect(limits.accounts).toBe(plan.accounts);
      expect(limits.transactions).toBe(plan.transactions);
      expect(limits.budgets).toBe(plan.budgets);
      expect(limits.goals).toBe(plan.goals);
    }
  });

  it('separates the tiers on capability features too', () => {
    // Free's advertised "Basic reporting" and Premium's lack of API access are
    // what make hasFeatureAccess discriminate at all; every tier has *some*
    // accounts, so the quota keys alone can never tell the tiers apart.
    expect(StripeService.hasFeatureAccess('free', 'customReports')).toBe(false);
    expect(StripeService.hasFeatureAccess('premium', 'customReports')).toBe(true);
    expect(StripeService.hasFeatureAccess('pro', 'customReports')).toBe(true);

    expect(StripeService.hasFeatureAccess('free', 'apiCalls')).toBe(false);
    expect(StripeService.hasFeatureAccess('premium', 'apiCalls')).toBe(false);
    expect(StripeService.hasFeatureAccess('pro', 'apiCalls')).toBe(true);
  });

  it('treats an unlimited allowance as access, not as zero', () => {
    // -1 is the unlimited sentinel; a naive `limit > 0` reads it as "none".
    expect(StripeService.getFeatureLimits('pro').accounts).toBe(-1);
    expect(StripeService.hasFeatureAccess('pro', 'accounts')).toBe(true);
  });

  it('never runs a paid tier out of an unlimited allowance', () => {
    const hugeUsage = 1_000_000;

    expect(StripeService.isWithinLimits('premium', hugeUsage, 'transactions')).toBe(true);
    expect(StripeService.isWithinLimits('pro', hugeUsage, 'accounts')).toBe(true);
  });

  it('stops the free tier exactly at its limit', () => {
    expect(StripeService.isWithinLimits('free', 4, 'accounts')).toBe(true);
    expect(StripeService.isWithinLimits('free', 5, 'accounts')).toBe(false);
    expect(StripeService.isWithinLimits('free', 6, 'accounts')).toBe(false);
  });
});

describe('StripeService — where the API lives', () => {
  afterEach(() => {
    StripeService.resetForTesting();
  });

  it('addresses the API relatively when no base is configured', async () => {
    // The default was 'http://localhost:3000' — a URL meaning "this
    // developer's own machine" in every browser that loaded it, which
    // pointed the whole billing surface at a server the user does not run
    // (measured 28 Aug: zero requests reached the deployment while the
    // owner's Pro plan displayed as Free). A relative path is same-origin
    // in production and proxied in dev.
    const fetchSpy = vi.fn(async () =>
      createJsonResponse({ data: { hasSubscription: false, planType: 'free' } })
    );

    StripeService.configure({ fetch: fetchSpy, apiBaseUrl: '' });
    await StripeService.getCurrentSubscription('token-abc');

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/subscriptions/status',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }) })
    );
  });

  it('still honours an explicitly configured base', async () => {
    const fetchSpy = vi.fn(async () =>
      createJsonResponse({ data: { hasSubscription: false, planType: 'free' } })
    );

    StripeService.configure({ fetch: fetchSpy, apiBaseUrl: 'https://api.test' });
    await StripeService.getCurrentSubscription('token-abc');

    expect(fetchSpy).toHaveBeenCalledWith('https://api.test/api/subscriptions/status', expect.anything());
  });
});
