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
  isUsingSupabase: false
};

vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: () => appValue
}));

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
});
