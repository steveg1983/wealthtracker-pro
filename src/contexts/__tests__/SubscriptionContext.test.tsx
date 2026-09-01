import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SubscriptionProvider, useUsageLimit, useSubscription } from '../SubscriptionContext';
import type { SubscriptionPlan, UsageMetrics } from '../../types/subscription';

// Only the auth and API boundaries are stubbed. StripeService stays real, so
// these tests exercise the same limit lookup the app runs in production.
const { mockState } = vi.hoisted(() => ({
  mockState: { tier: 'free' as SubscriptionPlan }
}));

const TEST_USER_ID = 'user_test_subscription';

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({
    isSignedIn: true,
    user: {
      id: TEST_USER_ID,
      primaryEmailAddress: { emailAddress: 'tester@example.test' },
      firstName: 'Tester',
      lastName: 'Example',
      fullName: 'Tester Example'
    }
  })
}));

vi.mock('../../services/userIdService', () => ({
  userIdService: {
    ensureUserExists: vi.fn(async () => 'db-user-id')
  }
}));

vi.mock('../../services/subscriptionApiService', () => ({
  __esModule: true,
  default: {
    initializeUserProfile: vi.fn(async () => undefined),
    getCurrentSubscription: vi.fn(async () =>
      mockState.tier === 'free'
        ? null
        : {
            id: 'sub_test',
            userId: TEST_USER_ID,
            plan: mockState.tier,
            tier: mockState.tier,
            status: 'active',
            billingPeriod: 'monthly',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(),
            cancelAtPeriodEnd: false,
            createdAt: new Date(),
            updatedAt: new Date()
          }
    )
  }
}));

type Quota = 'accounts' | 'transactions' | 'budgets' | 'goals';

function UsageProbe({ feature }: { feature: Quota }): React.JSX.Element {
  const { limit, isUnlimited, currentUsage, percentUsed, canAdd } = useUsageLimit(feature);
  const { tier, isLoading } = useSubscription();

  return (
    <dl>
      <dd data-testid="loading">{String(isLoading)}</dd>
      <dd data-testid="tier">{tier}</dd>
      <dd data-testid="limit">{String(limit)}</dd>
      <dd data-testid="unlimited">{String(isUnlimited)}</dd>
      <dd data-testid="usage">{String(currentUsage)}</dd>
      <dd data-testid="percent">{String(percentUsed)}</dd>
      <dd data-testid="can-add">{String(canAdd)}</dd>
    </dl>
  );
}

const seedUsage = (usage: Partial<UsageMetrics>): void => {
  const now = new Date().toISOString();
  localStorage.setItem(
    `usage_${TEST_USER_ID}`,
    JSON.stringify({
      subscriptionId: TEST_USER_ID,
      period: { start: now, end: now },
      usage: { accounts: 0, transactions: 0, budgets: 0, goals: 0, storage: 0, ...usage },
      limits: { accounts: 5, transactions: 100, budgets: 3, goals: 3, customReports: 0, apiCalls: 0 },
      percentageUsed: { accounts: 0, transactions: 0, budgets: 0, goals: 0, storage: 0 }
    })
  );
};

const renderProbe = async (feature: Quota = 'accounts'): Promise<void> => {
  render(
    <SubscriptionProvider>
      <UsageProbe feature={feature} />
    </SubscriptionProvider>
  );
  // Wait for the LOAD, not the tier. Waiting on the tier's text was vacuous
  // for every free-tier test — the provider's default state already reads
  // 'free', so the wait resolved on first paint and the assertions raced the
  // asynchronous usage load. Under coverage instrumentation the window widened
  // enough to fire (CI, 1 Sep 2026). isLoading flips false only after usage
  // has been set, so this wait is real for every tier.
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
};

describe('useUsageLimit', () => {
  beforeEach(() => {
    mockState.tier = 'free';
    localStorage.clear();
  });

  it('resolves a real limit for the free tier', async () => {
    // The regression this pins: the hook built a `maxAccounts` key, which is
    // not a FeatureLimits key, so every limit it reported was undefined.
    seedUsage({ accounts: 2 });

    await renderProbe('accounts');

    expect(screen.getByTestId('limit')).toHaveTextContent('5');
    expect(screen.getByTestId('limit')).not.toHaveTextContent('undefined');
    expect(screen.getByTestId('unlimited')).toHaveTextContent('false');
    expect(screen.getByTestId('percent')).toHaveTextContent('40');
  });

  it.each<Quota>(['accounts', 'transactions', 'budgets', 'goals'])(
    'resolves a real limit for %s rather than undefined',
    async (feature) => {
      await renderProbe(feature);

      expect(screen.getByTestId('limit')).not.toHaveTextContent('undefined');
      expect(screen.getByTestId('limit')).not.toHaveTextContent('NaN');
    }
  );

  it.each<SubscriptionPlan>(['premium', 'pro'])(
    'reports an unlimited allowance for the %s tier',
    async (tier) => {
      mockState.tier = tier;
      seedUsage({ accounts: 9_999 });

      await renderProbe('accounts');

      expect(screen.getByTestId('limit')).toHaveTextContent('-1');
      expect(screen.getByTestId('unlimited')).toHaveTextContent('true');
      // -1 must not be read as a quota: no percentage, and always room for more.
      expect(screen.getByTestId('percent')).toHaveTextContent('0');
      expect(screen.getByTestId('can-add')).toHaveTextContent('true');
    }
  );

  it('still allows the last item the free plan pays for', async () => {
    // Four accounts used out of five: the fifth is included in the plan.
    seedUsage({ accounts: 4 });

    await renderProbe('accounts');

    expect(screen.getByTestId('can-add')).toHaveTextContent('true');
  });

  it('refuses to go past the free limit', async () => {
    seedUsage({ accounts: 5 });

    await renderProbe('accounts');

    expect(screen.getByTestId('can-add')).toHaveTextContent('false');
    expect(screen.getByTestId('percent')).toHaveTextContent('100');
  });
});

describe('SubscriptionContext feature access', () => {
  beforeEach(() => {
    mockState.tier = 'free';
    localStorage.clear();
  });

  function FeatureProbe(): React.JSX.Element {
    const { hasFeature, tier, isLoading } = useSubscription();
    return (
      <dl>
        <dd data-testid="loading">{String(isLoading)}</dd>
        <dd data-testid="tier">{tier}</dd>
        <dd data-testid="reports">{String(hasFeature('customReports'))}</dd>
        <dd data-testid="api">{String(hasFeature('apiCalls'))}</dd>
      </dl>
    );
  }

  const renderFeatureProbe = async (): Promise<void> => {
    render(
      <SubscriptionProvider>
        <FeatureProbe />
      </SubscriptionProvider>
    );
    // Same wait as renderProbe, for the same reason: 'free' is also the
    // default, so waiting on the tier's text proved nothing for free-tier
    // tests. The load flag is real for every tier.
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
  };

  it('denies a free user a premium feature', async () => {
    await renderFeatureProbe();

    expect(screen.getByTestId('reports')).toHaveTextContent('false');
  });

  it.each<SubscriptionPlan>(['premium', 'pro'])('grants the %s tier that feature', async (tier) => {
    mockState.tier = tier;

    await renderFeatureProbe();

    expect(screen.getByTestId('reports')).toHaveTextContent('true');
  });

  it('keeps API access to the pro tier alone', async () => {
    mockState.tier = 'premium';

    await renderFeatureProbe();

    expect(screen.getByTestId('api')).toHaveTextContent('false');
  });
});
