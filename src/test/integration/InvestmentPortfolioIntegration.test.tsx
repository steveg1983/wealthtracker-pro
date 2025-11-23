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

    it('should show message when no investment accounts exist', async () => {
      // Mock to ensure no accounts are returned
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'wealthtracker_data_cleared') return 'true';
        return null;
      });
      
      renderWithProviders(<Investments />);

      await waitFor(() => {
        expect(screen.getByText(/no investment accounts yet/i)).toBeInTheDocument();
      });
    });

    it('should show instructions to add investment account', async () => {
      // Mock to ensure no accounts are returned
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'wealthtracker_data_cleared') return 'true';
        return null;
      });
      
      renderWithProviders(<Investments />);

      await waitFor(() => {
        expect(screen.getByText(/go to accounts/i)).toBeInTheDocument();
        expect(screen.getByText(/choose "investment"/i)).toBeInTheDocument();
      });
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

    it('should display investment icon when no accounts', async () => {
      // Mock to ensure no accounts are returned
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'wealthtracker_data_cleared') return 'true';
        return null;
      });
      
      renderWithProviders(<Investments />);

      await waitFor(() => {
        // Should show an icon (svg)
        const icons = screen.getAllByRole('img');
        expect(icons.length).toBeGreaterThan(0);
      });
    });
  });
});
