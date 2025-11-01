import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BusinessWidget from './BusinessWidget';
import { businessService } from '../../services/businessService';
import { useNavigate } from 'react-router-dom';
import type { BusinessMetrics, BusinessExpenseCategory } from '../../services/businessService';

// Mock dependencies
vi.mock('../../services/businessService');
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));
const mockUseCurrencyDecimal = vi.fn();
vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => mockUseCurrencyDecimal(),
}));

// Mock icons
vi.mock('../icons', () => ({
  BriefcaseIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="BriefcaseIcon" data-size={size} className={className} />
  ),
  FileTextIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="FileTextIcon" data-size={size} className={className} />
  ),
  DollarSignIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="DollarSignIcon" data-size={size} className={className} />
  ),
  MapPinIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="MapPinIcon" data-size={size} className={className} />
  ),
  TrendingUpIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="TrendingUpIcon" data-size={size} className={className} />
  ),
  ArrowRightIcon: ({ size }: { size?: number }) => (
    <div data-testid="ArrowRightIcon" data-size={size} />
  ),
  AlertCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="AlertCircleIcon" data-size={size} className={className} />
  ),
  CheckCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="CheckCircleIcon" data-size={size} className={className} />
  ),
}));

const mockNavigate = vi.fn();
const mockBusinessService = businessService as {
  getBusinessMetrics: Mock;
};

// Mock data
const mockMetrics: BusinessMetrics = {
  totalRevenue: 150000,
  totalExpenses: 85000,
  netProfit: 65000,
  profitMargin: 43.3,
  outstandingInvoices: 5,
  overdueInvoices: 2,
  averagePaymentTime: 28.5,
  topExpenseCategories: [
    {
      category: 'office_supplies' as BusinessExpenseCategory,
      amount: 25000,
      percentage: 29.4,
    },
    {
      category: 'travel' as BusinessExpenseCategory,
      amount: 20000,
      percentage: 23.5,
    },
    {
      category: 'equipment' as BusinessExpenseCategory,
      amount: 15000,
      percentage: 17.6,
    },
  ],
  monthlyTrends: [
    { month: 'Jan', revenue: 10000, expenses: 7000, profit: 3000 },
    { month: 'Feb', revenue: 12000, expenses: 8000, profit: 4000 },
  ],
};

describe('BusinessWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    mockUseCurrencyDecimal.mockReturnValue({
      displayCurrency: 'USD',
    });
    
    // Default mock values
    mockBusinessService.getBusinessMetrics.mockReturnValue(mockMetrics);
  });

  describe('Loading State', () => {
    it('shows content after loading', async () => {
      render(<BusinessWidget />);
      
      // Since loading is synchronous, just verify content appears
      await waitFor(() => {
        expect(screen.getByText('Business Overview')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockBusinessService.getBusinessMetrics.mockImplementation(() => {
        throw new Error('Service error');
      });
      
      render(<BusinessWidget />);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error loading business metrics:', expect.any(Error));
        expect(screen.getByText('No data available')).toBeInTheDocument();
      });
      
      consoleSpy.mockRestore();
    });

    it('shows no data message when metrics is null', async () => {
      mockBusinessService.getBusinessMetrics.mockReturnValue(null);
      
      render(<BusinessWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('No data available')).toBeInTheDocument();
      });
    });
  });

  describe('Small Size', () => {
    it('renders small size with net profit', async () => {
      render(<BusinessWidget size="small" />);
      
      await waitFor(() => {
        expect(screen.getByText('Business')).toBeInTheDocument();
        expect(screen.getByText('$65,000')).toBeInTheDocument();
        expect(screen.getByText('Net Profit')).toBeInTheDocument();
        expect(screen.getByTestId('BriefcaseIcon')).toHaveAttribute('data-size', '20');
      });
    });

    it('shows negative profit correctly', async () => {
      mockBusinessService.getBusinessMetrics.mockReturnValue({
        ...mockMetrics,
        netProfit: -15000,
      });
      
      render(<BusinessWidget size="small" />);
      
      await waitFor(() => {
        expect(screen.getByText('-$15,000')).toBeInTheDocument();
      });
    });
  });

  describe('Medium Size (Default)', () => {
    it('renders header with status', async () => {
      render(<BusinessWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Business Overview')).toBeInTheDocument();
        expect(screen.getByText('2 Overdue')).toBeInTheDocument();
        expect(screen.getByTestId('AlertCircleIcon')).toHaveAttribute('data-size', '16');
        expect(screen.getByTestId('BriefcaseIcon')).toHaveAttribute('data-size', '20');
      });
    });

    it('shows up to date status when no overdue invoices', async () => {
      mockBusinessService.getBusinessMetrics.mockReturnValue({
        ...mockMetrics,
        overdueInvoices: 0,
      });
      
      render(<BusinessWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Up to date')).toBeInTheDocument();
        expect(screen.getByTestId('CheckCircleIcon')).toHaveAttribute('data-size', '16');
      });
    });

    it('displays revenue and expenses', async () => {
      render(<BusinessWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Revenue')).toBeInTheDocument();
        expect(screen.getByText('$150,000')).toBeInTheDocument();
        expect(screen.getByText('Expenses')).toBeInTheDocument();
        expect(screen.getByText('$85,000')).toBeInTheDocument();
      });
    });

    it('shows net profit with margin', async () => {
      render(<BusinessWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Net Profit')).toBeInTheDocument();
        expect(screen.getByText('$65,000')).toBeInTheDocument();
        expect(screen.getByText('43.3% margin')).toBeInTheDocument();
      });
    });

    it('applies correct styling for negative profit', async () => {
      mockBusinessService.getBusinessMetrics.mockReturnValue({
        ...mockMetrics,
        netProfit: -10000,
        profitMargin: -10.0,
      });
      
      render(<BusinessWidget />);
      
      await waitFor(() => {
        const profitElement = screen.getByText('-$10,000');
        expect(profitElement).toHaveClass('text-red-900');
      });
    });

    it('displays quick stats', async () => {
      render(<BusinessWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Outstanding Invoices')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('Avg Payment Time')).toBeInTheDocument();
        expect(screen.getByText('29 days')).toBeInTheDocument();
      });
    });

    it('shows top expense category', async () => {
      render(<BusinessWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Top Expense')).toBeInTheDocument();
        expect(screen.getByText('office supplies')).toBeInTheDocument();
        expect(screen.getByText('$25,000')).toBeInTheDocument();
        expect(screen.getByText('29.4%')).toBeInTheDocument();
      });
    });

    it('handles underscore in category names', async () => {
      mockBusinessService.getBusinessMetrics.mockReturnValue({
        ...mockMetrics,
        topExpenseCategories: [{
          category: 'professional_fees' as BusinessExpenseCategory,
          amount: 30000,
          percentage: 35.3,
        }],
      });
      
      render(<BusinessWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('professional fees')).toBeInTheDocument();
      });
    });

    it('does not show top expense when none exist', async () => {
      mockBusinessService.getBusinessMetrics.mockReturnValue({
        ...mockMetrics,
        topExpenseCategories: [],
      });
      
      render(<BusinessWidget />);
      
      await waitFor(() => {
        expect(screen.queryByText('Top Expense')).not.toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('shows business features button', async () => {
      render(<BusinessWidget />);
      
      await waitFor(() => {
        const button = screen.getByText('Business Features');
        expect(button).toBeInTheDocument();
        expect(button.closest('button')).toHaveClass('bg-blue-600');
        expect(screen.getByTestId('ArrowRightIcon')).toHaveAttribute('data-size', '14');
      });
    });

    it('navigates to business features page', async () => {
      render(<BusinessWidget />);
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Business Features'));
        expect(mockNavigate).toHaveBeenCalledWith('/business-features');
      });
    });
  });

  describe('Currency Formatting', () => {
    it('formats large amounts correctly', async () => {
      mockBusinessService.getBusinessMetrics.mockReturnValue({
        ...mockMetrics,
        totalRevenue: 1250000,
        totalExpenses: 950000,
        netProfit: 300000,
      });
      
      render(<BusinessWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('$1,250,000')).toBeInTheDocument();
        expect(screen.getByText('$950,000')).toBeInTheDocument();
        expect(screen.getByText('$300,000')).toBeInTheDocument();
      });
    });

    it('formats percentage correctly', async () => {
      mockBusinessService.getBusinessMetrics.mockReturnValue({
        ...mockMetrics,
        profitMargin: 15.567,
      });
      
      render(<BusinessWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('15.6% margin')).toBeInTheDocument();
      });
    });

    it('places CHF symbol after the amount', async () => {
      mockUseCurrencyDecimal.mockReturnValue({
        displayCurrency: 'CHF',
      });

      render(<BusinessWidget />);

      await waitFor(() => {
        expect(screen.getByText('65,000 CHF')).toBeInTheDocument();
      });
    });

    it('rounds average payment time', async () => {
      mockBusinessService.getBusinessMetrics.mockReturnValue({
        ...mockMetrics,
        averagePaymentTime: 25.8,
      });
      
      render(<BusinessWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('26 days')).toBeInTheDocument();
      });
    });
  });

  describe('Component Structure', () => {
    it('applies correct container styles', async () => {
      const { container } = render(<BusinessWidget />);
      
      await waitFor(() => {
        const rootDiv = container.firstChild as HTMLElement;
        expect(rootDiv).toHaveClass('h-full', 'flex', 'flex-col');
      });
    });

    it('uses correct icon colors', async () => {
      render(<BusinessWidget />);
      
      await waitFor(() => {
        const briefcaseIcon = screen.getByTestId('BriefcaseIcon');
        expect(briefcaseIcon).toHaveClass('text-blue-600');
        
        const trendingIcon = screen.getByTestId('TrendingUpIcon');
        expect(trendingIcon).toHaveClass('text-green-600');
        
        const dollarIcon = screen.getByTestId('DollarSignIcon');
        expect(dollarIcon).toHaveClass('text-red-600');
      });
    });

    it('displays all sections in correct order', async () => {
      render(<BusinessWidget />);
      
      await waitFor(() => {
        // Header
        expect(screen.getByText('Business Overview')).toBeInTheDocument();
        
        // Key metrics
        expect(screen.getByText('Revenue')).toBeInTheDocument();
        expect(screen.getByText('Expenses')).toBeInTheDocument();
        
        // Net profit
        expect(screen.getByText('Net Profit')).toBeInTheDocument();
        
        // Quick stats
        expect(screen.getByText('Outstanding Invoices')).toBeInTheDocument();
        expect(screen.getByText('Avg Payment Time')).toBeInTheDocument();
        
        // Top expense
        expect(screen.getByText('Top Expense')).toBeInTheDocument();
        
        // Button
        expect(screen.getByText('Business Features')).toBeInTheDocument();
      });
    });
  });
});
