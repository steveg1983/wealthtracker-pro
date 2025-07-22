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

// Mock portfolio rebalance service
const mockAllocations = [
  { assetClass: 'Stocks', currentPercentage: 60, targetPercentage: 70, currentValue: 60000, targetValue: 70000 },
  { assetClass: 'Bonds', currentPercentage: 30, targetPercentage: 25, currentValue: 30000, targetValue: 25000 },
  { assetClass: 'Cash', currentPercentage: 10, targetPercentage: 5, currentValue: 10000, targetValue: 5000 }
];

const mockRebalanceActions = [
  { action: 'BUY', assetClass: 'Stocks', amount: 10000, reason: 'Under target allocation' },
  { action: 'SELL', assetClass: 'Bonds', amount: 5000, reason: 'Over target allocation' }
];

const mockPortfolioTargets = [
  { 
    id: 't1', 
    name: 'Balanced Portfolio', 
    allocations: { Stocks: 60, Bonds: 30, Cash: 10 },
    isActive: true 
  },
  { 
    id: 't2', 
    name: 'Aggressive Growth', 
    allocations: { Stocks: 80, Bonds: 15, Cash: 5 },
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
    deletePortfolioTarget: vi.fn()
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
vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    accounts: mockAccounts
  })
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
  });

  describe('rendering', () => {
    it('renders the component header', () => {
      render(<PortfolioRebalancer />);
      
      expect(screen.getByText('Portfolio Rebalancer')).toBeInTheDocument();
    });

    it('renders refresh button', () => {
      render(<PortfolioRebalancer />);
      
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
    });

    it('shows rebalancing needed alert when applicable', async () => {
      render(<PortfolioRebalancer />);
      
      await waitFor(() => {
        expect(screen.getByText(/rebalancing recommended/i)).toBeInTheDocument();
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
        expect(screen.getByText('Stocks')).toBeInTheDocument();
        expect(screen.getByText('Bonds')).toBeInTheDocument();
        expect(screen.getByText('Cash')).toBeInTheDocument();
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
        expect(screen.getByText('$10,000')).toBeInTheDocument();
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
        expect(screen.getByText(/active target/i)).toBeInTheDocument();
      });
    });

    it('renders manage targets button', () => {
      render(<PortfolioRebalancer />);
      
      expect(screen.getByRole('button', { name: /manage targets/i })).toBeInTheDocument();
      expect(screen.getByTestId('settings-icon')).toBeInTheDocument();
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
    it('calculates rebalance actions on button click', async () => {
      render(<PortfolioRebalancer />);
      
      const rebalanceButton = screen.getByRole('button', { name: /calculate rebalance/i });
      fireEvent.click(rebalanceButton);
      
      await waitFor(() => {
        expect(screen.getByText('Rebalance Actions')).toBeInTheDocument();
      });
    });

    it('displays buy actions', async () => {
      render(<PortfolioRebalancer />);
      
      const rebalanceButton = screen.getByRole('button', { name: /calculate rebalance/i });
      fireEvent.click(rebalanceButton);
      
      await waitFor(() => {
        expect(screen.getByText(/buy.*stocks/i)).toBeInTheDocument();
        expect(screen.getByText('$10,000')).toBeInTheDocument();
      });
    });

    it('displays sell actions', async () => {
      render(<PortfolioRebalancer />);
      
      const rebalanceButton = screen.getByRole('button', { name: /calculate rebalance/i });
      fireEvent.click(rebalanceButton);
      
      await waitFor(() => {
        expect(screen.getByText(/sell.*bonds/i)).toBeInTheDocument();
        expect(screen.getByText('$5,000')).toBeInTheDocument();
      });
    });

    it('shows action reasons', async () => {
      render(<PortfolioRebalancer />);
      
      const rebalanceButton = screen.getByRole('button', { name: /calculate rebalance/i });
      fireEvent.click(rebalanceButton);
      
      await waitFor(() => {
        expect(screen.getByText('Under target allocation')).toBeInTheDocument();
        expect(screen.getByText('Over target allocation')).toBeInTheDocument();
      });
    });
  });

  describe('settings', () => {
    it('shows tax consideration toggle', () => {
      render(<PortfolioRebalancer />);
      
      expect(screen.getByText(/tax considerations/i)).toBeInTheDocument();
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
      vi.mocked(vi.fn()).mockImplementation(() => ({
        useApp: () => ({
          accounts: []
        })
      }));
      
      render(<PortfolioRebalancer />);
      
      expect(screen.getByText(/no investment holdings found/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has accessible form controls', () => {
      render(<PortfolioRebalancer />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-label');
      
      const cashInput = screen.getByLabelText(/cash available/i);
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
      const mockSetActive = vi.mocked(portfolioRebalanceService.setActiveTarget);
      
      render(<PortfolioRebalancer />);
      
      const manageButton = screen.getByRole('button', { name: /manage targets/i });
      fireEvent.click(manageButton);
      
      await waitFor(() => {
        const aggressiveOption = screen.getByText('Aggressive Growth');
        fireEvent.click(aggressiveOption);
      });
      
      expect(mockSetActive).toHaveBeenCalled();
    });
  });
});