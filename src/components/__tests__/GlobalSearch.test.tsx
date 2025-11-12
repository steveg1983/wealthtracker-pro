import React, { createRef } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import GlobalSearch, { type GlobalSearchHandle } from '../GlobalSearch';

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

const baseResults = [
  {
    id: 'acc-1',
    type: 'account' as const,
    title: 'Main Checking Account',
    description: 'Balance: $1,500.00',
    matches: [] as string[]
  },
  {
    id: 'trans-1',
    type: 'transaction' as const,
    title: 'Coffee Shop Transaction',
    description: '$4.50 on Jan 15, 2024',
    matches: [] as string[]
  }
];

vi.mock('../../hooks/useGlobalSearch', () => ({
  useGlobalSearch: (query: string) => {
    if (!query || query.length < 2) {
      baseResults.forEach((result) => {
        result.matches = [];
      });
      return { results: [], hasResults: false, resultCount: 0 };
    }

    if (query === 'nomatch') {
      baseResults.forEach((result) => {
        result.matches = [];
      });
      return { results: [], hasResults: false, resultCount: 0 };
    }

    baseResults.forEach((result) => {
      result.matches = [query];
    });

    return {
      results: baseResults,
      hasResults: true,
      resultCount: baseResults.length
    };
  }
}));

vi.mock('../icons', () => ({
  SearchIcon: ({ className }: { className?: string }) => <div data-testid="search-icon" className={className}>Search</div>,
  WalletIcon: () => <div data-testid="wallet-icon">Wallet</div>,
  CreditCardIcon: () => <div data-testid="credit-card-icon">CreditCard</div>,
  TargetIcon: () => <div data-testid="target-icon">Target</div>,
  GoalIcon: () => <div data-testid="goal-icon">Goal</div>
}));

vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html
  }
}));

const mockNavigate = vi.fn();

const renderSearch = (props: Partial<React.ComponentProps<typeof GlobalSearch>> = {}) => {
  return render(
    <MemoryRouter>
      <GlobalSearch {...props} />
    </MemoryRouter>
  );
};

describe('GlobalSearch (inline)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  it('renders search input', () => {
    renderSearch();
    expect(screen.getByPlaceholderText('Search transactions, accounts, budgets...')).toBeInTheDocument();
  });

  it('focuses input when autoFocus is true', () => {
    renderSearch({ autoFocus: true });
    const input = screen.getByPlaceholderText('Search transactions, accounts, budgets...');
    expect(document.activeElement).toBe(input);
  });

  it('exposes focusInput via ref', () => {
    const ref = createRef<GlobalSearchHandle>();
    render(
      <MemoryRouter>
        <GlobalSearch ref={ref} />
      </MemoryRouter>
    );

    ref.current?.focusInput();
    const input = screen.getByPlaceholderText('Search transactions, accounts, budgets...');
    expect(document.activeElement).toBe(input);
  });

  it('shows helper panel when focused and query is short', async () => {
    renderSearch();
    const input = screen.getByPlaceholderText('Search transactions, accounts, budgets...');
    await userEvent.click(input);
    expect(await screen.findByText('Start typing to search…')).toBeInTheDocument();
  });

  it('displays search results when typing', async () => {
    renderSearch({ autoFocus: true });
    const input = screen.getByPlaceholderText('Search transactions, accounts, budgets...');
    await userEvent.type(input, 'checking');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Main Checking Account/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Coffee Shop Transaction/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/2 results/i)).toBeInTheDocument();
    });
  });

  it('shows no results message when nothing matches', async () => {
    renderSearch({ autoFocus: true });
    const input = screen.getByPlaceholderText('Search transactions, accounts, budgets...');
    await userEvent.type(input, 'nomatch');

    await waitFor(() => {
      expect(screen.getByText(/No results found/i)).toBeInTheDocument();
    });
  });

  it('navigates when a result is clicked', async () => {
    renderSearch({ autoFocus: true });
    const input = screen.getByPlaceholderText('Search transactions, accounts, budgets...');
    await userEvent.type(input, 'checking');

    const resultButton = await screen.findByRole('button', { name: /Main Checking Account/i });
    await userEvent.click(resultButton);

    expect(mockNavigate).toHaveBeenCalledWith('/accounts');
  });

  it('supports keyboard navigation', async () => {
    renderSearch({ autoFocus: true });
    const input = screen.getByPlaceholderText('Search transactions, accounts, budgets...');
    await userEvent.type(input, 'checking');

    await userEvent.keyboard('{ArrowDown}');

    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });

    await userEvent.keyboard('{Enter}');

    expect(mockNavigate).toHaveBeenCalledWith('/transactions?search=trans-1');
  });
});
