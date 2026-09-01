/**
 * Payee cleanup — the one shot back after a rename.
 *
 * The owner ticked the wrong payees and pressed Rename selected…, which
 * rewrote 771 descriptions in ten seconds: "I realised straight away but it
 * was too late. I think we should offer the user a brief 'undo' after each
 * change. Basically just holding the changes of the last batch change in
 * memory in case the user messed up."
 *
 * What these hold the screen to is the difference between an undo and another
 * rename. A rename collapses many payees into ONE name; putting that back
 * means giving every row ITS OWN wording again, which is why the batch is a
 * list of rows and not a name. The rest is the house's rule for this kind of
 * undo (see FilterAndFileList): one batch, the last one, replaced by the next
 * press, gone once used, and whatever the ledger refused is counted and named
 * rather than left as a silent shortfall.
 *
 * Every payee, date and figure below is invented: this repo is public.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import PayeeCleanup from './PayeeCleanup';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { TransactionDescription } from '../../contexts/AppContextSupabase';
import type { Transaction } from '../../types';

const toast = vi.hoisted(() => ({
  showToast: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
  showInfo: vi.fn(),
  dismissToast: vi.fn(),
}));

vi.mock('../../contexts/ToastContext', () => ({ useToast: () => toast }));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) =>
      Number(amount) < 0
        ? `(£${Math.abs(Number(amount)).toFixed(2)})`
        : `£${Number(amount).toFixed(2)}`,
    displayCurrency: 'GBP',
    getCurrencySymbol: () => '£',
    convert: vi.fn(), convertAndFormat: vi.fn(), convertAndSum: vi.fn(),
  }),
}));

const txn = (over: Partial<Transaction> & { id: string; description: string }): Transaction => ({
  date: new Date('2026-03-01'),
  amount: -10,
  category: 'cat-1',
  accountId: 'acc-1',
  type: 'expense',
  ...over,
});

/**
 * Three references for one shop — and THREE DIFFERENT ONES, which is the whole
 * fixture. A batch whose rows all said the same thing to begin with could be
 * put back by a second rename, and would prove nothing.
 */
const FIRST = 'SPORTS DEPOT*7781';
const SECOND = 'SPORTS DEPOT 4412 LONDON';
const THIRD = 'SPRTS DEPOT ONLINE';
const NEW_NAME = 'Sports Depot';

const START: Transaction[] = [
  txn({ id: 't1', description: FIRST }),
  txn({ id: 't2', description: SECOND }),
  txn({ id: 't3', description: THIRD }),
  txn({ id: 't4', description: 'CORNER SHOP' }),
  txn({ id: 't5', description: 'GAS BILL 0099' }),
];

/**
 * The register these doubles keep, as the real context keeps it: both bulk
 * writes patch what is on screen, so the page under test sees the rows change
 * exactly as it would against a live store — and the assertions can ask what
 * every row NOW reads rather than only what was requested.
 */
let register: Transaction[] = [];

const setRegister = (next: Transaction[]): void => {
  register = next;
  __setAppContextValue({ transactions: register });
};

const descriptionOf = (id: string): string | undefined =>
  register.find(transaction => transaction.id === id)?.description;

/** Rows the ledger will refuse to write — how a partial failure is arranged. */
const refused = new Set<string>();

const renameTransactionDescriptions = vi.fn(
  async (ids: string[], description: string): Promise<number> => {
    const changing = new Set(ids);
    setRegister(register.map(transaction =>
      changing.has(transaction.id) ? { ...transaction, description } : transaction
    ));
    return ids.length;
  }
);

const restoreTransactionDescriptions = vi.fn(
  async (
    entries: ReadonlyArray<TransactionDescription>,
    onProgress?: (done: number) => void
  ): Promise<number> => {
    onProgress?.(entries.length);
    const landed = entries.filter(entry => !refused.has(entry.id));
    const byId = new Map(landed.map(entry => [entry.id, entry.description]));
    setRegister(register.map(transaction => {
      const description = byId.get(transaction.id);
      return description === undefined ? transaction : { ...transaction, description };
    }));
    return landed.length;
  }
);

const deleteTransaction = vi.fn(async () => ({ released: [], releaseFailures: [] }));

const tick = (description: string): void => {
  fireEvent.click(screen.getByLabelText(`Select ${description}`));
};

/** Tick nothing new — just press the button and go through the dialog. */
const renameTicked = async (name: string): Promise<void> => {
  fireEvent.click(screen.getByRole('button', { name: 'Rename selected…' }));
  const box = await screen.findByLabelText('New payee name');
  fireEvent.change(box, { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: /^Rename \d+ transaction/ }));
  await waitFor(() => {
    expect(screen.queryByLabelText('New payee name')).not.toBeInTheDocument();
  });
};

const undoButton = (): HTMLElement | null => screen.queryByRole('button', { name: 'Undo' });

const resultLine = (): HTMLElement => screen.getByRole('status');

beforeEach(() => {
  vi.clearAllMocks();
  refused.clear();
  setRegister(START.map(transaction => ({ ...transaction })));
  __setAppContextValue({
    renameTransactionDescriptions,
    restoreTransactionDescriptions,
    deleteTransaction,
  });
});

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('Payee cleanup — a rename can be taken back for this sitting', () => {
  it('says what the rename did, and offers exactly one way back', async () => {
    render(<PayeeCleanup />);

    tick(FIRST);
    tick(SECOND);
    tick(THIRD);
    await renameTicked(NEW_NAME);

    await waitFor(() => {
      expect(resultLine()).toHaveTextContent(`3 transactions now read “${NEW_NAME}”.`);
    });
    expect(undoButton()).toBeInTheDocument();
  });

  it('gives every row back ITS OWN payee, not one shared name', async () => {
    render(<PayeeCleanup />);

    tick(FIRST);
    tick(SECOND);
    tick(THIRD);
    await renameTicked(NEW_NAME);

    // The rename really did flatten all three into one name…
    expect(descriptionOf('t1')).toBe(NEW_NAME);
    expect(descriptionOf('t2')).toBe(NEW_NAME);
    expect(descriptionOf('t3')).toBe(NEW_NAME);

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => {
      expect(restoreTransactionDescriptions).toHaveBeenCalledTimes(1);
    });
    // …and the undo hands back three DIFFERENT strings, one per row, in
    // exactly the shape the write takes: an id and a description, nothing else.
    expect(restoreTransactionDescriptions.mock.calls[0][0]).toEqual([
      { id: 't1', description: FIRST },
      { id: 't2', description: SECOND },
      { id: 't3', description: THIRD },
    ]);
    // Which is what the register ends up holding.
    await waitFor(() => expect(descriptionOf('t1')).toBe(FIRST));
    expect(descriptionOf('t2')).toBe(SECOND);
    expect(descriptionOf('t3')).toBe(THIRD);
    // And nothing the rename never touched moved at all.
    expect(descriptionOf('t4')).toBe('CORNER SHOP');
    expect(descriptionOf('t5')).toBe('GAS BILL 0099');
  });

  it('holds the LAST batch only — a second rename replaces the first', async () => {
    render(<PayeeCleanup />);

    tick(FIRST);
    await renameTicked('Alpha');
    await waitFor(() => expect(descriptionOf('t1')).toBe('Alpha'));

    tick('CORNER SHOP');
    await renameTicked('Beta');
    await waitFor(() => expect(descriptionOf('t4')).toBe('Beta'));

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => {
      expect(restoreTransactionDescriptions).toHaveBeenCalledTimes(1);
    });
    // The second batch, and only the second: the first rename's row is not in
    // the entries and does not move.
    expect(restoreTransactionDescriptions.mock.calls[0][0]).toEqual([
      { id: 't4', description: 'CORNER SHOP' },
    ]);
    await waitFor(() => expect(descriptionOf('t4')).toBe('CORNER SHOP'));
    expect(descriptionOf('t1')).toBe('Alpha');
  });

  it('offers nothing more once the batch has been put back', async () => {
    render(<PayeeCleanup />);

    tick(FIRST);
    tick(SECOND);
    tick(THIRD);
    await renameTicked(NEW_NAME);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => {
      expect(resultLine()).toHaveTextContent('3 transactions are back to the payees they had.');
    });
    // One shot: the batch is spent, so there is no second press and no line
    // still claiming those rows read the new name.
    expect(undoButton()).not.toBeInTheDocument();
    expect(screen.queryByText(/now read/)).not.toBeInTheDocument();
  });

  it('counts the rows as they go back, and takes only one press to do it', async () => {
    let release: (() => void) | null = null;
    restoreTransactionDescriptions.mockImplementationOnce(async (entries, onProgress) => {
      onProgress?.(1);
      await new Promise<void>(resolve => { release = () => resolve(); });
      return entries.length;
    });
    render(<PayeeCleanup />);

    tick(FIRST);
    tick(SECOND);
    tick(THIRD);
    await renameTicked(NEW_NAME);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    // Hundreds of writes take time, and a screen that said nothing while they
    // went out would be a screen somebody presses again.
    await waitFor(() => {
      expect(screen.getByText('Putting back 1 of 3…')).toBeInTheDocument();
    });
    const button = screen.getByRole('button', { name: 'Undo' });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(restoreTransactionDescriptions).toHaveBeenCalledTimes(1);

    release?.();
    await waitFor(() => {
      expect(screen.queryByText(/Putting back/)).not.toBeInTheDocument();
    });
    expect(resultLine()).toHaveTextContent('3 transactions are back to the payees they had.');
  });

  it('says nothing at all until a rename has happened', () => {
    render(<PayeeCleanup />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(undoButton()).not.toBeInTheDocument();
    expect(screen.queryByText(/now read/)).not.toBeInTheDocument();
  });

  it('never deletes anything, in either direction', async () => {
    render(<PayeeCleanup />);

    tick(FIRST);
    tick(SECOND);
    tick(THIRD);
    await renameTicked(NEW_NAME);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(restoreTransactionDescriptions).toHaveBeenCalled());
    // A rename rewrites wording and an undo rewrites it back. Neither is ever
    // a removal — the register keeps every row it started with.
    expect(deleteTransaction).not.toHaveBeenCalled();
    expect(register).toHaveLength(START.length);
  });
});

describe('Payee cleanup — an undo the ledger would not take says what still reads what', () => {
  it('counts the rows that came back and names what the others still say', async () => {
    refused.add('t2');
    render(<PayeeCleanup />);

    tick(FIRST);
    tick(SECOND);
    tick(THIRD);
    await renameTicked(NEW_NAME);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => {
      expect(resultLine()).toHaveTextContent('2 transactions are back to the payees they had.');
    });
    // The consequence, in the words of what is actually on that row now.
    expect(resultLine()).toHaveTextContent(
      `1 could not be put back and still read “${NEW_NAME}”.`
    );
    // Which is the truth of it: the two that landed are back, the refused one
    // still carries the name the rename gave it.
    expect(descriptionOf('t1')).toBe(FIRST);
    expect(descriptionOf('t2')).toBe(NEW_NAME);
    expect(descriptionOf('t3')).toBe(THIRD);
    // Still one shot: a partial undo is a run that happened.
    expect(undoButton()).not.toBeInTheDocument();
  });
});
