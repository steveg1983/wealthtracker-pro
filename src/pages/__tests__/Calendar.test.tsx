import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Calendar from '../Calendar';

// Mock the app context
vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    transactions: [
      { id: '1', date: new Date(), amount: -50, type: 'expense', description: 'Test expense', accountId: 'acc1', category: 'Food' },
      { id: '2', date: new Date(), amount: 200, type: 'income', description: 'Test income', accountId: 'acc1', category: 'Salary' },
    ],
    accounts: [
      { id: 'acc1', name: 'Test Account', type: 'current', balance: 1000, openingBalance: 1000 },
    ],
  }),
}));

// Mock currency hook
vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `£${Math.abs(amount).toFixed(2)}`,
  }),
}));

describe('Calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the calendar page with title', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    expect(screen.getByText('Calendar')).toBeInTheDocument();
  });

  it('renders day headers', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
  });

  it('renders month navigation', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous month')).toBeInTheDocument();
    expect(screen.getByLabelText('Next month')).toBeInTheDocument();
  });

  it('renders month summary stats', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
  });

  it('navigates to previous month', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    const prevButton = screen.getByLabelText('Previous month');
    fireEvent.click(prevButton);
    // Should not crash — month display should change
  });

  it('navigates to next month', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    const nextButton = screen.getByLabelText('Next month');
    fireEvent.click(nextButton);
    // Should not crash
  });

  it('has accessible grid role', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });
});
