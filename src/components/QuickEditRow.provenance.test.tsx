/**
 * The register's row editor — confirm or edit a suggested category.
 *
 * The owner's requirement, in his words: "If it is a 'suggested' category, it
 * has a different colour or something and then the user has to somehow do an
 * easy 'confirm or edit' when he clicks on the category, and if he doesn't then
 * it just keeps the suggested category."
 *
 * So three things have to hold, and each has a test here:
 *   1. a suggested category LOOKS different, in words as well as colour;
 *   2. agreeing with it is one click, and changes nothing but who vouched;
 *   3. a category the user vouched for shows none of that.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  QuickEditRowProvider,
  QuickEditFieldCell,
  QuickEditActionStrip,
  type QuickEditRowProviderProps,
} from './QuickEditRow';
import type { Transaction } from '../types';

const mocks = vi.hoisted(() => ({
  updateTransaction: vi.fn(async () => {}),
  confirmTransactionCategories: vi.fn(async () => 1),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const suggested: Transaction = {
  id: 'txn-suggested',
  date: new Date('2026-06-10'),
  description: 'NORTHGATE MARKET',
  amount: -12.34,
  type: 'expense',
  accountId: 'acc-a',
  category: 'det-x',
  categoryConfirmed: false,
  cleared: false,
} as Transaction;

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    transactions: [suggested],
    accounts: [
      { id: 'acc-a', name: 'Current Account', type: 'checking', balance: 100, currency: 'GBP' },
    ],
    categories: [
      { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
      { id: 'sub-x', name: 'Bills', type: 'expense', level: 'sub', parentId: 'type-expense' },
      { id: 'det-x', name: 'Council Tax', type: 'expense', level: 'detail', parentId: 'sub-x' },
      { id: 'det-y', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-x' },
    ],
    getSubCategories: (parentId?: string) =>
      [{ id: 'sub-x', name: 'Bills', type: 'expense', level: 'sub', parentId: 'type-expense' }]
        .filter(c => c.parentId === parentId),
    getDetailCategories: (parentId?: string) =>
      [
        { id: 'det-x', name: 'Council Tax', type: 'expense', level: 'detail', parentId: 'sub-x' },
        { id: 'det-y', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-x' },
      ].filter(c => c.parentId === parentId),
    updateTransaction: mocks.updateTransaction,
    confirmTransactionCategories: mocks.confirmTransactionCategories,
    applyCategoryToUncategorized: vi.fn(async () => 0),
    linkTransferPair: vi.fn(),
    createTransferCounterpart: vi.fn(),
  }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (n: number) =>
      Number(n) < 0
        ? `(£${Math.abs(Number(n)).toFixed(2)})`
        : `£${Number(n).toFixed(2)}`,
  }),
}));

/**
 * The register's table, in the smallest form that is honest.
 *
 * The editor is no longer one component in one place: its fields are cells the
 * row lends it and its buttons a strip beneath. Which cell goes under which
 * column, how wide it is and how tall the row grows are the REGISTER's to
 * arrange, and are proved there (AccountTransactions.inlineEdit); this stands
 * them up in a plain row so the behaviour underneath can be asked about on its
 * own.
 */
function RowEditor(props: Omit<QuickEditRowProviderProps, 'children'>): React.JSX.Element {
  return (
    <QuickEditRowProvider {...props}>
      <div role="row">
        <div role="gridcell"><QuickEditFieldCell field="date" /></div>
        <div role="gridcell"><QuickEditFieldCell field="description" /></div>
        <div role="gridcell"><QuickEditFieldCell field="category" /></div>
      </div>
      <div role="row">
        <div role="gridcell"><QuickEditActionStrip /></div>
      </div>
    </QuickEditRowProvider>
  );
}

describe('The register row editor — suggested categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('says "Suggested" in words, not only in colour', () => {
    render(<RowEditor transaction={suggested} onDismiss={vi.fn()} />);

    // Colour alone would say nothing to anyone who cannot see it, and nothing
    // at all in a screenshot pasted into an email.
    expect(screen.getByText('Suggested')).toBeInTheDocument();
  });

  it('offers a one-click confirm that changes nothing but who vouched for it', async () => {
    render(<RowEditor transaction={suggested} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(mocks.confirmTransactionCategories).toHaveBeenCalledWith(['txn-suggested']);
    });
    // Confirming is agreeing. It must not go near the ordinary update path,
    // which is what moves categories, amounts and balances.
    expect(mocks.updateTransaction).not.toHaveBeenCalled();
    expect(mocks.showSuccess).toHaveBeenCalled();
  });

  it('shows neither the badge nor the confirm button once the user has vouched', () => {
    render(
      <RowEditor
        transaction={{ ...suggested, categoryConfirmed: true }}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  });

  /**
   * A row from a database that has not had the migration applied, or from the
   * local/demo store, carries no flag at all. It must read as confirmed — the
   * alternative badges every transaction the user has ever typed.
   */
  it('treats a row with no provenance flag as the user\'s own', () => {
    const noFlag: Transaction = { ...suggested };
    delete noFlag.categoryConfirmed;

    render(<RowEditor transaction={noFlag} onDismiss={vi.fn()} />);

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
  });

  it('records a plain Save as confirmation — the user looked and let it stand', async () => {
    render(<RowEditor transaction={suggested} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mocks.updateTransaction).toHaveBeenCalledTimes(1);
    });
    const updates = mocks.updateTransaction.mock.calls[0][1] as Record<string, unknown>;
    expect(updates.category).toBe('det-x');
    expect(updates.categoryConfirmed).toBe(true);
  });

  /**
   * Confirm still leads. The run buttons swapped round (Save & Next took the
   * lead from Save, because a run is what this editor is for), and the one
   * thing that must NOT have moved with them is the button a freshly imported
   * row is really asking about: agreeing with the guess is the answer nine
   * times in ten, and it belongs at the near end of the strip.
   */
  it('keeps Confirm first, ahead of the run buttons', () => {
    render(<RowEditor transaction={suggested} onNext={vi.fn()} onDismiss={vi.fn()} />);

    const buttons = screen.getAllByRole('button').filter(b => b.textContent !== '');
    expect(buttons.map(b => b.textContent)).toEqual(['Confirm', 'Save & Next', 'Save']);
  });

  /**
   * The badge moved with the button it belongs to.
   *
   * The Category cell IS the picker now, and there is no room beside a picker
   * in a 280px column for a word as well — so the amber goes where the answer
   * is: on the strip, immediately before the Confirm it is asking about. The
   * register's own Category column still carries the identical badge on every
   * row that is not being edited, which is what stops the mark disappearing
   * from the page as an editor opens.
   */
  it('says it on the strip, beside the button that answers it', () => {
    render(<RowEditor transaction={suggested} onNext={vi.fn()} onDismiss={vi.fn()} />);

    const strip = document.querySelector('[data-quick-edit="actions"]');
    if (!(strip instanceof HTMLElement)) throw new Error('no strip is showing');
    expect(strip.contains(screen.getByText('Suggested'))).toBe(true);
    expect(strip.contains(screen.getByRole('button', { name: 'Confirm' }))).toBe(true);
  });

  it('drops the suggested styling the moment the user picks something else', () => {
    render(<RowEditor transaction={suggested} onDismiss={vi.fn()} />);

    expect(screen.getByText('Suggested')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    fireEvent.click(screen.getByText('Groceries'));

    // It is their choice now, and it must stop looking like a guess as they
    // make it rather than after a round trip.
    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  });
});
