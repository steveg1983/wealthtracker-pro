/**
 * EnhancedPortfolioView Tests
 * Tests for the enhanced portfolio view component
 * 
 * Note: This component relies on live stock price data which is mocked for testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EnhancedPortfolioView from './EnhancedPortfolioView';
import type { Holding } from '../types';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}));

// Mock icons
vi.mock('./icons', () => ({
  ArrowLeft: ({ size }: { size?: number }) => <div data-testid="arrow-left-icon" data-size={size} />,
  RefreshCw: ({ size }: { size?: number }) => <div data-testid="refresh-icon" data-size={size} />,
  TrendingUp: ({ size }: { size?: number }) => <div data-testid="trending-up-icon" data-size={size} />,
  TrendingDown: ({ size }: { size?: number }) => <div data-testid="trending-down-icon" data-size={size} />,
  Clock: ({ size }: { size?: number }) => <div data-testid="clock-icon" data-size={size} />,
}));

// Mock holdings data
const mockHoldings: Holding[] = [
  {
    id: 'h1',
    accountId: 'acc1',
    ticker: 'AAPL',
    name: 'Apple Inc.',
    shares: 100,
    value: 15000,
    averageCost: 140,
    type: 'stock'
  },
  {
    id: 'h2',
    accountId: 'acc1',
    ticker: 'GOOGL',
    name: 'Alphabet Inc.',
    shares: 50,
    value: 6000,
    averageCost: 110,
    type: 'stock'
  },
  {
    id: 'h3',
    accountId: 'acc1',
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    shares: 75,
    value: 22500,
    averageCost: 280,
    type: 'stock'
  }
];

// Mock stock prices
const mockPrices = new Map([
  ['AAPL', { 
    price: 155.00, 
    currency: 'USD', 
    lastUpdated: new Date(),
    name: 'Apple Inc.',
    change: 2.50,
    changePercent: 1.64
  }],
  ['GOOGL', { 
    price: 125.00, 
    currency: 'USD', 
    lastUpdated: new Date(),
    name: 'Alphabet Inc.',
    change: -1.20,
    changePercent: -0.95
  }],
  ['MSFT', { 
    price: 310.00, 
    currency: 'USD', 
    lastUpdated: new Date(),
    name: 'Microsoft Corporation',
    change: 5.00,
    changePercent: 1.64
  }]
]);

// Mock the useStockPrices hook
vi.mock('../hooks/useStockPrices', () => ({
  useStockPrices: () => ({
    prices: mockPrices,
    loading: false,
    error: null,
    refreshPrices: vi.fn()
  })
}));

// Mock stock price service
vi.mock('../services/stockPriceService', () => ({
  convertStockPrice: vi.fn(async (price, fromCurrency, toCurrency) => {
    // Simple mock conversion (no actual conversion)
    return {
      times: (shares: number) => ({
        toNumber: () => price.toNumber() * shares
      }),
      toNumber: () => price.toNumber()
    };
  })
}));

// Mock utils
vi.mock('../utils/currency', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`
}));

vi.mock('../utils/decimal', () => ({
  toDecimal: (value: number) => ({
    times: (other: number) => ({
      toNumber: () => value * other
    }),
    toNumber: () => value
  })
}));

describe('EnhancedPortfolioView', () => {
  const mockOnClose = vi.fn();
  const defaultProps = {
    accountId: 'acc1',
    accountName: 'Investment Account',
    holdings: mockHoldings,
    currency: 'USD',
    onClose: mockOnClose
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders portfolio header with account name', () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      expect(screen.getByText('Investment Account')).toBeInTheDocument();
      expect(screen.getByText('Portfolio')).toBeInTheDocument();
    });

    it('renders back button', () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton).toBeInTheDocument();
      expect(screen.getByTestId('arrow-left-icon')).toBeInTheDocument();
    });

    it('renders refresh button', () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
    });

    it('displays total portfolio value', async () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      await waitFor(() => {
        // AAPL: 100 * 155 = 15,500
        // GOOGL: 50 * 125 = 6,250
        // MSFT: 75 * 310 = 23,250
        // Total: 45,000
        expect(screen.getByText(/Total Value/i)).toBeInTheDocument();
        expect(screen.getByText('$45,000.00')).toBeInTheDocument();
      });
    });
  });

  describe('holdings display', () => {
    it('shows all holdings with tickers', async () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('GOOGL')).toBeInTheDocument();
        expect(screen.getByText('MSFT')).toBeInTheDocument();
      });
    });

    it('displays holding names', async () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
        expect(screen.getByText('Alphabet Inc.')).toBeInTheDocument();
        expect(screen.getByText('Microsoft Corporation')).toBeInTheDocument();
      });
    });

    it('shows share counts', async () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/100 shares/i)).toBeInTheDocument();
        expect(screen.getByText(/50 shares/i)).toBeInTheDocument();
        expect(screen.getByText(/75 shares/i)).toBeInTheDocument();
      });
    });

    it('displays current prices', async () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('$155.00')).toBeInTheDocument();
        expect(screen.getByText('$125.00')).toBeInTheDocument();
        expect(screen.getByText('$310.00')).toBeInTheDocument();
      });
    });
  });

  describe('gains and losses', () => {
    it('shows gain indicators for profitable holdings', async () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      await waitFor(() => {
        // AAPL and MSFT should show gains
        const trendingUpIcons = screen.getAllByTestId('trending-up-icon');
        expect(trendingUpIcons.length).toBeGreaterThan(0);
      });
    });

    it('shows loss indicators for losing holdings', async () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      await waitFor(() => {
        // GOOGL should show loss
        const trendingDownIcons = screen.getAllByTestId('trending-down-icon');
        expect(trendingDownIcons.length).toBeGreaterThan(0);
      });
    });

    it('displays total portfolio gain', async () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/Total Gain\/Loss/i)).toBeInTheDocument();
        // Total gain should be positive
        expect(screen.getByText(/\+\$/)).toBeInTheDocument();
      });
    });
  });

  describe('sorting', () => {
    it('renders sort dropdown', () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      const sortSelect = screen.getByLabelText(/sort by/i);
      expect(sortSelect).toBeInTheDocument();
    });

    it('has value as default sort option', () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      const sortSelect = screen.getByLabelText(/sort by/i) as HTMLSelectElement;
      expect(sortSelect.value).toBe('value');
    });

    it('allows sorting by different criteria', async () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      const sortSelect = screen.getByLabelText(/sort by/i);
      
      // Change to sort by name
      fireEvent.change(sortSelect, { target: { value: 'name' } });
      
      await waitFor(() => {
        const holdings = screen.getAllByRole('row');
        // First holding should be Alphabet (alphabetically first)
        expect(holdings[1]).toHaveTextContent('Alphabet Inc.');
      });
    });
  });

  describe('interactions', () => {
    it('calls onClose when back button is clicked', () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      const backButton = screen.getByRole('button', { name: /back/i });
      fireEvent.click(backButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('shows loading state when refreshing', async () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      // Should show refreshing state temporarily
      expect(screen.getByTestId('refresh-icon')).toHaveClass('animate-spin');
      
      // Wait for refresh to complete
      await waitFor(() => {
        expect(screen.getByTestId('refresh-icon')).not.toHaveClass('animate-spin');
      }, { timeout: 2000 });
    });
  });

  describe('loading states', () => {
    it('handles loading state gracefully', () => {
      // Mock loading state
      vi.doMock('../hooks/useStockPrices', () => ({
        useStockPrices: () => ({
          prices: new Map(),
          loading: true,
          error: null,
          refreshPrices: vi.fn()
        })
      }));
      
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      // Should still render basic structure
      expect(screen.getByText('Investment Account')).toBeInTheDocument();
    });
  });

  describe('error states', () => {
    it('displays error message when price fetch fails', () => {
      // Mock error state
      vi.doMock('../hooks/useStockPrices', () => ({
        useStockPrices: () => ({
          prices: new Map(),
          loading: false,
          error: 'Failed to fetch prices',
          refreshPrices: vi.fn()
        })
      }));
      
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      // Should still show holdings with static values
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    it('shows message when no holdings', () => {
      render(<EnhancedPortfolioView {...defaultProps} holdings={[]} />);
      
      expect(screen.getByText(/no holdings/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('has accessible table structure', async () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      await waitFor(() => {
        const table = screen.getByRole('table');
        expect(table).toBeInTheDocument();
        
        const headers = screen.getAllByRole('columnheader');
        expect(headers.length).toBeGreaterThan(0);
      });
    });

    it('provides keyboard navigation for sort dropdown', () => {
      render(<EnhancedPortfolioView {...defaultProps} />);
      
      const sortSelect = screen.getByLabelText(/sort by/i);
      sortSelect.focus();
      
      expect(document.activeElement).toBe(sortSelect);
    });
  });
});