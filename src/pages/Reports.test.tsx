/**
 * Reports Tests
 * Tests for the Reports component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Reports } from '../Reports';
import { renderWithProviders } from '../../test/testUtils';

describe('Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('rendering', () => {
    it('renders correctly with default props', () => {
      renderWithProviders(<Reports />);
      
      // Add specific assertions based on component
      expect(screen.getByTestId('reports')).toBeInTheDocument();
    });

    it('renders loading state when data is loading', () => {
      renderWithProviders(<Reports isLoading={true} />);
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('renders error state when error occurs', () => {
      renderWithProviders(<Reports error="Test error" />);
      
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('renders empty state when no data', () => {
      renderWithProviders(<Reports data={[]} />);
      
      expect(screen.getByText(/no data/i)).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('handles click events correctly', async () => {
      const mockOnClick = vi.fn();
      renderWithProviders(<Reports onClick={mockOnClick} />);
      
      const element = screen.getByTestId('clickable-element');
      await userEvent.click(element);
      
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('handles form submission', async () => {
      const mockOnSubmit = vi.fn();
      renderWithProviders(<Reports onSubmit={mockOnSubmit} />);
      
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
      renderWithProviders(<Reports />);
      
      const input = screen.getByLabelText(/amount/i);
      await userEvent.type(input, '-100');
      
      await waitFor(() => {
        expect(screen.getByText(/must be positive/i)).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderWithProviders(<Reports />);
      
      const mainElement = screen.getByRole('main');
      expect(mainElement).toHaveAttribute('aria-label');
    });

    it('supports keyboard navigation', async () => {
      renderWithProviders(<Reports />);
      
      const firstButton = screen.getAllByRole('button')[0];
      firstButton.focus();
      
      await userEvent.keyboard('{Tab}');
      
      const secondButton = screen.getAllByRole('button')[1];
      expect(secondButton).toHaveFocus();
    });

    it('announces changes to screen readers', async () => {
      renderWithProviders(<Reports />);
      
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
      
      renderWithProviders(<Reports data={largeData} />);
      
      // Should use virtualization for large lists
      const visibleItems = screen.getAllByTestId('list-item');
      expect(visibleItems.length).toBeLessThan(50);
    });

    it('handles network errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      renderWithProviders(<Reports onFetch={mockFetch} />);
      
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('prevents double submission', async () => {
      const mockSubmit = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      renderWithProviders(<Reports onSubmit={mockSubmit} />);
      
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(submitButton);
      await userEvent.click(submitButton);
      
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });
  });
});