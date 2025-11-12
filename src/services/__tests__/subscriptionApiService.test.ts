import { describe, it, expect, vi, beforeEach } from 'vitest';
import SubscriptionApiService from '../subscriptionApiService';

const createSupabaseMock = () => ({
  getUserProfile: vi.fn(),
  getCurrentSubscription: vi.fn(),
  getPaymentMethods: vi.fn(),
  getInvoices: vi.fn(),
  upsertSubscription: vi.fn(),
  createUserProfile: vi.fn(),
  refreshUsageCounts: vi.fn(),
  hasFeatureAccess: vi.fn(),
  getSubscriptionUsage: vi.fn()
});

describe('SubscriptionApiService (deterministic)', () => {
  const logger = { error: vi.fn(), warn: vi.fn() };
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    Object.values(logger).forEach(fn => fn.mockReset());
    SubscriptionApiService.configure({
      logger,
      supabaseService: supabaseMock as any
    });
  });

  it('initializes user profile and refreshes usage counts', async () => {
    supabaseMock.getUserProfile.mockResolvedValueOnce({ id: 'user-123' });

    await SubscriptionApiService.initializeUserProfile('clerk_abc', 'demo@example.com', 'Demo User');

    expect(supabaseMock.createUserProfile).toHaveBeenCalledWith('clerk_abc', 'demo@example.com', 'Demo User');
    expect(supabaseMock.refreshUsageCounts).toHaveBeenCalledWith('user-123');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns billing history aggregated from Supabase service', async () => {
    supabaseMock.getUserProfile.mockResolvedValueOnce({ id: 'user-1' });
    supabaseMock.getPaymentMethods.mockResolvedValueOnce([{ id: 'pm_1' }] as any);
    supabaseMock.getInvoices.mockResolvedValueOnce([
      { id: 'inv_1', amount: 1000, currency: 'usd', status: 'paid', createdAt: new Date('2025-01-01') },
      { id: 'inv_2', amount: 500, currency: 'usd', status: 'pending', createdAt: new Date('2025-01-15') }
    ] as any);
    supabaseMock.getCurrentSubscription.mockResolvedValueOnce({ currentPeriodEnd: new Date('2025-02-01') } as any);

    const history = await SubscriptionApiService.getBillingHistory('clerk_1');

    expect(history.paymentMethods).toHaveLength(1);
    expect(history.nextBillingDate).toEqual(new Date('2025-02-01'));
    expect(history.totalPaid).toBe(1000);
    expect(history.totalPaidCurrency).toBe('usd');
    expect(supabaseMock.getPaymentMethods).toHaveBeenCalledWith('user-1');
  });
});
