/**
 * RecurringBudgetTemplates Tests
 *
 * "Apply" used to delete EVERY budget before writing the template's items.
 * Against the old localStorage mirror that was merely rude; now that this tab
 * reads the real budgets it would have wiped the owner's data, including
 * categories the template has never heard of. These tests pin the upsert.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RecurringBudgetTemplates from './RecurringBudgetTemplates';
import { formatCurrency as formatCurrencyDecimal } from '../utils/currency-decimal';

const mockAddBudget = vi.fn(() => Promise.resolve());
const mockUpdateBudget = vi.fn(() => Promise.resolve());

const mockBudgets = [
  {
    id: 'budget-food',
    categoryId: 'cat-food',
    amount: 150,
    period: 'monthly' as const,
    isActive: true,
    spent: 0,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1)
  },
  {
    id: 'budget-pets',
    categoryId: 'cat-pets',
    amount: 40,
    period: 'monthly' as const,
    isActive: true,
    spent: 0,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1)
  }
];

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    categories: [
      { id: 'cat-food', name: 'Food', type: 'expense', level: 'detail' },
      { id: 'cat-pets', name: 'Pets', type: 'expense', level: 'detail' },
      { id: 'cat-fuel', name: 'Fuel', type: 'expense', level: 'detail' }
    ],
    budgets: mockBudgets,
    addBudget: mockAddBudget,
    updateBudget: mockUpdateBudget
  })
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn()
  })
}));

const mockStorageSeed: Record<string, unknown> = {};

vi.mock('../hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn((key: string, defaultValue: unknown) => {
    const seeded = Object.prototype.hasOwnProperty.call(mockStorageSeed, key);
    const [value, setValue] = React.useState(seeded ? mockStorageSeed[key] : defaultValue);
    return [value, setValue];
  })
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (value: number | { toNumber: () => number }) =>
      formatCurrencyDecimal(typeof value === 'number' ? value : value.toNumber(), 'USD')
  })
}));

const template = {
  id: 'template-1',
  name: 'Monthly Budget',
  description: 'The usual',
  budgetItems: [
    { name: 'Food', amount: 220, categoryIds: ['cat-food'], color: '#3B82F6', priority: 'medium' as const },
    { name: 'Fuel', amount: 90, categoryIds: ['cat-fuel'], color: '#3B82F6', priority: 'medium' as const }
  ],
  totalAmount: 310,
  isActive: true,
  frequency: 'monthly' as const,
  nextApplicationDate: new Date(2026, 8, 1),
  createdAt: new Date(2026, 0, 1)
};

describe('RecurringBudgetTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorageSeed).forEach(key => delete mockStorageSeed[key]);
    mockStorageSeed['budget-templates'] = [template];
  });

  it('updates a budget that already exists for the template category', async () => {
    render(<RecurringBudgetTemplates />);

    await userEvent.click(screen.getByRole('button', { name: /Apply/i }));

    await waitFor(() => {
      expect(mockUpdateBudget).toHaveBeenCalledWith('budget-food', expect.objectContaining({
        amount: 220,
        isActive: true
      }));
    });
  });

  it('creates a budget for a template category that has none', async () => {
    render(<RecurringBudgetTemplates />);

    await userEvent.click(screen.getByRole('button', { name: /Apply/i }));

    await waitFor(() => {
      expect(mockAddBudget).toHaveBeenCalledTimes(1);
    });
    expect(mockAddBudget).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: 'cat-fuel',
      amount: 90,
      period: 'monthly',
      isActive: true
    }));
  });

  it('leaves budgets the template does not name completely alone', async () => {
    render(<RecurringBudgetTemplates />);

    await userEvent.click(screen.getByRole('button', { name: /Apply/i }));

    await waitFor(() => {
      expect(mockUpdateBudget).toHaveBeenCalled();
    });

    // 'budget-pets' is not in the template; applying must not touch it.
    const touchedIds = mockUpdateBudget.mock.calls.map(([id]) => id);
    expect(touchedIds).not.toContain('budget-pets');
    expect(mockUpdateBudget).toHaveBeenCalledTimes(1);
  });

  it('shows the total with decimal arithmetic in the create-template preview', async () => {
    render(<RecurringBudgetTemplates />);

    await userEvent.click(screen.getByRole('button', { name: /Create Template/i }));

    // 150 + 40, summed through Decimal rather than raw floats.
    expect(await screen.findByText(/2 budget items with a total of \$190\.00/)).toBeInTheDocument();
  });
});
