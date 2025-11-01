import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PricingPlans from '../PricingPlans';

vi.mock('../../../services/stripeService', () => ({
  __esModule: true,
  default: {
    getSubscriptionPlans: vi.fn(() => ([
      {
        id: 'premium',
        name: 'Premium',
        tier: 'premium',
        description: 'Advanced features',
        price: 7.99,
        currency: 'usd',
        interval: 'month',
        features: [],
        accounts: -1,
        transactions: -1,
        maxBudgets: -1,
        maxGoals: -1,
        advancedReports: true,
        csvExport: true,
        apiAccess: false,
        prioritySupport: false,
        isPopular: true,
      },
    ])),
    isUpgrade: vi.fn(() => true),
    formatPrice: vi.fn(),
  },
}));

vi.mock('../../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    displayCurrency: 'USD',
    formatCurrency: (value: any, currency: string = 'USD') => {
      const amount = typeof value === 'number'
        ? value
        : typeof value?.toNumber === 'function'
          ? value.toNumber()
          : Number(value);
      return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
    },
  }),
}));

describe('PricingPlans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats monthly pricing with Decimal helpers', () => {
    render(<PricingPlans currentTier="free" onSelectPlan={vi.fn()} />);

    expect(
      screen.getByText((content) => content.includes('USD 7.99'))
    ).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes('/month'))
    ).toBeInTheDocument();
  });

  it('applies yearly discount and formatting', () => {
    render(<PricingPlans currentTier="free" onSelectPlan={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Yearly/ }));

    expect(
      screen.getByText((content) => content.includes('USD 76.70'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Save USD 19\.18 per year/)
    ).toBeInTheDocument();
  });
});
