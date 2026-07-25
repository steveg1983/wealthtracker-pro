import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { PremiumGate } from './PremiumGate';
import type { SubscriptionPlan, SubscriptionStatus } from '../../types/subscription';

interface MockSubscriptionState {
  tier: SubscriptionPlan;
  isLoading: boolean;
  status: SubscriptionStatus | undefined;
  hasSubscriptionRow: boolean;
}

const { mockState } = vi.hoisted(() => ({
  mockState: {
    tier: 'free',
    isLoading: false,
    status: 'active',
    hasSubscriptionRow: true
  } as MockSubscriptionState
}));

vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    tier: mockState.tier,
    isLoading: mockState.isLoading,
    subscription: mockState.hasSubscriptionRow ? { status: mockState.status } : null
  })
}));

const renderGate = () =>
  render(
    <MemoryRouter>
      <PremiumGate>
        <div>Premium Content</div>
      </PremiumGate>
    </MemoryRouter>
  );

describe('PremiumGate', () => {
  beforeEach(() => {
    mockState.tier = 'free';
    mockState.isLoading = false;
    mockState.status = 'active';
    mockState.hasSubscriptionRow = true;
  });

  it('blocks the free tier and offers the plans page', () => {
    mockState.tier = 'free';
    mockState.hasSubscriptionRow = false;

    renderGate();

    expect(screen.queryByText('Premium Content')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /see plans/i })).toHaveAttribute('href', '/subscription');
  });

  it.each<SubscriptionPlan>(['premium', 'pro'])('renders the route for the %s tier', (tier) => {
    mockState.tier = tier;

    renderGate();

    expect(screen.getByText('Premium Content')).toBeInTheDocument();
  });

  it.each<SubscriptionStatus>(['active', 'trialing', 'past_due'])(
    'keeps access while the subscription status is %s',
    (status) => {
      mockState.tier = 'premium';
      mockState.status = status;

      renderGate();

      expect(screen.getByText('Premium Content')).toBeInTheDocument();
    }
  );

  it.each<SubscriptionStatus>(['cancelled', 'inactive'])(
    'revokes access once the subscription is %s, even with a paid tier on the row',
    (status) => {
      mockState.tier = 'pro';
      mockState.status = status;

      renderGate();

      expect(screen.queryByText('Premium Content')).not.toBeInTheDocument();
    }
  );

  it('does not lock out a paid tier whose status is missing', () => {
    // The tier is the primary signal; a shape change in the row must never take
    // away something the user has already paid for.
    mockState.tier = 'premium';
    mockState.status = undefined;

    renderGate();

    expect(screen.getByText('Premium Content')).toBeInTheDocument();
  });

  it('shows neither the content nor the paywall while loading', () => {
    // Flashing "upgrade" at a paying subscriber during the fetch would be worse
    // than a beat of skeleton.
    mockState.tier = 'free';
    mockState.isLoading = true;

    renderGate();

    expect(screen.queryByText('Premium Content')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /see plans/i })).not.toBeInTheDocument();
  });
});
