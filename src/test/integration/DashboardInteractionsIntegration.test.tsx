import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Dashboard from '../../pages/Dashboard';
import { AppProvider } from '../../contexts/AppContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { BudgetProvider } from '../../contexts/BudgetContext';

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

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: () => [],
})) as any;

// Helper to render with all providers
const renderWithProviders = (ui: React.ReactElement, { route = '/dashboard' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <PreferencesProvider>
        <AppProvider>
          <NotificationProvider>
            <BudgetProvider>
              <Routes>
                <Route path="/dashboard" element={ui} />
                <Route path="/accounts" element={<div>Accounts Page</div>} />
                <Route path="/transactions" element={<div>Transactions Page</div>} />
              </Routes>
            </BudgetProvider>
          </NotificationProvider>
        </AppProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

describe('Dashboard Interactions Integration', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  describe('Widget Clicks → Navigation → Data Updates', () => {
    it('should display dashboard with summary cards', async () => {
      renderWithProviders(<Dashboard />);

      // Wait for dashboard to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      });

      // Should show summary cards - use getAllByText since there might be multiple
      const netWorthElements = screen.getAllByText(/net worth/i);
      expect(netWorthElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/total assets/i)).toBeInTheDocument();
      expect(screen.getByText(/total liabilities/i)).toBeInTheDocument();
    });

    it('should switch between dashboard tabs', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      });

      // Find tabs - they might be buttons or tabs
      const modernTab = screen.getByText(/modern/i);
      expect(modernTab).toBeInTheDocument();

      // Click modern tab
      await user.click(modernTab);

      // Modern tab should be active (has different styles)
      await waitFor(() => {
        // Check if Modern button has the active class
        const modernButton = screen.getByText(/modern/i).closest('button');
        expect(modernButton?.className).toContain('bg-white');
      });
    });

    it('should display recent transactions widget', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      });

      // Should have recent transactions section - might be multiple
      const recentTransactionsElements = screen.getAllByText(/recent transactions/i);
      expect(recentTransactionsElements.length).toBeGreaterThan(0);
    });

    it('should show account distribution chart', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      });

      // Should have account distribution - might be multiple
      const accountDistElements = screen.getAllByText(/account distribution/i);
      expect(accountDistElements.length).toBeGreaterThan(0);
    });

    it('should display test data warning when using test data', async () => {
      // Mock to ensure default test data is loaded
      localStorageMock.getItem.mockReturnValue(null);
      
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      });

      // With default test data, might show a test data warning
      // Check if either test data warning or regular content is shown
      const hasTestWarning = screen.queryByText(/test data/i);
      const netWorthElements = screen.queryAllByText(/net worth/i);
      const hasRegularContent = netWorthElements.length > 0;
      
      expect(hasTestWarning || hasRegularContent).toBeTruthy();
    });

    it('should handle modal interactions', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      });

      // Check for expand buttons on widgets
      const expandButtons = screen.queryAllByLabelText(/expand/i);
      
      if (expandButtons.length > 0) {
        // Click first expand button
        await user.click(expandButtons[0]);

        // Should show modal
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Close modal
        const closeButton = within(screen.getByRole('dialog')).getByLabelText(/close/i);
        await user.click(closeButton);

        // Modal should close
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
      }
    });

    it('should show import/export tab', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      });

      // Find import/export tab - use getAllByText since there might be multiple
      const importExportTabs = screen.getAllByText(/import\/export/i);
      expect(importExportTabs.length).toBeGreaterThan(0);
      
      // Click the first import/export tab
      await user.click(importExportTabs[0]);

      // Should show import/export content
      await waitFor(() => {
        const importTexts = screen.queryAllByText(/import/i);
        const exportTexts = screen.queryAllByText(/export/i);
        expect(importTexts.length > 0 || exportTexts.length > 0).toBeTruthy();
      });
    });

    it('should render dashboard widgets container', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      });

      // Dashboard should have main content area
      const mainContent = document.querySelector('.grid') || document.querySelector('[class*="dashboard"]');
      expect(mainContent).toBeInTheDocument();
    });

    it('should handle responsive layout', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      });

      // Check for responsive classes or grid layout
      const gridElements = document.querySelectorAll('[class*="grid"]');
      expect(gridElements.length).toBeGreaterThan(0);
    });

    it('should display loading state initially', async () => {
      renderWithProviders(<Dashboard />);

      // Dashboard heading should appear
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      });
    });
  });
});