/**
 * TestDataWarningModal Tests
 * Comprehensive tests for the test data warning modal component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TestDataWarningModal from './TestDataWarningModal';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock the global localStorage
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock icons
vi.mock('./icons/AlertTriangleIcon', () => ({
  AlertTriangleIcon: ({ className, size }: any) => (
    <div data-testid="alert-triangle-icon" className={className} data-size={size}>
      ⚠️
    </div>
  ),
}));

vi.mock('./icons/XIcon', () => ({
  XIcon: ({ size }: any) => (
    <div data-testid="x-icon" data-size={size}>
      ✕
    </div>
  ),
}));

describe('TestDataWarningModal', () => {
  const mockOnClose = vi.fn();
  const mockOnClearData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (isOpen = true, onClearData?: () => void) => {
    return render(
      <TestDataWarningModal
        isOpen={isOpen}
        onClose={mockOnClose}
        onClearData={onClearData || mockOnClearData}
      />
    );
  };

  describe('rendering', () => {
    it('renders when open', () => {
      renderModal(true);
      
      // Check for modal container and content
      expect(screen.getByText('Test Data Active')).toBeInTheDocument();
      
      // Check for modal overlay
      const overlay = document.querySelector('.fixed.inset-0');
      expect(overlay).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      renderModal(false);
      
      expect(screen.queryByText('Test Data Active')).not.toBeInTheDocument();
    });

    it('displays warning message and content', () => {
      renderModal();
      
      expect(screen.getByText(/You are currently viewing/)).toBeInTheDocument();
      expect(screen.getByText(/sample test data/)).toBeInTheDocument();
      expect(screen.getByText('Example accounts from various UK banks')).toBeInTheDocument();
      expect(screen.getByText('6 months of sample transactions')).toBeInTheDocument();
      expect(screen.getByText('Pre-configured budgets and financial goals')).toBeInTheDocument();
    });

    it('displays getting started information', () => {
      renderModal();
      
      expect(screen.getByText(/Getting Started:/)).toBeInTheDocument();
      expect(screen.getByText(/Explore the app with test data/)).toBeInTheDocument();
      expect(screen.getByText(/Settings → Data Management/)).toBeInTheDocument();
    });

    it('shows alert triangle icon', () => {
      renderModal();
      
      const alertIcon = screen.getByTestId('alert-triangle-icon');
      expect(alertIcon).toBeInTheDocument();
      expect(alertIcon).toHaveAttribute('data-size', '24');
      expect(alertIcon).toHaveClass('text-yellow-600', 'dark:text-yellow-400');
    });

    it('shows close (X) icon', () => {
      renderModal();
      
      const closeIcon = screen.getByTestId('x-icon');
      expect(closeIcon).toBeInTheDocument();
      expect(closeIcon).toHaveAttribute('data-size', '20');
    });

    it('renders continue button', () => {
      renderModal();
      
      expect(screen.getByRole('button', { name: /continue with test data/i })).toBeInTheDocument();
    });

    it('renders clear data button when onClearData is provided', () => {
      renderModal(true, mockOnClearData);
      
      expect(screen.getByRole('button', { name: /clear & start fresh/i })).toBeInTheDocument();
    });

    it('does not render clear data button when onClearData is not provided', () => {
      render(
        <TestDataWarningModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.queryByRole('button', { name: /clear & start fresh/i })).not.toBeInTheDocument();
    });

    it('renders checkbox for "don\'t show again"', () => {
      renderModal();
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
      expect(screen.getByLabelText(/don't show this warning again/i)).toBeInTheDocument();
    });
  });

  describe('localStorage integration', () => {
    it('closes modal automatically when previously dismissed', () => {
      mockLocalStorage.getItem.mockReturnValue('true');
      
      renderModal(true);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not auto-close when not previously dismissed', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      renderModal(true);
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('does not auto-close when localStorage returns false', () => {
      mockLocalStorage.getItem.mockReturnValue('false');
      
      renderModal(true);
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('saves dismiss preference when checkbox is checked and modal closed', () => {
      renderModal();
      
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      
      const continueButton = screen.getByRole('button', { name: /continue with test data/i });
      fireEvent.click(continueButton);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('testDataWarningDismissed', 'true');
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not save dismiss preference when checkbox is unchecked', () => {
      renderModal();
      
      const continueButton = screen.getByRole('button', { name: /continue with test data/i });
      fireEvent.click(continueButton);
      
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkbox functionality', () => {
    it('toggles checkbox state when clicked', () => {
      renderModal();
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
      
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('toggles checkbox when label is clicked', () => {
      renderModal();
      
      const checkbox = screen.getByRole('checkbox');
      const label = screen.getByLabelText(/don't show this warning again/i);
      
      expect(checkbox).not.toBeChecked();
      
      fireEvent.click(label);
      expect(checkbox).toBeChecked();
    });

    it('persists checkbox state between re-renders', () => {
      const { rerender } = renderModal();
      
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      
      rerender(
        <TestDataWarningModal
          isOpen={true}
          onClose={mockOnClose}
          onClearData={mockOnClearData}
        />
      );
      
      const newCheckbox = screen.getByRole('checkbox');
      expect(newCheckbox).toBeChecked();
    });
  });

  describe('button interactions', () => {
    it('calls onClose when continue button is clicked', () => {
      renderModal();
      
      const continueButton = screen.getByRole('button', { name: /continue with test data/i });
      fireEvent.click(continueButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClearData when clear button is clicked', () => {
      renderModal();
      
      const clearButton = screen.getByRole('button', { name: /clear & start fresh/i });
      fireEvent.click(clearButton);
      
      expect(mockOnClearData).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when X button is clicked', () => {
      renderModal();
      
      const closeButton = screen.getByTestId('x-icon').parentElement!;
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('saves preference when closing with checkbox checked via X button', () => {
      renderModal();
      
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      
      const closeButton = screen.getByTestId('x-icon').parentElement!;
      fireEvent.click(closeButton);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('testDataWarningDismissed', 'true');
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('styling and layout', () => {
    it('has proper modal overlay styling', () => {
      renderModal();
      
      const overlay = document.querySelector('.fixed.inset-0');
      expect(overlay).toHaveClass('fixed', 'inset-0', 'bg-black', 'bg-opacity-50');
    });

    it('has proper modal content styling', () => {
      renderModal();
      
      const modalContent = screen.getByText('Test Data Active').closest('.bg-white');
      expect(modalContent).toHaveClass('bg-white', 'dark:bg-gray-800', 'rounded-2xl', 'shadow-xl');
    });

    it('has proper warning icon container styling', () => {
      renderModal();
      
      const iconContainer = screen.getByTestId('alert-triangle-icon').parentElement;
      expect(iconContainer).toHaveClass('p-2', 'bg-yellow-100', 'dark:bg-yellow-900/30', 'rounded-lg');
    });

    it('has proper info box styling', () => {
      renderModal();
      
      const infoBox = screen.getByText(/Getting Started:/).closest('.p-4');
      expect(infoBox).toHaveClass('p-4', 'bg-blue-50', 'dark:bg-blue-900/20', 'rounded-lg');
    });

    it('has proper button styling', () => {
      renderModal();
      
      const continueButton = screen.getByRole('button', { name: /continue with test data/i });
      const clearButton = screen.getByRole('button', { name: /clear & start fresh/i });
      
      expect(continueButton).toHaveClass('bg-primary', 'text-white', 'rounded-lg');
      expect(clearButton).toHaveClass('border', 'border-gray-300', 'rounded-lg');
    });
  });

  describe('accessibility', () => {
    it('has proper modal structure', () => {
      renderModal();
      
      // Check for modal title (heading)
      expect(screen.getByRole('heading', { name: /test data active/i })).toBeInTheDocument();
      
      // Check for modal container
      const modalContainer = document.querySelector('.fixed.inset-0');
      expect(modalContainer).toBeInTheDocument();
    });

    it('has proper checkbox labeling', () => {
      renderModal();
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('id', 'dontShowAgain');
      
      const label = screen.getByText(/don't show this warning again/i);
      expect(label).toHaveAttribute('for', 'dontShowAgain');
    });

    it('has proper button roles', () => {
      renderModal();
      
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3); // Continue, Clear, Close (X)
    });

    it('supports keyboard navigation', () => {
      renderModal();
      
      const continueButton = screen.getByRole('button', { name: /continue with test data/i });
      const clearButton = screen.getByRole('button', { name: /clear & start fresh/i });
      const checkbox = screen.getByRole('checkbox');
      
      // Focus should be manageable
      continueButton.focus();
      expect(continueButton).toHaveFocus();
      
      clearButton.focus();
      expect(clearButton).toHaveFocus();
      
      checkbox.focus();
      expect(checkbox).toHaveFocus();
    });
  });

  describe('edge cases', () => {
    it('handles modal state change during interaction', () => {
      const { rerender } = renderModal(true);
      
      expect(screen.getByText('Test Data Active')).toBeInTheDocument();
      
      rerender(
        <TestDataWarningModal
          isOpen={false}
          onClose={mockOnClose}
          onClearData={mockOnClearData}
        />
      );
      
      expect(screen.queryByText('Test Data Active')).not.toBeInTheDocument();
    });

    it('handles missing onClearData gracefully', () => {
      render(
        <TestDataWarningModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByRole('button', { name: /continue with test data/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /clear & start fresh/i })).not.toBeInTheDocument();
    });

    it('handles localStorage errors gracefully', () => {
      // Mock getItem to throw error
      const originalGetItem = mockLocalStorage.getItem;
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });
      
      // Component should not crash and not auto-close
      expect(() => renderModal()).not.toThrow();
      expect(mockOnClose).not.toHaveBeenCalled();
      
      // Restore original mock
      mockLocalStorage.getItem = originalGetItem;
    });

    it('handles localStorage setItem errors gracefully', () => {
      // Mock setItem to throw error but wrap in try/catch in component
      const originalSetItem = mockLocalStorage.setItem;
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage setItem error');
      });
      
      renderModal();
      
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      
      const continueButton = screen.getByRole('button', { name: /continue with test data/i });
      
      // Should still call onClose despite localStorage error
      fireEvent.click(continueButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      
      // Restore original mock
      mockLocalStorage.setItem = originalSetItem;
    });

    it('handles rapid checkbox toggling', () => {
      renderModal();
      
      const checkbox = screen.getByRole('checkbox');
      
      // Rapidly toggle checkbox
      for (let i = 0; i < 10; i++) {
        fireEvent.click(checkbox);
      }
      
      expect(checkbox).not.toBeChecked(); // Should end up unchecked (10 clicks)
    });

    it('handles multiple button clicks', () => {
      renderModal();
      
      const continueButton = screen.getByRole('button', { name: /continue with test data/i });
      
      fireEvent.click(continueButton);
      fireEvent.click(continueButton);
      fireEvent.click(continueButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(3);
    });
  });

  describe('real-world scenarios', () => {
    it('displays correctly on first app launch', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      renderModal();
      
      expect(screen.getByText('Test Data Active')).toBeInTheDocument();
      expect(screen.getByText(/sample test data/)).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).not.toBeChecked();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('handles user dismissing permanently', () => {
      renderModal();
      
      // User checks "don't show again" and continues
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      
      const continueButton = screen.getByRole('button', { name: /continue with test data/i });
      fireEvent.click(continueButton);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('testDataWarningDismissed', 'true');
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('handles user choosing to clear data', () => {
      renderModal();
      
      const clearButton = screen.getByRole('button', { name: /clear & start fresh/i });
      fireEvent.click(clearButton);
      
      expect(mockOnClearData).toHaveBeenCalledTimes(1);
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('handles subsequent app launches after dismissal', () => {
      mockLocalStorage.getItem.mockReturnValue('true');
      
      renderModal(true);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
