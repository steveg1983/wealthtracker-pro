import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AIAnalyticsWidget from './AIAnalyticsWidget';
import { advancedAnalyticsService } from '../../services/advancedAnalyticsService';
import { useNavigate } from 'react-router-dom';
import { toDecimal } from '../../utils/decimal';
import type { FinancialInsight, SavingsOpportunity } from '../../services/advancedAnalyticsService';
import type { Transaction, Account, Budget } from '../../types';

// Mock dependencies
vi.mock('../../services/advancedAnalyticsService');
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));
vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    transactions: mockTransactions,
    accounts: mockAccounts,
    budgets: mockBudgets,
  }),
}));
vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (value: any) => {
      const num = parseFloat(value.toString());
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    },
    displayCurrency: 'USD',
  }),
}));

// Mock icons
vi.mock('../icons', () => ({
  MagicWandIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="MagicWandIcon" data-size={size} className={className} />
  ),
  AlertTriangleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="AlertTriangleIcon" data-size={size} className={className} />
  ),
  LightbulbIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="LightbulbIcon" data-size={size} className={className} />
  ),
  TrendingUpIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="TrendingUpIcon" data-size={size} className={className} />
  ),
  PiggyBankIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="PiggyBankIcon" data-size={size} className={className} />
  ),
}));

const mockNavigate = vi.fn();
const mockAdvancedAnalyticsService = advancedAnalyticsService as {
  detectSpendingAnomalies: Mock;
  generateInsights: Mock;
  identifySavingsOpportunities: Mock;
};

// Mock data
const mockTransactions: Transaction[] = [];
const mockAccounts: Account[] = [];
const mockBudgets: Budget[] = [];

const mockAnomalies = [
  { id: '1', amount: toDecimal(500), description: 'Unusual spending' },
  { id: '2', amount: toDecimal(300), description: 'High restaurant bill' },
  { id: '3', amount: toDecimal(200), description: 'Duplicate charge' },
];

const mockInsights: FinancialInsight[] = [
  {
    id: 'insight1',
    type: 'spending',
    title: 'Spending increased 25% this month',
    description: 'Your overall spending has increased significantly compared to last month',
    impact: 'negative',
    priority: 'high',
    actionable: true,
  },
  {
    id: 'insight2',
    type: 'saving',
    title: 'Great job saving!',
    description: 'You saved 15% more than your goal this month',
    impact: 'positive',
    priority: 'high',
    actionable: false,
  },
  {
    id: 'insight3',
    type: 'budget',
    title: 'Budget alert',
    description: 'You are close to exceeding your entertainment budget',
    impact: 'negative',
    priority: 'medium',
    actionable: true,
  },
];

const mockOpportunities: SavingsOpportunity[] = [
  {
    id: 'opp1',
    type: 'subscription',
    title: 'Unused Netflix subscription',
    description: 'You haven\'t used Netflix in 3 months',
    potentialSavings: toDecimal(15.99),
    difficulty: 'easy',
    actionRequired: 'Cancel subscription',
  },
  {
    id: 'opp2',
    type: 'category',
    title: 'Reduce dining out',
    description: 'Your restaurant spending is 50% higher than average',
    potentialSavings: toDecimal(200),
    difficulty: 'medium',
    actionRequired: 'Cook more meals at home',
  },
  {
    id: 'opp3',
    type: 'merchant',
    title: 'Switch to bulk buying at Costco',
    description: 'Save on groceries with bulk purchases',
    potentialSavings: toDecimal(50),
    difficulty: 'medium',
    actionRequired: 'Get Costco membership',
  },
];

describe('AIAnalyticsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    
    // Default mock values
    mockAdvancedAnalyticsService.detectSpendingAnomalies.mockReturnValue(mockAnomalies);
    mockAdvancedAnalyticsService.generateInsights.mockReturnValue(mockInsights);
    mockAdvancedAnalyticsService.identifySavingsOpportunities.mockReturnValue(mockOpportunities);
  });

  describe('Small Size', () => {
    it('renders small size with insights count', () => {
      render(<AIAnalyticsWidget size="small" />);
      
      expect(screen.getByText('AI Insights')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 high priority insights
      expect(screen.getByText('New insights')).toBeInTheDocument();
      expect(screen.getByTestId('MagicWandIcon')).toHaveAttribute('data-size', '20');
    });

    it('shows zero insights when none are high priority', () => {
      mockAdvancedAnalyticsService.generateInsights.mockReturnValue([
        { ...mockInsights[2], priority: 'low' },
      ]);
      
      render(<AIAnalyticsWidget size="small" />);
      
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('navigates to AI analytics on click', () => {
      render(<AIAnalyticsWidget size="small" />);
      
      const container = screen.getByText('AI Insights').closest('.cursor-pointer');
      fireEvent.click(container!);
      
      expect(mockNavigate).toHaveBeenCalledWith('/ai-analytics');
    });
  });

  describe('Medium Size (Default)', () => {
    it('renders gradient header with active indicator', () => {
      render(<AIAnalyticsWidget />);
      
      expect(screen.getByText('AI Analytics')).toBeInTheDocument();
      expect(screen.getByText('Powered by advanced machine learning')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      
      // Check for pulse animation indicator
      const pulseIndicator = screen.getByText('Active').parentElement?.querySelector('.animate-pulse');
      expect(pulseIndicator).toBeInTheDocument();
    });

    it('displays anomalies count', () => {
      render(<AIAnalyticsWidget />);
      
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Anomalies')).toBeInTheDocument();
      expect(screen.getByTestId('AlertTriangleIcon')).toHaveAttribute('data-size', '16');
    });

    it('displays insights count', () => {
      render(<AIAnalyticsWidget />);
      
      expect(screen.getByText('2')).toBeInTheDocument(); // High priority insights
      expect(screen.getByText('Insights')).toBeInTheDocument();
      expect(screen.getByTestId('LightbulbIcon')).toHaveAttribute('data-size', '16');
    });

    it('displays total savings opportunities', () => {
      render(<AIAnalyticsWidget />);
      
      // Total savings: 15.99 + 200 + 50 = 265.99
      expect(screen.getByText('$265')).toBeInTheDocument(); // Removes decimal part
      expect(screen.getByText('Savings')).toBeInTheDocument();
      expect(screen.getByTestId('PiggyBankIcon')).toHaveAttribute('data-size', '16');
    });

    it('shows top insight when available', () => {
      render(<AIAnalyticsWidget />);
      
      expect(screen.getByText('Latest Insight')).toBeInTheDocument();
      expect(screen.getByText('Spending increased 25% this month')).toBeInTheDocument();
      expect(screen.getByText('Your overall spending has increased significantly compared to last month')).toBeInTheDocument();
    });

    it('does not show top insight when none available', () => {
      mockAdvancedAnalyticsService.generateInsights.mockReturnValue([]);
      
      render(<AIAnalyticsWidget />);
      
      expect(screen.queryByText('Latest Insight')).not.toBeInTheDocument();
    });

    it('handles empty data gracefully', () => {
      mockAdvancedAnalyticsService.detectSpendingAnomalies.mockReturnValue([]);
      mockAdvancedAnalyticsService.generateInsights.mockReturnValue([]);
      mockAdvancedAnalyticsService.identifySavingsOpportunities.mockReturnValue([]);
      
      render(<AIAnalyticsWidget />);
      
      // Check all three 0 values are displayed
      const zeroValues = screen.getAllByText('0');
      expect(zeroValues).toHaveLength(2); // Anomalies and Insights
      expect(screen.getByText('$0')).toBeInTheDocument(); // Savings
    });
  });

  describe('Navigation', () => {
    it('shows view AI analytics button', () => {
      render(<AIAnalyticsWidget />);
      
      const button = screen.getByText('View AI Analytics');
      expect(button).toBeInTheDocument();
      expect(button.closest('button')).toHaveClass('bg-purple-600');
    });

    it('navigates to AI analytics page on button click', () => {
      render(<AIAnalyticsWidget />);
      
      fireEvent.click(screen.getByText('View AI Analytics'));
      expect(mockNavigate).toHaveBeenCalledWith('/ai-analytics');
    });
  });

  describe('Data Updates', () => {
    it('recalculates when mounted', () => {
      render(<AIAnalyticsWidget />);
      
      // Should be called once on mount
      expect(mockAdvancedAnalyticsService.detectSpendingAnomalies).toHaveBeenCalledTimes(1);
      expect(mockAdvancedAnalyticsService.generateInsights).toHaveBeenCalledTimes(1);
      expect(mockAdvancedAnalyticsService.identifySavingsOpportunities).toHaveBeenCalledTimes(1);
    });

    it('passes correct parameters to service methods', () => {
      render(<AIAnalyticsWidget />);
      
      expect(mockAdvancedAnalyticsService.detectSpendingAnomalies).toHaveBeenCalledWith(mockTransactions);
      expect(mockAdvancedAnalyticsService.generateInsights).toHaveBeenCalledWith(
        mockTransactions,
        mockAccounts,
        mockBudgets
      );
      expect(mockAdvancedAnalyticsService.identifySavingsOpportunities).toHaveBeenCalledWith(
        mockTransactions,
        mockAccounts
      );
    });
  });

  describe('Currency Formatting', () => {
    it('formats large savings amounts correctly', () => {
      mockAdvancedAnalyticsService.identifySavingsOpportunities.mockReturnValue([
        {
          ...mockOpportunities[0],
          potentialSavings: toDecimal(1250.50),
        },
      ]);
      
      render(<AIAnalyticsWidget />);
      
      expect(screen.getByText('$1,250')).toBeInTheDocument();
    });

    it('handles zero savings correctly', () => {
      mockAdvancedAnalyticsService.identifySavingsOpportunities.mockReturnValue([]);
      
      render(<AIAnalyticsWidget />);
      
      expect(screen.getByText('$0')).toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('applies correct container styles', () => {
      const { container } = render(<AIAnalyticsWidget />);
      
      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass('h-full', 'flex', 'flex-col');
    });

    it('uses gradient background for header', () => {
      render(<AIAnalyticsWidget />);
      
      const header = screen.getByText('AI Analytics').closest('.bg-gradient-to-r');
      expect(header).toHaveClass('from-purple-500', 'to-blue-500');
    });

    it('applies correct stat card styles', () => {
      render(<AIAnalyticsWidget />);
      
      const anomalyCard = screen.getByText('Anomalies').closest('.bg-red-50');
      expect(anomalyCard).toBeInTheDocument();
      
      const insightCard = screen.getByText('Insights').closest('.bg-blue-50');
      expect(insightCard).toBeInTheDocument();
      
      const savingsCard = screen.getByText('Savings').closest('.bg-green-50');
      expect(savingsCard).toBeInTheDocument();
    });

    it('uses correct icon colors', () => {
      render(<AIAnalyticsWidget />);
      
      expect(screen.getByTestId('AlertTriangleIcon')).toHaveClass('text-red-600');
      expect(screen.getByTestId('LightbulbIcon')).toHaveClass('text-blue-600');
      expect(screen.getByTestId('PiggyBankIcon')).toHaveClass('text-green-600');
    });
  });
});
