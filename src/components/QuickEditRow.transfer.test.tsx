/**
 * The register's row editor — Money-style transfer flow.
 *
 * Filing a transaction under a "To/From <account>" category must open the
 * match-or-create confirmation instead of writing the category blindly, and
 * the confirmed action must run the atomic link/create operation.
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
  linkTransferPair: vi.fn(async () => ({ a: {}, b: {} })),
  createTransferCounterpart: vi.fn(async () => ({ source: {}, counterpart: {} })),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const source: Transaction = {
  id: 'src',
  date: new Date('2026-06-10'),
  description: 'TRANSFER TO 5755',
  amount: -500,
  type: 'expense',
  accountId: 'acc-a',
  category: '',
  cleared: false,
} as Transaction;

// The opposite side sits in acc-b: +£500 two days later.
const opposite: Transaction = {
  ...source,
  id: 'other',
  accountId: 'acc-b',
  amount: 500,
  type: 'income',
  description: 'FASTER PAYMENT RECEIVED',
  date: new Date('2026-06-12'),
} as Transaction;

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    transactions: [source, opposite],
    accounts: [
      { id: 'acc-a', name: 'Current Account', type: 'checking', balance: 100, currency: 'GBP' },
      { id: 'acc-b', name: 'Savings', type: 'savings', balance: 100, currency: 'GBP' },
    ],
    categories: [
      { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
      { id: 'sub-x', name: 'Bills', type: 'expense', level: 'sub', parentId: 'type-expense' },
      { id: 'det-x', name: 'Council Tax', type: 'expense', level: 'detail', parentId: 'sub-x' },
      { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type' },
      { id: 'sub-transfer', name: 'Transfer', type: 'both', level: 'sub', parentId: 'type-transfer' },
      {
        id: 'tofrom-b', name: 'To/From Savings', type: 'both', level: 'detail',
        parentId: 'sub-transfer', isTransferCategory: true, accountId: 'acc-b',
      },
      {
        id: 'tofrom-a', name: 'To/From Current Account', type: 'both', level: 'detail',
        parentId: 'sub-transfer', isTransferCategory: true, accountId: 'acc-a',
      },
    ],
    getSubCategories: (parentId?: string) => [
      { id: 'sub-x', name: 'Bills', type: 'expense', level: 'sub', parentId: 'type-expense' },
      { id: 'sub-transfer', name: 'Transfer', type: 'both', level: 'sub', parentId: 'type-transfer' },
    ].filter(c => c.parentId === parentId),
    getDetailCategories: (parentId?: string) => [
      { id: 'det-x', name: 'Council Tax', type: 'expense', level: 'detail', parentId: 'sub-x' },
      { id: 'tofrom-b', name: 'To/From Savings', type: 'both', level: 'detail', parentId: 'sub-transfer', isTransferCategory: true, accountId: 'acc-b' },
      { id: 'tofrom-a', name: 'To/From Current Account', type: 'both', level: 'detail', parentId: 'sub-transfer', isTransferCategory: true, accountId: 'acc-a' },
    ].filter(c => c.parentId === parentId),
    updateTransaction: mocks.updateTransaction,
    linkTransferPair: mocks.linkTransferPair,
    createTransferCounterpart: mocks.createTransferCounterpart,
    applyCategoryToUncategorized: vi.fn(async () => 0),
    confirmTransactionCategories: vi.fn(async () => 0),
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
    formatCurrency: (n: number) => `£${Math.abs(Number(n)).toFixed(2)}`,
  }),
}));

/**
 * The register's table, in the smallest form that is honest — see the note in
 * QuickEditRow.provenance.test.tsx. The columns and the row's height belong to
 * the register; what is under test here is what filing under a To/From
 * category does.
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

/** File the row's transaction under the To/From Savings category and save. */
async function fileUnderToFromSavings() {
  render(<RowEditor transaction={source} onDismiss={vi.fn()} />);

  // Open the category picker and choose "To/From Savings"
  fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
  fireEvent.click(screen.getByText('To/From Savings'));

  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  // The match-or-create question opens in the STRIP instead of a plain
  // category write — see the note on QuickEditActionStrip for why it is not a
  // dialog here.
  await waitFor(() => {
    expect(
      screen.getByRole('group', { name: 'Make this a transfer with Savings' })
    ).toBeInTheDocument();
  });
}

describe('The register row editor — transfer flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the match dialog with the found candidate instead of writing the category', async () => {
    await fileUnderToFromSavings();

    expect(screen.getByText(/Found the matching transaction in Savings/)).toBeInTheDocument();
    // The candidate is named in the button's own title, not as a separate row:
    // the strip is 36px and has no space for a list.
    expect(
      screen.getByRole('button', { name: 'Link' }).title
    ).toContain('FASTER PAYMENT RECEIVED');
    // The field edits were saved WITHOUT the category
    expect(mocks.updateTransaction).toHaveBeenCalledTimes(1);
    const updates = mocks.updateTransaction.mock.calls[0][1] as Record<string, unknown>;
    expect(updates).not.toHaveProperty('category');
  });

  it('links the pair when confirmed', async () => {
    await fileUnderToFromSavings();

    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    await waitFor(() => {
      expect(mocks.linkTransferPair).toHaveBeenCalledWith('src', 'other');
    });
    expect(mocks.createTransferCounterpart).not.toHaveBeenCalled();
    expect(mocks.showSuccess).toHaveBeenCalled();
  });

  it('creates the counterpart when the user chooses to', async () => {
    await fileUnderToFromSavings();

    fireEvent.click(screen.getByRole('button', { name: 'Create the other side' }));
    await waitFor(() => {
      expect(mocks.createTransferCounterpart).toHaveBeenCalledWith('src', 'acc-b');
    });
    expect(mocks.linkTransferPair).not.toHaveBeenCalled();
  });

  it("is not even offered the source account's own To/From category", () => {
    render(<RowEditor transaction={source} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));

    // The other account's, yes. Its own, no: a transfer from an account to
    // itself moves nothing and has no other side to create, so it is left out
    // rather than offered and then refused.
    expect(screen.getByText('To/From Savings')).toBeInTheDocument();
    expect(screen.queryByText('To/From Current Account')).not.toBeInTheDocument();
  });

  it("rejects the source account's own To/From category when a row already carries one", async () => {
    // Unreachable through the picker above, and reachable in the data: this is
    // the exact shape a swept account's direct debits arrived in when an
    // earlier importer's categoriser had no such guard (see
    // utils/transferRepoint). Saving such a row must refuse, not convert.
    render(
      <RowEditor
        transaction={{ ...source, category: 'tofrom-a' } as Transaction}
        onDismiss={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mocks.showError).toHaveBeenCalled();
    });
    expect(
      screen.queryByRole('group', { name: /Make this a transfer/ })
    ).not.toBeInTheDocument();
    expect(mocks.updateTransaction).not.toHaveBeenCalled();
  });

  it('cancelling the dialog leaves the transaction untouched by the transfer flow', async () => {
    await fileUnderToFromSavings();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('group', { name: 'Make this a transfer with Savings' })
    ).not.toBeInTheDocument();
    expect(mocks.linkTransferPair).not.toHaveBeenCalled();
    expect(mocks.createTransferCounterpart).not.toHaveBeenCalled();
  });
});
