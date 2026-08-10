/**
 * The register's row editor — the inline Transfer toggle.
 *
 * The Category cell answers one of two questions: "what was this spent on?" or
 * "which account did this money move to?". The toggle swaps between them
 * without leaving the row, and — the part that makes it usable on a run — the
 * category underneath survives the flip. It dies exactly once: when a transfer
 * is actually committed.
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
  propagateCategory: vi.fn(async () => {}),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

/** An ordinary expense in acc-a, carrying the app's guess at a category. */
const row: Transaction = {
  id: 'src',
  date: new Date('2026-06-10'),
  description: 'TRANSFER TO 5755',
  amount: -500,
  type: 'expense',
  accountId: 'acc-a',
  category: 'det-x',
  categoryConfirmed: true,
  cleared: false,
} as Transaction;

/** Nothing in acc-b matches, so the prompt offers "create" and nothing else. */
const unrelated: Transaction = {
  ...row,
  id: 'other',
  accountId: 'acc-b',
  amount: 42,
  type: 'income',
} as Transaction;

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    transactions: [row, unrelated],
    accounts: [
      { id: 'acc-a', name: 'Current Account', type: 'checking', balance: 100, currency: 'GBP', isActive: true },
      { id: 'acc-b', name: 'Savings', type: 'savings', balance: 100, currency: 'GBP', isActive: true },
      { id: 'acc-z', name: 'Old ISA', type: 'savings', balance: 0, currency: 'GBP', isActive: false },
    ],
    categories: [
      { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
      { id: 'sub-x', name: 'Bills', type: 'expense', level: 'sub', parentId: 'type-expense' },
      { id: 'det-x', name: 'Council Tax', type: 'expense', level: 'detail', parentId: 'sub-x' },
    ],
    getSubCategories: (parentId?: string) => [
      { id: 'sub-x', name: 'Bills', type: 'expense', level: 'sub', parentId: 'type-expense' },
    ].filter(c => c.parentId === parentId),
    getDetailCategories: (parentId?: string) => [
      { id: 'det-x', name: 'Council Tax', type: 'expense', level: 'detail', parentId: 'sub-x' },
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

vi.mock('../hooks/usePayeeMemory', () => ({
  usePayeeMemory: () => ({ propagateCategory: mocks.propagateCategory }),
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({ formatCurrency: (n: number) => `£${Math.abs(Number(n)).toFixed(2)}` }),
}));

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

const toggle = (): HTMLElement => screen.getByRole('button', { name: 'Transfer' });
const categoryBox = (): HTMLElement | null => screen.queryByRole('combobox', { name: 'Category' });
const accountBox = (): HTMLElement | null => screen.queryByRole('combobox', { name: 'Transfer to account' });

describe('The register row editor — the inline Transfer toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('swaps the category combobox for the account picker, and back', () => {
    render(<RowEditor transaction={row} onDismiss={vi.fn()} />);

    expect(categoryBox()).toBeInTheDocument();
    expect(accountBox()).not.toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle());
    expect(accountBox()).toBeInTheDocument();
    expect(categoryBox()).not.toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(toggle());
    expect(categoryBox()).toBeInTheDocument();
    expect(accountBox()).not.toBeInTheDocument();
  });

  it('never offers the row’s own account, nor a closed one', () => {
    render(<RowEditor transaction={row} onDismiss={vi.fn()} />);
    fireEvent.click(toggle());
    fireEvent.click(accountBox()!);

    expect(screen.getByRole('option', { name: /Savings/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Current Account/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Old ISA/ })).not.toBeInTheDocument();
  });

  it('remembers the category across flips — it is not cleared by toggling', () => {
    render(<RowEditor transaction={row} onDismiss={vi.fn()} />);

    // Change it to something the user chose, then flip away and back.
    fireEvent.click(categoryBox()!);
    fireEvent.click(screen.getByText('Council Tax'));
    fireEvent.click(toggle());
    fireEvent.click(toggle());

    expect(categoryBox()).toHaveTextContent('Council Tax');
  });

  it('saves the remembered category when the toggle is flipped back off', async () => {
    render(<RowEditor transaction={row} onDismiss={vi.fn()} />);

    fireEvent.click(toggle());
    fireEvent.click(accountBox()!);
    fireEvent.click(screen.getByRole('option', { name: /Savings/ }));
    // Changed their mind: back to categories, and save.
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.updateTransaction).toHaveBeenCalledTimes(1));
    const updates = mocks.updateTransaction.mock.calls[0][1] as Record<string, unknown>;
    expect(updates).toMatchObject({ category: 'det-x' });
    expect(mocks.createTransferCounterpart).not.toHaveBeenCalled();
  });

  it('refuses to save transfer mode with no account chosen', async () => {
    render(<RowEditor transaction={row} onDismiss={vi.fn()} />);

    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.showError).toHaveBeenCalled());
    // Nothing was written at all — not even the category underneath, which is
    // not what is on screen.
    expect(mocks.updateTransaction).not.toHaveBeenCalled();
  });

  describe('committing the transfer', () => {
    const chooseSavingsAndSave = (button = 'Save'): void => {
      render(<RowEditor transaction={row} onDismiss={vi.fn()} />);
      fireEvent.click(toggle());
      fireEvent.click(accountBox()!);
      fireEvent.click(screen.getByRole('option', { name: /Savings/ }));
      fireEvent.click(screen.getByRole('button', { name: button }));
    };

    it('asks in the STRIP, not in a dialog — the run is not interrupted', async () => {
      chooseSavingsAndSave();

      const prompt = await screen.findByRole('group', {
        name: 'Make this a transfer with Savings',
      });
      expect(prompt).toBeInTheDocument();
      // The row's own fields are still there, and nothing took the screen.
      expect(screen.getByRole('textbox', { name: 'Transaction description' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('lands the cursor on the recommended answer, so the run is one Enter', async () => {
      chooseSavingsAndSave();

      const create = await screen.findByRole('button', { name: 'Create the other side' });
      await waitFor(() => expect(document.activeElement).toBe(create));
    });

    it('saves the field edits without the category, then hands over', async () => {
      chooseSavingsAndSave();

      await waitFor(() => expect(mocks.updateTransaction).toHaveBeenCalledTimes(1));
      const updates = mocks.updateTransaction.mock.calls[0][1] as Record<string, unknown>;
      // The category is not written: this row is becoming a transfer, and its
      // category will be the account it faces.
      expect(updates).not.toHaveProperty('category');
      expect(updates).toMatchObject({ needsReview: false });
    });

    it('creates the other side when the answer is given', async () => {
      chooseSavingsAndSave();

      fireEvent.click(await screen.findByRole('button', { name: 'Create the other side' }));
      await waitFor(() => {
        expect(mocks.createTransferCounterpart).toHaveBeenCalledWith('src', 'acc-b');
      });
      expect(mocks.linkTransferPair).not.toHaveBeenCalled();
    });

    it('puts the editor back when the answer is cancelled, toggle and all', async () => {
      chooseSavingsAndSave();

      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(
          screen.queryByRole('group', { name: /Make this a transfer/ })
        ).not.toBeInTheDocument();
      });
      expect(mocks.createTransferCounterpart).not.toHaveBeenCalled();
      // Still in transfer mode with the account chosen, so it can be corrected
      // and saved again rather than re-entered from scratch.
      expect(accountBox()).toHaveTextContent('Savings');
    });
  });

  describe('the keyboard', () => {
    it('sits next to the picker in the cell, so Tab reaches it', () => {
      render(<RowEditor transaction={row} onDismiss={vi.fn()} />);

      const cell = document.querySelector('[data-quick-edit="category"]')!;
      // Inside the editor's own cell — so the register stands down for its keys
      // (isInsideQuickEdit) — and AFTER the picker in DOM order, which is Tab
      // order: type the category, Tab, press, without a detour.
      expect(cell.contains(toggle())).toBe(true);
      expect(
        cell.querySelector('[role="combobox"]')!
          .compareDocumentPosition(toggle()) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it('does not steal Enter’s save semantics', async () => {
      render(<RowEditor transaction={row} onDismiss={vi.fn()} />);

      // Enter on a button is the press, and the editor's own Enter handler
      // stands aside for anything inside one — so this toggles and does not
      // run the "accept and hand over to Save & Next" rhythm.
      fireEvent.keyDown(toggle(), { key: 'Enter' });
      fireEvent.click(toggle());

      expect(accountBox()).toBeInTheDocument();
      await waitFor(() => expect(mocks.updateTransaction).not.toHaveBeenCalled());
    });

    it('still answers Escape from the toggle itself', () => {
      const onDismiss = vi.fn();
      render(<RowEditor transaction={row} onDismiss={onDismiss} />);

      fireEvent.keyDown(toggle(), { key: 'Escape' });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Escape', () => {
    it('closes without writing, whatever the toggle is doing', () => {
      const onDismiss = vi.fn();
      render(<RowEditor transaction={row} onDismiss={onDismiss} />);

      fireEvent.click(toggle());
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Transaction description' }), {
        key: 'Escape',
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
      // Nothing was saved — and in particular nothing said the row had been
      // reviewed. Toggling is not reviewing; saving is (work-stream A's rule,
      // which this must compose with rather than quietly break).
      expect(mocks.updateTransaction).not.toHaveBeenCalled();
    });

    it('forgets the toggle when the editor moves to another row', () => {
      const { rerender } = render(<RowEditor transaction={row} onDismiss={vi.fn()} />);
      fireEvent.click(toggle());
      expect(accountBox()).toBeInTheDocument();

      // A Save & Next landing on the next row must not arrive offering to move
      // money the moment the user types.
      const next = { ...row, id: 'next', description: 'Something else' } as Transaction;
      rerender(<RowEditor transaction={next} onDismiss={vi.fn()} />);

      expect(categoryBox()).toBeInTheDocument();
      expect(accountBox()).not.toBeInTheDocument();
    });
  });
});
