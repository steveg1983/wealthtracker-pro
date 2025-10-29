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

// Mock decimal utility
vi.mock('../utils/decimal', () => ({
  toDecimal: (value: number) => ({
    times: (other: any) => ({
      toNumber: () => value * (typeof other === 'number' ? other : other.toNumber())
    }),
    toNumber: () => value,
    greaterThanOrEqualTo: (other: number) => value >= other,
    toFixed: (decimals: number) => value.toFixed(decimals)
  })
}));

// Mock stock price service
vi.mock('../services/stockPriceService', () => ({
  getStockQuote: vi.fn(),
  calculatePortfolioMetrics: vi.fn(() => Promise.resolve({
    totalValue: { toNumber: () => 50000, greaterThanOrEqualTo: () => true },
    totalCost: { toNumber: () => 45000, greaterThanOrEqualTo: () => true },
    totalGain: { toNumber: () => 5000, greaterThanOrEqualTo: () => true },
    totalGainPercent: { toNumber: () => 11.11, greaterThanOrEqualTo: () => true, toFixed: () => '11.11' },
    holdings: [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        shares: { toFixed: () => '100.00' },
        currentPrice: { toNumber: () => 155.50 },
        value: { toNumber: () => 15550 },
        gain: { toNumber: () => 1550, greaterThanOrEqualTo: () => true },
        gainPercent: { toNumber: () => 11.07, greaterThanOrEqualTo: () => true, toFixed: () => '11.07' },
        change: { toNumber: () => 2.50, greaterThanOrEqualTo: () => true },
        changePercent: { toNumber: () => 1.63, greaterThanOrEqualTo: () => true, toFixed: () => '1.63' }
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        shares: { toFixed: () => '50.00' },
        currentPrice: { toNumber: () => 125.00 },
        value: { toNumber: () => 6250 },
        gain: { toNumber: () => -250, greaterThanOrEqualTo: () => false },
        gainPercent: { toNumber: () => -3.85, greaterThanOrEqualTo: () => false, toFixed: () => '-3.85' },
        change: { toNumber: () => -1.50, greaterThanOrEqualTo: () => false },
        changePercent: { toNumber: () => -1.18, greaterThanOrEqualTo: () => false, toFixed: () => '-1.18' }
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
vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    accounts: [mockAccountWithHoldings, mockAccountNoHoldings]
  })
}));

// Mock currency hook
vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (value: number | { toNumber: () => number }) => {
      const num = typeof value === 'number' ? value : value.toNumber();
      return `$${num.toFixed(2)}`;
    }
  })
}));

describe('RealTimePortfolio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
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
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
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
        expect(screen.getByText('$50000.00')).toBeInTheDocument();
      });
    });

    it('displays total cost', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Cost')).toBeInTheDocument();
        expect(screen.getByText('$45000.00')).toBeInTheDocument();
      });
    });

    it('displays total gain with positive indicator', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Gain/Loss')).toBeInTheDocument();
        expect(screen.getByText('+$5000.00')).toBeInTheDocument();
      });
    });

    it('displays return percentage', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Return %')).toBeInTheDocument();
        expect(screen.getByText('+11.11%')).toBeInTheDocument();
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
        expect(screen.getByText('$155.50')).toBeInTheDocument();
        expect(screen.getByText('$125.00')).toBeInTheDocument();
      });
    });
  });

  describe('loading states', () => {
    it('shows loading indicator initially', () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      expect(screen.getByText(/loading.../i)).toBeInTheDocument();
    });

    it('shows spinning refresh icon when loading', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      expect(screen.getByTestId('refresh-icon')).toHaveClass('animate-spin');
    });
  });

  describe('refresh functionality', () => {
    it('manual refresh updates data', async () => {
      const { calculatePortfolioMetrics } = await import('../services/stockPriceService');
      const mockCalculate = vi.mocked(calculatePortfolioMetrics);
      
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockCalculate).toHaveBeenCalledTimes(1);
      });
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      await waitFor(() => {
        expect(mockCalculate).toHaveBeenCalledTimes(2);
      });
    });

    it('disables refresh button while loading', async () => {
      render(<RealTimePortfolio {...defaultProps} />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      expect(refreshButton).toBeDisabled();
    });

    it('sets up auto-refresh interval', async () => {
      const { calculatePortfolioMetrics } = await import('../services/stockPriceService');
      const mockCalculate = vi.mocked(calculatePortfolioMetrics);
      
      render(<RealTimePortfolio {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockCalculate).toHaveBeenCalledTimes(1);
      });
      
      // Fast-forward 60 seconds
      vi.advanceTimersByTime(60000);
      
      await waitFor(() => {
        expect(mockCalculate).toHaveBeenCalledTimes(2);
      });
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
        const gainText = screen.getByText('+$5000.00');
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