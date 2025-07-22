/**
 * GoalProgressWidget Tests
 * Tests for the goal progress widget component with different sizes
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import GoalProgressWidget from './GoalProgressWidget';
import { useApp } from '../../contexts/AppContext';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { Goal } from '../../types';

// Mock the external dependencies
vi.mock('../../contexts/AppContext');
vi.mock('../../hooks/useCurrencyDecimal');

// Mock react-circular-progressbar
vi.mock('react-circular-progressbar', () => ({
  CircularProgressbar: ({ value, text }: any) => (
    <div data-testid="circular-progressbar" data-value={value} data-text={text}>
      {text}
    </div>
  ),
  buildStyles: (styles: any) => styles
}));

// Mock CSS import
vi.mock('react-circular-progressbar/dist/styles.css', () => ({}));

// Mock icons
vi.mock('../../components/icons', () => ({
  TargetIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="target-icon" data-size={size} className={className} />
  ),
  TrendingUpIcon: ({ size }: { size?: number }) => (
    <div data-testid="trending-up-icon" data-size={size} />
  ),
  CheckCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="check-circle-icon" data-size={size} className={className} />
  )
}));

const mockUseApp = useApp as Mock;
const mockUseCurrencyDecimal = useCurrencyDecimal as Mock;

describe('GoalProgressWidget', () => {
  const mockFormatCurrency = vi.fn((amount: any) => {
    const value = typeof amount === 'number' ? amount : amount.toNumber();
    return `£${value.toFixed(2)}`;
  });

  const mockGoals: Goal[] = [
    {
      id: 'goal-1',
      name: 'Emergency Fund',
      description: 'Build 6 months of expenses',
      targetAmount: 10000,
      currentAmount: 6500,
      targetDate: new Date('2024-12-31'),
      category: 'Savings',
      progress: 65,
      achieved: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-25')
    },
    {
      id: 'goal-2',
      name: 'New Car',
      description: 'Save for a new car',
      targetAmount: 25000,
      currentAmount: 8000,
      targetDate: new Date('2025-06-30'),
      category: 'Purchase',
      progress: 32,
      achieved: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-25')
    },
    {
      id: 'goal-3',
      name: 'Vacation Fund',
      description: 'Summer vacation to Japan',
      targetAmount: 5000,
      currentAmount: 3750,
      targetDate: new Date('2024-07-01'),
      category: 'Travel',
      progress: 75,
      achieved: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-25')
    },
    {
      id: 'goal-4',
      name: 'House Down Payment',
      description: '20% down payment',
      targetAmount: 50000,
      currentAmount: 20000,
      targetDate: new Date('2026-12-31'),
      category: 'Property',
      progress: 40,
      achieved: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-25')
    },
    {
      id: 'goal-5',
      name: 'MacBook Pro',
      description: 'New laptop for work',
      targetAmount: 3000,
      currentAmount: 3000,
      targetDate: new Date('2024-03-01'),
      category: 'Technology',
      progress: 100,
      achieved: true, // This one is achieved
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-25')
    },
    {
      id: 'goal-6',
      name: 'Investment Portfolio',
      description: 'Build investment portfolio',
      targetAmount: 100000,
      currentAmount: 15000,
      targetDate: new Date('2030-12-31'),
      category: 'Investment',
      progress: 15,
      achieved: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-25')
    }
  ];

  const defaultProps = {
    size: 'medium' as const,
    settings: {}
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseApp.mockReturnValue({
      goals: mockGoals
    });

    mockUseCurrencyDecimal.mockReturnValue({
      formatCurrency: mockFormatCurrency
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no goals exist', () => {
      mockUseApp.mockReturnValue({
        goals: []
      });

      render(<GoalProgressWidget {...defaultProps} />);
      
      expect(screen.getByTestId('target-icon')).toBeInTheDocument();
      expect(screen.getByText('No goals set')).toBeInTheDocument();
      expect(screen.getByText('Set your first goal')).toBeInTheDocument();
    });

    it('shows link to goals page in empty state', () => {
      mockUseApp.mockReturnValue({
        goals: []
      });

      render(<GoalProgressWidget {...defaultProps} />);
      
      const link = screen.getByText('Set your first goal');
      expect(link).toHaveAttribute('href', '/goals');
      expect(link).toHaveClass('text-xs', 'text-primary', 'hover:underline');
    });
  });

  describe('Small Size', () => {
    it('renders small widget with 2 active goals', () => {
      render(<GoalProgressWidget size="small" settings={{}} />);
      
      // Should show only 2 goals for small size
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      expect(screen.getByText('New Car')).toBeInTheDocument();
      
      // Should not show 3rd goal
      expect(screen.queryByText('Vacation Fund')).not.toBeInTheDocument();
    });

    it('calculates average progress correctly', () => {
      render(<GoalProgressWidget size="small" settings={{}} />);
      
      // Average of 65% and 32% = 48.5%, rounded to 49%
      // Check the main display (text-2xl)
      const mainProgress = screen.getByText((content, element) => {
        return element?.className?.includes('text-2xl') && content === '49%';
      });
      expect(mainProgress).toBeInTheDocument();
      expect(screen.getByText('Average Progress')).toBeInTheDocument();
    });
  });

  describe('Medium Size', () => {
    it('renders medium widget with 3 active goals', () => {
      render(<GoalProgressWidget size="medium" settings={{}} />);
      
      // Should show 3 goals for medium size
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      expect(screen.getByText('New Car')).toBeInTheDocument();
      expect(screen.getByText('Vacation Fund')).toBeInTheDocument();
      
      // Should not show 4th goal
      expect(screen.queryByText('House Down Payment')).not.toBeInTheDocument();
    });

    it('shows circular progress bar with correct value', () => {
      render(<GoalProgressWidget size="medium" settings={{}} />);
      
      const progressBar = screen.getByTestId('circular-progressbar');
      // Average of 65%, 32%, 75% = 57.33%, rounded to 57%
      expect(progressBar).toHaveAttribute('data-value', '57');
      expect(progressBar).toHaveAttribute('data-text', '57%');
    });
  });

  describe('Large Size', () => {
    it('renders large widget with up to 5 active goals', () => {
      render(<GoalProgressWidget size="large" settings={{}} />);
      
      // Should show first 5 non-achieved goals
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      expect(screen.getByText('New Car')).toBeInTheDocument();
      expect(screen.getByText('Vacation Fund')).toBeInTheDocument();
      expect(screen.getByText('House Down Payment')).toBeInTheDocument();
      expect(screen.getByText('Investment Portfolio')).toBeInTheDocument();
      
      // Should not show achieved goal
      expect(screen.queryByText('MacBook Pro')).not.toBeInTheDocument();
    });

    it('adds scrollable container for large size', () => {
      render(<GoalProgressWidget size="large" settings={{}} />);
      
      const goalsContainer = screen.getByText('Emergency Fund').closest('.space-y-3');
      expect(goalsContainer).toHaveClass('max-h-64', 'overflow-y-auto');
    });
  });

  describe('Goal Display', () => {
    it('shows goal progress bars with correct widths', () => {
      render(<GoalProgressWidget size="medium" settings={{}} />);
      
      // Find all progress bars
      const progressBars = document.querySelectorAll('.bg-primary');
      
      expect(progressBars[0]).toHaveStyle({ width: '65%' });
      expect(progressBars[1]).toHaveStyle({ width: '32%' });
      expect(progressBars[2]).toHaveStyle({ width: '75%' });
    });

    it('shows current and target amounts', () => {
      render(<GoalProgressWidget size="medium" settings={{}} />);
      
      // Emergency Fund amounts
      expect(screen.getByText('£6500.00')).toBeInTheDocument();
      expect(screen.getByText('£10000.00')).toBeInTheDocument();
      
      // New Car amounts
      expect(screen.getByText('£8000.00')).toBeInTheDocument();
      expect(screen.getByText('£25000.00')).toBeInTheDocument();
    });

    it('shows target dates when available', () => {
      render(<GoalProgressWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('Target: 12/31/2024')).toBeInTheDocument();
      expect(screen.getByText('Target: 6/30/2025')).toBeInTheDocument();
      expect(screen.getByText('Target: 7/1/2024')).toBeInTheDocument();
    });

    it('shows percentage for goals under 100%', () => {
      render(<GoalProgressWidget size="medium" settings={{}} />);
      
      // Should show specific goal percentages
      expect(screen.getByText('65%')).toBeInTheDocument(); // Emergency Fund
      expect(screen.getByText('32%')).toBeInTheDocument(); // New Car
      expect(screen.getByText('75%')).toBeInTheDocument(); // Vacation Fund
    });

    it('shows check icon for completed goals', () => {
      // Add a completed goal to active goals
      const goalsWithCompleted = [
        ...mockGoals.slice(0, 2),
        { ...mockGoals[0], progress: 100 } // Make first goal 100%
      ];

      mockUseApp.mockReturnValue({
        goals: goalsWithCompleted
      });

      render(<GoalProgressWidget size="medium" settings={{}} />);
      
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('filters out achieved goals', () => {
      render(<GoalProgressWidget size="large" settings={{}} />);
      
      // MacBook Pro is achieved, should not appear
      expect(screen.queryByText('MacBook Pro')).not.toBeInTheDocument();
      
      // All other goals should be eligible
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      expect(screen.getByText('Investment Portfolio')).toBeInTheDocument();
    });

    it('handles goals without progress property', () => {
      const goalsWithoutProgress = mockGoals.map(goal => ({
        ...goal,
        progress: undefined
      }));

      mockUseApp.mockReturnValue({
        goals: goalsWithoutProgress
      });

      render(<GoalProgressWidget size="medium" settings={{}} />);
      
      // Should treat undefined progress as 0
      // Find all elements showing 0% (will be in goal percentages)
      const zeroPercentages = screen.getAllByText('0%');
      expect(zeroPercentages.length).toBeGreaterThan(0);
      expect(screen.getByText('Average Progress')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('shows view all goals link', () => {
      render(<GoalProgressWidget size="medium" settings={{}} />);
      
      const link = screen.getByText('View all goals');
      expect(link).toHaveAttribute('href', '/goals');
      expect(link).toHaveClass('text-sm', 'text-primary', 'hover:underline');
    });

    it('includes trending up icon in view all link', () => {
      render(<GoalProgressWidget size="medium" settings={{}} />);
      
      const icon = screen.getByTestId('trending-up-icon');
      expect(icon).toHaveAttribute('data-size', '14');
    });
  });

  describe('Styling', () => {
    it('applies hover effects to goal cards', () => {
      render(<GoalProgressWidget size="medium" settings={{}} />);
      
      const goalCard = screen.getByText('Emergency Fund').closest('.bg-gray-50');
      expect(goalCard).toHaveClass(
        'hover:bg-gray-100',
        'dark:hover:bg-gray-700',
        'transition-colors'
      );
    });

    it('applies correct dark mode classes', () => {
      render(<GoalProgressWidget size="medium" settings={{}} />);
      
      // Goal card
      const goalCard = screen.getByText('Emergency Fund').closest('.bg-gray-50');
      expect(goalCard).toHaveClass('dark:bg-gray-700/50');
      
      // Goal name
      const goalName = screen.getByText('Emergency Fund');
      expect(goalName).toHaveClass('text-gray-900', 'dark:text-white');
      
      // Progress bar background
      const progressBarBg = goalCard?.querySelector('.bg-gray-200');
      expect(progressBarBg).toHaveClass('dark:bg-gray-600');
    });

    it('limits progress bar width to 100%', () => {
      const overflowGoal = {
        ...mockGoals[0],
        progress: 150 // Over 100%
      };

      mockUseApp.mockReturnValue({
        goals: [overflowGoal]
      });

      render(<GoalProgressWidget size="small" settings={{}} />);
      
      const progressBar = document.querySelector('.bg-primary');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty active goals list', () => {
      // All goals are achieved
      const achievedGoals = mockGoals.map(goal => ({
        ...goal,
        achieved: true
      }));

      mockUseApp.mockReturnValue({
        goals: achievedGoals
      });

      render(<GoalProgressWidget size="medium" settings={{}} />);
      
      // Should show 0% average when no active goals
      const mainProgress = screen.getByText((content, element) => {
        return element?.className?.includes('text-2xl') && content === '0%';
      });
      expect(mainProgress).toBeInTheDocument();
    });

    it('handles goals without target dates', () => {
      const goalsWithoutDates = mockGoals.map(goal => ({
        ...goal,
        targetDate: undefined
      }));

      mockUseApp.mockReturnValue({
        goals: goalsWithoutDates
      });

      render(<GoalProgressWidget size="medium" settings={{}} />);
      
      // Should not show any target dates
      expect(screen.queryByText(/Target:/)).not.toBeInTheDocument();
    });

    it('handles zero target amount gracefully', () => {
      const zeroTargetGoal = {
        ...mockGoals[0],
        targetAmount: 0,
        currentAmount: 100
      };

      mockUseApp.mockReturnValue({
        goals: [zeroTargetGoal]
      });

      render(<GoalProgressWidget size="small" settings={{}} />);
      
      // Should show amounts
      expect(screen.getByText('£100.00')).toBeInTheDocument();
      expect(screen.getByText('£0.00')).toBeInTheDocument();
    });
  });
});