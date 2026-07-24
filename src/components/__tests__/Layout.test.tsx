/**
 * Layout Tests
 * Component rendering and user interactions
 */

import React from 'react';
import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import Layout from '../Layout';

vi.mock('@clerk/clerk-react', () => ({
  UserButton: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="user-button">{children}</div>
  ),
  useUser: () => ({ user: null, isLoaded: true }),
  useAuth: () => ({ signOut: vi.fn(), getToken: vi.fn() }),
  useSession: () => ({ session: null }),
}));

vi.mock('../GlobalSearch', () => {
  const MockGlobalSearch = React.forwardRef<
    { focusInput: () => void },
    {
      placeholder?: string;
      autoFocus?: boolean;
      onResultSelect?: () => void;
    }
  >(({ placeholder = 'Search', autoFocus = false, onResultSelect }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => ({
      focusInput: () => {
        inputRef.current?.focus();
      }
    }), []);

    React.useEffect(() => {
      if (autoFocus) {
        inputRef.current?.focus();
      }
    }, [autoFocus]);

    return (
      <div>
        <input
          ref={inputRef}
          placeholder={placeholder}
          data-testid="mock-global-search-input"
        />
        <button
          type="button"
          data-testid="mock-global-search-result"
          onClick={() => onResultSelect?.()}
        >
          Select Result
        </button>
      </div>
    );
  });

  MockGlobalSearch.displayName = 'MockGlobalSearch';

  return {
    default: MockGlobalSearch
  };
});
describe('Layout', () => {
  const originalMatchMedia = window.matchMedia;

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
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
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('renders without crashing', () => {
    renderWithProviders(<Layout />);
    // Layout contains navigation - check for navigation elements (there may be multiple)
    const navElements = screen.getAllByRole('navigation');
    expect(navElements.length).toBeGreaterThan(0);
  });

  it('focuses desktop search input when Ctrl+K is pressed', async () => {
    renderWithProviders(<Layout />);

    const searchInput = await screen.findByPlaceholderText('Search...');
    expect(document.activeElement).not.toBe(searchInput);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    await waitFor(() => {
      expect(document.activeElement).toBe(searchInput);
    });
  });

  it('opens mobile search when shortcut is used on small screens', async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 500 });

    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      });

    try {
      renderWithProviders(<Layout />);

      expect(screen.queryByTestId('mobile-search-container')).not.toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

      const mobileContainer = await screen.findByTestId('mobile-search-container');
      const mobileInput = within(mobileContainer).getByPlaceholderText('Search transactions, accounts, budgets...');
      expect(document.activeElement).toBe(mobileInput);
    } finally {
      rafSpy.mockRestore();
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: originalInnerWidth });
    }
  });

  it('closes mobile search after selecting a result', async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 500 });

    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      });

    try {
      renderWithProviders(<Layout />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

      const mobileContainer = await screen.findByTestId('mobile-search-container');
      const resultButton = within(mobileContainer).getByTestId('mock-global-search-result');
      fireEvent.click(resultButton);

      await waitFor(() => {
        expect(screen.queryByTestId('mobile-search-container')).not.toBeInTheDocument();
      });
    } finally {
      rafSpy.mockRestore();
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: originalInnerWidth });
    }
  });
});

describe('Layout — the Plan menu and split triggers', () => {
  const originalMatchMedia = window.matchMedia;

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
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
  });

  afterAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
  });

  // The desktop nav's dropdown triggers: the LABEL is a link to the menu's
  // home; the chevron beside it is the button that opens the menu.
  const navLink = (name: string) =>
    within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name });
  const menuButton = (label: string) =>
    within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: `${label} menu` });

  it('groups the forward-looking pages under Plan, not as top-level items', () => {
    renderWithProviders(<Layout />);

    // Plan's label navigates to Budget, its menu holds all three.
    expect(navLink('Plan')).toHaveAttribute('href', '/budget');
    fireEvent.click(menuButton('Plan'));
    expect(navLink('Budget')).toHaveAttribute('href', '/budget');
    expect(navLink('Calendar')).toHaveAttribute('href', '/calendar');
    expect(navLink('Goals')).toHaveAttribute('href', '/goals');
  });

  it('no longer lists Goals under Manage — Manage is data admin', () => {
    renderWithProviders(<Layout />);

    fireEvent.click(menuButton('Manage'));
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Categories' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Goals' })).not.toBeInTheDocument();
  });

  it('clicking a trigger label navigates instead of only toggling a menu', () => {
    renderWithProviders(<Layout />);

    // Each label is a real link to its menu's home page…
    expect(navLink('Accounts')).toHaveAttribute('href', '/accounts');
    expect(navLink('Manage')).toHaveAttribute('href', '/settings/categories');
    expect(navLink('Settings')).toHaveAttribute('href', '/settings');
  });

  it('the chevron opens the menu without navigating, and ArrowDown on the label does too', () => {
    renderWithProviders(<Layout />);

    const chevron = menuButton('Accounts');
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chevron);
    expect(chevron).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(chevron);
    expect(chevron).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(navLink('Accounts'), { key: 'ArrowDown' });
    expect(chevron).toHaveAttribute('aria-expanded', 'true');
  });
});
