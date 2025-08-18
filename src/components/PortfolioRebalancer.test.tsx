/**
 * PortfolioRebalancer Tests
 * Tests for the portfolio rebalancing component
 * 
 * Note: This component uses the portfolioRebalanceService for calculations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PortfolioRebalancer from './PortfolioRebalancer';
import type { Account } from '../types';
import { useApp } from '../contexts/AppContext';

// Mock icons
vi.mock('./icons', () => ({
  BarChart3Icon: () => <div data-testid="bar-chart-icon" />,
  TrendingUpIcon: () => <div data-testid="trending-up-icon" />,
  AlertCircleIcon: () => <div data-testid="alert-circle-icon" />,
  CheckCircleIcon: () => <div data-testid="check-circle-icon" />,
  SettingsIcon: () => <div data-testid="settings-icon" />,
  RefreshCwIcon: () => <div data-testid="refresh-icon" />,
  TargetIcon: () => <div data-testid="target-icon" />,
  InfoIcon: () => <div data-testid="info-icon" />,
  EditIcon: () => <div data-testid="edit-icon" />,
  DeleteIcon: () => <div data-testid="delete-icon" />,
  PlusIcon: () => <div data-testid="plus-icon" />,
  X: () => <div data-testid="x-icon" />,
}));

// Mock recharts to avoid complex chart rendering
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

import { Decimal } from 'decimal.js';

// Mock portfolio rebalance service
const mockAllocations = [
  { 
    assetClass: 'Stocks', 
    currentPercent: 60, 
    targetPercent: 70, 
    currentValue: new Decimal(60000), 
    targetValue: new Decimal(70000),
    difference: new Decimal(10000),
    differencePercent: 10
  },
  { 
    assetClass: 'Bonds', 
    currentPercent: 30, 
    targetPercent: 25, 
    currentValue: new Decimal(30000), 
    targetValue: new Decimal(25000),
    difference: new Decimal(-5000),
    differencePercent: -5
  },
  { 
    assetClass: 'Cash', 
    currentPercent: 10, 
    targetPercent: 5, 
    currentValue: new Decimal(10000), 
    targetValue: new Decimal(5000),
    difference: new Decimal(-5000),
    differencePercent: -5
  }
];

const mockRebalanceActions = [
  { 
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    action: 'buy' as const, 
    assetClass: 'Stocks', 
    amount: new Decimal(10000),
    shares: new Decimal(25),
    currentShares: new Decimal(150),
    targetShares: new Decimal(175),
    currentValue: new Decimal(60000),
    targetValue: new Decimal(70000),
    priority: 1
  },
  { 
    symbol: 'BND',
    name: 'Vanguard Total Bond ETF',
    action: 'sell' as const, 
    assetClass: 'Bonds', 
    amount: new Decimal(5000),
    shares: new Decimal(50),
    currentShares: new Decimal(300),
    targetShares: new Decimal(250),
    currentValue: new Decimal(30000),
    targetValue: new Decimal(25000),
    priority: 2
  }
];

const mockPortfolioTargets = [
  { 
    id: 't1', 
    name: 'Balanced Portfolio', 
    allocations: [
      { assetClass: 'Stocks', targetPercent: 60 },
      { assetClass: 'Bonds', targetPercent: 30 },
      { assetClass: 'Cash', targetPercent: 10 }
    ],
    isActive: true 
  },
  { 
    id: 't2', 
    name: 'Aggressive Growth', 
    allocations: [
      { assetClass: 'Stocks', targetPercent: 80 },
      { assetClass: 'Bonds', targetPercent: 15 },
      { assetClass: 'Cash', targetPercent: 5 }
    ],
    isActive: false 
  }
];

vi.mock('../services/portfolioRebalanceService', () => ({
  portfolioRebalanceService: {
    calculateCurrentAllocation: vi.fn(() => mockAllocations),
    calculateRebalanceActions: vi.fn(() => mockRebalanceActions),
    getPortfolioTargets: vi.fn(() => mockPortfolioTargets),
    getActiveTarget: vi.fn(() => mockPortfolioTargets[0]),
    isRebalancingNeeded: vi.fn(() => true),
    setActiveTarget: vi.fn(),
    savePortfolioTarget: vi.fn(),
    deletePortfolioTarget: vi.fn(),
    getPortfolioTemplates: vi.fn(() => [
      {
        id: 'conservative',
        name: 'Conservative',
        description: 'Low risk, steady growth',
        allocations: [
          { assetClass: 'Stocks', targetPercent: 30 },
          { assetClass: 'Bonds', targetPercent: 60 },
          { assetClass: 'Cash', targetPercent: 10 }
        ]
      },
      {
        id: 'balanced',
        name: 'Balanced',
        description: 'Moderate risk and growth',
        allocations: [
          { assetClass: 'Stocks', targetPercent: 60 },
          { assetClass: 'Bonds', targetPercent: 30 },
          { assetClass: 'Cash', targetPercent: 10 }
        ]
      }
    ])
  }
}));

// Mock accounts with investments
const mockAccounts: Account[] = [
  {
    id: 'acc1',
    name: 'Investment Account',
    type: 'investment',
    balance: 100000,
    currency: 'USD',
    institution: 'Test Broker',
    lastUpdated: new Date(),
    holdings: [
      {
        id: 'h1',
        accountId: 'acc1',
        ticker: 'VOO',
        name: 'Vanguard S&P 500 ETF',
        shares: 150,
        value: 60000,
        averageCost: 350,
        currentPrice: 400,
        marketValue: 60000,
        type: 'stock'
      },
      {
        id: 'h2',
        accountId: 'acc1',
        ticker: 'BND',
        name: 'Vanguard Bond ETF',
        shares: 300,
        value: 30000,
        averageCost: 95,
        currentPrice: 100,
        marketValue: 30000,
        type: 'bond'
      }
    ]
  }
];

// Mock hooks
const mockUseApp = vi.fn();
vi.mock('../contexts/AppContext', () => ({
  useApp: () => mockUseApp()
}));

vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    currencySymbol: '$'
  })
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `$${amount.toLocaleString()}`
  })
}));

describe('PortfolioRebalancer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    mockUseApp.mockReturnValue({
      accounts: mockAccounts
    });
  });

  describe('rendering', () => {
    it('renders the component header', () => {
      render(<PortfolioRebalancer />);
      
      expect(screen.getByText('Portfolio Rebalancing')).toBeInTheDocument();
    });

    it('renders refresh button', () => {
      render(<PortfolioRebalancer />);
      
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
    });

    it('shows rebalancing needed alert when applicable', async () => {
      render(<PortfolioRebalancer />);
      
      await waitFor(() => {
        expect(screen.getByText('Rebalancing Recommended')).toBeInTheDocument();
        expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
      });
    });

    it('renders current allocation section', async () => {
      render(<PortfolioRebalancer />);
      
      await waitFor(() => {
        expect(screen.getByText('Current Allocation')).toBeInTheDocument();
      });
    });
  });

  describe('allocation display', () => {
    it('shows asset class allocations', async () => {
      render(<PortfolioRebalancer />);
      
      await waitFor(() => {
        // Use getAllByText since there are multiple instances
        const stocksElements = screen.getAllByText('Stocks');
        expect(stocksElements.length).toBeGreaterThan(0);
        
        const bondsElements = screen.getAllByText('Bonds');
        expect(bondsElements.length).toBeGreaterThan(0);
        
        const cashElements = screen.getAllByText('Cash');
        expect(cashElements.length).toBeGreaterThan(0);
      });
    });

    it('displays current percentages', async () => {
      render(<PortfolioRebalancer />);
      
      await waitFor(() => {
        expect(screen.getByText('60%')).toBeInTheDocument();
        expect(screen.getByText('30%')).toBeInTheDocument();
        expect(screen.getByText('10%')).toBeInTheDocument();
      });
    });

    it('shows allocation values', async () => {
      render(<PortfolioRebalancer />);
      
      await waitFor(() => {
        expect(screen.getByText('$60,000')).toBeInTheDocument();
        expect(screen.getByText('$30,000')).toBeInTheDocument();
        // $10,000 appears multiple times, so we need to check for at least one
        const tenThousandElements = screen.getAllByText('$10,000');
        expect(tenThousandElements.length).toBeGreaterThan(0);
      });
    });

    it('renders allocation chart', async () => {
      render(<PortfolioRebalancer />);
      
      await waitFor(() => {
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      });
    });
  });

  describe('portfolio targets', () => {
    it('shows active portfolio target', async () => {
      render(<PortfolioRebalancer />);
      
      await waitFor(() => {
        expect(screen.getByText('Balanced Portfolio')).toBeInTheDocument();
      });
    });

    it('renders manage targets button', () => {
      render(<PortfolioRebalancer />);
      
      expect(screen.getByRole('button', { name: /manage targets/i })).toBeInTheDocument();
      expect(screen.getByTestId('target-icon')).toBeInTheDocument();
    });

    it('opens target management modal', async () => {
      render(<PortfolioRebalancer />);
      
      const manageButton = screen.getByRole('button', { name: /manage targets/i });
      fireEvent.click(manageButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Portfolio Targets')).toBeInTheDocument();
      });
    });
  });

  describe('rebalance actions', () => {
    it('shows rebalance actions when needed', async () => {
      render(<PortfolioRebalancer />);
      
      // Rebalance actions are automatically calculated when needed
      await waitFor(() => {
        expect(screen.getByText('Rebalancing Actions')).toBeInTheDocument();
      });
    });

    it('displays buy actions', async () => {
      render(<PortfolioRebalancer />);
      
      // Rebalance actions are automatically shown
      await waitFor(() => {
        expect(screen.getByText('BUY')).toBeInTheDocument();
        expect(screen.getByText('VOO')).toBeInTheDocument();
        // Multiple $10,000 elements exist, so use getAllByText
        const tenThousandElements = screen.getAllByText('$10,000');
        expect(tenThousandElements.length).toBeGreaterThan(0);
      });
    });

    it('displays sell actions', async () => {
      render(<PortfolioRebalancer />);
      
      // Rebalance actions are automatically shown
      await waitFor(() => {
        expect(screen.getByText('SELL')).toBeInTheDocument();
        expect(screen.getByText('BND')).toBeInTheDocument();
        expect(screen.getByText('$5,000')).toBeInTheDocument();
      });
    });

    it('shows action details', async () => {
      render(<PortfolioRebalancer />);
      
      // Rebalance actions are automatically shown
      await waitFor(() => {
        // Check for priority indicators
        expect(screen.getByText('P1')).toBeInTheDocument();
        expect(screen.getByText('P2')).toBeInTheDocument();
      });
    });
  });

  describe('settings', () => {
    it('shows tax consideration toggle', () => {
      render(<PortfolioRebalancer />);
      
      expect(screen.getByText('Consider Tax Implications')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('toggles tax considerations', () => {
      render(<PortfolioRebalancer />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
      
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('shows cash available input', () => {
      render(<PortfolioRebalancer />);
      
      expect(screen.getByLabelText(/cash available/i)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows message when no investments', () => {
      // Override the useApp mock to return empty accounts for this test
      mockUseApp.mockReturnValue({
        accounts: [] // Empty accounts array
      });
      
      render(<PortfolioRebalancer />);
      
      // When there are no investments, the component shows "No holdings to display"
      expect(screen.getByText('No holdings to display')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has accessible form controls', () => {
      render(<PortfolioRebalancer />);
      
      const checkbox = screen.getByRole('checkbox');
      // Check that checkbox is accessible through its label
      const label = screen.getByText(/Consider Tax Implications/i);
      expect(label).toBeInTheDocument();
      
      // Cash input is within a label but text is in a span, so we need to find it differently
      const cashInput = screen.getByPlaceholderText('0');
      expect(cashInput).toHaveAttribute('type', 'number');
    });

    it('modal has proper dialog role', async () => {
      render(<PortfolioRebalancer />);
      
      const manageButton = screen.getByRole('button', { name: /manage targets/i });
      fireEvent.click(manageButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
      });
    });
  });

  describe('interactions', () => {
    it('refreshes data on refresh button click', async () => {
      const { portfolioRebalanceService } = await import('../services/portfolioRebalanceService');
      const mockCalculate = vi.mocked(portfolioRebalanceService.calculateCurrentAllocation);
      
      render(<PortfolioRebalancer />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      expect(mockCalculate).toHaveBeenCalled();
    });

    it('updates active target', async () => {
      const { portfolioRebalanceService } = await import('../services/portfolioRebalanceService');
      const mockSaveTarget = vi.mocked(portfolioRebalanceService.savePortfolioTarget);
      
      render(<PortfolioRebalancer />);
      
      const manageButton = screen.getByRole('button', { name: /manage targets/i });
      fireEvent.click(manageButton);
      
      await waitFor(() => {
        const setActiveButton = screen.getByText('Set Active');
        expect(setActiveButton).toBeInTheDocument();
      });
      
      // Click the Set Active button for the inactive target
      const setActiveButton = screen.getByText('Set Active');
      fireEvent.click(setActiveButton);
      
      // The component calls savePortfolioTarget to update the active state
      expect(mockSaveTarget).toHaveBeenCalled();
    });
  });
});