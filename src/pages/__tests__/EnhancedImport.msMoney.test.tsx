import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { MsMoneyImportResult } from '../../services/import/msMoney/transform';
import type { ImportProgress } from '../../services/import/msMoney/msMoneyImport';

/**
 * The Microsoft Money migration, as the Import page executes it.
 *
 * THE MOST DESTRUCTIVE IMPORT IN THE APP — it wipes the store and writes a whole
 * .mny file over the top — and it had no test at all. So this suite was written
 * FIRST, against the page exactly as it stood while it still chose between two
 * engines with a Postgres client of its own, and run green against it. Only the
 * mock changed afterwards, from the engine to the one door the page now knocks
 * on, which is what makes it evidence that the routing changed nothing.
 *
 * What it pins now is what the page still owns: it hands the parsed file and
 * the progress channel to the seam, ONCE, without naming a store or an owner —
 * and lets the importer's own failure through to the dialog that renders it.
 *
 * Why the store is worth pinning rather than assuming: a migration routed to
 * the wrong one is not a wrong number on a screen. It is a person's entire
 * financial history written into a browser their signed-in app will never read
 * again, reported to them as a success. That decision now belongs to the seam,
 * which resolves its owner on the same tick as the write — and the two engines
 * are covered where they live (msMoneyImport.test, and the port's own suite).
 */

/** What the modal handed over, and what came back. */
const run: {
  result: MsMoneyImportResult;
  reports: ImportProgress[];
  outcome: Promise<void> | null;
} = { result: emptyMigration(), reports: [], outcome: null };

/** The modal, reduced to the one thing this page owns: the execute callback. */
vi.mock('../../components/MsMoneyImportModal', () => ({
  default: ({ isOpen, onExecute }: {
    isOpen: boolean;
    onExecute: (result: MsMoneyImportResult, onProgress: (p: ImportProgress) => void) => Promise<void>;
  }) => isOpen
    ? (
      <button
        type="button"
        onClick={() => {
          // Held rather than floated: the page's rejection is the modal's error
          // message, so the test has to be able to wait for it.
          run.outcome = onExecute(run.result, (progress) => run.reports.push(progress));
          run.outcome.catch(() => {});
        }}
      >
        run the migration
      </button>
    )
    : null,
}));

/** The seam. One door, whichever store is behind it. */
const seam = vi.hoisted(() => ({
  importMsMoney: vi.fn<
    (
      result: unknown,
      options?: { onProgress?: (p: { phase: string; fraction: number; message: string }) => void }
    ) => Promise<void>
  >(),
}));

vi.mock('../../services/port', () => ({ dataPort: seam }));

const { default: EnhancedImport } = await import('../EnhancedImport');

/**
 * A parsed .mny file, invented. The importer is what reads a real one; this is
 * only the payload the page routes, so it carries nothing that has to be true
 * of Money's own format.
 */
function emptyMigration(): MsMoneyImportResult {
  return {
    accounts: [],
    categories: [],
    transactions: [],
    transactionSplits: [],
    summary: {
      accounts: { total: 0, open: 0, closed: 0, investmentCashPairs: 0 },
      categories: { subs: 0, details: 0, hidden: 0 },
      transactions: { imported: 0, standalone: 0, transfers: 0, splitTransactions: 0, splitLines: 0 },
      simplifications: [],
    },
  };
}

const renderPage = () => render(
  <MemoryRouter initialEntries={['/enhanced-import']}>
    <EnhancedImport />
  </MemoryRouter>
);

/** Open the Money flow and execute it, exactly as the modal would. */
const runTheMigration = async (): Promise<void> => {
  fireEvent.click(screen.getByRole('button', { name: /Import from Microsoft Money/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'run the migration' }));
};

describe('EnhancedImport — where a Microsoft Money migration lands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    run.result = emptyMigration();
    run.reports = [];
    run.outcome = null;
    seam.importMsMoney.mockResolvedValue(undefined);
    __setAppContextValue({ isUsingSupabase: false });
  });

  afterEach(() => {
    __resetAppContextValue();
  });

  it('hands the parsed file to the seam once, and names no store to put it in', async () => {
    // The page used to answer "which store?" for itself, out of a Postgres
    // client and a boot-time flag. The absence of an owner in this call IS the
    // change: two arguments, the file and a way to report progress.
    renderPage();
    await runTheMigration();

    await waitFor(() => expect(seam.importMsMoney).toHaveBeenCalledTimes(1));
    const [result, options] = seam.importMsMoney.mock.calls[0];
    expect(result).toBe(run.result);
    expect(typeof options?.onProgress).toBe('function');
    expect(seam.importMsMoney.mock.calls[0]).toHaveLength(2);
  });

  it('does the same when nobody is signed in — the page no longer asks', async () => {
    // The same call, under the condition the page used to branch on. Kept as a
    // separate test rather than deleted with the branch: the point of the slice
    // is that this makes no difference here, and a test that says so is how
    // that stays true.
    __setAppContextValue({ isUsingSupabase: true });

    renderPage();
    await runTheMigration();

    await waitFor(() => expect(seam.importMsMoney).toHaveBeenCalledTimes(1));
    expect(seam.importMsMoney.mock.calls[0][0]).toBe(run.result);
  });

  it('passes the importer’s progress straight back to the dialog', async () => {
    seam.importMsMoney.mockImplementationOnce(async (
      _result: unknown,
      options?: { onProgress?: (p: ImportProgress) => void }
    ) => {
      options?.onProgress?.({ phase: 'transactions', fraction: 0.5, message: 'Writing your data…' });
    });

    renderPage();
    await runTheMigration();

    await waitFor(() => expect(run.reports).toHaveLength(1));
    expect(run.reports[0]).toEqual({
      phase: 'transactions',
      fraction: 0.5,
      message: 'Writing your data…',
    });
  });

  it('reports the importer’s own failure rather than swallowing it', async () => {
    // The modal renders whatever this rejects with, so the sentence has to
    // survive the page untouched — a total migration that stopped part-way is
    // the one time somebody needs the real message.
    seam.importMsMoney.mockRejectedValueOnce(new Error('quota exceeded'));

    renderPage();
    await runTheMigration();

    await waitFor(() => expect(run.outcome).not.toBeNull());
    await expect(run.outcome).rejects.toThrow('quota exceeded');
  });
});
