/**
 * THE OWNER'S WALK THROUGH THE CSV WIZARD, as a test.
 *
 * He reported it as "pretty much useless": the Upload step showed forty bank
 * buttons and, as far as he could see, no file picker; he chose MBNA, pressed
 * Next, and arrived at Column Mapping with no file, where "+ Add Mapping" made
 * empty dropdown pairs referring to nothing; Preview showed an empty table; and
 * Import was offered over zero rows.
 *
 * Every step of that walk is pinned here. What separates this file from
 * CSVImportWizard.test.tsx is that NOTHING ABOUT READING A FILE IS MOCKED: the
 * real EnhancedCsvImportService parses a real (invented) CSV, suggests the
 * mappings, builds the rows and reports the failures. Only the two things that
 * cannot be real in a test are doubles — the app context, and the write.
 *
 * Every payee, figure and account name below is invented.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CSVImportWizard from './CSVImportWizard';
import { enhancedCsvImportService } from '../services/enhancedCsvImportService';
import { dataPort } from '../services/port';

const mockRefresh = vi.fn().mockResolvedValue(undefined);

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    accounts: [
      { id: 'acc-1', name: 'Everyday Current', type: 'checking', currency: 'GBP' },
      { id: 'acc-2', name: 'Rainy Day Savings', type: 'savings', currency: 'GBP' }
    ],
    transactions: [],
    categories: [],
    refreshAccountsAndTransactions: mockRefresh
  })
}));

/**
 * THE WRITE, and only the write.
 *
 * Which store answers is the seam's business, tested where that decision lives.
 * What matters here is that the wizard goes through the seam's BULK import — the
 * one operation that stamps `needsReview: true` on every row it writes,
 * whatever the draft says — and not through per-row creates, which are born
 * reviewed because they are a person typing.
 */
vi.mock('../services/port', () => ({
  dataPort: {
    importTransactions: vi.fn(),
    createTransaction: vi.fn()
  }
}));

/**
 * A statement in the shape most UK banks ship: separate money-out and money-in
 * columns, a running balance, and no column anywhere naming the account.
 *
 * Row 4 carries a date nothing can read and row 5 a zero pair — both are rows
 * the import must refuse, and refuse OUT LOUD.
 */
const STATEMENT_CSV = [
  'Date,Description,Paid out,Paid in,Balance',
  '2025-06-01,ORCHARD LANE CAFE,4.20,,995.80',
  '2025-06-02,SALARY MERIDIAN LTD,,1200.00,2195.80',
  '2025-06-03,BLUEBIRD GARAGE,52.40,,2143.40',
  'not-a-date,MYSTERY LINE,10.00,,2133.40',
  '2025-06-05,ZERO LINE,0.00,,2133.40'
].join('\n');

const statementFile = (name = 'statement.csv'): File =>
  new File([STATEMENT_CSV], name, { type: 'text/csv' });

describe("the CSV wizard, walked as its owner walked it", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    // The service is a module singleton holding its profiles in memory; clearing
    // storage alone would leave the previous test's profiles on it.
    for (const profile of enhancedCsvImportService.getProfiles()) {
      enhancedCsvImportService.deleteProfile(profile.id);
    }
    vi.mocked(dataPort.importTransactions).mockImplementation(async (_accountId, rows) => ({
      inserted: rows.length,
      alreadyPresent: 0,
      total: rows.length,
      complete: true
    }));
  });

  const openWizard = () =>
    render(<CSVImportWizard isOpen onClose={vi.fn()} />);

  const forwardButton = (): HTMLElement =>
    screen.getByRole('button', { name: /^(Next|Import)/ });

  const uploadStatement = async (file = statementFile()): Promise<void> => {
    await userEvent.upload(screen.getByLabelText(/select file/i), file);
    await waitFor(() => {
      expect(screen.getByText('Column Mapping')).toBeInTheDocument();
    });
  };

  const chooseDestination = async (name = 'Everyday Current'): Promise<void> => {
    fireEvent.click(screen.getByRole('combobox', { name: 'Import these transactions into' }));
    fireEvent.click(await screen.findByRole('option', { name: new RegExp(name) }));
  };

  const openTemplates = async (): Promise<void> => {
    await userEvent.click(screen.getByRole('button', { name: /know your bank/i }));
  };

  // ── 1. The file is the thing being asked for ──────────────────────────────

  describe('the Upload step leads with the file', () => {
    it('shows the picker without scrolling past anything', () => {
      openWizard();

      expect(screen.getByText('Choose your CSV file')).toBeInTheDocument();
      expect(screen.getByLabelText(/select file/i)).toBeInTheDocument();
      // The forty buttons that used to push it off the top are behind a
      // disclosure, closed.
      expect(screen.queryByText('Barclays')).not.toBeInTheDocument();
    });

    it('refuses to go on without a file, and says why', () => {
      openWizard();

      expect(forwardButton()).toBeDisabled();
      expect(
        screen.getByText(/Choose a CSV file to continue — a bank format on its own has nothing to read/)
      ).toBeInTheDocument();
    });

    /**
     * THE EXACT STEP THAT BROKE. Choosing a bank used to call setCurrentStep,
     * so the wizard walked to a Column Mapping step with no headings to map.
     */
    it('does not advance when a bank format is chosen with no file', async () => {
      openWizard();
      await openTemplates();

      await userEvent.click(screen.getByText('Lloyds Bank'));

      expect(screen.getByText('Choose your CSV file')).toBeInTheDocument();
      expect(screen.queryByText('Column Mapping')).not.toBeInTheDocument();
      expect(forwardButton()).toBeDisabled();
    });

    /**
     * MBNA was the format he chose. There is no MBNA template, and there never
     * was one behind that button — it looked up an id that did not exist and
     * quietly applied an empty mapping. The list is the registry now, so a
     * button that cannot deliver cannot be drawn; the search says so plainly
     * and names what happens instead.
     */
    it('says plainly when a bank is not in the list, and what happens then', async () => {
      openWizard();
      await openTemplates();

      await userEvent.type(screen.getByLabelText(/search \d+ bank formats/i), 'MBNA');

      expect(
        screen.getByText(/No format here matches “MBNA”\. You don't need one/)
      ).toBeInTheDocument();
      expect(screen.getByText(/reads the column headings out of your file/)).toBeInTheDocument();
    });

    it('refuses a file that is not a CSV instead of ignoring the drop', () => {
      openWizard();
      const dropZone = screen.getByText(/drag and drop your csv file/i).closest('div');

      fireEvent.drop(dropZone as HTMLElement, {
        dataTransfer: { files: [new File(['%PDF-1.4'], 'statement.pdf', { type: 'application/pdf' })] }
      });

      expect(screen.getByRole('alert')).toHaveTextContent(
        /statement\.pdf is not a \.csv file, so it has not been read/
      );
      expect(screen.queryByText('Column Mapping')).not.toBeInTheDocument();
    });

    it('refuses a file with headings and no transactions under them', async () => {
      openWizard();

      await userEvent.upload(
        screen.getByLabelText(/select file/i),
        new File(['Date,Description,Amount'], 'empty.csv', { type: 'text/csv' })
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          /empty\.csv has column headings but no transactions under them/
        );
      });
      expect(screen.queryByText('Column Mapping')).not.toBeInTheDocument();
    });
  });

  // ── 2. The mapping step reads the file ────────────────────────────────────

  describe('the Mapping step reads the file it was given', () => {
    it('offers the file’s own headings, and auto-detects the obvious ones', async () => {
      openWizard();
      await uploadStatement();

      const firstColumn = screen.getByRole('combobox', { name: 'CSV column for mapping 1' });
      expect(
        within(firstColumn).getAllByRole('option').map(option => option.textContent)
      ).toEqual(['Select CSV column...', 'Date', 'Description', 'Paid out', 'Paid in', 'Balance']);

      // Auto-detect took the date, the payee and BOTH halves of the two-column
      // format — the credit half used to be dropped, so every wage and refund
      // in a UK statement came through with no usable amount.
      expect(
        screen.getAllByRole('combobox', { name: /CSV column for mapping/ }).map(
          select => (select as HTMLSelectElement).value
        )
      ).toEqual(['Date', 'Description', 'Paid out', 'Paid in']);
    });

    it('shows real values from the file beside each mapped column', async () => {
      openWizard();
      await uploadStatement();

      expect(screen.getByText(/e\.g\. ORCHARD LANE CAFE · SALARY MERIDIAN LTD · BLUEBIRD GARAGE/))
        .toBeInTheDocument();
      expect(screen.getByText(/e\.g\. 4\.20 · 52\.40 · 10\.00/)).toBeInTheDocument();
    });

    it('will not go on until it knows where the rows go', async () => {
      openWizard();
      await uploadStatement();

      expect(forwardButton()).toBeDisabled();
      expect(
        screen.getByText(/Choose the account these transactions belong to — this file does not name one/)
      ).toBeInTheDocument();

      await chooseDestination();

      expect(forwardButton()).toBeEnabled();
    });

    it('will not go on while a field an import cannot do without is unmapped', async () => {
      openWizard();
      await uploadStatement();
      await chooseDestination();

      // Remove the date mapping, as somebody correcting a wrong guess might.
      await userEvent.click(screen.getByRole('button', { name: 'Remove mapping 1' }));

      expect(forwardButton()).toBeDisabled();
      expect(screen.getByText(/Still needed: a date column/)).toBeInTheDocument();
      expect(
        screen.getByText(/without one, no row can be placed on a statement/)
      ).toBeInTheDocument();
    });

    /**
     * "+ Add Mapping" produced an empty pair of dropdowns referring to nothing,
     * and — because the gate only counted mappings — that empty pair was enough
     * to enable Next.
     */
    it('an added blank mapping cannot open the gate on its own', async () => {
      openWizard();
      await uploadStatement();
      await chooseDestination();
      await userEvent.click(screen.getByRole('button', { name: 'Remove mapping 1' }));

      await userEvent.click(screen.getByText('+ Add Mapping'));

      expect(forwardButton()).toBeDisabled();
      expect(screen.getByText(/Still needed: a date column/)).toBeInTheDocument();
    });
  });

  // ── 3. Templates are a prefill, and say what they managed ─────────────────

  describe('a bank template applied to a real file', () => {
    it('fills the columns it finds and NAMES the ones it does not', async () => {
      openWizard();
      await openTemplates();
      // Lloyds names Transaction Date / Transaction Description / Debit Amount /
      // Credit Amount / Balance. This file has none of those spellings.
      await userEvent.click(screen.getByText('Lloyds Bank'));
      await uploadStatement();

      expect(
        screen.getByText(/names no column this file has, so nothing was taken from it/)
      ).toBeInTheDocument();
      // And it fell back to reading the file rather than leaving the step empty.
      expect(
        screen.getAllByRole('combobox', { name: /CSV column for mapping/ }).map(
          select => (select as HTMLSelectElement).value
        )
      ).toEqual(['Date', 'Description', 'Paid out', 'Paid in']);
    });

    it('reports the columns a partly-matching template could not find', async () => {
      openWizard();
      await openTemplates();
      // Nationwide's spellings ARE this file's, apart from its category column.
      await userEvent.click(screen.getByText('Nationwide Building Society'));
      await uploadStatement();

      expect(screen.getByText(/filled in 4 columns/)).toBeInTheDocument();
      expect(screen.getByText(/Not found in your file: Transaction type/)).toBeInTheDocument();
      // A running balance is not imported at all, and that is said too, rather
      // than shown as a mapping that quietly writes nothing.
      expect(screen.getByText(/Not imported by this app: Balance/)).toBeInTheDocument();
    });
  });

  // ── 4. The preview tells the truth about the whole file ───────────────────

  describe('the Preview step', () => {
    const reachPreview = async (): Promise<void> => {
      openWizard();
      await uploadStatement();
      await chooseDestination();
      await userEvent.click(forwardButton());
      await waitFor(() => {
        expect(screen.getByText('Preview Import')).toBeInTheDocument();
      });
    };

    it('shows the rows as they will be written, both directions of them', async () => {
      await reachPreview();

      const cafe = screen.getByText('ORCHARD LANE CAFE').closest('tr');
      expect(cafe).toHaveTextContent('-£4.20');
      expect(cafe).toHaveTextContent('expense');

      const salary = screen.getByText('SALARY MERIDIAN LTD').closest('tr');
      expect(salary).toHaveTextContent('£1,200.00');
      expect(salary).toHaveTextContent('income');
    });

    it('counts the rows it cannot read over the whole file, and names each reason', async () => {
      await reachPreview();

      expect(screen.getByText(/3 of 5 rows/)).toBeInTheDocument();
      expect(screen.getByText(/1 row skipped — Unreadable date: "not-a-date"/)).toBeInTheDocument();
      expect(
        screen.getByText(/1 row skipped — No non-zero amount found in the debit\/credit columns/)
      ).toBeInTheDocument();
      // The line numbers, so the row can be found in the file itself.
      expect(screen.getByText(/\(line 5\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(line 6\)/)).toBeInTheDocument();
    });

    it('refuses to offer Import when no row of the file can be read', async () => {
      openWizard();
      await uploadStatement();
      await chooseDestination();
      // Point the amount columns at the balance column's neighbour and the
      // date at nothing: every row becomes unreadable.
      const dateSelect = screen.getByRole('combobox', { name: 'CSV column for mapping 1' });
      fireEvent.change(dateSelect, { target: { value: 'Description' } });

      await userEvent.click(forwardButton());
      await waitFor(() => {
        expect(screen.getByText('Preview Import')).toBeInTheDocument();
      });

      expect(screen.getByText(/None of this file's 5 rows can be imported/)).toBeInTheDocument();
      expect(forwardButton()).toBeDisabled();
      expect(
        screen.getByText(/There is nothing to import — no row in this file can be read/)
      ).toBeInTheDocument();
      expect(dataPort.importTransactions).not.toHaveBeenCalled();
    });
  });

  // ── 5. The import writes honestly ─────────────────────────────────────────

  describe('the Import step', () => {
    const runImport = async (): Promise<void> => {
      openWizard();
      await uploadStatement();
      await chooseDestination();
      await userEvent.click(forwardButton());
      await waitFor(() => {
        expect(screen.getByText('Preview Import')).toBeInTheDocument();
      });
      await userEvent.click(forwardButton());
    };

    /**
     * THE REVIEW-FLOW LAW. A file import is new work by definition — nobody has
     * looked at these rows — so every row must arrive `needsReview: true`. The
     * engine stamps it, unconditionally, inside `dataPort.importTransactions`;
     * the wizard's whole duty is to use THAT door and not the per-row create,
     * which is a person typing and is born reviewed.
     */
    it('writes through the seam’s bulk import, the door that stamps a row as new', async () => {
      await runImport();

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      });
      expect(dataPort.importTransactions).toHaveBeenCalledTimes(1);
      expect(dataPort.createTransaction).not.toHaveBeenCalled();
      const [accountId, rows] = vi.mocked(dataPort.importTransactions).mock.calls[0];
      expect(accountId).toBe('acc-1');
      expect(rows).toHaveLength(3);
    });

    it('files the rows into the account chosen, with the file’s own figures', async () => {
      await runImport();

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      });
      const [, rows] = vi.mocked(dataPort.importTransactions).mock.calls[0];
      expect(rows).toEqual([
        expect.objectContaining({
          description: 'ORCHARD LANE CAFE',
          amount: -4.2,
          type: 'expense',
          accountId: 'acc-1'
        }),
        expect.objectContaining({
          description: 'SALARY MERIDIAN LTD',
          amount: 1200,
          type: 'income',
          accountId: 'acc-1'
        }),
        expect.objectContaining({ description: 'BLUEBIRD GARAGE', amount: -52.4 })
      ]);
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('reports what landed and what could not be read, and nothing it did not do', async () => {
      await runImport();

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      });
      expect(screen.getByText('Imported').parentElement).toHaveTextContent('3');
      expect(screen.getByText('Could not be read').parentElement).toHaveTextContent('2');
      expect(screen.getByText(/Line 5: Unreadable date: "not-a-date"/)).toBeInTheDocument();
    });

    /**
     * "Import Complete!" over a count of nought was the wizard's most confident
     * lie: a file that reached the store not at all still finished with a tick.
     */
    it('does not call an import that wrote nothing complete', async () => {
      vi.mocked(dataPort.importTransactions).mockResolvedValueOnce({
        inserted: 0,
        alreadyPresent: 0,
        total: 3,
        complete: false,
        error: 'offline'
      });

      await runImport();

      await waitFor(() => {
        expect(screen.getByText('Nothing was imported')).toBeInTheDocument();
      });
      expect(screen.queryByText('Import Complete!')).not.toBeInTheDocument();
      expect(screen.getByText(/3 transactions never reached Everyday Current/)).toBeInTheDocument();
    });
  });

  // ── 6. Profiles have a life cycle ─────────────────────────────────────────

  describe('saved import profiles', () => {
    const reachMapping = async (): Promise<void> => {
      openWizard();
      await uploadStatement();
      await chooseDestination();
    };

    const saveProfileAs = async (name: string): Promise<void> => {
      await userEvent.click(screen.getByText('Save Current'));
      const dialog = await screen.findByRole('dialog', { name: /save these columns/i });
      await userEvent.type(within(dialog).getByLabelText('Name'), name);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save profile' }));
    };

    it('saves the columns AND the duplicate settings under a name', async () => {
      await reachMapping();

      await saveProfileAs('Everyday statement');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Everyday statement' })).toBeInTheDocument();
      });
      const saved = enhancedCsvImportService.getProfiles();
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        name: 'Everyday statement',
        skipDuplicates: true,
        duplicateThreshold: 90
      });
      expect(saved[0].mappings.map(m => m.sourceColumn)).toEqual([
        'Date',
        'Description',
        'Paid out',
        'Paid in'
      ]);
    });

    it('refuses a nameless profile in place rather than saving one', async () => {
      await reachMapping();
      await userEvent.click(screen.getByText('Save Current'));
      const dialog = await screen.findByRole('dialog', { name: /save these columns/i });

      await userEvent.click(within(dialog).getByRole('button', { name: 'Save profile' }));

      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        /Give it a name you will recognise next month/
      );
      expect(enhancedCsvImportService.getProfiles()).toHaveLength(0);
    });

    it('renames one without losing which one is selected', async () => {
      await reachMapping();
      await saveProfileAs('Everyday statement');

      await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
      const dialog = await screen.findByRole('dialog', { name: /rename this profile/i });
      await userEvent.clear(within(dialog).getByLabelText('Name'));
      await userEvent.type(within(dialog).getByLabelText('Name'), 'Everyday — current account');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));

      await waitFor(() => {
        expect(
          screen.getByRole('option', { name: 'Everyday — current account' })
        ).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    });

    /**
     * There was no delete at all. A mis-saved profile stayed in the list for
     * good, which is a reason not to save any.
     */
    it('deletes one, after asking in the app’s own dialog', async () => {
      await reachMapping();
      await saveProfileAs('Everyday statement');

      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const confirm = await screen.findByRole('alertdialog');
      expect(confirm).toHaveTextContent(/Delete “Everyday statement”\?/);
      // What it costs, said before it happens.
      expect(confirm).toHaveTextContent(/No transactions are touched/);
      await userEvent.click(within(confirm).getByRole('button', { name: 'Delete profile' }));

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Everyday statement' })).not.toBeInTheDocument();
      });
      expect(enhancedCsvImportService.getProfiles()).toHaveLength(0);
      // The columns it loaded stay: deleting the note of a mapping is not the
      // same as undoing the mapping.
      expect(
        screen.getAllByRole('combobox', { name: /CSV column for mapping/ })
      ).toHaveLength(4);
    });

    it('keeps the profile when the question is answered with No', async () => {
      await reachMapping();
      await saveProfileAs('Everyday statement');

      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const confirm = await screen.findByRole('alertdialog');
      await userEvent.click(within(confirm).getByRole('button', { name: 'Keep it' }));

      expect(enhancedCsvImportService.getProfiles()).toHaveLength(1);
    });

    it('says which buttons need a profile chosen first, instead of failing silently', async () => {
      await reachMapping();

      const rename = screen.getByRole('button', { name: 'Rename' });
      expect(rename).toBeDisabled();
      expect(rename).toHaveAttribute('title', 'Choose a saved profile to rename it');
      expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    });

    /**
     * A profile saved against ANOTHER bank's file. Half-applying it in silence
     * is how an import of a whole statement lands with blank payees or £0.00
     * amounts — plausible on screen, wrong in the register.
     */
    it('warns when a loaded profile names columns this file has not got', async () => {
      enhancedCsvImportService.saveProfile({
        id: 'p-other-bank',
        name: 'Other bank',
        mappings: [
          { sourceColumn: 'Transaction Date', targetField: 'date' },
          { sourceColumn: 'Narrative', targetField: 'description' },
          { sourceColumn: 'Paid out', targetField: 'amount' },
          { sourceColumn: 'Running Balance', targetField: 'balance' }
        ]
      });
      await reachMapping();

      fireEvent.change(screen.getByLabelText('Import Profiles'), {
        target: { value: 'p-other-bank' }
      });

      expect(screen.getByText(/filled in 1 column/)).toBeInTheDocument();
      expect(
        screen.getByText(/Not found in your file: Transaction Date, Narrative/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Not imported by this app: Running Balance/)).toBeInTheDocument();
      // And the gate holds: a mapping with no date and no payee cannot go on.
      expect(forwardButton()).toBeDisabled();
      expect(screen.getByText(/Still needed: a date column/)).toBeInTheDocument();
    });

    it('shows a column the file has not got as missing, not as blank', async () => {
      enhancedCsvImportService.saveProfile({
        id: 'p-partial',
        name: 'Partly right',
        mappings: [
          { sourceColumn: 'Date', targetField: 'date' },
          { sourceColumn: 'Description', targetField: 'description' },
          { sourceColumn: 'Paid out', targetField: 'amount' }
        ]
      });
      await reachMapping();
      fireEvent.change(screen.getByLabelText('Import Profiles'), {
        target: { value: 'p-partial' }
      });

      // Now break it the way a bank changing its export would.
      const amountSelect = screen.getByRole('combobox', { name: 'CSV column for mapping 3' });
      fireEvent.change(amountSelect, { target: { value: '' } });

      expect(forwardButton()).toBeDisabled();
      expect(screen.getByText(/Still needed: an amount column/)).toBeInTheDocument();
    });
  });
});
