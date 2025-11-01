import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InvestmentEnhancementWidget from './InvestmentEnhancementWidget';
import { investmentEnhancementService } from '../../services/investmentEnhancementService';
import { useNavigate } from 'react-router-dom';
import { toDecimal } from '../../utils/decimal';
import type { Investment, Transaction } from '../../types';
import type { RebalancingSuggestion, RiskMetrics, DividendInfo, BenchmarkComparison } from '../../services/investmentEnhancementService';

const testCurrencySymbols: Record<string, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
  CHF: 'CHF',
};

const formatCurrencyMock = (value: any, currency: string = 'USD'): string => {
  const decimalValue = toDecimal(value);
  const isNegative = decimalValue.isNegative();
  const absolute = decimalValue.abs();
  const [integerPart, fractionalPart = ''] = absolute.toFixed(2).split('.');
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const symbol = testCurrencySymbols[currency] ?? currency;
  const formatted = `${groupedInteger}.${fractionalPart.padEnd(2, '0')}`;

  if (currency === 'CHF') {
    return `${isNegative ? '-' : ''}${formatted} ${symbol}`;
  }

  return `${isNegative ? '-' : ''}${symbol}${formatted}`;
};

const mockUseCurrencyDecimal = vi.fn();

// Mock dependencies
vi.mock('../../services/investmentEnhancementService');
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));
vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    investments: mockInvestments,
    transactions: mockTransactions,
  }),
}));
vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => mockUseCurrencyDecimal(),
}));

// Mock icons
vi.mock('../icons', () => ({
  TrendingUpIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="TrendingUpIcon" data-size={size} className={className} />
  ),
  ShieldIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="ShieldIcon" data-size={size} className={className} />
  ),
  RefreshCwIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="RefreshCwIcon" data-size={size} className={className} />
  ),
  ArrowRightIcon: ({ size }: { size?: number }) => (
    <div data-testid="ArrowRightIcon" data-size={size} />
  ),
}));

const mockNavigate = vi.fn();
const mockInvestmentEnhancementService = investmentEnhancementService as {
  getRebalancingSuggestions: Mock;
  calculateRiskMetrics: Mock;
  trackDividends: Mock;
  compareWithBenchmarks: Mock;
};

// Mock data
let mockInvestments: Investment[] = [
  {
    id: 'inv1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    quantity: 100,
    costBasis: toDecimal(15000),
    currentPrice: toDecimal(180),
    currentValue: toDecimal(18000),
    type: 'stock',
    accountId: 'acc1',
  },
  {
    id: 'inv2',
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    quantity: 50,
    costBasis: toDecimal(12000),
    currentPrice: toDecimal(350),
    currentValue: toDecimal(17500),
    type: 'stock',
    accountId: 'acc1',
  },
];

const mockTransactions: Transaction[] = [];

const mockRebalancingSuggestions: RebalancingSuggestion[] = [
  {
    symbol: 'AAPL',
    action: 'sell',
    amount: toDecimal(2000),
    shares: 11,
    reason: 'Overweight position',
  },
  {
    symbol: 'VTI',
    action: 'buy',
    amount: toDecimal(2000),
    shares: 10,
    reason: 'Increase diversification',
  },
];

const mockRiskMetrics: RiskMetrics = {
  portfolioBeta: 1.05,
  sharpeRatio: 0.85,
  standardDeviation: 12.5,
  diversificationScore: 75,
  concentrationRisk: [
    { symbol: 'AAPL', percent: 51.4, risk: 'high' },
    { symbol: 'MSFT', percent: 48.6, risk: 'medium' },
  ],
};

const mockDividends: DividendInfo[] = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    annualDividend: toDecimal(200),
    yield: 1.11,
    frequency: 'quarterly',
    totalReceived: toDecimal(50),
    projectedAnnual: toDecimal(200),
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    annualDividend: toDecimal(150),
    yield: 0.86,
    frequency: 'quarterly',
    totalReceived: toDecimal(37.50),
    projectedAnnual: toDecimal(150),
  },
];

const mockBenchmarkComparison: BenchmarkComparison = {
  portfolio: {
    return: 15.5,
    annualizedReturn: 12.8,
    totalValue: toDecimal(35500),
    startValue: toDecimal(27000),
  },
  benchmarks: [
    {
      name: 'S&P 500',
      symbol: 'SPY',
      return: 13.2,
      annualizedReturn: 11.5,
      outperformance: 2.3,
    },
    {
      name: 'Nasdaq 100',
      symbol: 'QQQ',
      return: 14.8,
      annualizedReturn: 12.2,
      outperformance: 0.7,
    },
  ],
};

describe('InvestmentEnhancementWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    mockUseCurrencyDecimal.mockReturnValue({
      formatCurrency: (value: any, currency?: string) => formatCurrencyMock(value, currency ?? 'USD'),
      displayCurrency: 'USD',
    });
    
    // Reset mock investments
    mockInvestments = [
      {
        id: 'inv1',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        quantity: 100,
        costBasis: toDecimal(15000),
        currentPrice: toDecimal(180),
        currentValue: toDecimal(18000),
        type: 'stock',
        accountId: 'acc1',
      },
      {
        id: 'inv2',
        symbol: 'MSFT',
        name: 'Microsoft Corp.',
        quantity: 50,
        costBasis: toDecimal(12000),
        currentPrice: toDecimal(350),
        currentValue: toDecimal(17500),
        type: 'stock',
        accountId: 'acc1',
      },
    ];
    
    // Default mock values
    mockInvestmentEnhancementService.getRebalancingSuggestions.mockReturnValue(mockRebalancingSuggestions);
    mockInvestmentEnhancementService.calculateRiskMetrics.mockReturnValue(mockRiskMetrics);
    mockInvestmentEnhancementService.trackDividends.mockReturnValue(mockDividends);
    mockInvestmentEnhancementService.compareWithBenchmarks.mockReturnValue(mockBenchmarkComparison);
  });

  describe('Small Size', () => {
    it('renders small size with diversification score', () => {
      render(<InvestmentEnhancementWidget size="small" />);
      
      expect(screen.getByText('Enhanced')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('Diversification')).toBeInTheDocument();
      expect(screen.getByTestId('TrendingUpIcon')).toHaveAttribute('data-size', '20');
    });

    it('navigates to enhanced investments on click', () => {
      render(<InvestmentEnhancementWidget size="small" />);
      
      const container = screen.getByText('Enhanced').closest('.cursor-pointer');
      fireEvent.click(container!);
      
      expect(mockNavigate).toHaveBeenCalledWith('/enhanced-investments');
    });
  });

  describe('No Investments State', () => {
    it('shows empty state when no investments', () => {
      mockInvestments.length = 0;
      
      render(<InvestmentEnhancementWidget />);
      
      expect(screen.getByText('No investments to analyze')).toBeInTheDocument();
      const icon = screen.getAllByTestId('TrendingUpIcon').find(icon => 
        icon.getAttribute('data-size') === '32'
      );
      expect(icon).toBeInTheDocument();
    });

    it('does not call service methods when no investments', () => {
      mockInvestments.length = 0;
      
      render(<InvestmentEnhancementWidget />);
      
      expect(mockInvestmentEnhancementService.getRebalancingSuggestions).not.toHaveBeenCalled();
      expect(mockInvestmentEnhancementService.calculateRiskMetrics).not.toHaveBeenCalled();
    });
  });

  describe('Medium Size (Default)', () => {
    it('renders header with holdings count', () => {
      render(<InvestmentEnhancementWidget />);
      
      expect(screen.getByText('Investment Enhancement')).toBeInTheDocument();
      expect(screen.getByText('2 holdings')).toBeInTheDocument();
      expect(screen.getByTestId('TrendingUpIcon')).toHaveAttribute('data-size', '20');
    });

    it('shows rebalancing alert when needed', () => {
      render(<InvestmentEnhancementWidget />);
      
      expect(screen.getByText('Portfolio rebalancing recommended')).toBeInTheDocument();
      expect(screen.getByTestId('RefreshCwIcon')).toHaveAttribute('data-size', '16');
    });

    it('does not show rebalancing alert when not needed', () => {
      mockInvestmentEnhancementService.getRebalancingSuggestions.mockReturnValue([]);
      
      render(<InvestmentEnhancementWidget />);
      
      expect(screen.queryByText('Portfolio rebalancing recommended')).not.toBeInTheDocument();
    });

    it('displays risk score with progress bar', () => {
      render(<InvestmentEnhancementWidget />);
      
      expect(screen.getByText('Risk Score')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByTestId('ShieldIcon')).toHaveAttribute('data-size', '14');
      
      // Check progress bar
      const progressBar = screen.getByText('75%').parentElement?.querySelector('.bg-purple-500');
      expect(progressBar).toHaveStyle({ width: '75%' });
    });

    it('displays projected dividends', () => {
      render(<InvestmentEnhancementWidget />);
      
      expect(screen.getByText('Annual Dividends')).toBeInTheDocument();
      expect(screen.getByText('$350.00')).toBeInTheDocument(); // 200 + 150
      expect(screen.getByText('Projected')).toBeInTheDocument();
    });

    it('shows positive benchmark performance', () => {
      render(<InvestmentEnhancementWidget />);
      
      expect(screen.getByText('vs Benchmarks')).toBeInTheDocument();
      expect(screen.getByText('+1.50%')).toBeInTheDocument(); // Average of 2.3 and 0.7
      expect(screen.getByText('Outperforming')).toBeInTheDocument();
    });

    it('shows negative benchmark performance', () => {
      mockInvestmentEnhancementService.compareWithBenchmarks.mockReturnValue({
        ...mockBenchmarkComparison,
        benchmarks: [
          { ...mockBenchmarkComparison.benchmarks[0], outperformance: -2.5 },
          { ...mockBenchmarkComparison.benchmarks[1], outperformance: -1.5 },
        ],
      });
      
      render(<InvestmentEnhancementWidget />);
      
      expect(screen.getByText('-2.00%')).toBeInTheDocument();
      expect(screen.getByText('Underperforming')).toBeInTheDocument();
      expect(screen.getByText('-2.00%')).toHaveClass('text-red-600');
    });

    it('handles zero dividends', () => {
      mockInvestmentEnhancementService.trackDividends.mockReturnValue([]);
      
      render(<InvestmentEnhancementWidget />);
      
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('shows view analytics button', () => {
      render(<InvestmentEnhancementWidget />);
      
      const button = screen.getByText('View Analytics');
      expect(button).toBeInTheDocument();
      expect(button.closest('button')).toHaveClass('bg-purple-600');
      expect(screen.getByTestId('ArrowRightIcon')).toHaveAttribute('data-size', '14');
    });

    it('navigates to enhanced investments page', () => {
      render(<InvestmentEnhancementWidget />);
      
      fireEvent.click(screen.getByText('View Analytics'));
      expect(mockNavigate).toHaveBeenCalledWith('/enhanced-investments');
    });
  });

  describe('Data Updates', () => {
    it('calculates metrics on mount', () => {
      render(<InvestmentEnhancementWidget />);
      
      // Should be called once on mount
      expect(mockInvestmentEnhancementService.getRebalancingSuggestions).toHaveBeenCalledTimes(1);
      expect(mockInvestmentEnhancementService.calculateRiskMetrics).toHaveBeenCalledTimes(1);
      expect(mockInvestmentEnhancementService.trackDividends).toHaveBeenCalledTimes(1);
      expect(mockInvestmentEnhancementService.compareWithBenchmarks).toHaveBeenCalledTimes(1);
    });

    it('passes correct parameters to service methods', () => {
      render(<InvestmentEnhancementWidget />);
      
      expect(mockInvestmentEnhancementService.getRebalancingSuggestions).toHaveBeenCalledWith(mockInvestments);
      expect(mockInvestmentEnhancementService.calculateRiskMetrics).toHaveBeenCalledWith(mockInvestments);
      expect(mockInvestmentEnhancementService.trackDividends).toHaveBeenCalledWith(
        mockInvestments,
        mockTransactions
      );
      expect(mockInvestmentEnhancementService.compareWithBenchmarks).toHaveBeenCalledWith(mockInvestments);
    });
  });

  describe('Component Structure', () => {
    it('applies correct container styles', () => {
      const { container } = render(<InvestmentEnhancementWidget />);
      
      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass('h-full', 'flex', 'flex-col');
    });

    it('uses correct icon colors', () => {
      render(<InvestmentEnhancementWidget />);
      
      const trendingIcon = screen.getAllByTestId('TrendingUpIcon')[0];
      expect(trendingIcon).toHaveClass('text-purple-600');
      
      expect(screen.getByTestId('ShieldIcon')).toHaveClass('text-purple-600');
      expect(screen.getByTestId('RefreshCwIcon')).toHaveClass('text-yellow-600');
    });

    it('applies correct metric card styles', () => {
      render(<InvestmentEnhancementWidget />);
      
      const riskCard = screen.getByText('Risk Score').closest('.bg-gray-50');
      expect(riskCard).toBeInTheDocument();
      
      const dividendCard = screen.getByText('Annual Dividends').closest('.bg-gray-50');
      expect(dividendCard).toBeInTheDocument();
    });

    it('renders all sections when investments exist', () => {
      render(<InvestmentEnhancementWidget />);
      
      // Header
      expect(screen.getByText('Investment Enhancement')).toBeInTheDocument();
      
      // Rebalancing alert
      expect(screen.getByText('Portfolio rebalancing recommended')).toBeInTheDocument();
      
      // Risk score
      expect(screen.getByText('Risk Score')).toBeInTheDocument();
      
      // Dividends
      expect(screen.getByText('Annual Dividends')).toBeInTheDocument();
      
      // Benchmarks
      expect(screen.getByText('vs Benchmarks')).toBeInTheDocument();
      
      // Button
      expect(screen.getByText('View Analytics')).toBeInTheDocument();
    });
  });
});
