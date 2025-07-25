/**
 * AccountSettingsModal Tests
 * Tests for the AccountSettingsModal component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountSettingsModal } from '../AccountSettingsModal';
import { renderWithProviders, createMockAccount, createMockTransaction } from '../../test/testUtils';

describe('AccountSettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('rendering', () => {
    it('renders correctly with default props', () => {
      renderWithProviders(<AccountSettingsModal />);
      
      // Add specific assertions based on component
      expect(screen.getByTestId('accountsettingsmodal')).toBeInTheDocument();
    });

    it('renders loading state when data is loading', () => {
      renderWithProviders(<AccountSettingsModal isLoading={true} />);
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('renders error state when error occurs', () => {
      renderWithProviders(<AccountSettingsModal error="Test error" />);
      
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('renders empty state when no data', () => {
      renderWithProviders(<AccountSettingsModal data={[]} />);
      
      expect(screen.getByText(/no data/i)).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('handles click events correctly', async () => {
      const mockOnClick = vi.fn();
      renderWithProviders(<AccountSettingsModal onClick={mockOnClick} />);
      
      const element = screen.getByTestId('clickable-element');
      await userEvent.click(element);
      
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('handles form submission', async () => {
      const mockOnSubmit = vi.fn();
      renderWithProviders(<AccountSettingsModal onSubmit={mockOnSubmit} />);
      
      // Fill form fields
      const input = screen.getByLabelText(/name/i);
      await userEvent.type(input, 'Test Value');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Test Value'
        }));
      });
    });

    it('validates user input', async () => {
      renderWithProviders(<AccountSettingsModal />);
      
      const input = screen.getByLabelText(/amount/i);
      await userEvent.type(input, '-100');
      
      await waitFor(() => {
        expect(screen.getByText(/must be positive/i)).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderWithProviders(<AccountSettingsModal />);
      
      const mainElement = screen.getByRole('main');
      expect(mainElement).toHaveAttribute('aria-label');
    });

    it('supports keyboard navigation', async () => {
      renderWithProviders(<AccountSettingsModal />);
      
      const firstButton = screen.getAllByRole('button')[0];
      firstButton.focus();
      
      await userEvent.keyboard('{Tab}');
      
      const secondButton = screen.getAllByRole('button')[1];
      expect(secondButton).toHaveFocus();
    });

    it('announces changes to screen readers', async () => {
      renderWithProviders(<AccountSettingsModal />);
      
      const button = screen.getByRole('button', { name: /update/i });
      await userEvent.click(button);
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/updated successfully/i);
      });
    });
  });

  describe('edge cases', () => {
    it('handles large datasets efficiently', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }));
      
      renderWithProviders(<AccountSettingsModal data={largeData} />);
      
      // Should use virtualization for large lists
      const visibleItems = screen.getAllByTestId('list-item');
      expect(visibleItems.length).toBeLessThan(50);
    });

    it('handles network errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      renderWithProviders(<AccountSettingsModal onFetch={mockFetch} />);
      
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('prevents double submission', async () => {
      const mockSubmit = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      renderWithProviders(<AccountSettingsModal onSubmit={mockSubmit} />);
      
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(submitButton);
      await userEvent.click(submitButton);
      
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });
  });
});