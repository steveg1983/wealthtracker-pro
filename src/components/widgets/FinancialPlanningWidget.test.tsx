import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FinancialPlanningWidget from './FinancialPlanningWidget';
import { financialPlanningService } from '../../services/financialPlanningService';
import { useNavigate } from 'react-router-dom';
import type { RetirementPlan, FinancialGoal } from '../../services/financialPlanningService';

// Mock dependencies
vi.mock('../../services/financialPlanningService');
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));
vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    displayCurrency: 'USD',
    formatCurrency: (value: any) => {
      const num = parseFloat(value.toString());
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
    },
  }),
}));

// Mock icons
vi.mock('../icons', () => ({
  CalculatorIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="CalculatorIcon" data-size={size} className={className} />
  ),
  PiggyBankIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="PiggyBankIcon" data-size={size} className={className} />
  ),
  HomeIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="HomeIcon" data-size={size} className={className} />
  ),
  TargetIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="TargetIcon" data-size={size} className={className} />
  ),
  CreditCardIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="CreditCardIcon" data-size={size} className={className} />
  ),
  ArrowRightIcon: ({ size }: { size?: number }) => (
    <div data-testid="ArrowRightIcon" data-size={size} />
  ),
  CheckCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="CheckCircleIcon" data-size={size} className={className} />
  ),
  AlertCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="AlertCircleIcon" data-size={size} className={className} />
  ),
}));

const mockNavigate = vi.fn();
const mockFinancialPlanningService = financialPlanningService as {
  getRetirementPlans: Mock;
  getFinancialGoals: Mock;
  calculateRetirementProjection: Mock;
  calculateGoalProjection: Mock;
};

// Mock data
const mockRetirementPlans: RetirementPlan[] = [
  {
    id: 'ret1',
    name: '401k Plan',
    currentAge: 35,
    retirementAge: 65,
    currentSavings: 50000,
    monthlyContribution: 500,
    expectedReturn: 0.07,
    inflationRate: 0.03,
    targetRetirementIncome: 5000,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'ret2',
    name: 'IRA Plan',
    currentAge: 35,
    retirementAge: 67,
    currentSavings: 25000,
    monthlyContribution: 300,
    expectedReturn: 0.065,
    inflationRate: 0.025,
    targetRetirementIncome: 3000,
    createdAt: new Date('2024-01-15'),
  },
];

const mockFinancialGoals: FinancialGoal[] = [
  {
    id: 'goal1',
    name: 'Emergency Fund',
    targetAmount: 15000,
    currentSavings: 8000,
    monthlyContribution: 500,
    targetDate: new Date('2025-12-31'),
    priority: 'high',
    category: 'emergency',
    expectedReturn: 0.02,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'goal2',
    name: 'Dream Vacation',
    targetAmount: 5000,
    currentSavings: 2000,
    monthlyContribution: 200,
    targetDate: new Date('2025-06-01'),
    priority: 'medium',
    category: 'vacation',
    expectedReturn: 0.015,
    createdAt: new Date('2024-01-10'),
  },
  {
    id: 'goal3',
    name: 'New Car Down Payment',
    targetAmount: 10000,
    currentSavings: 3500,
    monthlyContribution: 400,
    targetDate: new Date('2025-03-01'),
    priority: 'low',
    category: 'car',
    expectedReturn: 0.02,
    createdAt: new Date('2024-01-20'),
  },
];

describe('FinancialPlanningWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    
    // Default mock values
    mockFinancialPlanningService.getRetirementPlans.mockReturnValue(mockRetirementPlans);
    mockFinancialPlanningService.getFinancialGoals.mockReturnValue(mockFinancialGoals);
    mockFinancialPlanningService.calculateRetirementProjection.mockReturnValue({
      yearsToRetirement: 30,
      totalSavingsAtRetirement: 825000,
      monthlyRetirementIncome: 3300,
      shortfall: 1700,
    });
    mockFinancialPlanningService.calculateGoalProjection.mockImplementation((goal) => ({
      onTrack: goal.id === 'goal1' || goal.id === 'goal3',
      projectedAmount: goal.currentSavings * 1.2,
      monthsToGoal: 12,
      recommendedMonthly: goal.monthlyContribution,
    }));
  });

  describe('Loading State', () => {
    it('shows content after loading', async () => {
      render(<FinancialPlanningWidget />);
      
      // Since loading is synchronous, just verify content appears
      await waitFor(() => {
        const headings = screen.getAllByText('Financial Planning');
        expect(headings.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('handles errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFinancialPlanningService.getRetirementPlans.mockImplementation(() => {
        throw new Error('Service error');
      });
      
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error loading financial planning data:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Small Size', () => {
    it('renders small size with plan count', async () => {
      render(<FinancialPlanningWidget size="small" />);
      
      await waitFor(() => {
        expect(screen.getByText('Planning')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument(); // 2 retirement + 3 goals
        expect(screen.getByText('Active Plans')).toBeInTheDocument();
        expect(screen.getByTestId('CalculatorIcon')).toHaveAttribute('data-size', '20');
      });
    });

    it('shows zero plans when empty', async () => {
      mockFinancialPlanningService.getRetirementPlans.mockReturnValue([]);
      mockFinancialPlanningService.getFinancialGoals.mockReturnValue([]);
      
      render(<FinancialPlanningWidget size="small" />);
      
      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
      });
    });
  });

  describe('Medium Size (Default)', () => {
    it('renders header with plan count', async () => {
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        const headings = screen.getAllByText('Financial Planning');
        expect(headings.length).toBeGreaterThan(0);
        expect(screen.getByText('5 Plans')).toBeInTheDocument();
        const calculatorIcon = screen.getAllByTestId('CalculatorIcon')[0];
        expect(calculatorIcon).toHaveClass('text-purple-600');
      });
    });

    it('shows quick stats', async () => {
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        // Find the specific instances in the stats section
        const retirementStat = screen.getAllByText('Retirement')[0];
        expect(retirementStat).toBeInTheDocument();
        expect(screen.getByText('2 Plans')).toBeInTheDocument();
        expect(screen.getByText('Goals')).toBeInTheDocument();
        expect(screen.getByText('3 Active')).toBeInTheDocument();
      });
    });

    it('displays retirement plans', async () => {
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('401k Plan')).toBeInTheDocument();
        expect(screen.getByText('IRA Plan')).toBeInTheDocument();
        expect(screen.getAllByText('30 years to go')).toHaveLength(2);
        expect(screen.getAllByText('$825,000')).toHaveLength(2);
      });
    });

    it('displays financial goals', async () => {
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
        expect(screen.getByText('Dream Vacation')).toBeInTheDocument();
        expect(screen.getByText('53.3% complete')).toBeInTheDocument(); // 8000/15000
        expect(screen.getByText('40.0% complete')).toBeInTheDocument(); // 2000/5000
      });
    });

    it('shows on-track status for goals', async () => {
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        // Emergency Fund is on track
        const checkIcons = screen.getAllByTestId('CheckCircleIcon');
        expect(checkIcons.length).toBeGreaterThan(0);
        
        // Dream Vacation is not on track
        const alertIcons = screen.getAllByTestId('AlertCircleIcon');
        expect(alertIcons.length).toBeGreaterThan(0);
      });
    });

    it('limits display to 2 plans of each type', async () => {
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        // Should show 2 retirement plans
        expect(screen.getByText('401k Plan')).toBeInTheDocument();
        expect(screen.getByText('IRA Plan')).toBeInTheDocument();
        
        // Should show 2 goals (not the third)
        expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
        expect(screen.getByText('Dream Vacation')).toBeInTheDocument();
        expect(screen.queryByText('New Car Down Payment')).not.toBeInTheDocument();
      });
    });
  });

  describe('No Plans State', () => {
    it('shows empty state when no plans', async () => {
      mockFinancialPlanningService.getRetirementPlans.mockReturnValue([]);
      mockFinancialPlanningService.getFinancialGoals.mockReturnValue([]);
      
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('No financial plans yet')).toBeInTheDocument();
        expect(screen.getByText('Create your first plan')).toBeInTheDocument();
      });
    });

    it('navigates to create plan on click', async () => {
      mockFinancialPlanningService.getRetirementPlans.mockReturnValue([]);
      mockFinancialPlanningService.getFinancialGoals.mockReturnValue([]);
      
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Create your first plan'));
        expect(mockNavigate).toHaveBeenCalledWith('/financial-planning');
      });
    });
  });

  describe('Quick Actions', () => {
    it('shows quick action buttons', async () => {
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument();
        // Check that the buttons contain the right text and icons
        const retirementButton = screen.getAllByText('Retirement').find(el => 
          el.classList.contains('text-purple-800')
        );
        const mortgageButton = screen.getByText('Mortgage');
        expect(retirementButton).toBeInTheDocument();
        expect(mortgageButton).toBeInTheDocument();
      });
    });

    it('navigates to retirement tab', async () => {
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        // Find buttons in the Quick Actions section
        const buttons = screen.getAllByRole('button');
        const retirementButton = buttons.find(btn => 
          btn.textContent?.includes('Retirement') && 
          btn.classList.contains('bg-purple-50')
        );
        fireEvent.click(retirementButton!);
        expect(mockNavigate).toHaveBeenCalledWith('/financial-planning?tab=retirement');
      });
    });

    it('navigates to mortgage tab', async () => {
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        const mortgageButton = screen.getByText('Mortgage').closest('button');
        fireEvent.click(mortgageButton!);
        expect(mockNavigate).toHaveBeenCalledWith('/financial-planning?tab=mortgage');
      });
    });
  });

  describe('Navigation', () => {
    it('shows financial planning button', async () => {
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        // Find the button element itself
        const button = screen.getByRole('button', { name: /Financial Planning/i });
        expect(button).toHaveClass('bg-purple-600');
        expect(screen.getByTestId('ArrowRightIcon')).toHaveAttribute('data-size', '14');
      });
    });

    it('navigates to financial planning page', async () => {
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Financial Planning/i });
        fireEvent.click(button);
        expect(mockNavigate).toHaveBeenCalledWith('/financial-planning');
      });
    });
  });

  describe('Currency Formatting', () => {
    it('formats large amounts correctly', async () => {
      mockFinancialPlanningService.calculateRetirementProjection.mockReturnValue({
        yearsToRetirement: 30,
        totalSavingsAtRetirement: 1250000,
        monthlyRetirementIncome: 5000,
        shortfall: 0,
      });
      
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        const amounts = screen.getAllByText('$1,250,000');
        expect(amounts.length).toBeGreaterThan(0);
      });
    });

    it('formats goal amounts correctly', async () => {
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('$15,000')).toBeInTheDocument(); // Emergency Fund
        expect(screen.getByText('$5,000')).toBeInTheDocument(); // Dream Vacation
      });
    });
  });

  describe('Component Structure', () => {
    it('applies correct container styles', async () => {
      const { container } = render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        const rootDiv = container.firstChild as HTMLElement;
        expect(rootDiv).toHaveClass('h-full', 'flex', 'flex-col');
      });
    });

    it('uses correct icon colors', async () => {
      render(<FinancialPlanningWidget />);
      
      await waitFor(() => {
        const piggyBankIcons = screen.getAllByTestId('PiggyBankIcon');
        expect(piggyBankIcons[0]).toHaveClass('text-purple-600');
        
        const targetIcons = screen.getAllByTestId('TargetIcon');
        expect(targetIcons[0]).toHaveClass('text-blue-600');
      });
    });
  });
});
