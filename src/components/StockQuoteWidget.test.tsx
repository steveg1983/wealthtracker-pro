/**
 * StockQuoteWidget Tests
 * Tests for the stock quote display widget and search components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import StockQuoteWidget, { StockQuoteSearch } from './StockQuoteWidget';
import { toDecimal } from '../utils/decimal';

// Mock icons
vi.mock('./icons', () => ({
  SearchIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="search-icon" className={className} style={{ fontSize: size }}>🔍</span>
  ),
  TrendingUpIcon: ({ size }: { size?: number }) => (
    <span data-testid="trending-up-icon" style={{ fontSize: size }}>📈</span>
  ),
  TrendingDownIcon: ({ size }: { size?: number }) => (
    <span data-testid="trending-down-icon" style={{ fontSize: size }}>📉</span>
  ),
  RefreshCwIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="refresh-icon" className={className} style={{ fontSize: size }}>🔄</span>
  )
}));

// Mock currency hook
const mockFormatCurrency = vi.fn((value: any) => {
  const num = typeof value === 'object' && value?.toNumber ? value.toNumber() : Number(value);
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD' 
  }).format(num);
});

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: mockFormatCurrency
  })
}));

// Mock stock price service
const mockGetStockQuote = vi.fn();
vi.mock('../services/stockPriceService', () => ({
  getStockQuote: (symbol: string) => mockGetStockQuote(symbol)
}));

// Mock stock quote data
const mockQuote = {
  symbol: 'AAPL',
  price: toDecimal(150.25),
  currency: 'USD',
  change: toDecimal(2.50),
  changePercent: toDecimal(1.69),
  previousClose: toDecimal(147.75),
  marketCap: toDecimal(2500000000000),
  volume: 52384920,
  name: 'Apple Inc.',
  lastUpdated: new Date('2024-01-15T15:30:00')
};

describe('StockQuoteWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date('2024-01-15T16:00:00'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading state on initial load', async () => {
      mockGetStockQuote.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockQuote), 100)));
      
      render(<StockQuoteWidget symbol="AAPL" />);
      
      expect(screen.getByText('Loading quote...')).toBeInTheDocument();
      expect(screen.getByTestId('refresh-icon')).toHaveClass('animate-spin');
      
      await waitFor(() => {
        expect(screen.queryByText('Loading quote...')).not.toBeInTheDocument();
      });
    });

    it.skip('shows loading spinner in header when refreshing', async () => {
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
      });
      
      mockGetStockQuote.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockQuote), 100)));
      
      const refreshButton = screen.getAllByTestId('refresh-icon')[1].parentElement;
      fireEvent.click(refreshButton!);
      
      expect(screen.getAllByTestId('refresh-icon')[0]).toHaveClass('animate-spin');
    });
  });

  describe('Error State', () => {
    it('shows error message when fetch fails', async () => {
      mockGetStockQuote.mockRejectedValue(new Error('Network error'));
      
      render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch quote')).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      mockGetStockQuote.mockRejectedValue(new Error('Network error'));
      
      render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('retries fetch when retry button clicked', async () => {
      mockGetStockQuote.mockRejectedValueOnce(new Error('Network error'));
      mockGetStockQuote.mockResolvedValueOnce(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch quote')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Retry'));
      
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
      });
      
      expect(mockGetStockQuote).toHaveBeenCalledTimes(2);
    });

    it('shows error when quote not found', async () => {
      mockGetStockQuote.mockResolvedValue(null);
      
      render(<StockQuoteWidget symbol="INVALID" />);
      
      await waitFor(() => {
        expect(screen.getByText('Quote not found')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('shows no quote message when symbol is empty', () => {
      render(<StockQuoteWidget symbol="" />);
      
      expect(screen.getByText('No quote available')).toBeInTheDocument();
    });
  });

  describe('Quote Display', () => {
    it('displays symbol and price', async () => {
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('$150.25')).toBeInTheDocument();
      });
    });

    it('displays company name when available', async () => {
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
      });
    });

    it('displays currency', async () => {
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('USD')).toBeInTheDocument();
      });
    });

    it('displays positive change with green color and up icon', async () => {
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('+$2.50')).toBeInTheDocument();
        expect(screen.getByText('(+1.69%)')).toBeInTheDocument();
        expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
        const changeContainer = screen.getByText('+$2.50').parentElement;
        expect(changeContainer).toHaveClass('text-green-600');
      });
    });

    it('displays negative change with red color and down icon', async () => {
      mockGetStockQuote.mockResolvedValue({
        ...mockQuote,
        change: toDecimal(-2.50),
        changePercent: toDecimal(-1.69)
      });
      
      render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('-$2.50')).toBeInTheDocument();
        expect(screen.getByText('(-1.69%)')).toBeInTheDocument();
        expect(screen.getByTestId('trending-down-icon')).toBeInTheDocument();
        const changeContainer = screen.getByText('-$2.50').parentElement;
        expect(changeContainer).toHaveClass('text-red-600');
      });
    });
  });

  describe('Details Section', () => {
    it('does not show details by default', async () => {
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
      });
      
      expect(screen.queryByText('Previous Close')).not.toBeInTheDocument();
    });

    it('shows details when showDetails is true', async () => {
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" showDetails={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Previous Close')).toBeInTheDocument();
        expect(screen.getByText('$147.75')).toBeInTheDocument();
      });
    });

    it('shows volume when available', async () => {
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" showDetails={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Volume')).toBeInTheDocument();
        expect(screen.getByText('52,384,920')).toBeInTheDocument();
      });
    });

    it('shows market cap when available', async () => {
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" showDetails={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Market Cap')).toBeInTheDocument();
        expect(screen.getByText('$2,500,000,000,000.00')).toBeInTheDocument();
      });
    });

    it('shows last updated time', async () => {
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" showDetails={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Last Updated')).toBeInTheDocument();
        expect(screen.getByText('3:30:00 PM')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it.skip('refreshes quote when refresh button clicked', async () => {
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
      });
      
      mockGetStockQuote.mockResolvedValue({
        ...mockQuote,
        price: toDecimal(152.00)
      });
      
      const refreshButton = screen.getAllByTestId('refresh-icon')[1].parentElement;
      fireEvent.click(refreshButton!);
      
      await waitFor(() => {
        expect(screen.getByText('$152.00')).toBeInTheDocument();
      });
    });

    it.skip('disables refresh button while loading', async () => {
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
      });
      
      mockGetStockQuote.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockQuote), 100)));
      
      const refreshButtonIcon = screen.getAllByTestId('refresh-icon')[1];
      const refreshButton = refreshButtonIcon.parentElement!;
      fireEvent.click(refreshButton);
      
      expect(refreshButton).toHaveClass('disabled:opacity-50');
    });

    it.skip('auto-refreshes every 30 seconds', async () => {
      vi.useRealTimers();
      vi.useFakeTimers();
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
      });
      
      expect(mockGetStockQuote).toHaveBeenCalledTimes(1);
      
      act(() => {
        vi.advanceTimersByTime(30000);
      });
      
      expect(mockGetStockQuote).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it.skip('clears interval on unmount', async () => {
      vi.useRealTimers();
      vi.useFakeTimers();
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      const { unmount } = render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
      });
      
      unmount();
      
      act(() => {
        vi.advanceTimersByTime(30000);
      });
      
      // Should not have been called again after unmount
      expect(mockGetStockQuote).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });

  describe('Callbacks', () => {
    it.skip('calls onQuoteUpdate when quote is fetched', async () => {
      const mockOnQuoteUpdate = vi.fn();
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      render(<StockQuoteWidget symbol="AAPL" onQuoteUpdate={mockOnQuoteUpdate} />);
      
      await waitFor(() => {
        expect(mockOnQuoteUpdate).toHaveBeenCalledWith(mockQuote);
      });
    });

    it.skip('does not call onQuoteUpdate when quote is null', async () => {
      const mockOnQuoteUpdate = vi.fn();
      mockGetStockQuote.mockResolvedValue(null);
      
      render(<StockQuoteWidget symbol="AAPL" onQuoteUpdate={mockOnQuoteUpdate} />);
      
      await waitFor(() => {
        expect(screen.getByText('Quote not found')).toBeInTheDocument();
      });
      
      expect(mockOnQuoteUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Symbol Changes', () => {
    it.skip('fetches new quote when symbol changes', async () => {
      mockGetStockQuote.mockResolvedValue(mockQuote);
      
      const { rerender } = render(<StockQuoteWidget symbol="AAPL" />);
      
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
      });
      
      mockGetStockQuote.mockResolvedValue({
        ...mockQuote,
        symbol: 'GOOGL',
        name: 'Alphabet Inc.'
      });
      
      rerender(<StockQuoteWidget symbol="GOOGL" />);
      
      await waitFor(() => {
        expect(screen.getByText('GOOGL')).toBeInTheDocument();
        expect(screen.getByText('Alphabet Inc.')).toBeInTheDocument();
      });
    });
  });
});

describe('StockQuoteSearch', () => {
  describe('Search Input', () => {
    it('renders search input with placeholder', () => {
      render(<StockQuoteSearch onStockSelect={vi.fn()} />);
      
      expect(screen.getByPlaceholderText('Search stocks (e.g., AAPL)')).toBeInTheDocument();
    });

    it('shows search icon', () => {
      render(<StockQuoteSearch onStockSelect={vi.fn()} />);
      
      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });

    it('updates input value on type', () => {
      render(<StockQuoteSearch onStockSelect={vi.fn()} />);
      
      const input = screen.getByPlaceholderText('Search stocks (e.g., AAPL)');
      fireEvent.change(input, { target: { value: 'AA' } });
      
      expect(input).toHaveValue('AA');
    });
  });

  describe('Suggestions', () => {
    it('shows no suggestions initially', () => {
      render(<StockQuoteSearch onStockSelect={vi.fn()} />);
      
      expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    });

    it('shows suggestions when typing', () => {
      render(<StockQuoteSearch onStockSelect={vi.fn()} />);
      
      const input = screen.getByPlaceholderText('Search stocks (e.g., AAPL)');
      fireEvent.change(input, { target: { value: 'A' } });
      
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('AMZN')).toBeInTheDocument();
      expect(screen.getByText('ADBE')).toBeInTheDocument();
    });

    it('filters suggestions based on input', () => {
      render(<StockQuoteSearch onStockSelect={vi.fn()} />);
      
      const input = screen.getByPlaceholderText('Search stocks (e.g., AAPL)');
      fireEvent.change(input, { target: { value: 'AA' } });
      
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.queryByText('AMZN')).not.toBeInTheDocument();
    });

    it('shows max 10 suggestions', () => {
      render(<StockQuoteSearch onStockSelect={vi.fn()} />);
      
      const input = screen.getByPlaceholderText('Search stocks (e.g., AAPL)');
      fireEvent.change(input, { target: { value: 'A' } });
      
      const suggestions = screen.getAllByRole('button');
      expect(suggestions.length).toBeLessThanOrEqual(10);
    });

    it('hides suggestions when input is cleared', () => {
      render(<StockQuoteSearch onStockSelect={vi.fn()} />);
      
      const input = screen.getByPlaceholderText('Search stocks (e.g., AAPL)');
      fireEvent.change(input, { target: { value: 'A' } });
      
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      
      fireEvent.change(input, { target: { value: '' } });
      
      expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    });
  });

  describe('Stock Selection', () => {
    it('calls onStockSelect when suggestion clicked', () => {
      const mockOnStockSelect = vi.fn();
      render(<StockQuoteSearch onStockSelect={mockOnStockSelect} />);
      
      const input = screen.getByPlaceholderText('Search stocks (e.g., AAPL)');
      fireEvent.change(input, { target: { value: 'AA' } });
      
      fireEvent.click(screen.getByText('AAPL'));
      
      expect(mockOnStockSelect).toHaveBeenCalledWith('AAPL');
    });

    it('clears input after selection', () => {
      const mockOnStockSelect = vi.fn();
      render(<StockQuoteSearch onStockSelect={mockOnStockSelect} />);
      
      const input = screen.getByPlaceholderText('Search stocks (e.g., AAPL)');
      fireEvent.change(input, { target: { value: 'AA' } });
      
      fireEvent.click(screen.getByText('AAPL'));
      
      expect(input).toHaveValue('');
    });

    it('hides suggestions after selection', () => {
      const mockOnStockSelect = vi.fn();
      render(<StockQuoteSearch onStockSelect={mockOnStockSelect} />);
      
      const input = screen.getByPlaceholderText('Search stocks (e.g., AAPL)');
      fireEvent.change(input, { target: { value: 'AA' } });
      
      fireEvent.click(screen.getByText('AAPL'));
      
      expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    });
  });

  describe('Case Insensitive Search', () => {
    it('finds stocks with lowercase input', () => {
      render(<StockQuoteSearch onStockSelect={vi.fn()} />);
      
      const input = screen.getByPlaceholderText('Search stocks (e.g., AAPL)');
      fireEvent.change(input, { target: { value: 'aapl' } });
      
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('finds stocks with mixed case input', () => {
      render(<StockQuoteSearch onStockSelect={vi.fn()} />);
      
      const input = screen.getByPlaceholderText('Search stocks (e.g., AAPL)');
      fireEvent.change(input, { target: { value: 'AaPl' } });
      
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });
  });
});