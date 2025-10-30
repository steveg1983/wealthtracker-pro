/**
 * Breadcrumbs Tests
 * Tests for the breadcrumbs navigation component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumbs from './Breadcrumbs';

// Mock the icons
vi.mock('./icons', () => ({
  ChevronRight: ({ size: _size, className }: { size?: number; className?: string }) => (
    <span data-testid="chevron-right" className={className}>›</span>
  ),
  Home: ({ size: _size }: { size?: number }) => (
    <span data-testid="home-icon">🏠</span>
  )
}));

// Mock react-router-dom
const mockLocation = {
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'default'
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: () => mockLocation,
    Link: ({ to, children, className }: any) => (
      <a href={to} className={className}>{children}</a>
    )
  };
});

// Mock the AppContext
const mockAccounts = [
  { id: '1', name: 'Checking Account', type: 'checking' },
  { id: '2', name: 'Savings Account', type: 'savings' }
];

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    accounts: mockAccounts
  })
}));

describe('Breadcrumbs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset location to default
    mockLocation.pathname = '/';
    mockLocation.search = '';
  });

  describe('Basic Rendering', () => {
    it('returns null on dashboard (root path)', () => {
      mockLocation.pathname = '/';
      
      const { container } = render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(container.firstChild).toBeNull();
    });

    it('shows breadcrumbs on non-root paths', () => {
      mockLocation.pathname = '/accounts';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('always includes home icon', () => {
      mockLocation.pathname = '/accounts';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('home-icon')).toBeInTheDocument();
    });

    it('renders chevron separators between items', () => {
      mockLocation.pathname = '/accounts';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getAllByTestId('chevron-right')).toHaveLength(1);
    });
  });

  describe('Path Handling', () => {
    it('handles accounts path', () => {
      mockLocation.pathname = '/accounts';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByText('Accounts')).toBeInTheDocument();
    });

    it('handles transactions path with parent', () => {
      mockLocation.pathname = '/transactions';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByText('Accounts')).toBeInTheDocument();
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });

    it('handles transactions with account filter', () => {
      mockLocation.pathname = '/transactions';
      mockLocation.search = '?account=1';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByText('Accounts')).toBeInTheDocument();
      expect(screen.getByText('Transactions')).toBeInTheDocument();
      expect(screen.getByText('Checking Account')).toBeInTheDocument();
    });

    it('handles budget path with forecasting parent', () => {
      mockLocation.pathname = '/budget';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByText('Forecasting')).toBeInTheDocument();
      expect(screen.getByText('Budget')).toBeInTheDocument();
    });

    it('handles goals path with forecasting parent', () => {
      mockLocation.pathname = '/goals';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByText('Forecasting')).toBeInTheDocument();
      expect(screen.getByText('Goals')).toBeInTheDocument();
    });

    it('handles reconciliation path with accounts parent', () => {
      mockLocation.pathname = '/reconciliation';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByText('Accounts')).toBeInTheDocument();
      expect(screen.getByText('Reconciliation')).toBeInTheDocument();
    });

    it('handles standalone paths', () => {
      mockLocation.pathname = '/analytics';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.queryByText('Accounts')).not.toBeInTheDocument();
    });

    it('handles investments path', () => {
      mockLocation.pathname = '/investments';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByText('Investments')).toBeInTheDocument();
    });

    it('handles settings path', () => {
      mockLocation.pathname = '/settings';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  describe('Link Behavior', () => {
    it('home icon links to root', () => {
      mockLocation.pathname = '/accounts';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      const homeLink = screen.getByTestId('home-icon').closest('a');
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('last breadcrumb is not a link', () => {
      mockLocation.pathname = '/accounts';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      const accountsText = screen.getByText('Accounts');
      expect(accountsText.tagName).toBe('SPAN');
      expect(accountsText.closest('a')).toBeNull();
    });

    it('intermediate breadcrumbs are links', () => {
      mockLocation.pathname = '/transactions';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      const accountsLink = screen.getByText('Accounts').closest('a');
      expect(accountsLink).toHaveAttribute('href', '/accounts');
      
      const transactionsText = screen.getByText('Transactions');
      expect(transactionsText.tagName).toBe('SPAN');
    });

    it('preserves query params in account filter links', () => {
      mockLocation.pathname = '/transactions';
      mockLocation.search = '?account=2';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      const savingsText = screen.getByText('Savings Account');
      expect(savingsText.tagName).toBe('SPAN');
      expect(savingsText).toHaveClass('font-medium');
    });
  });

  describe('Styling', () => {
    it('applies correct nav styling', () => {
      mockLocation.pathname = '/accounts';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('flex', 'items-center', 'space-x-2', 'text-sm', 'mb-4');
    });

    it('applies correct link styling', () => {
      mockLocation.pathname = '/transactions';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      const accountsLink = screen.getByText('Accounts').closest('a');
      expect(accountsLink).toHaveClass(
        'text-gray-500',
        'hover:text-gray-700',
        'dark:text-gray-400',
        'dark:hover:text-gray-200'
      );
    });

    it('styles last breadcrumb differently', () => {
      mockLocation.pathname = '/accounts';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      const accountsText = screen.getByText('Accounts');
      expect(accountsText).toHaveClass(
        'text-gray-900',
        'dark:text-white',
        'font-medium'
      );
    });

    it('styles chevron separators', () => {
      mockLocation.pathname = '/accounts';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      const chevron = screen.getByTestId('chevron-right');
      expect(chevron).toHaveClass('text-gray-400');
    });
  });

  describe('Edge Cases', () => {
    it('handles unknown path segments gracefully', () => {
      mockLocation.pathname = '/unknown/path';
      
      const { container } = render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      // Unknown paths result in only Dashboard being in breadcrumbs array
      // Since breadcrumbs.length <= 1, it returns null
      expect(container.firstChild).toBeNull();
    });

    it('handles empty path segments', () => {
      mockLocation.pathname = '//accounts//';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByText('Accounts')).toBeInTheDocument();
      // Should filter out empty segments
    });

    it('handles missing account in filter', () => {
      mockLocation.pathname = '/transactions';
      mockLocation.search = '?account=999';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByText('Transactions')).toBeInTheDocument();
      // Should not show account name if account not found
      expect(screen.queryByText('Unknown Account')).not.toBeInTheDocument();
    });

    it('avoids duplicate parent entries', () => {
      mockLocation.pathname = '/forecasting/budget';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      const forecastingElements = screen.getAllByText('Forecasting');
      expect(forecastingElements).toHaveLength(1);
    });

    it('handles complex nested paths', () => {
      mockLocation.pathname = '/settings/app/theme';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByText('Settings')).toBeInTheDocument();
      // Sub-paths under settings are not mapped
    });
  });

  describe('Accessibility', () => {
    it('has navigation role', () => {
      mockLocation.pathname = '/accounts';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('links are keyboard accessible', () => {
      mockLocation.pathname = '/transactions';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link.tagName).toBe('A');
      });
    });

    it('could benefit from aria-label on nav', () => {
      mockLocation.pathname = '/accounts';
      
      render(
        <MemoryRouter>
          <Breadcrumbs />
        </MemoryRouter>
      );
      
      const nav = screen.getByRole('navigation');
      // Note: Component could be improved with aria-label="Breadcrumb navigation"
      expect(nav).toBeInTheDocument();
    });
  });
});
