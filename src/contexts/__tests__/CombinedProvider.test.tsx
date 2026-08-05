import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CombinedProvider } from '../CombinedProvider';

// Each provider is replaced by a marker element so the test can assert the
// nesting order without dragging in every context's real implementation.
vi.mock('../AccountContext', () => ({
  AccountProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="account-provider">{children}</div>
}));

vi.mock('../CategoryContext', () => ({
  CategoryProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="category-provider">{children}</div>
}));

vi.mock('../PreferencesContext', () => ({
  PreferencesProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="preferences-provider">{children}</div>
}));

vi.mock('../LayoutContext', () => ({
  LayoutProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="layout-provider">{children}</div>
}));

vi.mock('../../data/defaultTestData', () => ({
  getDefaultTestAccounts: vi.fn(() => [
    { id: '1', name: 'Test Account', type: 'checking', balance: 1000, currency: 'GBP' }
  ])
}));

describe('CombinedProvider', () => {
  it('renders all providers in correct order', () => {
    render(
      <CombinedProvider>
        <div>Test Content</div>
      </CombinedProvider>
    );

    expect(screen.getByTestId('preferences-provider')).toBeInTheDocument();
    expect(screen.getByTestId('layout-provider')).toBeInTheDocument();
    expect(screen.getByTestId('category-provider')).toBeInTheDocument();
    expect(screen.getByTestId('account-provider')).toBeInTheDocument();

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('does not mount the removed transaction, goal and budget providers', () => {
    // These mirrored financial data into plaintext localStorage. The budget one
    // also starved the envelope/template/rollover/alert tabs of the real
    // Supabase budgets; this pins the removal so they cannot drift back in.
    render(
      <CombinedProvider>
        <div>Test Content</div>
      </CombinedProvider>
    );

    expect(screen.queryByTestId('transaction-provider')).not.toBeInTheDocument();
    expect(screen.queryByTestId('goal-provider')).not.toBeInTheDocument();
    expect(screen.queryByTestId('budget-provider')).not.toBeInTheDocument();
  });

  it('provides test data when useTestData is true', async () => {
    const testDataModule = await import('../../data/defaultTestData');

    render(
      <CombinedProvider useTestData={true}>
        <div>Test Content</div>
      </CombinedProvider>
    );

    expect(testDataModule.getDefaultTestAccounts).toHaveBeenCalled();
  });

  it('provides all contexts to deeply nested children', () => {
    const NestedComponent = () => (
      <div>
        <div>
          <div>
            <div data-testid="deep-child">Deep child</div>
          </div>
        </div>
      </div>
    );

    render(
      <CombinedProvider>
        <NestedComponent />
      </CombinedProvider>
    );

    expect(screen.getByTestId('deep-child')).toHaveTextContent('Deep child');
  });
});
