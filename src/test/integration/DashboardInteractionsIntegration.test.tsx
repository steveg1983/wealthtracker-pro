import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Dashboard from '../../pages/Dashboard';
import { markOnboardingComplete } from '../utils/testPreferences';
import { AppProvider } from '../../contexts/AppContextSupabase';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';

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
            <ToastProvider>
              <Routes>
                <Route path="/dashboard" element={ui} />
                <Route path="/accounts" element={<div>Accounts Page</div>} />
                <Route path="/transactions" element={<div>Transactions Page</div>} />
              </Routes>
            </ToastProvider>
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
    localStorage.clear();
    sessionStorage.clear();
    markOnboardingComplete();
    localStorage.setItem('onboardingCompleted', 'true');
    localStorage.setItem('dashboardKeyAccounts', JSON.stringify([]));
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
        expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
      });

      // The dashboard is lazy-loaded and its chunk can resolve slowly when the
      // full coverage suite runs under load. Query both labels concurrently so
      // their wait windows overlap (sequential 5s waits could otherwise sum
      // past the per-test timeout) and give the test an explicit generous cap.
      const [assetsLabel, liabilitiesLabel] = await Promise.all([
        screen.findByText(/assets/i, { selector: 'p' }, { timeout: 15000 }),
        screen.findByText(/liabilities/i, { selector: 'p' }, { timeout: 15000 })
      ]);
      expect(assetsLabel).toBeInTheDocument();
      expect(liabilitiesLabel).toBeInTheDocument();
    }, 20000);

    it('should display performance metrics for the selected period', async () => {
      renderWithProviders(<Dashboard />);

      // Titled "Income and Expenses" with a period control beside it, rather
      // than a fixed "This Month's". It was "Performance" until 2026-08-13,
      // which measured nothing — performance is a return against a benchmark,
      // and this card compares its two totals to nothing at all.
      const performanceHeading = await screen.findByRole('heading', { name: /^income and expenses$/i });
      expect(performanceHeading).toBeInTheDocument();
      // Scoped to the Performance section: the page tip's copy now mentions
      // income and expenses too, so a page-wide /income/i matched twice. What
      // this test is actually about is the section's own two figures.
      const performanceSection = performanceHeading.closest('section');
      if (performanceSection === null) {
        throw new Error('Performance heading is not inside a section');
      }
      const performance = within(performanceSection);
      expect(performance.getByText('Income')).toBeInTheDocument();
      expect(performance.getByText('Expenses')).toBeInTheDocument();
      // The picker offering the same windows as the rest of the app.
      expect(screen.getAllByRole('button', { name: /this month/i }).length).toBeGreaterThan(0);
    });

    it('no longer shows a Recent Transactions card', async () => {
      // The dashboard used to carry a Recent Transactions list; Steve found it
      // pointless on a dashboard (an account's register is one click away) so
      // the card and its data slice were removed. Wait for the dashboard body
      // to actually render before asserting absence, otherwise the check could
      // pass on a page that simply hadn't painted the card yet.
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
      });
      // The Income and Expenses section always renders once the body is up.
      await screen.findByRole('heading', { name: /^income and expenses$/i }, { timeout: 15000 });

      expect(screen.queryByText(/recent transactions/i)).not.toBeInTheDocument();
    }, 20000);

    it('should show account distribution chart', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
      });

      // Should have account distribution - might be multiple
      const accountDistElements = await screen.findAllByText(/account distribution/i);
      expect(accountDistElements.length).toBeGreaterThan(0);
    });

    it('should bypass test data modal for seeded preferences', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
      });

      const warning = screen.queryByText(/test data active/i);
      if (warning) {
        await user.click(screen.getByText(/continue with test data/i));
        await waitFor(() => {
          expect(screen.queryByText(/test data active/i)).not.toBeInTheDocument();
        });
      }

      const assetsLabel = await screen.findByText(/assets/i, { selector: 'p' });
      expect(assetsLabel).toBeInTheDocument();
    });

    it('should handle modal interactions', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
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

    it('no longer ends in a row of quick-action tiles', async () => {
      // Same reasoning as the Recent Transactions card above: four 140px tiles
      // closed the page — Add Transaction, View Accounts, Set Budget, Reports —
      // and each was a second door to a room already on screen. The sidebar
      // names those destinations permanently, and adding a transaction belongs
      // in the register that will hold it. The phone keeps its floating "+"
      // (components/MobileBottomNav), where the sidebar is behind a tap.
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
      });
      // The Income and Expenses section always renders once the body is up,
      // so absence is being asserted against a painted page.
      await screen.findByRole('heading', { name: /^income and expenses$/i }, { timeout: 15000 });

      expect(screen.queryByRole('navigation', { name: /quick actions/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /add a new transaction/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /set up or view budgets/i })).not.toBeInTheDocument();
    }, 20000);

    it('should render dashboard widgets container', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
      });

      // Dashboard should have main content area
      const mainContent = document.querySelector('[data-testid="dashboard-grid"]');
      expect(mainContent).not.toBeNull();
    });

    it('should handle responsive layout', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
      });

      // Check for responsive classes or grid layout
      const gridElements = document.querySelectorAll('[data-testid="dashboard-grid"], .grid');
      expect(gridElements.length).toBeGreaterThan(0);
    });

    it('should display loading state initially', async () => {
      renderWithProviders(<Dashboard />);

      // Dashboard heading should appear
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
      });
    });
  });
});
