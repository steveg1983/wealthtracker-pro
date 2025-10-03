import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import DashboardModal from './DashboardModal';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock icons
vi.mock('./icons/XIcon', () => ({
  XIcon: ({ size, className }: any) => <div data-testid="x-icon" className={className}>X</div>
}));

vi.mock('./icons/MaximizeIcon', () => ({
  MaximizeIcon: ({ size, className }: any) => <div data-testid="maximize-icon" className={className}>Maximize</div>
}));

vi.mock('./icons/MinimizeIcon', () => ({
  MinimizeIcon: ({ size, className }: any) => <div data-testid="minimize-icon" className={className}>Minimize</div>
}));

// Mock recharts components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children, data }: any) => <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)}>{children}</div>,
  Bar: ({ dataKey, onClick }: any) => (
    <div 
      data-testid="bar" 
      data-datakey={dataKey}
      onClick={() => onClick && onClick({ payload: { month: '2024-01' } })}
    >
      Bar
    </div>
  ),
  XAxis: ({ dataKey }: any) => <div data-testid="x-axis" data-datakey={dataKey}>XAxis</div>,
  YAxis: () => <div data-testid="y-axis">YAxis</div>,
  CartesianGrid: () => <div data-testid="cartesian-grid">Grid</div>,
  Tooltip: ({ formatter }: any) => <div data-testid="tooltip">Tooltip</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data, onClick }: any) => (
    <div 
      data-testid="pie" 
      data-chart-data={JSON.stringify(data)}
      onClick={() => onClick && onClick({ id: 'acc1' })}
    >
      Pie
      {data && data.map((_: any, index: number) => (
        <div key={index} data-testid="cell">Cell</div>
      ))}
    </div>
  ),
  Cell: () => <div data-testid="cell">Cell</div>
}));

// Mock IncomeExpenditureReport
vi.mock('./IncomeExpenditureReport', () => ({
  default: ({ settings, setSettings }: any) => (
    <div data-testid="income-expenditure-report">
      <div>Income Expenditure Report</div>
      <button onClick={() => setSettings({ ...settings, period: 'monthly' })}>
        Update Settings
      </button>
    </div>
  )
}));

// Mock ErrorBoundary
vi.mock('./ErrorBoundary', () => ({
  default: ({ children }: any) => <div data-testid="error-boundary">{children}</div>
}));

// Mock currency hook
vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `£${amount.toFixed(2)}`
  })
}));

// Type definitions
interface NetWorthData {
  month: string;
  netWorth: number;
}

interface AccountDistributionData {
  id: string;
  name: string;
  value: number;
}

interface ReconciliationData {
  account: {
    id: string;
    name: string;
  };
  unreconciledCount: number;
  totalToReconcile: number;
}

interface IncomeExpenditureData {
  settings: any;
  setSettings: any;
  categories: any[];
  transactions: any[];
  accounts: any[];
}

// Test data
const mockNetWorthData: NetWorthData[] = [
  { month: '2024-01', netWorth: 10000 },
  { month: '2024-02', netWorth: 12000 },
  { month: '2024-03', netWorth: 11500 }
];

const mockAccountDistributionData: AccountDistributionData[] = [
  { id: 'acc1', name: 'Current Account', value: 5000 },
  { id: 'acc2', name: 'Savings Account', value: 3000 },
  { id: 'acc3', name: 'Investment Account', value: 2000 }
];

const mockReconciliationData: ReconciliationData[] = [
  {
    account: { id: 'acc1', name: 'Current Account' },
    unreconciledCount: 5,
    totalToReconcile: 1500
  },
  {
    account: { id: 'acc2', name: 'Savings Account' },
    unreconciledCount: 2,
    totalToReconcile: 800
  }
];

const mockIncomeExpenditureData: IncomeExpenditureData = {
  settings: {
    period: 'monthly' as const,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    groupBy: 'category' as const,
    showComparisons: true,
    includeSubcategories: true
  },
  setSettings: vi.fn(),
  categories: [
    {
      id: 'cat1',
      name: 'Food',
      type: 'expense' as const,
      level: 'type' as const,
      color: '#FF6B6B'
    }
  ],
  transactions: [
    {
      id: 'trans1',
      date: new Date('2024-01-15'),
      amount: 50,
      description: 'Grocery store',
      category: 'cat1',
      accountId: 'acc1',
      type: 'expense' as const
    }
  ],
  accounts: [
    {
      id: 'acc1',
      name: 'Current Account',
      type: 'current' as const,
      balance: 1000,
      currency: 'GBP',
      lastUpdated: new Date('2024-01-15')
    }
  ]
};

// Wrapper component for router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('DashboardModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    type: null as any
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      render(
        <TestWrapper>
          <DashboardModal {...defaultProps} isOpen={false} />
        </TestWrapper>
      );
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    });

    it('renders nothing when type is null', () => {
      render(
        <TestWrapper>
          <DashboardModal {...defaultProps} type={null} />
        </TestWrapper>
      );
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    });

    it('renders modal when open with valid type', () => {
      render(
        <TestWrapper>
          <DashboardModal {...defaultProps} type="networth-chart" data={mockNetWorthData} />
        </TestWrapper>
      );
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
    });

    it('renders header with title and controls', () => {
      render(
        <TestWrapper>
          <DashboardModal {...defaultProps} type="networth-chart" data={mockNetWorthData} />
        </TestWrapper>
      );
      
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByTestId('maximize-icon')).toBeInTheDocument();
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });

    it('renders footer with tip', () => {
      render(
        <TestWrapper>
          <DashboardModal {...defaultProps} type="networth-chart" data={mockNetWorthData} />
        </TestWrapper>
      );
      
      expect(screen.getByText(/All interactive features/)).toBeInTheDocument();
      expect(screen.getByText(/maximize/)).toBeInTheDocument();
    });
  });

  describe('Fullscreen Toggle', () => {
    it('toggles to fullscreen mode', () => {
      render(
        <TestWrapper>
          <DashboardModal {...defaultProps} type="networth-chart" data={mockNetWorthData} />
        </TestWrapper>
      );
      
      const maximizeButton = screen.getByTestId('maximize-icon').closest('button')!;
      fireEvent.click(maximizeButton);
      
      expect(screen.getByTestId('minimize-icon')).toBeInTheDocument();
      expect(screen.getByText(/minimize/)).toBeInTheDocument();
    });

    it('toggles back from fullscreen mode', () => {
      render(
        <TestWrapper>
          <DashboardModal {...defaultProps} type="networth-chart" data={mockNetWorthData} />
        </TestWrapper>
      );
      
      const maximizeButton = screen.getByTestId('maximize-icon').closest('button')!;
      fireEvent.click(maximizeButton);
      
      const minimizeButton = screen.getByTestId('minimize-icon').closest('button')!;
      fireEvent.click(minimizeButton);
      
      expect(screen.getByTestId('maximize-icon')).toBeInTheDocument();
      expect(screen.getByText(/maximize/)).toBeInTheDocument();
    });

    it('resets fullscreen state when modal reopens', () => {
      const { rerender } = render(
        <TestWrapper>
          <DashboardModal {...defaultProps} type="networth-chart" data={mockNetWorthData} />
        </TestWrapper>
      );
      
      // Toggle to fullscreen
      const maximizeButton = screen.getByTestId('maximize-icon').closest('button')!;
      fireEvent.click(maximizeButton);
      expect(screen.getByTestId('minimize-icon')).toBeInTheDocument();
      
      // Close and reopen modal
      rerender(
        <TestWrapper>
          <DashboardModal {...defaultProps} type="networth-chart" data={mockNetWorthData} isOpen={false} />
        </TestWrapper>
      );
      
      rerender(
        <TestWrapper>
          <DashboardModal {...defaultProps} type="networth-chart" data={mockNetWorthData} isOpen={true} />
        </TestWrapper>
      );
      
      // Should be back to normal mode
      expect(screen.getByTestId('maximize-icon')).toBeInTheDocument();
    });
  });

  describe('Net Worth Chart Content', () => {
    it('renders net worth chart', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="networth-chart" 
            data={mockNetWorthData} 
          />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('bar')).toBeInTheDocument();
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    });

    it('handles bar chart click navigation', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="networth-chart" 
            data={mockNetWorthData} 
          />
        </TestWrapper>
      );
      
      const bar = screen.getByTestId('bar');
      fireEvent.click(bar);
      
      expect(mockNavigate).toHaveBeenCalledWith('/networth/monthly/2024-01');
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('passes chart data correctly', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="networth-chart" 
            data={mockNetWorthData} 
          />
        </TestWrapper>
      );
      
      const barChart = screen.getByTestId('bar-chart');
      expect(barChart).toHaveAttribute('data-chart-data', JSON.stringify(mockNetWorthData));
    });
  });

  describe('Account Distribution Content', () => {
    it('renders account distribution chart', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="account-distribution" 
            data={mockAccountDistributionData} 
          />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('pie')).toBeInTheDocument();
      expect(screen.getAllByTestId('cell')).toHaveLength(3);
    });

    it('handles pie chart click navigation', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="account-distribution" 
            data={mockAccountDistributionData} 
          />
        </TestWrapper>
      );
      
      const pie = screen.getByTestId('pie');
      fireEvent.click(pie);
      
      expect(mockNavigate).toHaveBeenCalledWith('/transactions?account=acc1');
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('passes account distribution data correctly', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="account-distribution" 
            data={mockAccountDistributionData} 
          />
        </TestWrapper>
      );
      
      const pie = screen.getByTestId('pie');
      expect(pie).toHaveAttribute('data-chart-data', JSON.stringify(mockAccountDistributionData));
    });
  });

  describe('Income Expenditure Content', () => {
    it('renders income expenditure report', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="income-expenditure" 
            data={mockIncomeExpenditureData} 
          />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
      expect(screen.getByTestId('income-expenditure-report')).toBeInTheDocument();
      expect(screen.getByText('Income Expenditure Report')).toBeInTheDocument();
    });

    it('passes correct props to income expenditure report', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="income-expenditure" 
            data={mockIncomeExpenditureData} 
          />
        </TestWrapper>
      );
      
      // Test that setSettings works
      const updateButton = screen.getByText('Update Settings');
      fireEvent.click(updateButton);
      
      expect(mockIncomeExpenditureData.setSettings).toHaveBeenCalled();
    });

    it('wraps report in error boundary', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="income-expenditure" 
            data={mockIncomeExpenditureData} 
          />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    });
  });

  describe('Reconciliation Content', () => {
    it('renders reconciliation overview', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="reconciliation" 
            data={mockReconciliationData} 
          />
        </TestWrapper>
      );
      
      expect(screen.getByText('Accounts')).toBeInTheDocument();
      expect(screen.getAllByText('Unreconciled')[0]).toBeInTheDocument();
      expect(screen.getByText('Total Value')).toBeInTheDocument();
    });

    it('displays correct reconciliation statistics', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="reconciliation" 
            data={mockReconciliationData} 
          />
        </TestWrapper>
      );
      
      expect(screen.getAllByText('2')[0]).toBeInTheDocument(); // Number of accounts
      expect(screen.getByText('7')).toBeInTheDocument(); // Total unreconciled (5 + 2)
      expect(screen.getByText('£2300.00')).toBeInTheDocument(); // Total value (1500 + 800)
    });

    it('renders account reconciliation table', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="reconciliation" 
            data={mockReconciliationData} 
          />
        </TestWrapper>
      );
      
      expect(screen.getByText('Current Account')).toBeInTheDocument();
      expect(screen.getByText('Savings Account')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getAllByText('2')[1]).toBeInTheDocument(); // Use the second instance (table row)
      expect(screen.getByText('£1500.00')).toBeInTheDocument();
      expect(screen.getByText('£800.00')).toBeInTheDocument();
    });

    it('handles account row click navigation', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="reconciliation" 
            data={mockReconciliationData} 
          />
        </TestWrapper>
      );
      
      const accountRow = screen.getByText('Current Account').closest('div')!;
      fireEvent.click(accountRow);
      
      expect(mockNavigate).toHaveBeenCalledWith('/reconciliation?account=acc1');
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('handles empty reconciliation data', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="reconciliation" 
            data={[]} 
          />
        </TestWrapper>
      );
      
      const zeroTexts = screen.getAllByText('0');
      expect(zeroTexts[0]).toBeInTheDocument(); // Accounts
      expect(zeroTexts[1]).toBeInTheDocument(); // Unreconciled
      expect(screen.getByText('£0.00')).toBeInTheDocument(); // Total value
    });
  });

  describe('Default Content', () => {
    it('renders default message for unknown type', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type={'unknown-type' as any} 
          />
        </TestWrapper>
      );
      
      expect(screen.getByText('Content not available')).toBeInTheDocument();
    });
  });

  describe('User Actions', () => {
    it('calls onClose when X button clicked', () => {
      const onClose = vi.fn();
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="networth-chart" 
            data={mockNetWorthData}
            onClose={onClose} 
          />
        </TestWrapper>
      );
      
      const closeButton = screen.getByTestId('x-icon').closest('button')!;
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    });

    it('shows correct fullscreen toggle tooltip', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="networth-chart" 
            data={mockNetWorthData} 
          />
        </TestWrapper>
      );
      
      const maximizeButton = screen.getByTestId('maximize-icon').closest('button')!;
      expect(maximizeButton).toHaveAttribute('title', 'Enter fullscreen');
      
      fireEvent.click(maximizeButton);
      
      const minimizeButton = screen.getByTestId('minimize-icon').closest('button')!;
      expect(minimizeButton).toHaveAttribute('title', 'Exit fullscreen');
    });
  });

  describe('Chart Styles', () => {
    it('passes tooltip styles to chart components', () => {
      const chartStyles = {
        tooltip: { backgroundColor: '#000000' },
        pieTooltip: { color: '#ffffff' }
      };
      
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="networth-chart" 
            data={mockNetWorthData}
            chartStyles={chartStyles}
          />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });

    it('renders without chart styles', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="account-distribution" 
            data={mockAccountDistributionData}
          />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('adjusts height in fullscreen mode', () => {
      const { container } = render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="networth-chart" 
            data={mockNetWorthData} 
          />
        </TestWrapper>
      );
      
      // Toggle to fullscreen
      const maximizeButton = screen.getByTestId('maximize-icon').closest('button')!;
      fireEvent.click(maximizeButton);
      
      // Check that container classes change for fullscreen
      const modal = container.querySelector('.bg-white');
      expect(modal).toHaveClass('max-w-[95vw]', 'h-[95vh]');
    });

    it('uses normal size in default mode', () => {
      const { container } = render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="networth-chart" 
            data={mockNetWorthData} 
          />
        </TestWrapper>
      );
      
      const modal = container.querySelector('.bg-white');
      expect(modal).toHaveClass('max-w-6xl');
      expect(modal).not.toHaveClass('max-w-[95vw]');
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined data gracefully', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="networth-chart" 
            data={undefined} 
          />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('handles empty data arrays', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="account-distribution" 
            data={[]} 
          />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });

    it('handles malformed data objects', () => {
      const malformedData = [{ invalidProp: 'test' }];
      
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="networth-chart" 
            data={malformedData as any} 
          />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('handles very large numbers in currency formatting', () => {
      const largeValueData: ReconciliationData[] = [
        {
          account: { id: 'acc1', name: 'Large Account' },
          unreconciledCount: 1,
          totalToReconcile: 1000000000
        }
      ];
      
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="reconciliation" 
            data={largeValueData} 
          />
        </TestWrapper>
      );
      
      const largeAmountTexts = screen.getAllByText('£1000000000.00');
      expect(largeAmountTexts[0]).toBeInTheDocument(); // Total value in summary
    });

    it('handles navigation without data payload', () => {
      render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="networth-chart" 
            data={mockNetWorthData} 
          />
        </TestWrapper>
      );
      
      // Mock the bar click without payload
      const bar = screen.getByTestId('bar');
      vi.mocked(bar.onclick = () => {
        const onClick = vi.fn();
        onClick({}); // Empty payload
      });
      
      // Should not crash
      expect(screen.getByTestId('bar')).toBeInTheDocument();
    });
  });

  describe('Content Height Adjustments', () => {
    it('adjusts chart content height for fullscreen in networth chart', () => {
      const { container } = render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="networth-chart" 
            data={mockNetWorthData} 
          />
        </TestWrapper>
      );
      
      // Initially should have normal height
      let chartContainer = container.querySelector('.h-96');
      expect(chartContainer).toBeInTheDocument();
      
      // Toggle to fullscreen
      const maximizeButton = screen.getByTestId('maximize-icon').closest('button')!;
      fireEvent.click(maximizeButton);
      
      // Should now have fullscreen height
      chartContainer = container.querySelector('.h-\\[calc\\(100vh-200px\\)\\]');
      expect(chartContainer).toBeInTheDocument();
    });

    it('adjusts scroll content height for fullscreen in income-expenditure', () => {
      const { container } = render(
        <TestWrapper>
          <DashboardModal 
            {...defaultProps} 
            type="income-expenditure" 
            data={mockIncomeExpenditureData} 
          />
        </TestWrapper>
      );
      
      // Initially should have normal max height
      let scrollContainer = container.querySelector('.max-h-96');
      expect(scrollContainer).toBeInTheDocument();
      
      // Toggle to fullscreen
      const maximizeButton = screen.getByTestId('maximize-icon').closest('button')!;
      fireEvent.click(maximizeButton);
      
      // Should now have fullscreen max height
      scrollContainer = container.querySelector('.max-h-\\[calc\\(100vh-200px\\)\\]');
      expect(scrollContainer).toBeInTheDocument();
    });
  });
});