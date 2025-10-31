/**
 * DashboardWidget Tests
 * Tests for the DashboardWidget component
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardWidget from '../DashboardWidget';
import type { WidgetConfig } from '../DashboardWidget';

// Mock dependencies
vi.mock('../../hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn()
}));

// Mock icons
vi.mock('../icons', () => ({
  GripVerticalIcon: ({ className }: { className?: string }) => (
    <div data-testid="grip-vertical-icon" className={className}>GripVertical</div>
  ),
  SettingsIcon: () => <div data-testid="settings-icon">Settings</div>,
  MaximizeIcon: () => <div data-testid="maximize-icon">Maximize</div>,
  MinimizeIcon: () => <div data-testid="minimize-icon">Minimize</div>,
  XIcon: () => <div data-testid="x-icon">X</div>,
  RefreshCwIcon: ({ className }: { className?: string }) => (
    <div data-testid="refresh-icon" className={className}>Refresh</div>
  ),
  BarChart3Icon: ({ className }: { className?: string }) => (
    <div data-testid="bar-chart-icon" className={className}>BarChart</div>
  ),
  TrendingUpIcon: ({ className }: { className?: string }) => (
    <div data-testid="trending-up-icon" className={className}>TrendingUp</div>
  ),
  PiggyBankIcon: ({ className }: { className?: string }) => (
    <div data-testid="piggy-bank-icon" className={className}>PiggyBank</div>
  ),
  CreditCardIcon: ({ className }: { className?: string }) => (
    <div data-testid="credit-card-icon" className={className}>CreditCard</div>
  ),
  TargetIcon: ({ className }: { className?: string }) => (
    <div data-testid="target-icon" className={className}>Target</div>
  )
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('DashboardWidget', () => {
  const mockConfig: WidgetConfig = {
    id: 'widget-1',
    type: 'net-worth',
    title: 'Net Worth',
    size: 'medium',
    position: { x: 0, y: 0 },
    isVisible: true,
    settings: {},
    refreshInterval: undefined,
    lastRefresh: undefined
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('rendering', () => {
    it('renders correctly with required props', () => {
      render(
        <DashboardWidget 
          config={mockConfig} 
          onConfigChange={vi.fn()} 
          onRemove={vi.fn()}
        >
          <div>Widget Content</div>
        </DashboardWidget>
      );
      
      expect(screen.getByText('Net Worth')).toBeInTheDocument();
      expect(screen.getByText('Widget Content')).toBeInTheDocument();
    });

    it('renders correct icon based on widget type', () => {
      // Test net-worth
      const { rerender } = render(
        <DashboardWidget 
          config={{ ...mockConfig, type: 'net-worth' }} 
          onConfigChange={vi.fn()} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
      
      // Test budget-summary
      rerender(
        <DashboardWidget 
          config={{ ...mockConfig, type: 'budget-summary' }} 
          onConfigChange={vi.fn()} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      expect(screen.getByTestId('piggy-bank-icon')).toBeInTheDocument();
      
      // Test goal-progress
      rerender(
        <DashboardWidget 
          config={{ ...mockConfig, type: 'goal-progress' }} 
          onConfigChange={vi.fn()} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      expect(screen.getByTestId('target-icon')).toBeInTheDocument();
    });

    it('renders drag handle when in drag mode', () => {
      render(
        <DashboardWidget 
          config={mockConfig} 
          onConfigChange={vi.fn()} 
          onRemove={vi.fn()}
          isDragMode={true}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      expect(screen.getByTestId('grip-vertical-icon')).toBeInTheDocument();
    });

    it('does not render drag handle when not in drag mode', () => {
      render(
        <DashboardWidget 
          config={mockConfig} 
          onConfigChange={vi.fn()} 
          onRemove={vi.fn()}
          isDragMode={false}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      expect(screen.queryByTestId('grip-vertical-icon')).not.toBeInTheDocument();
    });

    it('applies correct size classes', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      
      sizes.forEach(size => {
        const { container, rerender } = render(
          <DashboardWidget 
            config={{ ...mockConfig, size }} 
            onConfigChange={vi.fn()} 
            onRemove={vi.fn()}
          >
            <div>Content</div>
          </DashboardWidget>
        );

        const widget = container.firstChild;
        if (size === 'small') {
          expect(widget).toHaveClass('col-span-1', 'row-span-1');
        } else if (size === 'medium') {
          expect(widget).toHaveClass('col-span-2', 'row-span-1');
        } else {
          expect(widget).toHaveClass('col-span-2', 'row-span-2');
        }

        rerender(<></>);
      });
    });

    it('shows last refresh time when available', () => {
      const lastRefresh = new Date('2024-01-15T10:30:00');
      render(
        <DashboardWidget 
          config={{ ...mockConfig, lastRefresh }} 
          onConfigChange={vi.fn()} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      // Check that the last updated text exists
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('handles refresh button click', async () => {
      const onConfigChange = vi.fn();
      render(
        <DashboardWidget 
          config={mockConfig} 
          onConfigChange={onConfigChange} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      const refreshButton = screen.getByTitle('Refresh');
      await userEvent.click(refreshButton);
      
      // Wait for refresh to complete (1 second timeout in component)
      await waitFor(() => {
        expect(onConfigChange).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'widget-1',
            type: 'net-worth',
            title: 'Net Worth',
            size: 'medium',
            position: { x: 0, y: 0 },
            isVisible: true,
            settings: {},
            refreshInterval: undefined,
            lastRefresh: expect.any(Date)
          })
        );
      }, { timeout: 2000 });
    });

    it('handles size change buttons', async () => {
      const onConfigChange = vi.fn();
      render(
        <DashboardWidget 
          config={mockConfig} 
          onConfigChange={onConfigChange} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      // Click small size
      const smallButton = screen.getByTitle('Small');
      await userEvent.click(smallButton);
      expect(onConfigChange).toHaveBeenCalledWith({ ...mockConfig, size: 'small' });
      
      // Click large size
      const largeButton = screen.getByTitle('Large');
      await userEvent.click(largeButton);
      expect(onConfigChange).toHaveBeenCalledWith({ ...mockConfig, size: 'large' });
    });

    it('handles remove button click', async () => {
      const onRemove = vi.fn();
      render(
        <DashboardWidget 
          config={mockConfig} 
          onConfigChange={vi.fn()} 
          onRemove={onRemove}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      const removeButton = screen.getByTitle('Remove');
      await userEvent.click(removeButton);
      
      expect(onRemove).toHaveBeenCalledWith('widget-1');
    });

    it('opens settings modal', async () => {
      render(
        <DashboardWidget 
          config={mockConfig} 
          onConfigChange={vi.fn()} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      const settingsButton = screen.getByTitle('Settings');
      await userEvent.click(settingsButton);
      
      expect(screen.getByText('Net Worth Settings')).toBeInTheDocument();
      expect(screen.getByText('Widget Title')).toBeInTheDocument();
    });
  });

  describe('settings modal', () => {
    it('updates widget title', async () => {
      const onConfigChange = vi.fn();
      render(
        <DashboardWidget 
          config={mockConfig} 
          onConfigChange={onConfigChange} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      // Open settings
      await userEvent.click(screen.getByTitle('Settings'));
      
      // Find title input by its current value
      const titleInput = screen.getByDisplayValue('Net Worth');
      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, 'My Assets');
      
      // Save
      await userEvent.click(screen.getByText('Save'));
      
      expect(onConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        title: 'My Assets'
      });
    });

    it('updates refresh interval', async () => {
      const onConfigChange = vi.fn();
      render(
        <DashboardWidget 
          config={mockConfig} 
          onConfigChange={onConfigChange} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      // Open settings
      await userEvent.click(screen.getByTitle('Settings'));
      
      // Find select by searching for the label text, then finding the select element
      const labelElement = screen.getByText('Auto Refresh (minutes)');
      const refreshSelect = labelElement.parentElement?.querySelector('select');
      if (refreshSelect) {
        await userEvent.selectOptions(refreshSelect, '5');
      }
      
      // Save
      await userEvent.click(screen.getByText('Save'));
      
      expect(onConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        refreshInterval: 5
      });
    });

    it('shows widget-specific settings for budget-summary', async () => {
      const budgetConfig = { ...mockConfig, type: 'budget-summary' as const, title: 'Budget Summary' };
      render(
        <DashboardWidget 
          config={budgetConfig} 
          onConfigChange={vi.fn()} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      // Open settings
      await userEvent.click(screen.getByTitle('Settings'));
      
      expect(screen.getByText('Show Period')).toBeInTheDocument();
      expect(screen.getByText('Current Month')).toBeInTheDocument();
    });

    it('shows widget-specific settings for recent-transactions', async () => {
      const transConfig = { ...mockConfig, type: 'recent-transactions' as const, title: 'Recent Transactions' };
      render(
        <DashboardWidget 
          config={transConfig} 
          onConfigChange={vi.fn()} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      // Open settings
      await userEvent.click(screen.getByTitle('Settings'));
      
      expect(screen.getByText('Number of Transactions')).toBeInTheDocument();
    });

    it('shows widget-specific settings for cash-flow', async () => {
      const cashFlowConfig = { ...mockConfig, type: 'cash-flow' as const, title: 'Cash Flow' };
      render(
        <DashboardWidget 
          config={cashFlowConfig} 
          onConfigChange={vi.fn()} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      // Open settings
      await userEvent.click(screen.getByTitle('Settings'));
      
      expect(screen.getByText('Forecast Period')).toBeInTheDocument();
      expect(screen.getByText('6 months')).toBeInTheDocument();
    });

    it('cancels settings changes', async () => {
      const onConfigChange = vi.fn();
      render(
        <DashboardWidget 
          config={mockConfig} 
          onConfigChange={onConfigChange} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      // Open settings
      await userEvent.click(screen.getByTitle('Settings'));
      
      // Change title
      const titleInput = screen.getByDisplayValue('Net Worth');
      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, 'My Assets');
      
      // Cancel
      await userEvent.click(screen.getByText('Cancel'));
      
      expect(onConfigChange).not.toHaveBeenCalled();
      expect(screen.queryByText('Net Worth Settings')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('prevents multiple refresh clicks', async () => {
      const onConfigChange = vi.fn();
      render(
        <DashboardWidget 
          config={mockConfig} 
          onConfigChange={onConfigChange} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      const refreshButton = screen.getByTitle('Refresh');
      
      // Click multiple times quickly
      await userEvent.click(refreshButton);
      await userEvent.click(refreshButton);
      await userEvent.click(refreshButton);
      
      // Should only trigger one refresh
      await waitFor(() => {
        expect(onConfigChange).toHaveBeenCalledTimes(1);
      }, { timeout: 2000 });
    });

    it('handles empty settings object', () => {
      const configWithoutSettings = { 
        ...mockConfig, 
        settings: {},
        type: 'budget-summary' as const
      };
      
      render(
        <DashboardWidget 
          config={configWithoutSettings} 
          onConfigChange={vi.fn()} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      expect(screen.getByText('Net Worth')).toBeInTheDocument();
    });

    it('handles unknown widget type', () => {
      const unknownConfig = { 
        ...mockConfig, 
        type: 'unknown-type' as any 
      };
      
      render(
        <DashboardWidget 
          config={unknownConfig} 
          onConfigChange={vi.fn()} 
          onRemove={vi.fn()}
        >
          <div>Content</div>
        </DashboardWidget>
      );
      
      // Should render with default icon (there will be multiple bar-chart icons)
      const barChartIcons = screen.getAllByTestId('bar-chart-icon');
      expect(barChartIcons.length).toBeGreaterThan(0);
      // The first one should be the widget icon
      expect(barChartIcons[0]).toHaveClass('text-[var(--color-primary)]');
    });
  });
});
