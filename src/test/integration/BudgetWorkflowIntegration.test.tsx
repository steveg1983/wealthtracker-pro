import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Budget from '../../pages/Budget';
import { AppProvider } from '../../contexts/AppContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { BudgetProvider } from '../../contexts/BudgetContext';
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
const renderWithProviders = (ui: React.ReactElement, { route = '/budget' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <PreferencesProvider>
        <AppProvider>
          <NotificationProvider>
            <BudgetProvider>
              <Routes>
                <Route path="/budget" element={ui} />
              </Routes>
            </BudgetProvider>
          </NotificationProvider>
        </AppProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

describe('Budget Workflow Integration', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Return empty data by default
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Create Budget → Track Spending → Alerts', () => {
    it('should open and close the budget modal', async () => {
      // Step 1: Render budget page
      renderWithProviders(<Budget />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /budget/i })).toBeInTheDocument();
      });

      // Click the Add Budget icon
      const addBudgetIcon = screen.getByTitle('Add Budget');
      await user.click(addBudgetIcon);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Verify modal has the expected title
      const modal = screen.getByRole('dialog');
      expect(within(modal).getByRole('heading', { name: 'Add Budget' })).toBeInTheDocument();
      
      // Verify form fields are present - use getAllByText since there might be multiple matches
      const categoryElements = within(modal).getAllByText(/category/i);
      expect(categoryElements.length).toBeGreaterThan(0);
      expect(within(modal).getByText(/amount/i)).toBeInTheDocument();
      expect(within(modal).getByText(/period/i)).toBeInTheDocument();

      // Click cancel button
      const cancelButton = within(modal).getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Verify modal closes
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should display different budget tabs', async () => {
      renderWithProviders(<Budget />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /budget/i })).toBeInTheDocument();
      });

      // Find tab buttons
      const traditionalTab = screen.getByRole('button', { name: /traditional/i });
      const envelopeTab = screen.getByRole('button', { name: /envelope/i });
      const alertsTab = screen.getByRole('button', { name: /alerts/i });

      // Test envelope tab
      await user.click(envelopeTab);
      await waitFor(() => {
        expect(screen.getByText(/envelope budgeting/i)).toBeInTheDocument();
      });

      // Test alerts tab
      await user.click(alertsTab);
      await waitFor(() => {
        expect(screen.getByText(/spending alerts/i)).toBeInTheDocument();
      });

      // Go back to traditional tab
      await user.click(traditionalTab);
    });

    it('should handle budget with existing data', async () => {
      // Set up localStorage with existing budget data
      const existingData = {
        budgets: [{
          id: 'budget-1',
          category: 'Entertainment',
          amount: 200,
          period: 'monthly',
          isActive: true,
          createdAt: new Date().toISOString()
        }],
        categories: [
          { id: 'cat-1', name: 'Entertainment', type: 'expense', level: 'detail' },
          { id: 'cat-2', name: 'Food & Dining', type: 'expense', level: 'detail' }
        ]
      };

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'budgets') return JSON.stringify(existingData.budgets);
        if (key === 'categories') return JSON.stringify(existingData.categories);
        return null;
      });

      renderWithProviders(<Budget />);

      await waitFor(() => {
        expect(screen.getByText('Entertainment')).toBeInTheDocument();
      });
      
      // The budget amount appears in the format "$200.00 of $200.00"
      await waitFor(() => {
        const budgetTexts = screen.getAllByText(/200/);
        expect(budgetTexts.length).toBeGreaterThan(0);
      });
    });

    it('should display budget with existing data', async () => {
      // Set up data with budgets
      const testData = {
        budgets: [{
          id: 'budget-1',
          category: 'Groceries',
          amount: 500,
          period: 'monthly',
          isActive: true,
          createdAt: new Date().toISOString()
        }],
        categories: [
          { id: 'cat-1', name: 'Groceries', type: 'expense', level: 'detail' }
        ]
      };

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'budgets') return JSON.stringify(testData.budgets);
        if (key === 'categories') return JSON.stringify(testData.categories);
        return null;
      });

      renderWithProviders(<Budget />);

      await waitFor(() => {
        // Should show budget category
        expect(screen.getByText('Groceries')).toBeInTheDocument();
      });
      
      // Budget amount appears in various formats (e.g., "$500.00 of $500.00")
      await waitFor(() => {
        const budgetTexts = screen.getAllByText(/500/);
        expect(budgetTexts.length).toBeGreaterThan(0);
      });
    });

    it('should select different budget periods', async () => {
      renderWithProviders(<Budget />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /budget/i })).toBeInTheDocument();
      });

      // Click Add Budget icon
      const addBudgetIcon = screen.getByTitle('Add Budget');
      await user.click(addBudgetIcon);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const modal = screen.getByRole('dialog');

      // Find period select - find by proximity to label
      const periodLabel = within(modal).getByText(/period/i);
      const periodSelect = periodLabel.parentElement?.querySelector('select');
      expect(periodSelect).toBeInTheDocument();
      
      if (periodSelect) {
        // Verify default is monthly
        expect(periodSelect).toHaveValue('monthly');
        
        // Change to yearly
        await user.selectOptions(periodSelect, 'yearly');
        expect(periodSelect).toHaveValue('yearly');
      }

      // Click cancel to close
      const cancelButton = within(modal).getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should navigate between budget tabs successfully', async () => {
      renderWithProviders(<Budget />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /budget/i })).toBeInTheDocument();
      });

      // Verify all tabs are present
      expect(screen.getByRole('button', { name: /traditional/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /envelope/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /templates/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /rollover/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /alerts/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /zero-based/i })).toBeInTheDocument();
      
      // Test clicking envelope tab
      const envelopeTab = screen.getByRole('button', { name: /envelope/i });
      await user.click(envelopeTab);
      
      // The envelope tab should show envelope budgeting content
      await waitFor(() => {
        expect(screen.getByText(/envelope budgeting/i)).toBeInTheDocument();
      });
    });
  });
});