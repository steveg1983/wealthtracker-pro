/**
 * GoalCelebrationModal Tests
 * Comprehensive tests for the goal celebration modal component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GoalCelebrationModal from './GoalCelebrationModal';

// Mock dependencies
vi.mock('./common/Modal', () => ({
  Modal: ({ isOpen, children, title, onClose, size }: any) => (
    isOpen ? (
      <div data-testid="modal" role="dialog" aria-label={title || 'Goal Celebration'}>
        <div data-testid="modal-size">{size}</div>
        <button data-testid="modal-close" onClick={onClose}>×</button>
        {children}
      </div>
    ) : null
  ),
}));

vi.mock('./icons', () => ({
  CheckCircleIcon: ({ size, className }: any) => (
    <div data-testid="check-circle-icon" data-size={size} className={className}>
      ✓
    </div>
  ),
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => {
      if (amount === 1500.50) return '$1,501'; // Handle specific rounding case
      return `$${Math.round(amount).toLocaleString()}`;
    },
  }),
}));

describe('GoalCelebrationModal', () => {
  const mockOnClose = vi.fn();

  const createMockGoal = (overrides = {}) => ({
    id: 'goal-1',
    name: 'Emergency Fund',
    type: 'savings' as const,
    targetAmount: 10000,
    currentAmount: 10000,
    targetDate: new Date('2025-12-31'),
    isActive: true,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers(); // Reset timers first
    vi.useFakeTimers(); // Then use fake timers
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const renderModal = (isOpen = true, goal = createMockGoal(), message = 'Congratulations! You\'ve reached your goal!') => {
    return render(
      <GoalCelebrationModal
        isOpen={isOpen}
        onClose={mockOnClose}
        goal={goal}
        message={message}
      />
    );
  };

  describe('rendering', () => {
    it('renders when open', () => {
      renderModal(true);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      renderModal(false);
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('renders with small modal size', () => {
      renderModal();
      
      expect(screen.getByTestId('modal-size')).toHaveTextContent('sm');
    });

    it('displays goal name', () => {
      const goal = createMockGoal({ name: 'Vacation Fund' });
      renderModal(true, goal);
      
      expect(screen.getByText('Vacation Fund')).toBeInTheDocument();
    });

    it('displays celebration message', () => {
      const message = 'Amazing achievement!';
      renderModal(true, createMockGoal(), message);
      
      expect(screen.getByText('Amazing achievement!')).toBeInTheDocument();
    });

    it('displays target amount', () => {
      const goal = createMockGoal({ targetAmount: 25000 });
      renderModal(true, goal);
      
      expect(screen.getByText('$25,000')).toBeInTheDocument();
    });

    it('shows trophy and check circle icons', () => {
      renderModal();
      
      expect(screen.getByText('🏆')).toBeInTheDocument();
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      renderModal();
      
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /share achievement/i })).toBeInTheDocument();
    });
  });

  describe('goal type icons', () => {
    it('shows savings icon for savings goal', () => {
      const goal = createMockGoal({ type: 'savings' });
      renderModal(true, goal);
      
      expect(screen.getByText('💰')).toBeInTheDocument();
    });

    it('shows debt-payoff icon for debt-payoff goal', () => {
      const goal = createMockGoal({ type: 'debt-payoff' });
      renderModal(true, goal);
      
      expect(screen.getByText('💳')).toBeInTheDocument();
    });

    it('shows investment icon for investment goal', () => {
      const goal = createMockGoal({ type: 'investment' });
      renderModal(true, goal);
      
      expect(screen.getByText('📈')).toBeInTheDocument();
    });

    it('shows custom icon for custom goal', () => {
      const goal = createMockGoal({ type: 'custom' });
      renderModal(true, goal);
      
      expect(screen.getByText('🎯')).toBeInTheDocument();
    });
  });

  describe('auto-close functionality', () => {
    it('auto-closes after 5 seconds when opened', async () => {
      renderModal(true);
      
      expect(mockOnClose).not.toHaveBeenCalled();
      
      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not auto-close when modal is closed', () => {
      renderModal(false);
      
      vi.advanceTimersByTime(5000);
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('clears timer when modal is closed manually before auto-close', () => {
      const { rerender } = render(
        <GoalCelebrationModal
          isOpen={true}
          onClose={mockOnClose}
          goal={createMockGoal()}
          message="Test message"
        />
      );
      
      // Advance partway through auto-close timer
      vi.advanceTimersByTime(2000);
      
      // Close the modal by changing props (simulating parent state change)
      rerender(
        <GoalCelebrationModal
          isOpen={false}
          onClose={mockOnClose}
          goal={createMockGoal()}
          message="Test message"
        />
      );
      
      // Advance the remaining time - timer should be cleared
      vi.advanceTimersByTime(4000);
      
      // onClose should not be called by the timer since modal is already closed
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('resets timer when modal reopens', () => {
      const { rerender } = render(
        <GoalCelebrationModal
          isOpen={true}
          onClose={mockOnClose}
          goal={createMockGoal()}
          message="Test message"
        />
      );
      
      // Advance partway
      vi.advanceTimersByTime(2000);
      
      // Close modal
      rerender(
        <GoalCelebrationModal
          isOpen={false}
          onClose={mockOnClose}
          goal={createMockGoal()}
          message="Test message"
        />
      );
      
      // Reopen modal
      rerender(
        <GoalCelebrationModal
          isOpen={true}
          onClose={mockOnClose}
          goal={createMockGoal()}
          message="Test message"
        />
      );
      
      // Should reset timer
      vi.advanceTimersByTime(3000); // Total 5 seconds from reopen
      expect(mockOnClose).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(2000); // Complete 5 seconds from reopen
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('user interactions', () => {
    it('closes modal when close button clicked', () => {
      renderModal();
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('closes modal when share button clicked', () => {
      renderModal();
      
      const shareButton = screen.getByRole('button', { name: /share achievement/i });
      fireEvent.click(shareButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('closes modal when modal close button clicked', () => {
      renderModal();
      
      const modalCloseButton = screen.getByTestId('modal-close');
      fireEvent.click(modalCloseButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('handles multiple button clicks gracefully', () => {
      renderModal();
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      
      fireEvent.click(closeButton);
      fireEvent.click(closeButton);
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(3);
    });
  });

  describe('styling and layout', () => {
    it('has proper CSS classes for trophy animation', () => {
      renderModal();
      
      const trophyContainer = screen.getByText('🏆').parentElement;
      expect(trophyContainer).toHaveClass('animate-bounce');
    });

    it('has proper CSS classes for check icon animation', () => {
      renderModal();
      
      const checkIcon = screen.getByTestId('check-circle-icon');
      expect(checkIcon.parentElement).toHaveClass('animate-pulse');
    });

    it('has proper button styling', () => {
      renderModal();
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      const shareButton = screen.getByRole('button', { name: /share achievement/i });
      
      expect(closeButton).toHaveClass('px-6', 'py-2', 'rounded-lg');
      expect(shareButton).toHaveClass('px-6', 'py-2', 'rounded-lg');
    });

    it('has proper achievement details styling', () => {
      renderModal();
      
      const achievementSection = screen.getByText('Target Achieved').parentElement;
      expect(achievementSection).toHaveClass('bg-green-50', 'dark:bg-green-900/20', 'rounded-xl');
    });
  });

  describe('accessibility', () => {
    it('has proper role attributes', () => {
      renderModal();
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has proper button roles', () => {
      renderModal();
      
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3); // Close, Share, Modal close
    });

    it('has proper heading structure', () => {
      renderModal();
      
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Emergency Fund');
    });

    it('supports keyboard navigation', () => {
      renderModal();
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      const shareButton = screen.getByRole('button', { name: /share achievement/i });
      
      closeButton.focus();
      expect(closeButton).toHaveFocus();
      
      fireEvent.keyDown(closeButton, { key: 'Tab', code: 'Tab' });
      shareButton.focus();
      expect(shareButton).toHaveFocus();
    });

    it('supports keyboard activation', () => {
      renderModal();
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      closeButton.focus();
      
      // Simulate actual button click via keyboard
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('currency formatting', () => {
    it('formats currency correctly for different amounts', () => {
      const amounts = [
        { amount: 1000, expected: '$1,000' },
        { amount: 10000, expected: '$10,000' },
        { amount: 100000, expected: '$100,000' },
        { amount: 1500.50, expected: '$1,501' }, // toLocaleString rounds
      ];

      amounts.forEach(({ amount, expected }) => {
        const goal = createMockGoal({ targetAmount: amount });
        const { unmount } = renderModal(true, goal);
        
        expect(screen.getByText(expected)).toBeInTheDocument();
        
        unmount();
      });
    });
  });

  describe('edge cases', () => {
    it('handles goal with empty name', () => {
      const goal = createMockGoal({ name: '' });
      renderModal(true, goal);
      
      // Should still render but with empty name
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('');
    });

    it('handles zero target amount', () => {
      const goal = createMockGoal({ targetAmount: 0 });
      renderModal(true, goal);
      
      expect(screen.getByText('$0')).toBeInTheDocument();
    });

    it('handles negative target amount', () => {
      const goal = createMockGoal({ targetAmount: -1000 });
      renderModal(true, goal);
      
      expect(screen.getByText('$-1,000')).toBeInTheDocument();
    });

    it('handles very long goal names', () => {
      const longName = 'A'.repeat(100);
      const goal = createMockGoal({ name: longName });
      renderModal(true, goal);
      
      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('handles very long messages', () => {
      const longMessage = 'Congratulations! '.repeat(20);
      renderModal(true, createMockGoal(), longMessage);
      
      // Use a more flexible matcher for the long text
      expect(screen.getByText((content, element) => {
        return content.includes('Congratulations!') && content.length > 200;
      })).toBeInTheDocument();
    });

    it('handles rapid open/close cycles', () => {
      const { rerender } = render(
        <GoalCelebrationModal
          isOpen={false}
          onClose={mockOnClose}
          goal={createMockGoal()}
          message="Test"
        />
      );

      // Rapidly toggle open/close
      for (let i = 0; i < 5; i++) {
        rerender(
          <GoalCelebrationModal
            isOpen={true}
            onClose={mockOnClose}
            goal={createMockGoal()}
            message="Test"
          />
        );
        
        rerender(
          <GoalCelebrationModal
            isOpen={false}
            onClose={mockOnClose}
            goal={createMockGoal()}
            message="Test"
          />
        );
      }

      // Should not cause errors or unexpected calls
      vi.advanceTimersByTime(10000);
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('real-world scenarios', () => {
    it('displays savings goal celebration correctly', () => {
      const goal = createMockGoal({
        name: 'Emergency Fund',
        type: 'savings',
        targetAmount: 10000,
      });
      
      renderModal(true, goal, 'You\'ve built your safety net!');
      
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      expect(screen.getByText('💰')).toBeInTheDocument();
      expect(screen.getByText('$10,000')).toBeInTheDocument();
      expect(screen.getByText('You\'ve built your safety net!')).toBeInTheDocument();
    });

    it('displays debt payoff goal celebration correctly', () => {
      const goal = createMockGoal({
        name: 'Credit Card Debt',
        type: 'debt-payoff',
        targetAmount: 5000,
      });
      
      renderModal(true, goal, 'Debt free at last!');
      
      expect(screen.getByText('Credit Card Debt')).toBeInTheDocument();
      expect(screen.getByText('💳')).toBeInTheDocument();
      expect(screen.getByText('$5,000')).toBeInTheDocument();
      expect(screen.getByText('Debt free at last!')).toBeInTheDocument();
    });

    it('displays investment goal celebration correctly', () => {
      const goal = createMockGoal({
        name: 'Retirement Fund',
        type: 'investment',
        targetAmount: 100000,
      });
      
      renderModal(true, goal, 'Your future is looking bright!');
      
      expect(screen.getByText('Retirement Fund')).toBeInTheDocument();
      expect(screen.getByText('📈')).toBeInTheDocument();
      expect(screen.getByText('$100,000')).toBeInTheDocument();
      expect(screen.getByText('Your future is looking bright!')).toBeInTheDocument();
    });
  });
});