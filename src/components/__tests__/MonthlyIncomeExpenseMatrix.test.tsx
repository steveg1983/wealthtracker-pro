import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import MonthlyIncomeExpenseMatrix, { type MatrixDrillTarget } from '../MonthlyIncomeExpenseMatrix';
import { buildMonthlyCategoryMatrix } from '../../utils/monthlyCategoryMatrix';
import { computeIncomeExpense } from '../../utils/incomeExpense';
import type { Category, Transaction } from '../../types';
import type { PeriodRange } from '../../hooks/usePeriod';

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-salary', name: 'Salary', type: 'income', level: 'sub', parentId: 'type-income' },
  { id: 'grp-food', name: 'Food Related Costs', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
];

const RANGE: PeriodRange = { from: new Date(2026, 0, 1), to: new Date(2026, 1, 28, 23, 59, 59, 999) };

const TRANSACTIONS: Transaction[] = [
  { id: 't1', date: new Date(2026, 0, 5), amount: 2000, description: 'synthetic pay', category: 'grp-salary', accountId: 'acc-1', type: 'income' },
  { id: 't2', date: new Date(2026, 0, 12), amount: -40, description: 'synthetic shop', category: 'cat-groceries', accountId: 'acc-1', type: 'expense' },
  { id: 't3', date: new Date(2026, 1, 12), amount: -60, description: 'synthetic shop', category: 'cat-groceries', accountId: 'acc-1', type: 'expense' },
];

const matrix = (): ReturnType<typeof buildMonthlyCategoryMatrix> => {
  const flows = computeIncomeExpense(TRANSACTIONS, [], CATEGORIES, {
    from: RANGE.from ?? undefined,
    to: RANGE.to ?? undefined,
  });
  return buildMonthlyCategoryMatrix(flows.incomeRows, flows.expenseRows, CATEGORIES, RANGE, {
    now: new Date(2026, 1, 20),
  });
};

const renderMatrix = (onDrill: (t: MatrixDrillTarget) => void = vi.fn()) =>
  render(
    <PreferencesProvider>
      <MonthlyIncomeExpenseMatrix matrix={matrix()} onDrill={onDrill} />
    </PreferencesProvider>
  );

describe('MonthlyIncomeExpenseMatrix', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lays categories down the side and months across the top', () => {
    renderMatrix();

    expect(screen.getByRole('columnheader', { name: 'Category' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Jan 26' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Feb 26' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Food Related Costs' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Salary' })).toBeInTheDocument();
  });

  it('shows the Money footer rows with income less expenses', () => {
    renderMatrix();

    const net = screen.getByRole('rowheader', { name: 'Income less Expenses' }).closest('tr');
    expect(net).not.toBeNull();
    // Jan: 2000 − 40, Feb: 0 − 60, period: 2000 − 100
    expect(within(net as HTMLElement).getByText('£1,960.00')).toBeInTheDocument();
    expect(within(net as HTMLElement).getByText('-£60.00')).toBeInTheDocument();
    expect(within(net as HTMLElement).getByText('£1,900.00')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Total Expenses' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Total Income' })).toBeInTheDocument();
  });

  it('drills into a single category/month cell', () => {
    const onDrill = vi.fn();
    renderMatrix(onDrill);

    fireEvent.click(screen.getByTitle('Groceries · Feb 26 — view these transactions'));

    expect(onDrill).toHaveBeenCalledWith({
      bucket: 'expense',
      categoryIds: ['cat-groceries'],
      monthKey: '2026-02',
      label: 'Food Related Costs : Groceries — Feb 26',
      total: 60,
    });
  });

  it('drills into a whole-period total from the Total column', () => {
    const onDrill = vi.fn();
    renderMatrix(onDrill);

    fireEvent.click(screen.getByTitle('Total Income · whole period — view these transactions'));

    expect(onDrill).toHaveBeenCalledWith({
      bucket: 'income',
      categoryIds: null,
      monthKey: null,
      label: 'Income — whole period',
      total: 2000,
    });
  });

  it('a month with no activity renders as a dash, not a clickable zero', () => {
    renderMatrix();

    const salaryRow = screen.getByRole('rowheader', { name: 'Salary' }).closest('tr');
    expect(within(salaryRow as HTMLElement).queryByTitle('Salary · Feb 26 — view these transactions')).toBeNull();
    expect(within(salaryRow as HTMLElement).getAllByText('—').length).toBe(1);
  });

  it('persists the subcategory toggle', () => {
    renderMatrix();

    expect(screen.getByRole('rowheader', { name: 'Groceries' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Subcategories' }));

    expect(localStorage.getItem('reportsMatrixSubcategories')).toBe('0');
    expect(screen.queryByRole('rowheader', { name: 'Groceries' })).toBeNull();
    // The group subtotal row stays.
    expect(screen.getByRole('rowheader', { name: 'Food Related Costs' })).toBeInTheDocument();
  });
});
