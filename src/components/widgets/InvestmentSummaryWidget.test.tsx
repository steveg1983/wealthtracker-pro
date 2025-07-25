import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import InvestmentSummaryWidget from './InvestmentSummaryWidget';
import { useApp } from '../../contexts/AppContext';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { Account, Investment } from '../../types';

// Mock the contexts and hooks
vi.mock('../../contexts/AppContext');
vi.mock('../../hooks/useCurrencyDecimal');

// Mock icons
vi.mock('../icons', () => ({
  TrendingUpIcon: ({ size }: { size?: number }) => (
    <div data-testid="TrendingUpIcon" data-size={size} />
  ),
  TrendingDownIcon: ({ size }: { size?: number }) => (
    <div data-testid="TrendingDownIcon" data-size={size} />
  ),
  LineChartIcon: ({ size }: { size?: number }) => (
    <div data-testid="LineChartIcon" data-size={size} />
  ),
}));

// Mock recharts to avoid canvas issues
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Line: ({ type, dataKey, stroke, strokeWidth, dot }: any) => (
    <div 
      data-testid="line" 
      data-type={type} 
      data-key={dataKey} 
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      data-dot={dot}
    />
  ),
  XAxis: ({ dataKey, tickFormatter }: any) => (
    <div data-testid="x-axis" data-key={dataKey} data-formatter={tickFormatter ? 'has-formatter' : 'no-formatter'} />
  ),
  YAxis: ({ tickFormatter }: any) => (
    <div data-testid="y-axis" data-formatter={tickFormatter ? 'has-formatter' : 'no-formatter'} />
  ),
  CartesianGrid: ({ strokeDasharray, stroke }: any) => (
    <div data-testid="cartesian-grid" data-stroke-dasharray={strokeDasharray} data-stroke={stroke} />
  ),
  Tooltip: ({ formatter, labelFormatter }: any) => (
    <div 
      data-testid="tooltip" 
      data-formatter={formatter ? 'has-formatter' : 'no-formatter'}
      data-label-formatter={labelFormatter ? 'has-label-formatter' : 'no-label-formatter'}
    />
  ),
}));

const mockUseApp = useApp as Mock;
const mockUseCurrencyDecimal = useCurrencyDecimal as Mock;

// Mock data
const mockInvestmentAccounts: Account[] = [
  {
    id: 'inv1',
    name: 'Brokerage Account',
    type: 'investment',
    balance: 50000,
    currency: 'USD',
    institution: 'Vanguard',
    lastUpdated: new Date('2024-01-20'),
  },
  {
    id: 'inv2',
    name: 'IRA',
    type: 'investment',
    balance: 25000,
    currency: 'USD',
    institution: 'Fidelity',
    lastUpdated: new Date('2024-01-20'),
  },
];

const mockOtherAccounts: Account[] = [
  {
    id: 'chk1',
    name: 'Checking',
    type: 'current',
    balance: 5000,
    currency: 'USD',
    institution: 'Bank',
    lastUpdated: new Date('2024-01-20'),
  },
];

const mockInvestments: Investment[] = [
  {
    id: 'stock1',
    accountId: 'inv1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    quantity: 100,
    costBasis: 150,
    currentPrice: 180,
    value: 18000,
    lastUpdated: new Date('2024-01-20'),
  },
  {
    id: 'stock2',
    accountId: 'inv1',
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    quantity: 50,
    costBasis: 100,
    currentPrice: 120,
    value: 6000,
    lastUpdated: new Date('2024-01-20'),
  },
  {
    id: 'fund1',
    accountId: 'inv2',
    symbol: 'VTSAX',
    name: 'Vanguard Total Stock Market',
    quantity: 200,
    costBasis: 100,
    currentPrice: 110,
    value: 22000,
    lastUpdated: new Date('2024-01-20'),
  },
];

describe('InvestmentSummaryWidget', () => {
  const mockFormatCurrency = vi.fn((amount: number) => `$${amount.toFixed(2)}`);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock useCurrencyDecimal
    mockUseCurrencyDecimal.mockReturnValue({
      formatCurrency: mockFormatCurrency,
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no investment accounts', () => {
      mockUseApp.mockReturnValue({
        accounts: mockOtherAccounts,
        investments: [],
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('No investment accounts')).toBeInTheDocument();
      expect(screen.getByText('Add investment account')).toBeInTheDocument();
      expect(screen.getByText('Add investment account')).toHaveAttribute('href', '/accounts');
    });

    it('shows empty state with proper styling', () => {
      mockUseApp.mockReturnValue({
        accounts: [],
        investments: [],
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      const container = screen.getByText('No investment accounts').parentElement;
      expect(container).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center', 'h-full');
    });
  });

  describe('Portfolio Summary', () => {
    it('displays total portfolio value', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: mockInvestments,
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      // Total value from accounts: 50000 + 25000 = 75000
      expect(screen.getByText('$75000.00')).toBeInTheDocument();
      expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    });

    it('calculates and displays gains correctly', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: mockInvestments,
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      // Total cost: (100 * 150) + (50 * 100) + (200 * 100) = 15000 + 5000 + 20000 = 40000
      // Total value: (100 * 180) + (50 * 120) + (200 * 110) = 18000 + 6000 + 22000 = 46000
      // Total gains: 46000 - 40000 = 6000
      expect(screen.getByText('+$6000.00')).toBeInTheDocument();
      expect(screen.getByText('Total Gains')).toBeInTheDocument();
    });

    it('calculates and displays return percentage', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: mockInvestments,
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      // Gain percentage: (6000 / 40000) * 100 = 15%
      expect(screen.getByText('+15.00%')).toBeInTheDocument();
      expect(screen.getByText('Return Rate')).toBeInTheDocument();
    });

    it('displays losses with negative values', () => {
      const lossInvestments: Investment[] = [
        {
          id: 'stock1',
          accountId: 'inv1',
          symbol: 'LOSS',
          name: 'Loss Stock',
          quantity: 100,
          costBasis: 100,
          currentPrice: 80,
          value: 8000,
          lastUpdated: new Date('2024-01-20'),
        },
      ];

      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: lossInvestments,
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      // Loss: (100 * 80) - (100 * 100) = -2000
      expect(screen.getByText('$-2000.00')).toBeInTheDocument();
      expect(screen.getByText('Total Losses')).toBeInTheDocument();
      expect(screen.getByText('-20.00%')).toBeInTheDocument();
    });

    it('displays account count correctly', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: mockInvestments,
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('2 Investment Accounts')).toBeInTheDocument();
    });

    it('displays singular account text for single account', () => {
      mockUseApp.mockReturnValue({
        accounts: [mockInvestmentAccounts[0]],
        investments: [],
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('1 Investment Account')).toBeInTheDocument();
    });
  });

  describe('Chart Display', () => {
    it('shows chart for medium size by default', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: mockInvestments,
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('shows chart for large size', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: mockInvestments,
      });

      render(<InvestmentSummaryWidget size="large" settings={{}} />);
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('hides chart for small size', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: mockInvestments,
      });

      render(<InvestmentSummaryWidget size="small" settings={{}} />);
      
      expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
    });

    it('hides chart when showChart is false', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: mockInvestments,
      });

      render(<InvestmentSummaryWidget size="medium" settings={{ showChart: false }} />);
      
      expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
    });

    it('generates chart data based on period setting', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: mockInvestments,
      });

      render(<InvestmentSummaryWidget size="medium" settings={{ period: '3M' }} />);
      
      const chartElement = screen.getByTestId('line-chart');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
      
      // Should have multiple data points
      expect(chartData.length).toBeGreaterThan(0);
      expect(chartData[0]).toHaveProperty('date');
      expect(chartData[0]).toHaveProperty('value');
    });

    it('configures chart components correctly', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: mockInvestments,
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      // Check Line configuration
      const line = screen.getByTestId('line');
      expect(line).toHaveAttribute('data-type', 'monotone');
      expect(line).toHaveAttribute('data-key', 'value');
      expect(line).toHaveAttribute('data-stroke', 'var(--color-primary)');
      expect(line).toHaveAttribute('data-stroke-width', '2');
      expect(line).toHaveAttribute('data-dot', 'false');

      // Check axes
      expect(screen.getByTestId('x-axis')).toHaveAttribute('data-formatter', 'has-formatter');
      expect(screen.getByTestId('y-axis')).toHaveAttribute('data-formatter', 'has-formatter');
      
      // Check grid
      const grid = screen.getByTestId('cartesian-grid');
      expect(grid).toHaveAttribute('data-stroke-dasharray', '3 3');
      expect(grid).toHaveAttribute('data-stroke', 'var(--color-border)');
    });
  });

  describe('Settings', () => {
    it('respects different period settings', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: mockInvestments,
      });

      const periods: Array<'1M' | '3M' | '6M' | '1Y' | 'ALL'> = ['1M', '3M', '6M', '1Y', 'ALL'];
      
      periods.forEach(period => {
        const { rerender } = render(<InvestmentSummaryWidget size="medium" settings={{ period }} />);
        
        const chartElement = screen.getByTestId('line-chart');
        const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
        expect(chartData.length).toBeGreaterThan(0);
        
        rerender(<div />); // Clean up between iterations
      });
    });

    it('defaults to 1M period when not specified', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: mockInvestments,
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      const chartElement = screen.getByTestId('line-chart');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
      
      // Default 1M should have around 30 data points
      expect(chartData.length).toBeGreaterThan(20);
      expect(chartData.length).toBeLessThan(40);
    });
  });

  describe('Icon Display', () => {
    it('shows trending up icon for positive gains', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: mockInvestments,
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      expect(screen.getByTestId('TrendingUpIcon')).toBeInTheDocument();
      expect(screen.queryByTestId('TrendingDownIcon')).not.toBeInTheDocument();
    });

    it('shows trending down icon for losses', () => {
      const lossInvestments: Investment[] = [
        {
          id: 'stock1',
          accountId: 'inv1',
          symbol: 'LOSS',
          name: 'Loss Stock',
          quantity: 100,
          costBasis: 100,
          currentPrice: 80,
          value: 8000,
          lastUpdated: new Date('2024-01-20'),
        },
      ];

      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: lossInvestments,
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      expect(screen.getByTestId('TrendingDownIcon')).toBeInTheDocument();
      expect(screen.queryByTestId('TrendingUpIcon')).not.toBeInTheDocument();
    });
  });

  describe('Links', () => {
    it('includes link to view investment details', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: mockInvestments,
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      const detailsLink = screen.getByText('View Details →');
      expect(detailsLink).toBeInTheDocument();
      expect(detailsLink).toHaveAttribute('href', '/investments');
    });
  });

  describe('Edge Cases', () => {
    it('handles accounts with no investments', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: [],
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('$75000.00')).toBeInTheDocument();
      expect(screen.getByText('+$0.00')).toBeInTheDocument(); // No gains  
      expect(screen.getByText('+0.00%')).toBeInTheDocument(); // No percentage gain
    });

    it('handles investments with missing data', () => {
      const incompleteInvestments: Investment[] = [
        {
          id: 'stock1',
          accountId: 'inv1',
          symbol: 'TEST',
          name: 'Test Stock',
          // Missing quantity, costBasis, currentPrice
          value: 1000,
          lastUpdated: new Date('2024-01-20'),
        },
      ];

      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: incompleteInvestments,
      });

      expect(() => {
        render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      }).not.toThrow();
      
      expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    });

    it('handles undefined investments array', () => {
      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: undefined,
      });

      expect(() => {
        render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      }).not.toThrow();
      
      expect(screen.getByText('$75000.00')).toBeInTheDocument();
    });

    it('handles zero cost basis', () => {
      const zeroCostInvestments: Investment[] = [
        {
          id: 'stock1',
          accountId: 'inv1',
          symbol: 'FREE',
          name: 'Free Stock',
          quantity: 100,
          costBasis: 0,
          currentPrice: 50,
          value: 5000,
          lastUpdated: new Date('2024-01-20'),
        },
      ];

      mockUseApp.mockReturnValue({
        accounts: mockInvestmentAccounts,
        investments: zeroCostInvestments,
      });

      render(<InvestmentSummaryWidget size="medium" settings={{}} />);
      
      // With zero cost basis, percentage should be 0
      expect(screen.getByText('+0.00%')).toBeInTheDocument();
    });
  });
});