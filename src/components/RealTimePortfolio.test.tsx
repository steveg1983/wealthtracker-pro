/**
 * RealTimePortfolio Tests
 * Tests for the real-time portfolio tracking component
 * 
 * Note: This component uses real-time stock data which is mocked for testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RealTimePortfolio from './RealTimePortfolio';
import type { Account } from '../types';
import { formatCurrency as formatCurrencyDecimal } from '../utils/currency-decimal';

const toNumeric = (raw: unknown): number => {
  if (typeof raw === 'number') return raw;
  if (raw && typeof raw === 'object') {
    if ('value' in (raw as Record<string, unknown>) && typeof (raw as any).value === 'number') {
      return (raw as any).value;
    }
    if (typeof (raw as any).toNumber === 'function') {
      return (raw as any).toNumber();
    }
  }
  const coerced = Number(raw);
  return Number.isFinite(coerced) ? coerced : 0;
};

const createMockDecimal = (raw: unknown) => {
  const value = toNumeric(raw);
  const wrap = (next: unknown) => createMockDecimal(next);

  return {
    value,
    plus: (other: unknown) => wrap(value + toNumeric(other)),
    minus: (other: unknown) => wrap(value - toNumeric(other)),
    times: (other: unknown) => wrap(value * toNumeric(other)),
    dividedBy: (other: unknown) => wrap(value / (toNumeric(other) || 1)),
    greaterThanOrEqualTo: (other: unknown) => value >= toNumeric(other),
    greaterThan: (other: unknown) => value > toNumeric(other),
    lessThan: (other: unknown) => value < toNumeric(other),
    abs: () => wrap(Math.abs(value)),
    isNegative: () => value < 0,
    isZero: () => value === 0,
    toDecimalPlaces: (decimals: number) => wrap(Number(value.toFixed(decimals))),
    toNumber: () => value,
    toFixed: (decimals: number) => value.toFixed(decimals),
    toString: () => value.toString(),
    valueOf: () => value
  };
};

// Mock icons
vi.mock('./icons', () => ({
  RefreshCwIcon: ({ size, className }: { size?: number; className?: string }) => 
    <div data-testid="refresh-icon" data-size={size} className={className} />,
  TrendingUpIcon: ({ size }: { size?: number }) => 
    <div data-testid="trending-up-icon" data-size={size} />,
  TrendingDownIcon: ({ size }: { size?: number }) => 
    <div data-testid="trending-down-icon" data-size={size} />,
  AlertCircleIcon: ({ size }: { size?: number }) => 
    <div data-testid="alert-circle-icon" data-size={size} />,
}));

// Mock stock price service
vi.mock('../services/stockPriceService', () => ({
  getStockQuote: vi.fn(),
  calculatePortfolioMetrics: vi.fn(() => Promise.resolve({
    totalValue: createMockDecimal(50000),
    totalCost: createMockDecimal(45000),
    totalGain: createMockDecimal(5000),
    totalGainPercent: createMockDecimal(11.11),
    holdings: [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        shares: createMockDecimal(100),
        averageCost: createMockDecimal(140),
        currentPrice: createMockDecimal(155.5),
        marketValue: createMockDecimal(15550),
        gain: createMockDecimal(1550),
        gainPercent: createMockDecimal(11.07),
        change: createMockDecimal(2.5),
        changePercent: createMockDecimal(1.63),
        allocation: createMockDecimal(71.3),
        currency: 'USD'
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        shares: createMockDecimal(50),
        averageCost: createMockDecimal(130),
        currentPrice: createMockDecimal(125),
        marketValue: createMockDecimal(6250),
        gain: createMockDecimal(-250),
        gainPercent: createMockDecimal(-3.85),
        change: createMockDecimal(-1.5),
        changePercent: createMockDecimal(-1.18),
        allocation: createMockDecimal(28.7),
        currency: 'USD'
      }
    ]
  }))
}));

// Mock account with holdings
const mockAccountWithHoldings: Account = {
  id: 'acc1',
  name: 'Investment Account',
  type: 'investment',
  balance: 50000,
  currency: 'USD',
  institution: 'Test Broker',
  lastUpdated: new Date(),
  holdings: [
    {
      id: 'h1',
      accountId: 'acc1',
      ticker: 'AAPL',
      name: 'Apple Inc.',
      shares: 100,
      value: 14000,
      averageCost: 140,
      type: 'stock'
    },
    {
      id: 'h2',
      accountId: 'acc1',
      ticker: 'GOOGL',
      name: 'Alphabet Inc.',
      shares: 50,
      value: 6500,
      averageCost: 130,
      type: 'stock'
    }
  ]
};

const mockAccountNoHoldings: Account = {
  id: 'acc2',
  name: 'Empty Investment Account',
  type: 'investment',
  balance: 10000,
  currency: 'USD',
  institution: 'Test Broker',
  lastUpdated: new Date()
};

// Mock the useApp hook
vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    accounts: [mockAccountWithHoldings, mockAccountNoHoldings]
  })
}));

// Mock currency hook
vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (value: number | { toNumber: () => number }, currency: string = 'USD') => {
      const num = typeof value === 'number'
        ? value
        : typeof value?.toNumber === 'function'
          ? value.toNumber()
          : toNumeric(value);
      return formatCurrencyDecimal(num, currency);
    }
  })
}));

describe('RealTimePortfolio', () => {
  const formatUSD = (value: number) => formatCurrencyDecimal(value, 'USD');
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultProps = {
    accountId: 'acc1',
    accountName: 'Investment Account',
    currency: 'USD'
  };

  describe('rendering', () => {
    it('renders account name', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Investment Account')).toBeInTheDocument();
      });
    });

    it('renders refresh button', () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      expect(screen.getAllByTestId('refresh-icon').length).toBeGreaterThan(0);
    });

    it('shows last updated time', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
      });
    });

    it('renders empty state when no holdings', () => {
      render(<RealTimePortfolio {...defaultProps} accountId="acc2" />);
      
      expect(screen.getByText('No Holdings')).toBeInTheDocument();
      expect(screen.getByText(/doesn't have any stock holdings/i)).toBeInTheDocument();
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
    });
  });

  describe('portfolio metrics', () => {
    it('displays total value', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Value')).toBeInTheDocument();
        const totalValueText = screen.getByText('Total Value').parentElement?.querySelector('p.text-xl.font-bold');
        expect(totalValueText?.textContent).toBe(formatUSD(50000));
      });
    });

    it('displays total cost', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Cost')).toBeInTheDocument();
        const totalCostText = screen.getByText('Total Cost').parentElement?.querySelector('p.text-xl.font-bold');
        expect(totalCostText?.textContent).toBe(formatUSD(45000));
      });
    });

    it('displays total gain with positive indicator', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Gain/Loss')).toBeInTheDocument();
        const gainText = screen.getByText('Total Gain/Loss').parentElement?.querySelector('p.text-xl.font-bold');
        expect(gainText?.textContent).toBe(`+${formatUSD(5000)}`);
        expect(gainText).toHaveClass('text-green-600');
      });
    });

    it('displays return percentage', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Return %')).toBeInTheDocument();
        const returnText = screen.getByText('Return %').parentElement?.querySelector('p.text-xl.font-bold');
        expect(returnText?.textContent).toBe('+11.11%');
      });
    });
  });

  describe('holdings display', () => {
    it('shows holdings list header', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Holdings')).toBeInTheDocument();
      });
    });

    it('displays all holdings with symbols', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('GOOGL')).toBeInTheDocument();
      });
    });

    it('shows holding names', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
        expect(screen.getByText('Alphabet Inc.')).toBeInTheDocument();
      });
    });

    it('displays share counts', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('100.00')).toBeInTheDocument();
        expect(screen.getByText('50.00')).toBeInTheDocument();
      });
    });

    it('shows current prices', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getAllByText(formatUSD(155.5)).length).toBeGreaterThan(0);
        expect(screen.getAllByText(formatUSD(125)).length).toBeGreaterThan(0);
      });
    });
  });

  describe('loading states', () => {
    it('shows loading indicator initially', () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      expect(screen.getAllByText(/loading.../i).length).toBeGreaterThan(0);
    });

    it('shows spinning refresh icon when loading', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      const icons = screen.getAllByTestId('refresh-icon');
      expect(icons.some(icon => icon.classList.contains('animate-spin'))).toBe(true);
    });
  });

  describe('refresh functionality', () => {
    it('manual refresh updates data', async () => {
      const { calculatePortfolioMetrics } = await import('../services/stockPriceService');
      const mockCalculate = vi.mocked(calculatePortfolioMetrics);
      
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockCalculate).toHaveBeenCalled();
      });

      const initialCalls = mockCalculate.mock.calls.length;
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      await waitFor(() => {
        expect(mockCalculate.mock.calls.length).toBeGreaterThan(initialCalls);
      });
    });

    it('disables refresh button while loading', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      expect(refreshButton).toBeDisabled();
    });

    it('sets up auto-refresh interval', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      render(<RealTimePortfolio {...defaultProps} />);

      expect(setIntervalSpy).toHaveBeenCalled();
      const intervalCall = setIntervalSpy.mock.calls.find(([, delay]) => delay === 60000);
      expect(intervalCall).toBeDefined();

      setIntervalSpy.mockRestore();
    });

    it('cleans up interval on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      const { unmount } = render(<RealTimePortfolio {...defaultProps} />);
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('handles API errors gracefully', async () => {
      const { calculatePortfolioMetrics } = await import('../services/stockPriceService');
      const mockCalculate = vi.mocked(calculatePortfolioMetrics);
      
      mockCalculate.mockRejectedValueOnce(new Error('API Error'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching portfolio data:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('visual indicators', () => {
    it('shows green indicators for gains', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        const gainText = screen.getByText(`+${formatUSD(5000)}`);
        expect(gainText).toHaveClass('text-green-600');
      });
    });

    it('uses correct trend icons', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        const trendingIcons = screen.getAllByTestId('trending-up-icon');
        expect(trendingIcons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('accessibility', () => {
    it('has accessible button labels', () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();
    });

    it('provides status updates for screen readers', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
      });
    });
  });
});
// Mock decimal utility to provide lightweight decimal operations for formatting
vi.mock('../utils/decimal', async () => {
  const actual = await vi.importActual<typeof import('../utils/decimal')>('../utils/decimal');
  return {
    ...actual,
    toDecimal: (value: unknown) => createMockDecimal(value)
  };
});
