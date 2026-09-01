/**
 * Export Data — the page.
 *
 * Covers the three things that were wrong with it end to end: QIF and OFX
 * were fully written and tested but unreachable (the dropdown offered PDF and
 * CSV only); the preview counted the whole dataset while the file was
 * date-filtered; and templates threw away the period they had been saved with.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildBackupBundle } from '../../services/backupService';
import type { Account, Category, Transaction } from '../../types';

const accounts: Account[] = [
  {
    id: 'acc-1',
    name: 'Everyday Account',
    type: 'current',
    balance: 250,
    currency: 'GBP',
    lastUpdated: new Date('2025-03-01')
  },
  {
    id: 'acc-2',
    name: 'Dormant Savings',
    type: 'savings',
    balance: 1000,
    currency: 'GBP',
    lastUpdated: new Date('2025-03-01')
  }
];

const categories: Category[] = [
  { id: 'cat-spending', name: 'Spending', type: 'expense', level: 'sub' },
  { id: 'cat-food', name: 'Food', type: 'expense', level: 'detail', parentId: 'cat-spending' }
];

const thisMonth = (day: number): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), day);
};

const transactions: Transaction[] = [
  {
    id: 'tx-old',
    // Comfortably outside every period except All time.
    date: new Date(2019, 5, 1),
    amount: -99,
    description: 'Ancient history',
    category: 'cat-food',
    accountId: 'acc-1',
    type: 'expense'
  },
  {
    id: 'tx-1',
    date: thisMonth(1),
    amount: -10,
    description: 'Corner shop',
    category: 'cat-food',
    accountId: 'acc-1',
    type: 'expense'
  },
  {
    id: 'tx-2',
    date: thisMonth(2),
    amount: -20,
    description: 'Market',
    category: 'cat-food',
    accountId: 'acc-1',
    type: 'expense'
  }
];

const downloads: Array<{ filename: string; text: string }> = [];

/**
 * The app context, mocked from the TEST file's own scope.
 *
 * Every module under src/ is re-imported per test (see beforeEach), and the
 * shared mock's stored value is re-created with it — so a value set through
 * that module would belong to a different copy from the one the page reads.
 * This object is not part of the graph being reset, so it cannot drift.
 */
const appValue = {
  accounts,
  transactions,
  transactionSplits: [],
  categories,
  budgets: [],
  // The seam's capability descriptor, as a device answers it. This page reads
  // exactly one field of it, for one sentence of copy on the full-backup card;
  // it is here because the page would throw without it, not because anything
  // below asserts on it.
  capabilities: {
    edition: 'device' as const,
    session: 'anonymous' as const,
    realtime: false,
    maxConcurrentWrites: 1,
    backupTarget: 'device' as const
  }
};

vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: () => appValue
}));

/**
 * The seam, mocked as ONE door.
 *
 * These assertions were first written against the page as it stood — reading
 * `DataService.getUserIds()`, branching on the database id, and calling one of
 * two collectors itself — and run green there. Only the mock changed: which
 * store a backup is read out of is the seam's business now, and it is pinned
 * where that decision lives (dataService.test.ts, "which store the backup comes
 * from"). What this file still owns is the FILE: that what the seam handed back
 * is what landed on disk, and that a refusal is shown rather than swallowed.
 */
const seam = vi.hoisted(() => ({ collectBackup: vi.fn() }));

vi.mock('../../services/port', () => ({ dataPort: seam }));

describe('Export Data page', () => {
  // Every module under src/ is re-imported per test (see beforeEach), so the
  // providers have to come from the SAME graph as the page — a React context
  // from an older copy of the module is a different context object.
  let ExportManager: typeof import('../ExportManager').default;
  let PreferencesProvider: typeof import('../../contexts/PreferencesContext').PreferencesProvider;
  let ToastProvider: typeof import('../../contexts/ToastContext').ToastProvider;

  const renderPage = () =>
    render(
      <MemoryRouter>
        <PreferencesProvider>
          <ToastProvider>
            <ExportManager />
          </ToastProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );

  beforeEach(async () => {
    localStorage.clear();
    downloads.length = 0;
    appValue.capabilities = {
      edition: 'device',
      session: 'anonymous',
      realtime: false,
      maxConcurrentWrites: 1,
      backupTarget: 'device'
    };
    seam.collectBackup.mockReset();

    // A fresh module graph per test, so each one gets the exportService
    // singleton a newly-opened browser would get: it caches its templates in
    // memory, and clearing localStorage alone would leave that cache behind.
    vi.resetModules();
    ({ PreferencesProvider } = await import('../../contexts/PreferencesContext'));
    ({ ToastProvider } = await import('../../contexts/ToastContext'));
    ({ default: ExportManager } = await import('../ExportManager'));

    // Capture whatever would have been written to disk. jsdom's Blob cannot be
    // read back, so the text is recorded as it is handed over.
    vi.stubGlobal('Blob', vi.fn((parts: unknown[]) => {
      downloads.push({ filename: '', text: String(parts[0]) });
      return { type: 'text/plain' };
    }));
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      const last = downloads[downloads.length - 1];
      if (last) last.filename = this.getAttribute('download') ?? '';
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const chooseFormat = (value: string): void => {
    fireEvent.change(screen.getByLabelText('Format'), { target: { value } });
  };

  describe('formats', () => {
    /**
     * exportToQIF and exportToOFX were written, correct and covered by nine
     * passing tests — and reachable from nowhere in the UI.
     */
    it('offers QIF and OFX, not just PDF and CSV', () => {
      renderPage();
      const select = screen.getByLabelText('Format');
      const values = Array.from(select.querySelectorAll('option')).map(option => option.getAttribute('value'));

      expect(values).toEqual(['pdf', 'csv', 'qif', 'ofx']);
    });

    it('writes a QIF the sign-preserving writer produced, through the same filtered data', async () => {
      renderPage();
      chooseFormat('qif');
      fireEvent.click(screen.getByRole('button', { name: /Export Now/i }));

      await waitFor(() => expect(downloads).toHaveLength(1));

      const { filename, text } = downloads[0];
      expect(filename).toMatch(/\.qif$/);
      expect(text).toContain('!Account');
      expect(text).toContain('NEveryday Account');
      // Amounts stay signed, and the category is a NAME.
      expect(text).toMatch(/^T-10\.00$/m);
      expect(text).toMatch(/^LSpending:Food$/m);
      // Out of period, so not in the file.
      expect(text).not.toContain('Ancient history');
      // An account with nothing in the period is not named: importing this
      // file elsewhere must not create empty accounts.
      expect(text).not.toContain('Dormant Savings');
    });

    it('writes an OFX statement', async () => {
      renderPage();
      chooseFormat('ofx');
      fireEvent.click(screen.getByRole('button', { name: /Export Now/i }));

      await waitFor(() => expect(downloads).toHaveLength(1));

      const { filename, text } = downloads[0];
      expect(filename).toMatch(/\.ofx$/);
      expect(text).toContain('<OFX>');
      expect(text).toContain('<CURDEF>GBP');
      expect(text).toContain('<TRNAMT>-10');
    });

    /**
     * A CSV holds exactly one table. Stapling accounts below transactions with
     * a second header row would produce a file no spreadsheet can read, so each
     * ticked section is written as its own well-formed file.
     */
    it('writes one CSV per ticked section', async () => {
      renderPage();
      chooseFormat('csv');
      fireEvent.click(screen.getByRole('button', { name: /Export Now/i }));

      await waitFor(() => expect(downloads).toHaveLength(2));

      expect(downloads[0].filename).toMatch(/-transactions\.csv$/);
      expect(downloads[1].filename).toMatch(/-accounts\.csv$/);
      // Category names, not ids, and every field quoted.
      expect(downloads[0].text).toContain('"Spending : Food"');
      expect(downloads[0].text).not.toContain('cat-food');
    });

    it('writes only the ticked section', async () => {
      renderPage();
      chooseFormat('csv');
      fireEvent.click(screen.getByRole('switch', { name: 'Accounts' }));
      fireEvent.click(screen.getByRole('button', { name: /Export Now/i }));

      await waitFor(() => expect(downloads).toHaveLength(1));
      expect(downloads[0].filename).toMatch(/-transactions\.csv$/);
    });
  });

  describe('preview', () => {
    /**
     * The panel used to count the whole dataset while the export was
     * date-filtered, so the two disagreed by design. Both now read one
     * selection.
     */
    it('counts the rows that will be in the file, not the whole dataset', async () => {
      renderPage();

      // Default period is this month: two of the three transactions.
      expect(screen.getByTestId('preview-transaction-count')).toHaveTextContent('2');

      chooseFormat('csv');
      fireEvent.click(screen.getByRole('button', { name: /Export Now/i }));
      await waitFor(() => expect(downloads.length).toBeGreaterThan(0));

      const bodyLines = downloads[0].text.split('\n').slice(1);
      expect(bodyLines).toHaveLength(2);
    });

    it('follows the period control', () => {
      renderPage();
      expect(screen.getByTestId('preview-transaction-count')).toHaveTextContent('2');

      fireEvent.click(screen.getByRole('button', { name: 'All time' }));
      expect(screen.getByTestId('preview-transaction-count')).toHaveTextContent('3');
    });

    it('has nothing to write when nothing is ticked', () => {
      renderPage();
      fireEvent.click(screen.getByRole('switch', { name: 'Transactions' }));
      fireEvent.click(screen.getByRole('switch', { name: 'Accounts' }));

      expect(screen.getByRole('button', { name: /Export Now/i })).toBeDisabled();
      expect(screen.getByText(/there is no file to write/i)).toBeInTheDocument();
    });
  });

  describe('checkbox honesty', () => {
    it('offers only the sections it can actually export', () => {
      renderPage();

      expect(screen.getByRole('switch', { name: 'Transactions' })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Accounts' })).toBeInTheDocument();
      // Investments were passed as a hard-coded empty array, budgets were
      // never passed at all, and Charts printed a placeholder sentence.
      expect(screen.queryByRole('switch', { name: 'Investments' })).not.toBeInTheDocument();
      expect(screen.queryByRole('switch', { name: 'Budgets' })).not.toBeInTheDocument();
      expect(screen.queryByRole('switch', { name: 'Charts' })).not.toBeInTheDocument();
    });

    it('has no History tab promising a feature that records nothing', () => {
      renderPage();
      expect(screen.queryByRole('button', { name: /History/i })).not.toBeInTheDocument();
    });
  });

  /**
   * THE WEB EDITION KEEPS EXCEL — the other half of the owner's ruling of
   * 1 September 2026, and the half nothing else in this repository watches.
   *
   * *"Lose excel is fine as long as they can keep csv"* was a ruling about the
   * DESKTOP edition. Every guard behind it — the bundle grep, the import walk,
   * the size ratchet, the mount test — asserts an ABSENCE in a window, and all
   * four would go on passing if the format had been removed from the product
   * altogether. This suite runs with `@spreadsheet` at its cloud half, which is
   * what a browser resolves, so this is where "and the web page is exactly as it
   * was" is a check rather than an intention.
   */
  describe('the Excel exporter, in the edition that has one', () => {
    it('offers the Excel Export button, and says so in the page copy', () => {
      renderPage();

      expect(screen.getByRole('button', { name: /Excel Export/i })).toBeInTheDocument();
      expect(screen.getByText(/Generate reports, export to Excel/i)).toBeInTheDocument();
    });

    it('leaves the CSV option worded as it always was', () => {
      // The desktop edition appends "— opens in Excel" here, because it has no
      // Excel button to explain itself with. A browser has one, so the label is
      // untouched — asserted exactly, so that a future edit to the desktop's
      // wording cannot leak into the web's by being written in the wrong place.
      renderPage();
      const csv = screen.getByRole('option', { name: 'CSV spreadsheet' });

      expect(csv).toBeInTheDocument();
      expect(csv.textContent).toBe('CSV spreadsheet');
    });
  });

  /**
   * The full backup — the only export that can be restored, and the only one
   * that reads whole rows out of the store rather than the app's React state.
   */
  describe('the full backup', () => {
    const bundle = buildBackupBundle({
      sourceUserId: 'source-login',
      exportedAt: '2026-03-04T10:00:00.000Z',
      data: {
        accounts: [{ id: 'acct-1', name: 'Everyday', type: 'current', balance: '10.00' }],
        transactions: [
          { id: 'txn-1', account_id: 'acct-1', amount: '-10.00', date: '2026-02-01', description: 'Shop' }
        ]
      },
      preferences: null
    });

    const download = (): void => {
      fireEvent.click(screen.getByRole('button', { name: /Download full backup/i }));
    };

    it('writes the file the seam handed back, named for the day it was taken', async () => {
      seam.collectBackup.mockResolvedValue(bundle);
      renderPage();
      download();

      await waitFor(() => expect(downloads).toHaveLength(1));
      expect(downloads[0].filename).toBe('wealthtracker-backup-2026-03-04.json');
      expect(JSON.parse(downloads[0].text)).toEqual(JSON.parse(JSON.stringify(bundle)));
    });

    it('asks the seam once, and gives it somewhere to report progress', async () => {
      // A real dataset is 50k+ rows and 50+ round trips. The page has to hand
      // over a reporter or the button sits silent long enough to look broken.
      seam.collectBackup.mockImplementation(async (options: { onProgress?: (p: unknown) => void }) => {
        options.onProgress?.({
          entity: 'transaction_splits',
          entityNumber: 4,
          entityCount: 14,
          rows: 1234
        });
        return bundle;
      });
      renderPage();
      download();

      await waitFor(() => expect(downloads).toHaveLength(1));
      expect(seam.collectBackup).toHaveBeenCalledTimes(1);
      const [options] = seam.collectBackup.mock.calls[0];
      expect(typeof options.onProgress).toBe('function');
      // No owner, ever: the page does not know whose data this is, which is the
      // whole point of the operation living behind the seam.
      expect(Object.keys(options)).toEqual(['onProgress']);
    });

    it('says what the store said and writes no file when the read fails', async () => {
      seam.collectBackup.mockRejectedValue(new Error('Could not read transactions for the backup: timeout'));
      renderPage();
      download();

      await screen.findByText(/The backup stopped and no file was written/i);
      expect(screen.getByText(/Could not read transactions for the backup: timeout/)).toBeInTheDocument();
      expect(downloads).toHaveLength(0);
    });

    it('shows the seam\'s refusal rather than writing a file made of the wrong data', async () => {
      // This page used to make this judgement itself, from a database id it had
      // asked for. The sentence is now the seam's, and it is REACHED — a
      // refusal that never reached the screen would leave the button looking
      // like it had done nothing.
      seam.collectBackup.mockRejectedValue(new Error(
        'This session has no database identity yet, so there is nothing to read. Reload the page and try again.'
      ));
      renderPage();
      download();

      await screen.findByText(/no database identity yet/i);
      expect(downloads).toHaveLength(0);
    });
  });

  describe('templates', () => {
    const openTemplates = (): void => {
      fireEvent.click(screen.getByRole('button', { name: /Templates \(/i }));
    };

    it('applies everything a template was saved with, period included', () => {
      renderPage();

      // Save an OFX / last-month / transactions-only export.
      fireEvent.click(screen.getByRole('button', { name: 'Last month' }));
      chooseFormat('ofx');
      vi.spyOn(window, 'prompt')
        .mockReturnValueOnce('Last month as OFX')
        .mockReturnValueOnce('');
      fireEvent.click(screen.getByRole('button', { name: /Save as Template/i }));

      // Move everything away from what was saved.
      fireEvent.click(screen.getByRole('button', { name: 'All time' }));
      chooseFormat('pdf');

      openTemplates();
      fireEvent.click(screen.getByRole('button', { name: 'Use template Last month as OFX' }));

      expect(screen.getByLabelText('Format')).toHaveValue('ofx');
      expect(screen.getByRole('button', { name: 'Last month' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('says what period a template will use, as a rule', () => {
      renderPage();
      openTemplates();

      expect(screen.getByText('Monthly Summary')).toBeInTheDocument();
      // A rule ("This month"), not the dates of the month it was saved in.
      // The label and the value are separate text nodes, hence the matcher.
      const periods = screen.getAllByText(
        (_text, element) => element?.textContent === 'Period: This month'
      );
      expect(periods).toHaveLength(2);
    });

    /**
     * The starters were undeletable: the delete button was disabled for
     * anything flagged isDefault, and deleting everything else brought them
     * back because an empty store was read as a new one.
     */
    it('deletes a starter template, and does not bring it back', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderPage();
      openTemplates();

      const deleteButton = screen.getByRole('button', { name: 'Delete template Monthly Summary' });
      expect(deleteButton).not.toBeDisabled();
      fireEvent.click(deleteButton);

      expect(screen.queryByText('Monthly Summary')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Delete template Transaction Report' }));
      expect(screen.getByText('No templates')).toBeInTheDocument();
    });
  });

  /**
   * Password-protecting the backup.
   *
   * Two claims worth a test. The first is cryptographic: what lands on disk
   * must not contain the account names and balances that went in. The second
   * is Claude Design's ruling of 15 August — the "not encrypted" warning is a
   * WARNING rather than a caveat, which is why it keeps the amber pair, and
   * why it must be ABSENT when it is no longer true. Amber that cannot be
   * absent stops meaning anything.
   */
  describe('protecting the full backup with a password', () => {
    const bundle = buildBackupBundle({
      sourceUserId: 'source-login',
      exportedAt: '2026-03-04T10:00:00.000Z',
      data: {
        accounts: [{ id: 'acct-1', name: 'Everyday', type: 'current', balance: '10.00' }]
      },
      preferences: null
    });

    const tick = (): void =>
      fireEvent.click(screen.getByLabelText(/Protect this backup with a password/i));

    const typeBoth = (value: string): void => {
      fireEvent.change(screen.getByLabelText('Password'), { target: { value } });
      fireEvent.change(screen.getByLabelText('Password again'), { target: { value } });
    };

    it('warns that the file is readable, and stops warning once it is not', async () => {
      renderPage();

      expect(screen.getByText(/not encrypted/i)).toBeInTheDocument();

      tick();

      // The statement has become false, so it goes. What replaces it is the
      // consequence of the choice just made, which is a different warning.
      expect(screen.queryByText(/not encrypted/i)).not.toBeInTheDocument();
      expect(screen.getByText(/cannot be opened/i)).toBeInTheDocument();
    });

    it('will not export until the two passwords agree', async () => {
      renderPage();
      tick();

      const button = screen.getByRole('button', { name: /Download protected backup/i });
      expect(button).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough' } });
      fireEvent.change(screen.getByLabelText('Password again'), { target: { value: 'different!' } });
      expect(button).toBeDisabled();
      expect(screen.getByText(/do not match/i)).toBeInTheDocument();

      typeBoth('longenough');
      expect(button).toBeEnabled();
    });

    it('says why a short password is refused rather than just going dead', async () => {
      renderPage();
      tick();
      typeBoth('short');

      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Download protected backup/i })).toBeDisabled();
    });

    it('writes a file with nothing readable in it', async () => {
      seam.collectBackup.mockResolvedValue(bundle);
      renderPage();
      tick();
      typeBoth('a good long password');

      fireEvent.click(screen.getByRole('button', { name: /Download protected backup/i }));

      await waitFor(() => expect(downloads.length).toBe(1));
      const written = downloads[0].text;

      // The whole point, checked on the actual bytes that reach the disk.
      expect(written).not.toContain('Everyday');
      expect(written).not.toContain('10.00');
      expect(written).not.toContain('acct-1');
      // And it still says what it is, so a reader is not left guessing.
      expect(written).toContain('wealthtracker-encrypted-backup');
      expect(written).toContain('PBKDF2');
    });

    it('leaves the plain path exactly as it was', async () => {
      seam.collectBackup.mockResolvedValue(bundle);
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: /Download full backup/i }));

      await waitFor(() => expect(downloads.length).toBe(1));
      expect(downloads[0].text).toContain('Everyday');
    });
  });

});
