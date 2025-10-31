/**
 * GlobalSearch Tests
 * Tests for the GlobalSearch component
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import GlobalSearch from '../GlobalSearch';
import { useGlobalSearchDialog } from '../../hooks/useGlobalSearchDialog';

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn()
  };
});

vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: (value: string) => value
}));

vi.mock('../../hooks/useGlobalSearch', () => ({
  useGlobalSearch: (query: string) => {
    if (!query || query.length < 2) {
      return { results: [], hasResults: false, resultCount: 0 };
    }
    
    if (query === 'nomatch') {
      return { results: [], hasResults: false, resultCount: 0 };
    }
    
    // Return mock search results
    return {
      results: [
        {
          id: 'acc-1',
          type: 'account',
          title: 'Main Checking Account',
          description: 'Balance: $1,500.00',
          matches: [query]
        },
        {
          id: 'trans-1',
          type: 'transaction',
          title: 'Coffee Shop Transaction',
          description: '$4.50 on Jan 15, 2024',
          matches: [query]
        },
        {
          id: 'budget-1',
          type: 'budget',
          title: 'Food Budget',
          description: '$500.00 monthly budget',
          matches: [query]
        },
        {
          id: 'goal-1',
          type: 'goal',
          title: 'Vacation Savings Goal',
          description: 'Save $5,000 by Dec 2024',
          matches: [query]
        }
      ],
      hasResults: true,
      resultCount: 4
    };
  }
}));

// Mock icons
vi.mock('../icons', () => ({
  SearchIcon: ({ className }: { className?: string }) => <div data-testid="search-icon" className={className}>Search</div>,
  XIcon: () => <div data-testid="x-icon">X</div>,
  WalletIcon: () => <div data-testid="wallet-icon">Wallet</div>,
  CreditCardIcon: () => <div data-testid="credit-card-icon">CreditCard</div>,
  TargetIcon: () => <div data-testid="target-icon">Target</div>,
  GoalIcon: () => <div data-testid="goal-icon">Goal</div>
}));

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html
  }
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

describe('GlobalSearch', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const renderGlobalSearch = (props = {}) => {
    return render(
      <MemoryRouter>
        <GlobalSearch isOpen={true} onClose={vi.fn()} {...props} />
      </MemoryRouter>
    );
  };

  describe('rendering', () => {
    it('renders correctly when open', () => {
      renderGlobalSearch();
      
      expect(screen.getByPlaceholderText('Search accounts, transactions, budgets, goals...')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(
        <MemoryRouter>
          <GlobalSearch isOpen={false} onClose={vi.fn()} />
        </MemoryRouter>
      );
      
      expect(screen.queryByPlaceholderText('Search accounts, transactions, budgets, goals...')).not.toBeInTheDocument();
    });

    it('shows initial search prompt', () => {
      renderGlobalSearch();
      
      expect(screen.getByText('Start typing to search...')).toBeInTheDocument();
      expect(screen.getByText('Search across accounts, transactions, budgets, and goals')).toBeInTheDocument();
    });

    it('focuses input when opened', () => {
      renderGlobalSearch();
      
      const input = screen.getByPlaceholderText('Search accounts, transactions, budgets, goals...');
      expect(document.activeElement).toBe(input);
    });
  });

  describe('search functionality', () => {
    it('shows search results when typing', async () => {
      renderGlobalSearch();
      
      const input = screen.getByPlaceholderText('Search accounts, transactions, budgets, goals...');
      await userEvent.type(input, 'checking');
      
      await waitFor(() => {
        // The text is broken up by the highlight, so we need to look for partial text
        expect(screen.getByText(/Main.*Account/)).toBeInTheDocument();
        expect(screen.getByText(/Coffee Shop Transaction/)).toBeInTheDocument();
        expect(screen.getByText(/Food Budget/)).toBeInTheDocument();
        expect(screen.getByText(/Vacation Savings Goal/)).toBeInTheDocument();
      });
    });

    it('shows result count', async () => {
      renderGlobalSearch();
      
      const input = screen.getByPlaceholderText('Search accounts, transactions, budgets, goals...');
      await userEvent.type(input, 'test');
      
      await waitFor(() => {
        expect(screen.getByText('4 results')).toBeInTheDocument();
      });
    });

    it('shows no results message', async () => {
      renderGlobalSearch();
      
      const input = screen.getByPlaceholderText('Search accounts, transactions, budgets, goals...');
      await userEvent.type(input, 'nomatch');
      
      await waitFor(() => {
        expect(screen.getByText('No results found')).toBeInTheDocument();
        expect(screen.getByText('Try different keywords or check your spelling')).toBeInTheDocument();
      });
    });

    it('requires minimum 2 characters to search', async () => {
      renderGlobalSearch();
      
      const input = screen.getByPlaceholderText('Search accounts, transactions, budgets, goals...');
      await userEvent.type(input, 'a');
      
      expect(screen.getByText('Start typing to search...')).toBeInTheDocument();
      expect(screen.queryByText('Main Checking Account')).not.toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('handles close button click', async () => {
      const onClose = vi.fn();
      render(
        <MemoryRouter>
          <GlobalSearch isOpen={true} onClose={onClose} />
        </MemoryRouter>
      );
      
      const closeButton = screen.getByTestId('x-icon').parentElement!;
      await userEvent.click(closeButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('navigates when clicking account result', async () => {
      renderGlobalSearch();
      
      const input = screen.getByPlaceholderText('Search accounts, transactions, budgets, goals...');
      await userEvent.type(input, 'test');
      
      await waitFor(() => {
        expect(screen.getByText('Main Checking Account')).toBeInTheDocument();
      });
      
      await userEvent.click(screen.getByText('Main Checking Account'));
      
      expect(mockNavigate).toHaveBeenCalledWith('/accounts');
    });

    it('navigates when clicking transaction result', async () => {
      renderGlobalSearch();
      
      const input = screen.getByPlaceholderText('Search accounts, transactions, budgets, goals...');
      await userEvent.type(input, 'test');
      
      await waitFor(() => {
        expect(screen.getByText('Coffee Shop Transaction')).toBeInTheDocument();
      });
      
      await userEvent.click(screen.getByText('Coffee Shop Transaction'));
      
      expect(mockNavigate).toHaveBeenCalledWith('/transactions?search=trans-1');
    });

    it('navigates when clicking budget result', async () => {
      renderGlobalSearch();
      
      const input = screen.getByPlaceholderText('Search accounts, transactions, budgets, goals...');
      await userEvent.type(input, 'test');
      
      await waitFor(() => {
        expect(screen.getByText('Food Budget')).toBeInTheDocument();
      });
      
      await userEvent.click(screen.getByText('Food Budget'));
      
      expect(mockNavigate).toHaveBeenCalledWith('/budget');
    });

    it('navigates when clicking goal result', async () => {
      renderGlobalSearch();
      
      const input = screen.getByPlaceholderText('Search accounts, transactions, budgets, goals...');
      await userEvent.type(input, 'test');
      
      await waitFor(() => {
        expect(screen.getByText('Vacation Savings Goal')).toBeInTheDocument();
      });
      
      await userEvent.click(screen.getByText('Vacation Savings Goal'));
      
      expect(mockNavigate).toHaveBeenCalledWith('/goals');
    });
  });

  describe('keyboard navigation', () => {
    it('handles arrow down navigation', async () => {
      renderGlobalSearch();
      
      const input = screen.getByPlaceholderText('Search accounts, transactions, budgets, goals...');
      await userEvent.type(input, 'test');
      
      await waitFor(() => {
        expect(screen.getByText('Main Checking Account')).toBeInTheDocument();
      });
      
      await userEvent.keyboard('{ArrowDown}');
      
      // Second result should be highlighted
      const buttons = screen.getAllByRole('button');
      expect(buttons[1]).toHaveClass('bg-[var(--color-primary)]/10');
    });

    it('handles arrow up navigation', async () => {
      renderGlobalSearch();
      
      const input = screen.getByPlaceholderText('Search accounts, transactions, budgets, goals...');
      await userEvent.type(input, 'test');
      
      await waitFor(() => {
        expect(screen.getByText('Main Checking Account')).toBeInTheDocument();
      });
      
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowUp}');
      
      // Second result should be highlighted
      const buttons = screen.getAllByRole('button');
      expect(buttons[1]).toHaveClass('bg-[var(--color-primary)]/10');
    });

    it('handles enter key to select result', async () => {
      renderGlobalSearch();
      
      const input = screen.getByPlaceholderText('Search accounts, transactions, budgets, goals...');
      await userEvent.type(input, 'test');
      
      await waitFor(() => {
        expect(screen.getByText('Main Checking Account')).toBeInTheDocument();
      });
      
      await userEvent.keyboard('{Enter}');
      
      expect(mockNavigate).toHaveBeenCalledWith('/accounts');
    });

    it('handles escape key to close', async () => {
      const onClose = vi.fn();
      render(
        <MemoryRouter>
          <GlobalSearch isOpen={true} onClose={onClose} />
        </MemoryRouter>
      );
      
      await userEvent.keyboard('{Escape}');
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('search tips', () => {
    it('shows search tips when searching', async () => {
      renderGlobalSearch();
      
      const input = screen.getByPlaceholderText('Search accounts, transactions, budgets, goals...');
      await userEvent.type(input, 'test');
      
      await waitFor(() => {
        expect(screen.getByText(/Use ↑↓ to navigate/)).toBeInTheDocument();
        expect(screen.getByText(/Search works across all your financial data/)).toBeInTheDocument();
      });
    });
  });

  describe('useGlobalSearchDialog hook', () => {
    it('manages open/close state', () => {
      const TestComponent = () => {
        const { isOpen, openSearch, closeSearch } = useGlobalSearchDialog();
        return (
          <div>
            <div data-testid="state">{isOpen ? 'Open' : 'Closed'}</div>
            <button onClick={openSearch}>Open Search</button>
            <button onClick={closeSearch}>Close Search</button>
          </div>
        );
      };
      
      render(<TestComponent />);
      
      expect(screen.getByTestId('state')).toHaveTextContent('Closed');
      
      fireEvent.click(screen.getByText('Open Search'));
      expect(screen.getByTestId('state')).toHaveTextContent('Open');
      
      fireEvent.click(screen.getByText('Close Search'));
      expect(screen.getByTestId('state')).toHaveTextContent('Closed');
    });
  });
});
