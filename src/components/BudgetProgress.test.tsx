/**
 * BudgetProgress Tests
 * Tests for the budget progress tracking component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import BudgetProgress from './BudgetProgress';

// Mock icons
vi.mock('./icons', () => ({
  AlertCircle: ({ className, size }: { className?: string; size?: number }) => (
    <span data-testid="alert-circle" className={className} style={{ fontSize: size }}>⚠️</span>
  ),
  CheckCircle: ({ className, size }: { className?: string; size?: number }) => (
    <span data-testid="check-circle" className={className} style={{ fontSize: size }}>✅</span>
  ),
  XCircle: ({ className, size }: { className?: string; size?: number }) => (
    <span data-testid="x-circle" className={className} style={{ fontSize: size }}>❌</span>
  )
}));

// Mock currency formatting
const mockFormatCurrency = vi.fn((value: number) => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD' 
  }).format(value);
});

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: mockFormatCurrency
  })
}));

describe('BudgetProgress', () => {
  const defaultProps = {
    category: 'Groceries',
    budgetAmount: 500,
    spent: 300
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders category name', () => {
      render(<BudgetProgress {...defaultProps} />);
      
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    it('displays spent amount and budget', () => {
      render(<BudgetProgress {...defaultProps} />);
      
      expect(screen.getByText('$300.00 of $500.00')).toBeInTheDocument();
    });

    it('shows remaining amount when under budget', () => {
      render(<BudgetProgress {...defaultProps} />);
      
      expect(screen.getByText('$200.00 left')).toBeInTheDocument();
    });

    it('shows over amount when over budget', () => {
      render(<BudgetProgress category="Food" budgetAmount={500} spent={600} />);
      
      expect(screen.getByText('$100.00 over')).toBeInTheDocument();
    });
  });

  describe('Progress Bar', () => {
    it('shows correct width for progress under 100%', () => {
      render(<BudgetProgress {...defaultProps} />);
      
      const progressBar = document.querySelector('.h-2.rounded-full.transition-all');
      // 300/500 = 60%
      expect(progressBar).toHaveStyle({ width: '60%' });
    });

    it('caps progress bar at 100% when over budget', () => {
      render(<BudgetProgress category="Food" budgetAmount={500} spent={700} />);
      
      const progressBar = document.querySelector('.h-2.rounded-full.transition-all');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('shows 0% progress when nothing spent', () => {
      render(<BudgetProgress category="Food" budgetAmount={500} spent={0} />);
      
      const progressBar = document.querySelector('.h-2.rounded-full.transition-all');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('handles zero budget correctly', () => {
      render(<BudgetProgress category="Food" budgetAmount={0} spent={100} />);
      
      const progressBar = document.querySelector('.h-2.rounded-full.transition-all');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });
  });

  describe('Status Indicators', () => {
    it('shows green check and "On track" when under 80%', () => {
      render(<BudgetProgress {...defaultProps} />);
      
      expect(screen.getByTestId('check-circle')).toBeInTheDocument();
      expect(screen.getByTestId('check-circle')).toHaveClass('text-green-500');
      expect(screen.getByText('On track')).toBeInTheDocument();
    });

    it('shows yellow alert and "Approaching limit" when 80-99%', () => {
      render(<BudgetProgress category="Food" budgetAmount={500} spent={420} />);
      
      expect(screen.getByTestId('alert-circle')).toBeInTheDocument();
      expect(screen.getByTestId('alert-circle')).toHaveClass('text-yellow-500');
      expect(screen.getByText('Approaching limit')).toBeInTheDocument();
    });

    it('shows red X and "Over budget" when 100% or more', () => {
      render(<BudgetProgress category="Food" budgetAmount={500} spent={500} />);
      
      expect(screen.getByTestId('x-circle')).toBeInTheDocument();
      expect(screen.getByTestId('x-circle')).toHaveClass('text-red-500');
      expect(screen.getByText('Over budget')).toBeInTheDocument();
    });
  });

  describe('Progress Bar Colors', () => {
    it('uses green color when under 80%', () => {
      render(<BudgetProgress {...defaultProps} />);
      
      const progressBar = document.querySelector('.h-2.rounded-full.transition-all');
      expect(progressBar).toHaveClass('bg-green-500');
    });

    it('uses yellow color when 80-99%', () => {
      render(<BudgetProgress category="Food" budgetAmount={500} spent={420} />);
      
      const progressBar = document.querySelector('.h-2.rounded-full.transition-all');
      expect(progressBar).toHaveClass('bg-yellow-500');
    });

    it('uses red color when 100% or more', () => {
      render(<BudgetProgress category="Food" budgetAmount={500} spent={600} />);
      
      const progressBar = document.querySelector('.h-2.rounded-full.transition-all');
      expect(progressBar).toHaveClass('bg-red-500');
    });
  });

  describe('Action Buttons', () => {
    it('shows edit button when onEdit provided', () => {
      const mockEdit = vi.fn();
      render(<BudgetProgress {...defaultProps} onEdit={mockEdit} />);
      
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('shows delete button when onDelete provided', () => {
      const mockDelete = vi.fn();
      render(<BudgetProgress {...defaultProps} onDelete={mockDelete} />);
      
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('does not show buttons when handlers not provided', () => {
      render(<BudgetProgress {...defaultProps} />);
      
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });

    it('calls onEdit when edit button clicked', () => {
      const mockEdit = vi.fn();
      render(<BudgetProgress {...defaultProps} onEdit={mockEdit} />);
      
      fireEvent.click(screen.getByText('Edit'));
      
      expect(mockEdit).toHaveBeenCalledTimes(1);
    });

    it('calls onDelete when delete button clicked', () => {
      const mockDelete = vi.fn();
      render(<BudgetProgress {...defaultProps} onDelete={mockDelete} />);
      
      fireEvent.click(screen.getByText('Delete'));
      
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Text Colors', () => {
    it('shows status text in red when over budget', () => {
      render(<BudgetProgress category="Food" budgetAmount={500} spent={600} />);
      
      const statusText = screen.getByText('Over budget');
      expect(statusText).toHaveClass('text-red-600');
    });

    it('shows status text in gray when under budget', () => {
      render(<BudgetProgress {...defaultProps} />);
      
      const statusText = screen.getByText('On track');
      expect(statusText).toHaveClass('text-gray-700');
    });

    it('shows remaining amount in green when positive', () => {
      render(<BudgetProgress {...defaultProps} />);
      
      const remainingText = screen.getByText('$200.00 left');
      expect(remainingText).toHaveClass('text-green-600');
    });

    it('shows over amount in red when negative', () => {
      render(<BudgetProgress category="Food" budgetAmount={500} spent={600} />);
      
      const overText = screen.getByText('$100.00 over');
      expect(overText).toHaveClass('text-red-600');
    });
  });

  describe('Edge Cases', () => {
    it('handles exact budget match', () => {
      render(<BudgetProgress category="Food" budgetAmount={500} spent={500} />);
      
      expect(screen.getByText('Over budget')).toBeInTheDocument();
      expect(screen.getByText('$0.00 left')).toBeInTheDocument();
    });

    it('handles very small amounts', () => {
      render(<BudgetProgress category="Food" budgetAmount={0.01} spent={0.005} />);
      
      expect(screen.getByText('$0.01 of $0.01')).toBeInTheDocument();
    });

    it('handles large amounts', () => {
      render(<BudgetProgress category="Food" budgetAmount={100000} spent={50000} />);
      
      expect(screen.getByText('$50,000.00 of $100,000.00')).toBeInTheDocument();
    });

    it('handles negative budget gracefully', () => {
      render(<BudgetProgress category="Food" budgetAmount={-500} spent={100} />);
      
      const progressBar = document.querySelector('.h-2.rounded-full.transition-all');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });
  });

  describe('Component Structure', () => {
    it('has correct container structure', () => {
      const { container } = render(<BudgetProgress {...defaultProps} />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('bg-white', 'p-4', 'rounded-lg', 'shadow');
    });

    it('renders progress bar container', () => {
      render(<BudgetProgress {...defaultProps} />);
      
      const progressContainer = document.querySelector('.w-full.bg-gray-200.rounded-full.h-2');
      expect(progressContainer).toHaveClass('w-full', 'bg-gray-200', 'rounded-full', 'h-2');
    });
  });

  describe('Memoization', () => {
    it('does not re-render when props are unchanged', () => {
      const { rerender } = render(<BudgetProgress {...defaultProps} />);
      
      const initialRender = mockFormatCurrency.mock.calls.length;
      
      rerender(<BudgetProgress {...defaultProps} />);
      
      // formatCurrency should not be called again
      expect(mockFormatCurrency).toHaveBeenCalledTimes(initialRender);
    });

    it('re-renders when props change', () => {
      const { rerender } = render(<BudgetProgress {...defaultProps} />);
      
      const initialRender = mockFormatCurrency.mock.calls.length;
      
      rerender(<BudgetProgress {...defaultProps} spent={400} />);
      
      // formatCurrency should be called again
      expect(mockFormatCurrency.mock.calls.length).toBeGreaterThan(initialRender);
    });
  });

  describe('Accessibility', () => {
    it('has accessible structure for screen readers', () => {
      render(<BudgetProgress {...defaultProps} />);
      
      // Category heading
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Groceries');
      
      // Buttons have accessible text
      const mockEdit = vi.fn();
      const mockDelete = vi.fn();
      render(<BudgetProgress {...defaultProps} onEdit={mockEdit} onDelete={mockDelete} />);
      
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
  });
});
