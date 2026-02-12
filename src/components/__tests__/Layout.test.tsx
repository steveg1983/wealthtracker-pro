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

    const searchInput = await screen.findByPlaceholderText('Search transactions, accounts, budgets...');
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
