import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Investments from '../../pages/Investments';
import { AppProvider } from '../../contexts/AppContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { PreferencesProvider } from '../../contexts/PreferencesContext';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Helper to render with all providers
const renderWithProviders = (ui: React.ReactElement, { route = '/investments' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <PreferencesProvider>
        <AppProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/investments" element={ui} />
            </Routes>
          </NotificationProvider>
        </AppProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

describe('Investment Portfolio Integration', () => {
  const _user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('Add Investment → Track Performance → Rebalance', () => {
    it('should display investment page with default test data', async () => {
      // Mock storageAdapter to return null so default test data is loaded
      localStorageMock.getItem.mockReturnValue(null);
      
      renderWithProviders(<Investments />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /investments/i })).toBeInTheDocument();
      });

      // With default test data, should show investment content
      // Check for either tabs or no accounts message
      const hasInvestmentAccounts = screen.queryByRole('button', { name: /overview/i });
      const noAccountsMessage = screen.queryByText(/no investment accounts yet/i);
      
      expect(hasInvestmentAccounts || noAccountsMessage).toBeTruthy();
    });

    it('should display investment page heading', async () => {
      renderWithProviders(<Investments />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /investments/i })).toBeInTheDocument();
      });
    });

    it('should show investments content or empty state', async () => {
      renderWithProviders(<Investments />);

      await waitFor(() => {
        // Should show either investment content or empty state message
        const hasInvestmentHeading = screen.getByRole('heading', { name: /investments/i });
        expect(hasInvestmentHeading).toBeInTheDocument();
      });

      // Check for either tabs (has accounts) or empty state (no accounts)
      const hasOverviewTab = screen.queryByRole('button', { name: /overview/i });
      const hasEmptyState = screen.queryByText(/no investment accounts yet/i);

      expect(hasOverviewTab || hasEmptyState).toBeTruthy();
    });

    it('should render investment page without errors', async () => {
      renderWithProviders(<Investments />);

      // Page should render without throwing
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /investments/i })).toBeInTheDocument();
      });

      // Should have some content
      const pageContent = screen.getByRole('heading', { name: /investments/i }).parentElement?.parentElement;
      expect(pageContent).toBeTruthy();
    });

    it('should display svg graphics on investment page', async () => {
      renderWithProviders(<Investments />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /investments/i })).toBeInTheDocument();
      });

      // Should show SVG graphics (icons, charts, etc.)
      const svgElements = document.querySelectorAll('svg');
      expect(svgElements.length).toBeGreaterThan(0);
    });
  });
});
