import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaxPlanningWidget from './TaxPlanningWidget';
import { useApp } from '../../contexts/AppContextSupabase';
import { taxPlanningService } from '../../services/taxPlanningService';
import { useNavigate } from 'react-router-dom';
import { toDecimal } from '../../utils/decimal';
import { formatCurrency as formatCurrencyDecimal } from '../../utils/currency-decimal';
import type { Transaction, Account } from '../../types';

const formatCurrencyMock = (value: any, currency: string = 'USD'): string =>
  formatCurrencyDecimal(value, currency);

const mockUseCurrencyDecimal = vi.fn();

// Mock dependencies
vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: vi.fn(),
}));
vi.mock('../../services/taxPlanningService');
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));
vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => mockUseCurrencyDecimal(),
}));

// Mock icons
vi.mock('../icons', () => ({
  CalculatorIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="CalculatorIcon" data-size={size} className={className} />
  ),
  TrendingUpIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="TrendingUpIcon" data-size={size} className={className} />
  ),
  FileTextIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="FileTextIcon" data-size={size} className={className} />
  ),
  CalendarIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="CalendarIcon" data-size={size} className={className} />
  ),
}));

const mockNavigate = vi.fn();
const mockUseApp = useApp as Mock;
const mockTaxPlanningService = taxPlanningService as {
  estimateTaxes: Mock;
  trackDeductibleExpenses: Mock;
};

// Mock data
const mockTransactions: Transaction[] = [];
const mockAccounts: Account[] = [];

const mockTaxEstimate = {
  estimatedTax: toDecimal(5250.75),
  effectiveRate: 18.5,
  taxableIncome: toDecimal(28380),
  deductions: toDecimal(13200),
  credits: toDecimal(0),
};

const mockDeductibleExpenses = [
  {
    id: 'ded1',
    category: 'Charitable',
    description: 'Red Cross Donation',
    amount: toDecimal(500),
    date: new Date('2024-01-15'),
    type: 'standard' as const,
  },
  {
    id: 'ded2',
    category: 'Medical',
    description: 'Doctor Visit',
    amount: toDecimal(250),
    date: new Date('2024-02-10'),
    type: 'medical' as const,
  },
  {
    id: 'ded3',
    category: 'Business',
    description: 'Office Supplies',
    amount: toDecimal(150),
    date: new Date('2024-03-05'),
    type: 'business' as const,
  },
];

beforeAll(() => {
  vi.useRealTimers(); // Reset any existing timers
});

describe('TaxPlanningWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-20'));
    
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    mockUseCurrencyDecimal.mockReturnValue({
      formatCurrency: (value: any, currency?: string) => formatCurrencyMock(value, currency ?? 'USD'),
      displayCurrency: 'USD',
    });
    mockUseApp.mockReturnValue({
      transactions: mockTransactions,
      accounts: mockAccounts,
    });
    mockTaxPlanningService.estimateTaxes.mockReturnValue(mockTaxEstimate);
    mockTaxPlanningService.trackDeductibleExpenses.mockReturnValue(mockDeductibleExpenses);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Small Size', () => {
    it('renders small size with tax estimate', () => {
      render(<TaxPlanningWidget size="small" />);
      
      expect(screen.getByText('Tax Planning')).toBeInTheDocument();
      expect(screen.getByText('$5,250.75')).toBeInTheDocument();
      expect(screen.getByText('Est. Tax (18.5%)')).toBeInTheDocument();
      expect(screen.getByTestId('CalculatorIcon')).toHaveAttribute('data-size', '20');
    });

    it('navigates to tax planning page on click', () => {
      render(<TaxPlanningWidget size="small" />);
      
      const container = screen.getByText('Tax Planning').closest('.cursor-pointer');
      fireEvent.click(container!);
      
      expect(mockNavigate).toHaveBeenCalledWith('/tax-planning');
    });
  });

  describe('Tax Calculations', () => {
    it('calculates tax data on mount', () => {
      render(<TaxPlanningWidget />);
      
      expect(mockTaxPlanningService.estimateTaxes).toHaveBeenCalledWith(
        mockTransactions,
        mockAccounts,
        2024
      );
      expect(mockTaxPlanningService.trackDeductibleExpenses).toHaveBeenCalledWith(
        mockTransactions,
        2024
      );
    });

    it('recalculates when transactions change', () => {
      const { rerender } = render(<TaxPlanningWidget />);
      
      mockTaxPlanningService.estimateTaxes.mockClear();
      mockTaxPlanningService.trackDeductibleExpenses.mockClear();
      
      const newTransactions = [{ id: 'tx1' }] as Transaction[];
      mockUseApp.mockReturnValue({
        transactions: newTransactions,
        accounts: mockAccounts,
      });
      
      rerender(<TaxPlanningWidget />);
      
      expect(mockTaxPlanningService.estimateTaxes).toHaveBeenCalledWith(
        newTransactions,
        mockAccounts,
        2024
      );
    });

    it('sums deductions correctly', () => {
      render(<TaxPlanningWidget />);
      
      // Total deductions: 500 + 250 + 150 = 900
      expect(
        screen.getByText((content) => content.includes('$900.00'))
      ).toBeInTheDocument();
      expect(screen.getByText('Tracked YTD')).toBeInTheDocument();
    });
  });

  describe('Tax Deadline Warning', () => {
    it('shows deadline warning when within 90 days', () => {
      // Set date to March 1, 2024 (45 days before April 15)
      vi.setSystemTime(new Date('2024-03-01'));
      
      render(<TaxPlanningWidget />);
      
      expect(screen.getByText('45 days until tax deadline')).toBeInTheDocument();
      expect(screen.getByTestId('CalendarIcon')).toBeInTheDocument();
    });

    it('does not show warning when more than 90 days away', () => {
      // Set date to January 1, 2024 (104 days before April 15)
      vi.setSystemTime(new Date('2024-01-01'));
      
      render(<TaxPlanningWidget />);
      
      expect(screen.queryByText(/days until tax deadline/)).not.toBeInTheDocument();
    });

    it('does not show warning after deadline has passed', () => {
      // Set date to April 20, 2024 (after deadline)
      vi.setSystemTime(new Date('2024-04-20'));
      
      render(<TaxPlanningWidget />);
      
      expect(screen.queryByText(/days until tax deadline/)).not.toBeInTheDocument();
    });

    it('calculates next year deadline when past April', () => {
      // Set date to October 1, 2024 (should calculate for April 15, 2025)
      vi.setSystemTime(new Date('2024-10-01'));
      
      render(<TaxPlanningWidget />);
      
      // Should be about 196 days to April 15, 2025
      expect(screen.queryByText(/days until tax deadline/)).not.toBeInTheDocument(); // > 90 days
    });
  });

  describe('Medium Size (Default)', () => {
    it('renders medium size with full details', () => {
      render(<TaxPlanningWidget />);
      
      expect(screen.getByText('Tax Planning')).toBeInTheDocument();
      expect(screen.getByText('2024 Tax Year')).toBeInTheDocument();
      expect(screen.getByText('Estimated Tax')).toBeInTheDocument();
      expect(screen.getByText('$5,250.75')).toBeInTheDocument();
      expect(screen.getByText('18.5% rate')).toBeInTheDocument();
      expect(screen.getByText('Deductions')).toBeInTheDocument();
      expect(
        screen.getByText((content) => content.includes('$900.00'))
      ).toBeInTheDocument();
    });

    it('shows track receipts message', () => {
      render(<TaxPlanningWidget />);
      
      expect(screen.getByText('Track receipts & documents')).toBeInTheDocument();
      expect(screen.getByTestId('FileTextIcon')).toBeInTheDocument();
      expect(screen.getByTestId('TrendingUpIcon')).toHaveAttribute('data-size', '14');
    });

    it('shows view tax planning button', () => {
      render(<TaxPlanningWidget />);
      
      const button = screen.getByText('View Tax Planning');
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
    });

    it('navigates to tax planning on button click', () => {
      render(<TaxPlanningWidget />);
      
      fireEvent.click(screen.getByText('View Tax Planning'));
      
      expect(mockNavigate).toHaveBeenCalledWith('/tax-planning');
    });
  });

  describe('Large Size', () => {
    it('renders the same as medium size', () => {
      render(<TaxPlanningWidget size="large" />);
      
      // The component doesn't have a specific large size implementation
      // It should render the same as medium
      expect(screen.getByText('Tax Planning')).toBeInTheDocument();
      expect(screen.getByText('2024 Tax Year')).toBeInTheDocument();
      expect(screen.getByText('Estimated Tax')).toBeInTheDocument();
      expect(screen.getByText('Deductions')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero tax estimate', () => {
      mockTaxPlanningService.estimateTaxes.mockReturnValue({
        estimatedTax: toDecimal(0),
        effectiveRate: 0,
        taxableIncome: toDecimal(0),
        deductions: toDecimal(0),
        credits: toDecimal(0),
      });
      
      render(<TaxPlanningWidget />);
      
      expect(screen.getByText('$0.00')).toBeInTheDocument();
      expect(screen.getByText('0.0% rate')).toBeInTheDocument();
    });

    it('handles no deductible expenses', () => {
      mockTaxPlanningService.trackDeductibleExpenses.mockReturnValue([]);
      
      render(<TaxPlanningWidget />);
      
      const deductionElements = screen.getAllByText('$0.00');
      expect(deductionElements.length).toBeGreaterThan(0);
    });

    it('handles high tax rates', () => {
      mockTaxPlanningService.estimateTaxes.mockReturnValue({
        ...mockTaxEstimate,
        effectiveRate: 37.5,
      });
      
      render(<TaxPlanningWidget />);
      
      expect(screen.getByText('37.5% rate')).toBeInTheDocument();
    });

    it('formats large amounts correctly', () => {
      mockTaxPlanningService.estimateTaxes.mockReturnValue({
        ...mockTaxEstimate,
        estimatedTax: toDecimal(125000.50),
      });
      
      render(<TaxPlanningWidget size="small" />);
      
      expect(screen.getByText('$125,000.50')).toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('renders with correct header', () => {
      render(<TaxPlanningWidget />);
      
      expect(screen.getByText('Tax Planning')).toBeInTheDocument();
      expect(screen.getByTestId('CalculatorIcon')).toHaveClass('text-green-600');
    });

    it('uses correct color scheme for metrics', () => {
      render(<TaxPlanningWidget />);
      
      // Estimated tax should be in red (expense)
      const taxAmount = screen.getByText('$5,250.75');
      expect(taxAmount).toHaveClass('text-red-600');
      
      // Deductions should be in green (benefit)
      const deductionAmount = screen.getByText('$900.00');
      expect(deductionAmount).toHaveClass('text-green-600');
    });

    it('applies correct container styles', () => {
      const { container } = render(<TaxPlanningWidget />);
      
      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass('h-full', 'flex', 'flex-col');
    });
  });

  describe('Effective Rate Display', () => {
    it('displays effective rate with one decimal place', () => {
      mockTaxPlanningService.estimateTaxes.mockReturnValue({
        ...mockTaxEstimate,
        effectiveRate: 22.456,
      });
      
      render(<TaxPlanningWidget />);
      
      expect(screen.getByText('22.5% rate')).toBeInTheDocument();
    });

    it('rounds effective rate correctly', () => {
      mockTaxPlanningService.estimateTaxes.mockReturnValue({
        ...mockTaxEstimate,
        effectiveRate: 15.94,
      });
      
      render(<TaxPlanningWidget />);
      
      expect(screen.getByText('15.9% rate')).toBeInTheDocument();
    });
  });
});
