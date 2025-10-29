/**
 * EmptyState Tests
 * Tests for the empty state component with optional icon, action, and description
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import EmptyState from './EmptyState';

// Mock the icons
vi.mock('./icons', () => ({
  PlusIcon: ({ size }: { size?: number }) => (
    <svg data-testid="plus-icon" width={size} height={size} />
  )
}));

describe('EmptyState', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with only title', () => {
      render(<EmptyState title="No transactions found" />);
      
      expect(screen.getByText('No transactions found')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('No transactions found');
    });

    it('renders with title and description', () => {
      render(
        <EmptyState 
          title="No data available" 
          description="Start by adding your first transaction"
        />
      );
      
      expect(screen.getByText('No data available')).toBeInTheDocument();
      expect(screen.getByText('Start by adding your first transaction')).toBeInTheDocument();
    });

    it('does not render icon container when no icon provided', () => {
      render(<EmptyState title="Empty" />);
      
      const iconContainer = document.querySelector('.text-gray-400');
      expect(iconContainer).not.toBeInTheDocument();
    });

    it('does not render description when not provided', () => {
      render(<EmptyState title="Empty" />);
      
      const description = document.querySelector('.text-gray-600');
      expect(description).not.toBeInTheDocument();
    });

    it('does not render action button when not provided', () => {
      render(<EmptyState title="Empty" />);
      
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Icon Rendering', () => {
    it('renders custom icon when provided', () => {
      const CustomIcon = () => <svg data-testid="custom-icon" />;
      
      render(
        <EmptyState 
          title="No results" 
          icon={<CustomIcon />}
        />
      );
      
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('applies correct styling to icon container', () => {
      const CustomIcon = () => <svg data-testid="custom-icon" />;
      
      render(
        <EmptyState 
          title="No results" 
          icon={<CustomIcon />}
        />
      );
      
      const iconContainer = screen.getByTestId('custom-icon').parentElement;
      expect(iconContainer).toHaveClass('mb-6', 'text-gray-400', 'dark:text-gray-600');
    });

    it('renders multiple icons if provided as fragment', () => {
      const MultipleIcons = () => (
        <>
          <svg data-testid="icon-1" />
          <svg data-testid="icon-2" />
        </>
      );
      
      render(
        <EmptyState 
          title="No results" 
          icon={<MultipleIcons />}
        />
      );
      
      expect(screen.getByTestId('icon-1')).toBeInTheDocument();
      expect(screen.getByTestId('icon-2')).toBeInTheDocument();
    });
  });

  describe('Action Button', () => {
    it('renders action button with label', () => {
      render(
        <EmptyState 
          title="No items" 
          action={{
            label: 'Add Item',
            onClick: mockOnClick
          }}
        />
      );
      
      const button = screen.getByRole('button', { name: /Add Item/ });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Add Item');
    });

    it('renders default plus icon when action has no icon', () => {
      render(
        <EmptyState 
          title="No items" 
          action={{
            label: 'Add Item',
            onClick: mockOnClick
          }}
        />
      );
      
      expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    });

    it('renders custom action icon when provided', () => {
      const CustomActionIcon = () => <svg data-testid="custom-action-icon" />;
      
      render(
        <EmptyState 
          title="No items" 
          action={{
            label: 'Import Data',
            onClick: mockOnClick,
            icon: <CustomActionIcon />
          }}
        />
      );
      
      expect(screen.getByTestId('custom-action-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('plus-icon')).not.toBeInTheDocument();
    });

    it('calls onClick handler when action button is clicked', () => {
      render(
        <EmptyState 
          title="No items" 
          action={{
            label: 'Add Item',
            onClick: mockOnClick
          }}
        />
      );
      
      fireEvent.click(screen.getByRole('button'));
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('applies correct styling to action button', () => {
      render(
        <EmptyState 
          title="No items" 
          action={{
            label: 'Add Item',
            onClick: mockOnClick
          }}
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass(
        'inline-flex',
        'items-center',
        'gap-2',
        'px-6',
        'py-3',
        'bg-primary',
        'text-white',
        'rounded-lg',
        'hover:bg-primary-dark',
        'transition-colors'
      );
    });
  });

  describe('Styling', () => {
    it('applies default container styling', () => {
      const { container } = render(<EmptyState title="Empty" />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass(
        'flex',
        'flex-col',
        'items-center',
        'justify-center',
        'py-12',
        'px-6',
        'text-center'
      );
    });

    it('applies custom className when provided', () => {
      const { container } = render(
        <EmptyState 
          title="Empty" 
          className="custom-empty-state"
        />
      );
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('custom-empty-state');
    });

    it('merges custom className with default classes', () => {
      const { container } = render(
        <EmptyState 
          title="Empty" 
          className="mt-8 bg-gray-50"
        />
      );
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex', 'flex-col', 'mt-8', 'bg-gray-50');
    });

    it('applies correct title styling', () => {
      render(<EmptyState title="No data" />);
      
      const title = screen.getByRole('heading');
      expect(title).toHaveClass(
        'text-xl',
        'font-semibold',
        'text-gray-900',
        'dark:text-white',
        'mb-2'
      );
    });

    it('applies correct description styling', () => {
      render(
        <EmptyState 
          title="No data" 
          description="This is a description"
        />
      );
      
      const description = screen.getByText('This is a description');
      expect(description).toHaveClass(
        'text-gray-600',
        'dark:text-gray-400',
        'max-w-md',
        'mb-6'
      );
    });
  });

  describe('Complete Example', () => {
    it('renders all elements together correctly', () => {
      const CustomIcon = () => (
        <svg data-testid="empty-icon" className="w-16 h-16" />
      );
      
      render(
        <EmptyState
          icon={<CustomIcon />}
          title="No transactions yet"
          description="Add your first transaction to start tracking your finances"
          action={{
            label: 'Add Transaction',
            onClick: mockOnClick
          }}
          className="mt-8"
        />
      );
      
      // Check all elements are present
      expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
      expect(screen.getByText('No transactions yet')).toBeInTheDocument();
      expect(screen.getByText('Add your first transaction to start tracking your finances')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add Transaction/ })).toBeInTheDocument();
      
      // Check layout order (icon -> title -> description -> action)
      const container = screen.getByTestId('empty-icon').closest('.mt-8');
      const children = Array.from(container?.children || []);
      
      expect(children[0]).toContainElement(screen.getByTestId('empty-icon'));
      expect(children[1]).toHaveTextContent('No transactions yet');
      expect(children[2]).toHaveTextContent('Add your first transaction to start tracking your finances');
      expect(children[3]).toHaveTextContent('Add Transaction');
    });
  });

  describe('Accessibility', () => {
    it('has semantic heading structure', () => {
      render(<EmptyState title="Empty State Title" />);
      
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Empty State Title');
    });

    it('action button is keyboard accessible', () => {
      render(
        <EmptyState 
          title="No items" 
          action={{
            label: 'Add Item',
            onClick: mockOnClick
          }}
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      
      // Simulate keyboard interaction
      button.focus();
      expect(document.activeElement).toBe(button);
      
      // For buttons, Enter and Space trigger click events
      fireEvent.click(button);
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('maintains proper text contrast ratios', () => {
      render(
        <EmptyState 
          title="High Contrast Title" 
          description="This description should be readable"
        />
      );
      
      // Component uses appropriate color classes for contrast
      const title = screen.getByText('High Contrast Title');
      const description = screen.getByText('This description should be readable');
      
      expect(title).toHaveClass('text-gray-900', 'dark:text-white');
      expect(description).toHaveClass('text-gray-600', 'dark:text-gray-400');
    });
  });

  describe('Edge Cases', () => {
    it('handles very long title text', () => {
      const longTitle = 'This is a very long title that might wrap to multiple lines in a narrow container';
      
      render(<EmptyState title={longTitle} />);
      
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('handles very long description text', () => {
      const longDescription = 'This is a very long description that definitely will wrap to multiple lines and should be constrained by the max-width styling to maintain readability';
      
      render(
        <EmptyState 
          title="Title" 
          description={longDescription}
        />
      );
      
      const description = screen.getByText(longDescription);
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass('max-w-md');
    });

    it('handles empty string title gracefully', () => {
      render(<EmptyState title="" />);
      
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('');
    });

    it('handles React elements as title', () => {
      const TitleWithEmphasis = () => (
        <>No <strong>transactions</strong> found</>
      );
      
      render(<EmptyState title={<TitleWithEmphasis />} />);
      
      expect(screen.getByText('transactions')).toBeInTheDocument();
      expect(screen.getByText('transactions').tagName).toBe('STRONG');
    });
  });
});