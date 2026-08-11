/**
 * THE FOUR THINGS A REAL BANK FILE DOES THAT THE WIZARD USED TO GET WRONG.
 *
 *   1. It writes 01/06/2026 and means the 1st of June. The old parser read that
 *      as the 6th of January, and read 13/06/2026 — the same column, four rows
 *      down — as the 13th of June. A UK statement imported with its first
 *      twelve days of every month transposed, in silence.
 *   2. It puts a covering block above the table, so the headings are not on
 *      line 1 and the mapping step offered columns called "Account Name:".
 *   3. It quotes a description that contains a newline, and split-on-newline
 *      turned one transaction into two unreadable half-rows.
 *   4. It has nothing whatever to do with importing ACCOUNTS, which this wizard
 *      offered a mode for and never performed.
 *
 * As in the walk tests, NOTHING ABOUT READING A FILE IS MOCKED: the real
 * service tokenizes a real (invented) CSV, detects its headings, infers its
 * date format, builds the rows and reports the refusals. Only the app context
 * and the write are doubles.
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
    accounts: [{ id: 'acc-1', name: 'Everyday Current', type: 'checking', currency: 'GBP' }],
    transactions: [],
    categories: [],
    refreshAccountsAndTransactions: mockRefresh
  })
}));

vi.mock('../services/port', () => ({
  dataPort: {
    importTransactions: vi.fn(),
    createTransaction: vi.fn()
  }
}));

/** Nationwide's column spellings, so the shipped template matches this file. */
const HEADINGS = 'Date,Transaction type,Description,Paid out,Paid in,Balance';

/**
 * A UK statement whose every date falls in the first twelve days of a month.
 *
 * Nothing in it can settle whether it is day-first or month-first, and the two
 * readings file the same transaction in different months. This is the file the
 * old parser guessed at.
 */
const AMBIGUOUS_UK_CSV = [
  HEADINGS,
  '01/06/2026,Visa,ORCHARD LANE CAFE,4.20,,995.80',
  '02/06/2026,Bank credit,MERIDIAN LTD,,1200.00,2195.80',
  '03/06/2026,Visa,BLUEBIRD GARAGE,52.40,,2143.40'
].join('\n');

/** The same statement, with one row past the 12th. That row settles it. */
const PROVEN_UK_CSV = [
  HEADINGS,
  '01/06/2026,Visa,ORCHARD LANE CAFE,4.20,,995.80',
  '02/06/2026,Bank credit,MERIDIAN LTD,,1200.00,2195.80',
  '13/06/2026,Visa,BLUEBIRD GARAGE,52.40,,2143.40'
].join('\n');

const csvFile = (content: string, name = 'statement.csv'): File =>
  new File([content], name, { type: 'text/csv' });

describe('the CSV wizard against a real bank file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
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

  const openWizard = () => render(<CSVImportWizard isOpen onClose={vi.fn()} />);

  const forwardButton = (): HTMLElement =>
    screen.getByRole('button', { name: /^(Next|Import)/ });

  const upload = async (content: string, name?: string): Promise<void> => {
    await userEvent.upload(screen.getByLabelText(/select file/i), csvFile(content, name));
    await waitFor(() => {
      expect(screen.getByText('Column Mapping')).toBeInTheDocument();
    });
  };

  const chooseDestination = async (): Promise<void> => {
    fireEvent.click(screen.getByRole('combobox', { name: 'Import these transactions into' }));
    fireEvent.click(await screen.findByRole('option', { name: /Everyday Current/ }));
  };

  const dateFormatSelect = (): HTMLSelectElement =>
    screen.getByLabelText('How this file writes its dates') as HTMLSelectElement;

  const chooseDateFormat = (value: string): void => {
    fireEvent.change(dateFormatSelect(), { target: { value } });
  };

  const reachPreview = async (): Promise<void> => {
    await userEvent.click(forwardButton());
    await waitFor(() => {
      expect(screen.getByText('Preview Import')).toBeInTheDocument();
    });
  };

  // ── 1. Dates ──────────────────────────────────────────────────────────────

  describe('a file whose dates could be read two ways', () => {
    /**
     * THE GATE. There is no evidence to be had and no default that is safe, so
     * the wizard stops and asks — with the actual cell, read both ways, so the
     * question can be answered by looking at one line of the statement.
     */
    it('will not go on until the user says which way round they are', async () => {
      openWizard();
      await upload(AMBIGUOUS_UK_CSV);
      await chooseDestination();

      expect(forwardButton()).toBeDisabled();
      // Beside the button it disables, in the words of a real cell from the file.
      expect(screen.getByText(/These dates could be read two ways/)).toHaveAttribute(
        'id',
        'csv-wizard-blocked-reason'
      );
      expect(
        screen.getAllByText(/"01\/06\/2026" on line 2 could be 1 June 2026 or 6 January 2026/)
      ).not.toHaveLength(0);
    });

    it('offers the likely answer in words WITHOUT preselecting it', () => {
      // A default that imported without a confirmation would be the same silent
      // guess this control exists to remove: the confirmation IS the safety.
      openWizard();
      return upload(AMBIGUOUS_UK_CSV).then(() => {
        expect(dateFormatSelect().value).toBe('auto');
        expect(
          screen.getByText(/For a file from a UK bank the answer is normally DD\/MM\/YYYY \(day first\) — but it has to be your answer, not ours/)
        ).toBeInTheDocument();
      });
    });

    it('opens the gate once a format is chosen, and shows the reading', async () => {
      openWizard();
      await upload(AMBIGUOUS_UK_CSV);
      await chooseDestination();

      chooseDateFormat('DD/MM/YYYY');

      expect(forwardButton()).toBeEnabled();
      expect(
        screen.getByText(/Read as DD\/MM\/YYYY \(day first\) — 01\/06\/2026 is 1 June 2026/)
      ).toBeInTheDocument();
    });

    it('writes the day the user chose, not the one JavaScript would have picked', async () => {
      openWizard();
      await upload(AMBIGUOUS_UK_CSV);
      await chooseDestination();
      chooseDateFormat('DD/MM/YYYY');
      await reachPreview();
      await userEvent.click(forwardButton());

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      });
      const [, rows] = vi.mocked(dataPort.importTransactions).mock.calls[0];
      // 1 June, not 6 January. `new Date('01/06/2026')` is the 6th of January.
      expect(rows[0].date.toISOString()).toBe('2026-06-01T00:00:00.000Z');
      expect(rows[2].date.toISOString()).toBe('2026-06-03T00:00:00.000Z');
    });

    it('reads the same file the other way round when told to', async () => {
      openWizard();
      await upload(AMBIGUOUS_UK_CSV);
      await chooseDestination();
      chooseDateFormat('MM/DD/YYYY');
      await reachPreview();
      await userEvent.click(forwardButton());

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      });
      const [, rows] = vi.mocked(dataPort.importTransactions).mock.calls[0];
      expect(rows[0].date.toISOString()).toBe('2026-01-06T00:00:00.000Z');
    });
  });

  describe('a file that settles the question itself', () => {
    it('needs no answer when one row falls past the 12th', async () => {
      openWizard();
      await upload(PROVEN_UK_CSV);
      await chooseDestination();

      expect(forwardButton()).toBeEnabled();
      expect(dateFormatSelect().value).toBe('auto');
    });

    it('says which line settled it, so the claim can be checked', async () => {
      openWizard();
      await upload(PROVEN_UK_CSV);

      expect(
        screen.getByText(/Line 4 reads "13\/06\/2026" — 13 cannot be a month, so this file writes the day first/)
      ).toBeInTheDocument();
    });

    it('reads an ISO column without asking anything at all', async () => {
      openWizard();
      await upload(
        ['Date,Description,Amount', '2026-06-01,ORCHARD LANE CAFE,-4.20'].join('\n')
      );
      await chooseDestination();

      expect(forwardButton()).toBeEnabled();
      expect(
        screen.getByText(/Every date in this column starts with its year, which can only be read one way/)
      ).toBeInTheDocument();
    });
  });

  describe('a bank template knows its own format', () => {
    const openTemplates = () =>
      userEvent.click(screen.getByRole('button', { name: /know your bank/i }));

    it('prefills DD/MM for a UK bank, and that answers the question', async () => {
      openWizard();
      await openTemplates();
      await userEvent.click(screen.getByText('Nationwide Building Society'));
      await upload(AMBIGUOUS_UK_CSV);
      await chooseDestination();

      expect(dateFormatSelect().value).toBe('DD/MM/YYYY');
      expect(forwardButton()).toBeEnabled();
      // And it SAYS it set it, because it is the one prefilled setting that
      // changes what gets written rather than which column is read.
      expect(
        screen.getByText(/It also set the date format to DD\/MM\/YYYY \(day first\)/)
      ).toBeInTheDocument();
    });

    it('prefills MM/DD for an American bank, reading the very same cell differently', async () => {
      const chaseCsv = [
        'Transaction Date,Description,Amount,Type,Balance',
        '01/06/2026,ORCHARD LANE CAFE,-4.20,Sale,995.80'
      ].join('\n');

      openWizard();
      await openTemplates();
      await userEvent.click(screen.getByText('Chase (credit card export)'));
      await upload(chaseCsv);

      expect(dateFormatSelect().value).toBe('MM/DD/YYYY');
      expect(
        screen.getByText(/Read as MM\/DD\/YYYY \(month first\) — 01\/06\/2026 is 6 January 2026/)
      ).toBeInTheDocument();
    });

    it('prefills nothing from a template that matched no column of this file', async () => {
      // A template that found nothing here has told us nothing about this file,
      // its date format included. Setting one anyway would be the confident
      // half of a guess.
      openWizard();
      await openTemplates();
      // Fidelity names Run Date / Action / Symbol / Price / Quantity / Amount:
      // not one of this file's columns, under any spelling.
      await userEvent.click(screen.getByText('Fidelity'));
      await upload(AMBIGUOUS_UK_CSV);

      expect(dateFormatSelect().value).toBe('auto');
      expect(
        screen.getByText(/names no column this file has, so nothing was taken from it/)
      ).toBeInTheDocument();
    });

    /**
     * A bank that has changed its export, or a template this app guessed wrong
     * about. The choice is still honoured — but the file is sitting right there
     * disproving it, and saying nothing would be obeying a stale guess in
     * silence.
     */
    it('says so when the file disproves the format a template set', async () => {
      openWizard();
      await openTemplates();
      await userEvent.click(screen.getByText('Chase (credit card export)'));
      await upload(
        [
          'Transaction Date,Description,Amount,Type,Balance',
          '13/06/2026,BLUEBIRD GARAGE,-52.40,Sale,2143.40'
        ].join('\n')
      );

      expect(screen.getByText(/Your file says otherwise/)).toBeInTheDocument();
      expect(screen.getByText(/13 cannot be a month, so this file writes the day first/))
        .toBeInTheDocument();
    });
  });

  /**
   * THE PER-ROW REFUSAL THAT NAMES THE FORMAT. A 13 in the month position is
   * not a broken row: it is a UK file being read as an American one, and every
   * row of it is being read wrong. "Unreadable date" here would send the user
   * off to correct their bank's export.
   */
  describe('rows that do not fit the declared format', () => {
    it('refuses them one by one, naming the format and the cure', async () => {
      openWizard();
      await upload(PROVEN_UK_CSV);
      await chooseDestination();
      chooseDateFormat('MM/DD/YYYY');
      await reachPreview();

      expect(screen.getByText(/2 of 3 rows/)).toBeInTheDocument();
      // Grouped by reason and counted over the whole file, with the format
      // named and the cure named — and the line, so the row can be found in the
      // file itself rather than counted to.
      expect(
        screen.getByText(
          /1 row skipped — There is no month 13 — "13\/06\/2026" is being read as MM\/DD\/YYYY \(month first\)\. Choose DD\/MM\/YYYY if this file writes the day first\./
        )
      ).toBeInTheDocument();
      expect(screen.getByText(/\(line 4\)/)).toBeInTheDocument();
    });

    it('shows the refusal against the row in the preview table too', async () => {
      openWizard();
      await upload(PROVEN_UK_CSV);
      await chooseDestination();
      chooseDateFormat('MM/DD/YYYY');
      await reachPreview();

      expect(screen.getByText(/Will be skipped — There is no month 13/)).toBeInTheDocument();
    });
  });

  // ── 2. A covering block above the table ───────────────────────────────────

  describe('a file with metadata lines above its headings', () => {
    const WITH_PREAMBLE = [
      'Account Name:,"Everyday Current"',
      'Account Balance:,"2143.40"',
      'Available Balance:,"2143.40"',
      '',
      PROVEN_UK_CSV
    ].join('\n');

    it('finds the real headings and maps the columns under them', async () => {
      openWizard();
      await upload(WITH_PREAMBLE, 'nationwide.csv');

      // Not "Account Name:" and "Everyday Current", which is what reading line
      // 1 as the headings produced.
      const firstColumn = screen.getByRole('combobox', { name: 'CSV column for mapping 1' });
      expect(
        within(firstColumn).getAllByRole('option').map(option => option.textContent)
      ).toEqual([
        'Select CSV column...',
        'Date',
        'Transaction type',
        'Description',
        'Paid out',
        'Paid in',
        'Balance'
      ]);
    });

    it('says which line it read them from, and why it skipped the rest', async () => {
      openWizard();
      await upload(WITH_PREAMBLE, 'nationwide.csv');

      expect(screen.getByText(/Column headings read from/)).toBeInTheDocument();
      expect(screen.getByText('line 5')).toBeInTheDocument();
      expect(screen.getByText(/the 3 lines above them are being ignored/)).toBeInTheDocument();
      expect(
        screen.getByText(/3 lines above it do not have the same columns as the rows below/)
      ).toBeInTheDocument();
    });

    it('shows the ignored lines, marked as ignored, rather than dropping them in silence', async () => {
      openWizard();
      await upload(WITH_PREAMBLE, 'nationwide.csv');

      const list = screen.getByRole('list', { name: 'The first lines of this file' });
      const items = within(list).getAllByRole('listitem');
      expect(items[0]).toHaveTextContent('Account Name:,"Everyday Current"');
      expect(items[0]).toHaveTextContent('(ignored)');
      // And the line that IS the heading row is marked as such, not as ignored.
      const heading = items.find(item => item.textContent?.includes('Transaction type'));
      expect(heading).toBeDefined();
      expect(heading).not.toHaveTextContent('(ignored)');
    });

    it('lets the user move the heading line, and re-reads the file from there', async () => {
      openWizard();
      await upload(WITH_PREAMBLE, 'nationwide.csv');

      await userEvent.click(
        screen.getByRole('button', { name: 'Read the column headings from line 1' })
      );

      expect(screen.getByText('line 1')).toBeInTheDocument();
      const firstColumn = screen.getByRole('combobox', { name: 'CSV column for mapping 1' });
      expect(
        within(firstColumn).getAllByRole('option').map(option => option.textContent)
      ).toEqual(['Select CSV column...', 'Account Name:', 'Everyday Current']);
    });

    it('numbers its rows by the FILE, not by their position in the table', async () => {
      openWizard();
      await upload(WITH_PREAMBLE, 'nationwide.csv');
      await chooseDestination();
      chooseDateFormat('MM/DD/YYYY');
      await reachPreview();

      // The offending row is the 3rd of the table and the 8th line of the file.
      // Row-index arithmetic would have sent the reader to line 4.
      expect(screen.getByText(/\(line 8\)/)).toBeInTheDocument();
    });

    it('says nothing about a covering block on a file that has none', async () => {
      openWizard();
      await upload(PROVEN_UK_CSV);

      expect(screen.getByText(/Column headings read from/)).toBeInTheDocument();
      expect(screen.getByText('line 1')).toBeInTheDocument();
      expect(screen.queryByText(/being ignored/)).not.toBeInTheDocument();
      // The picker is closed, because nothing has been skipped — but it is
      // reachable, because detection can be wrong in the other direction too.
      expect(
        screen.queryByRole('list', { name: 'The first lines of this file' })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Not right\? Choose the heading line/ })
      ).toBeInTheDocument();
    });
  });

  // ── 3. Multi-line quoted fields ───────────────────────────────────────────

  describe('a description that contains a line break', () => {
    const MULTILINE_CSV = [
      'Date,Description,Amount',
      '2026-06-01,ORCHARD LANE CAFE,-4.20',
      '2026-06-02,"BLUEBIRD GARAGE',
      'Invoice 4471, parts and labour",-52.40',
      '2026-06-03,MERIDIAN LTD,1200.00'
    ].join('\n');

    it('reads it as ONE transaction, with the whole description', async () => {
      openWizard();
      await upload(MULTILINE_CSV);
      await chooseDestination();
      await reachPreview();

      // Three rows, not four — and not two unreadable half-rows with the
      // £52.40 lost between them.
      expect(screen.getByText(/3 of 3 rows/)).toBeInTheDocument();
      expect(
        screen.getByText(/BLUEBIRD GARAGE\s+Invoice 4471, parts and labour/)
      ).toBeInTheDocument();
    });

    it('writes the whole description, comma and newline included', async () => {
      openWizard();
      await upload(MULTILINE_CSV);
      await chooseDestination();
      await reachPreview();
      await userEvent.click(forwardButton());

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      });
      const [, rows] = vi.mocked(dataPort.importTransactions).mock.calls[0];
      expect(rows).toHaveLength(3);
      expect(rows[1].description).toBe('BLUEBIRD GARAGE\nInvoice 4471, parts and labour');
      expect(rows[1].amount).toBe(-52.4);
    });

    /**
     * THE LINE-NUMBER BOOKKEEPING. Row index plus two is right only while every
     * record is one line long; the moment one spans two, every number after it
     * is wrong by a growing amount and the reader is sent to the wrong row of
     * their own file.
     */
    it('keeps the line numbers true for every row after it', async () => {
      const withBadRowAfter = [
        'Date,Description,Amount',
        '2026-06-01,ORCHARD LANE CAFE,-4.20',
        '2026-06-02,"BLUEBIRD GARAGE',
        'Invoice 4471",-52.40',
        'not-a-date,MYSTERY LINE,-10.00'
      ].join('\n');

      openWizard();
      await upload(withBadRowAfter);
      await chooseDestination();
      await reachPreview();

      // The bad row is the 4th record and the 5th LINE. Index arithmetic would
      // have said line 5 too — only because the header is one line — so the
      // fixture puts the multi-line row FIRST: 3 records before it, 5 lines.
      expect(screen.getByText(/1 row skipped — Unreadable date: "not-a-date"/)).toBeInTheDocument();
      expect(screen.getByText(/\(line 5\)/)).toBeInTheDocument();
    });

    it('refuses a file whose quote is never closed, instead of importing a fragment of it', async () => {
      openWizard();
      await userEvent.upload(
        screen.getByLabelText(/select file/i),
        csvFile(
          [
            'Date,Description,Amount',
            '2026-06-01,"ORCHARD LANE CAFE,-4.20',
            '2026-06-02,BLUEBIRD GARAGE,-52.40'
          ].join('\n'),
          'torn.csv'
        )
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          /Line 2 of torn\.csv opens a quotation mark that is never closed/
        );
      });
      expect(screen.queryByText('Column Mapping')).not.toBeInTheDocument();
    });
  });

  // ── 4. There is no account import ─────────────────────────────────────────

  describe('the account-import mode that never existed', () => {
    it('offers no way to ask for it, and imports transactions regardless', async () => {
      openWizard();
      await upload(PROVEN_UK_CSV);
      await chooseDestination();
      await reachPreview();
      await userEvent.click(forwardButton());

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      });
      // The refusal that used to stand in for the feature is gone, because the
      // mode it refused is gone.
      expect(
        screen.queryByText(/Creating accounts from a CSV is not something this app does/)
      ).not.toBeInTheDocument();
      expect(dataPort.importTransactions).toHaveBeenCalledTimes(1);
    });

    it('saves a profile with the date format, and restores both next time', async () => {
      openWizard();
      await upload(AMBIGUOUS_UK_CSV);
      await chooseDestination();
      chooseDateFormat('DD/MM/YYYY');

      await userEvent.click(screen.getByText('Save Current'));
      const dialog = await screen.findByRole('dialog', { name: /save these columns/i });
      await userEvent.type(within(dialog).getByLabelText('Name'), 'Everyday statement');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save profile' }));

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Everyday statement' })).toBeInTheDocument();
      });
      const saved = enhancedCsvImportService.getProfiles();
      expect(saved).toHaveLength(1);
      expect(saved[0].dateFormat).toBe('DD/MM/YYYY');
      // And no `type`, because there is no longer such a thing.
      expect(Object.keys(saved[0])).not.toContain('type');
    });

    it('restores the saved format, so the same file needs no second answer', async () => {
      enhancedCsvImportService.saveProfile({
        id: 'p-uk',
        name: 'Everyday statement',
        dateFormat: 'DD/MM/YYYY',
        mappings: [
          { sourceColumn: 'Date', targetField: 'date' },
          { sourceColumn: 'Description', targetField: 'description' },
          { sourceColumn: 'Paid out', targetField: 'amount' },
          { sourceColumn: 'Paid in', targetField: 'amount' }
        ]
      });

      openWizard();
      await upload(AMBIGUOUS_UK_CSV);
      await chooseDestination();
      expect(forwardButton()).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Import Profiles'), { target: { value: 'p-uk' } });

      expect(dateFormatSelect().value).toBe('DD/MM/YYYY');
      expect(forwardButton()).toBeEnabled();
    });
  });
});
