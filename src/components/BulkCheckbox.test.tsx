/**
 * BulkCheckbox Tests
 * Tests for the bulk checkbox component with indeterminate state support
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import BulkCheckbox from './BulkCheckbox';

// Mock the icons
vi.mock('./icons', () => ({
  CheckIcon: ({ size, className }: { size?: number; className?: string }) => (
    <svg data-testid="check-icon" width={size} height={size} className={className} />
  ),
  MinusIcon: ({ size, className }: { size?: number; className?: string }) => (
    <svg data-testid="minus-icon" width={size} height={size} className={className} />
  )
}));

describe('BulkCheckbox', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders unchecked state correctly', () => {
      render(<BulkCheckbox checked={false} onChange={mockOnChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('minus-icon')).not.toBeInTheDocument();
    });

    it('renders checked state with check icon', () => {
      render(<BulkCheckbox checked={true} onChange={mockOnChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('minus-icon')).not.toBeInTheDocument();
    });

    it('renders indeterminate state with minus icon', () => {
      render(<BulkCheckbox checked={false} indeterminate={true} onChange={mockOnChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
      expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument();
      expect(screen.getByTestId('minus-icon')).toBeInTheDocument();
    });

    it('prioritizes indeterminate over checked when both are true', () => {
      render(<BulkCheckbox checked={true} indeterminate={true} onChange={mockOnChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
      expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument();
      expect(screen.getByTestId('minus-icon')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('calls onChange with true when clicking unchecked checkbox', () => {
      render(<BulkCheckbox checked={false} onChange={mockOnChange} />);
      
      fireEvent.click(screen.getByRole('checkbox'));
      expect(mockOnChange).toHaveBeenCalledWith(true);
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it('calls onChange with false when clicking checked checkbox', () => {
      render(<BulkCheckbox checked={true} onChange={mockOnChange} />);
      
      fireEvent.click(screen.getByRole('checkbox'));
      expect(mockOnChange).toHaveBeenCalledWith(false);
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it('calls onChange with false when clicking indeterminate checkbox', () => {
      render(<BulkCheckbox checked={true} indeterminate={true} onChange={mockOnChange} />);
      
      fireEvent.click(screen.getByRole('checkbox'));
      expect(mockOnChange).toHaveBeenCalledWith(false);
    });

    it('does not call onChange when disabled', () => {
      render(<BulkCheckbox checked={false} onChange={mockOnChange} disabled={true} />);
      
      fireEvent.click(screen.getByRole('checkbox'));
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('has disabled attribute when disabled', () => {
      render(<BulkCheckbox checked={false} onChange={mockOnChange} disabled={true} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
      expect(checkbox).toHaveClass('opacity-50', 'cursor-not-allowed');
    });
  });

  describe('Size Variants', () => {
    it('applies small size classes correctly', () => {
      render(<BulkCheckbox checked={true} onChange={mockOnChange} size="sm" />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass('w-4', 'h-4');
      
      const icon = screen.getByTestId('check-icon');
      expect(icon).toHaveAttribute('width', '12');
      expect(icon).toHaveAttribute('height', '12');
    });

    it('applies medium size classes correctly (default)', () => {
      render(<BulkCheckbox checked={true} onChange={mockOnChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass('w-5', 'h-5');
      
      const icon = screen.getByTestId('check-icon');
      expect(icon).toHaveAttribute('width', '16');
      expect(icon).toHaveAttribute('height', '16');
    });

    it('applies large size classes correctly', () => {
      render(<BulkCheckbox checked={true} onChange={mockOnChange} size="lg" />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass('w-6', 'h-6');
      
      const icon = screen.getByTestId('check-icon');
      expect(icon).toHaveAttribute('width', '20');
      expect(icon).toHaveAttribute('height', '20');
    });

    it('applies correct icon size for indeterminate state', () => {
      render(<BulkCheckbox checked={false} indeterminate={true} onChange={mockOnChange} size="lg" />);
      
      const icon = screen.getByTestId('minus-icon');
      expect(icon).toHaveAttribute('width', '20');
      expect(icon).toHaveAttribute('height', '20');
    });
  });

  describe('Styling', () => {
    it('applies correct styles for unchecked state', () => {
      render(<BulkCheckbox checked={false} onChange={mockOnChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass(
        'border-gray-300',
        'dark:border-gray-600',
        'hover:border-[var(--color-primary)]',
        'bg-white',
        'dark:bg-gray-700'
      );
    });

    it('applies correct styles for checked state', () => {
      render(<BulkCheckbox checked={true} onChange={mockOnChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass(
        'bg-[var(--color-primary)]',
        'border-[var(--color-primary)]',
        'text-white'
      );
    });

    it('applies correct styles for indeterminate state', () => {
      render(<BulkCheckbox checked={false} indeterminate={true} onChange={mockOnChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass(
        'bg-[var(--color-primary)]',
        'border-[var(--color-primary)]',
        'text-white'
      );
    });

    it('applies common styling classes', () => {
      render(<BulkCheckbox checked={false} onChange={mockOnChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass(
        'rounded',
        'border-2',
        'transition-all',
        'duration-200',
        'focus:outline-none',
        'focus:ring-2',
        'focus:ring-[var(--color-primary)]/50',
        'focus:ring-offset-1'
      );
    });

    it('applies custom className', () => {
      render(<BulkCheckbox checked={false} onChange={mockOnChange} className="custom-checkbox" />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass('custom-checkbox');
    });

    it('applies white color to icons', () => {
      render(<BulkCheckbox checked={true} onChange={mockOnChange} />);
      
      const icon = screen.getByTestId('check-icon');
      expect(icon).toHaveClass('text-white');
    });
  });

  describe('Accessibility', () => {
    it('has proper role attribute', () => {
      render(<BulkCheckbox checked={false} onChange={mockOnChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('role', 'checkbox');
    });

    it('has correct aria-checked for all states', () => {
      const { rerender } = render(<BulkCheckbox checked={false} onChange={mockOnChange} />);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
      
      rerender(<BulkCheckbox checked={true} onChange={mockOnChange} />);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
      
      rerender(<BulkCheckbox checked={false} indeterminate={true} onChange={mockOnChange} />);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
    });

    it('is keyboard accessible', () => {
      render(<BulkCheckbox checked={false} onChange={mockOnChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      checkbox.focus();
      expect(document.activeElement).toBe(checkbox);
      
      // Simulate space key press
      fireEvent.keyDown(checkbox, { key: ' ' });
      fireEvent.click(checkbox);
      expect(mockOnChange).toHaveBeenCalledWith(true);
    });

    it('has type button to prevent form submission', () => {
      render(<BulkCheckbox checked={false} onChange={mockOnChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('type', 'button');
    });

    it('shows focus ring when focused', () => {
      render(<BulkCheckbox checked={false} onChange={mockOnChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass(
        'focus:outline-none',
        'focus:ring-2',
        'focus:ring-[var(--color-primary)]/50',
        'focus:ring-offset-1'
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles rapid clicks correctly', () => {
      render(<BulkCheckbox checked={false} onChange={mockOnChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      
      // Rapid clicks
      fireEvent.click(checkbox);
      fireEvent.click(checkbox);
      fireEvent.click(checkbox);
      
      expect(mockOnChange).toHaveBeenCalledTimes(3);
      expect(mockOnChange).toHaveBeenNthCalledWith(1, true);
      expect(mockOnChange).toHaveBeenNthCalledWith(2, true);
      expect(mockOnChange).toHaveBeenNthCalledWith(3, true);
    });

    it('maintains proper state when switching between states', () => {
      const { rerender } = render(<BulkCheckbox checked={false} onChange={mockOnChange} />);
      expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('minus-icon')).not.toBeInTheDocument();
      
      rerender(<BulkCheckbox checked={true} onChange={mockOnChange} />);
      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('minus-icon')).not.toBeInTheDocument();
      
      rerender(<BulkCheckbox checked={true} indeterminate={true} onChange={mockOnChange} />);
      expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument();
      expect(screen.getByTestId('minus-icon')).toBeInTheDocument();
    });

  });
});