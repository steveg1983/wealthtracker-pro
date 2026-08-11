import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnhancedCsvImportService } from '../enhancedCsvImportService';
import type { ColumnMapping, ImportProfile } from '../enhancedCsvImportService';
import type { Transaction } from '../../types';

const CSV_IMPORT_KEY = 'csvImportProfiles';
const FIXED_NOW = new Date('2025-06-01T00:00:00.000Z').getTime();

const createStorage = (initial: Record<string, unknown> = {}) => {
  const backing = new Map<string, string>();
  Object.entries(initial).forEach(([key, value]) => {
    backing.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  });

  return {
    getItem: vi.fn((key: string) => backing.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      backing.set(key, value);
    })
  };
};

describe('EnhancedCsvImportService (deterministic)', () => {
  const logger = { warn: vi.fn(), error: vi.fn() };
  const categorizationService = {
    learnFromTransactions: vi.fn(),
    suggestCategories: vi.fn(() => [])
  };
  const rulesService = {
    applyRules: vi.fn((transaction: Partial<Transaction>) => transaction)
  };

  beforeEach(() => {
    logger.warn.mockReset();
    logger.error.mockReset();
    categorizationService.learnFromTransactions.mockReset();
    categorizationService.suggestCategories.mockReset();
    rulesService.applyRules.mockReset();
  });

  const createService = (storage = createStorage()) =>
    new EnhancedCsvImportService({
      storage,
      logger,
      now: () => FIXED_NOW,
      categorizationService,
      rulesService
    });

  it('loads existing profiles and persists new ones via injected storage', () => {
    const existingProfile: ImportProfile = {
      id: 'existing',
      name: 'Existing Profile',
      mappings: []
    };
    const storage = createStorage({
      [CSV_IMPORT_KEY]: [existingProfile]
    });

    const service = createService(storage);
    const profiles = service.getProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe('existing');

    const newProfile: ImportProfile = {
      id: 'new-profile',
      name: 'New Profile',
      mappings: []
    };

    storage.setItem.mockClear();
    service.saveProfile(newProfile);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(storage.setItem.mock.calls[0][1]) as ImportProfile[];
    expect(payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'existing' }),
        expect.objectContaining({ id: 'new-profile' })
      ])
    );
  });

  /**
   * A DATE NOBODY CAN READ IS A ROW NOBODY CAN IMPORT.
   *
   * This used to fall back to today's date and import the row anyway, with a
   * console warning as the only trace. That is the worst of the three possible
   * outcomes: the statement line lands in the register on the wrong day, so it
   * reconciles against nothing, appears in the wrong month's spending, and is
   * not where its owner will look for it. Refusing it costs one line in the
   * "rows that could not be read" list, which is on screen at the end of every
   * import and quotes the cell back.
   *
   * An EMPTY date cell is the same refusal for a worse reason: it used to reach
   * the wizard as no date at all, which became `new Date('undefined')` — a row
   * written with an Invalid Date.
   */
  it('refuses a row whose date cannot be read, and quotes the cell back', async () => {
    const storage = createStorage();
    const service = createService(storage);
    const csv =
      'Date,Description,Amount\n' +
      'invalid-date,Coffee,-12.50\n' +
      ',Sandwich,-4.00\n' +
      '2025-06-03,Bus fare,-2.40';
    const mappings: ColumnMapping[] = [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' }
    ];

    const result = await service.importTransactions(
      csv,
      mappings,
      [],
      new Map(),
      { skipDuplicates: false }
    );

    expect(result.success).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.errors).toEqual([
      { line: 2, error: 'Unreadable date: "invalid-date"' },
      { line: 3, error: 'No date in this row' }
    ]);
    // The readable row still lands, still deterministic, still signed.
    expect(result.items[0].id).toBe(`import-${FIXED_NOW}-2-0`);
    expect(result.items[0].date?.toISOString()).toBe('2025-06-03T00:00:00.000Z');
    expect(result.items[0].amount).toBe(-2.4);
    expect(result.items[0].type).toBe('expense');
  });

  /**
   * The mapping step will not let a file through without an amount column, but
   * a profile saved against a different file can still name a column this one
   * does not have. £0.00 rows are the outcome nobody can spot afterwards.
   */
  it('refuses a row whose amount column is not in the file, rather than importing zero', async () => {
    const service = createService();
    const csv = 'Date,Description,Value\n2025-06-01,Coffee,-3.50';
    const mappings: ColumnMapping[] = [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' }
    ];

    const result = await service.importTransactions(csv, mappings, [], new Map(), {
      skipDuplicates: false
    });

    expect(result.success).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.errors).toEqual([{ line: 2, error: 'No amount in this row' }]);
  });

  /**
   * A CSV's category column is the user's own data — they chose the file and
   * they told the wizard which column it is. The smart categoriser's guess is
   * not. Both end up in the same field, so only the flag can tell them apart.
   */
  describe('category provenance', () => {
    const csv = 'Date,Description,Amount,Category\n2025-06-01,Supermarket,-40.00,det-groceries';
    const mappings: ColumnMapping[] = [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Category', targetField: 'category' }
    ];
    const csvWithoutCategory = 'Date,Description,Amount\n2025-06-01,Supermarket,-40.00';
    const mappingsWithoutCategory = mappings.slice(0, 3);

    it('treats a MAPPED category column as confirmed', async () => {
      rulesService.applyRules.mockImplementation((t: Partial<Transaction>) => t);
      const service = createService();

      const result = await service.importTransactions(csv, mappings, [], new Map(), {
        skipDuplicates: false,
        autoCategorize: true,
        categories: []
      });

      expect(result.items[0].category).toBe('det-groceries');
      expect(result.items[0].categoryConfirmed).toBe(true);
    });

    it('marks a GUESSED category as suggested', async () => {
      rulesService.applyRules.mockImplementation((t: Partial<Transaction>) => t);
      categorizationService.suggestCategories.mockReturnValue([
        { categoryId: 'det-groceries', confidence: 0.9, reason: 'Merchant match' }
      ]);
      const service = createService();

      const result = await service.importTransactions(
        csvWithoutCategory,
        mappingsWithoutCategory,
        [],
        new Map(),
        { skipDuplicates: false, autoCategorize: true, categories: [] }
      );

      expect(result.items[0].category).toBe('det-groceries');
      expect(result.items[0].categoryConfirmed).toBe(false);
    });

    it('leaves a row nothing was guessed for confirmed, category or not', async () => {
      rulesService.applyRules.mockImplementation((t: Partial<Transaction>) => t);
      categorizationService.suggestCategories.mockReturnValue([]);
      const service = createService();

      const result = await service.importTransactions(
        csvWithoutCategory,
        mappingsWithoutCategory,
        [],
        new Map(),
        { skipDuplicates: false, autoCategorize: true, categories: [] }
      );

      expect(result.items[0].category).toBeUndefined();
      expect(result.items[0].categoryConfirmed).toBe(true);
    });
  });

  it('stores income positive and expenses negative from a single signed amount column', async () => {
    const service = createService();
    const csv = 'Date,Description,Amount\n2025-06-01,Salary,2500.00\n2025-06-02,Coffee,-12.50';
    const mappings: ColumnMapping[] = [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' }
    ];

    const result = await service.importTransactions(
      csv,
      mappings,
      [],
      new Map(),
      { skipDuplicates: false }
    );

    expect(result.success).toBe(2);
    expect(result.items[0]).toMatchObject({ amount: 2500, type: 'income' });
    expect(result.items[1]).toMatchObject({ amount: -12.5, type: 'expense' });
  });

  it('signs a debit-labelled single amount column negative', async () => {
    const service = createService();
    // Single amount column whose header marks it as money-out; magnitude is
    // stored, then signed negative per the signed convention.
    const csv = 'Date,Description,Debit Amount\n2025-06-01,Coffee,12.50';
    const mappings: ColumnMapping[] = [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit Amount', targetField: 'amount' }
    ];

    const result = await service.importTransactions(
      csv,
      mappings,
      [],
      new Map(),
      { skipDuplicates: false }
    );

    expect(result.success).toBe(1);
    expect(result.items[0]).toMatchObject({ amount: -12.5, type: 'expense' });
  });

  it('reads SEPARATE debit and credit columns from their own indices (bank-format regression)', async () => {
    const service = createService();
    // Lloyds/Halifax/Nationwide-style format: two source columns both mapped
    // to targetField 'amount'. A targetField-keyed index map collapsed them,
    // making the debit mapping read the credit column's cell — debit-only rows
    // imported with no amount at all.
    const csv = 'Date,Description,Debit Amount,Credit Amount\n2025-06-01,Coffee,50.00,\n2025-06-02,Salary,,100.00';
    const mappings: ColumnMapping[] = [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit Amount', targetField: 'amount' },
      { sourceColumn: 'Credit Amount', targetField: 'amount' }
    ];

    const result = await service.importTransactions(
      csv,
      mappings,
      [],
      new Map(),
      { skipDuplicates: false }
    );

    expect(result.success).toBe(2);
    expect(result.items[0]).toMatchObject({ amount: -50, type: 'expense' });
    expect(result.items[1]).toMatchObject({ amount: 100, type: 'income' });
  });

  it('preserves reversal signs in debit/credit columns (sign is authoritative)', async () => {
    const service = createService();
    // A NEGATIVE cell in the Debit column is a refunded charge — money IN.
    // A NEGATIVE cell in the Credit column is a clawback — money OUT.
    // Math.abs must never erase these source signs.
    const csv =
      'Date,Description,Debit Amount,Credit Amount\n' +
      '2025-06-01,Refunded charge,-12.50,\n' +
      '2025-06-02,Cashback clawback,,-30.00';
    const mappings: ColumnMapping[] = [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit Amount', targetField: 'amount' },
      { sourceColumn: 'Credit Amount', targetField: 'amount' }
    ];

    const result = await service.importTransactions(
      csv,
      mappings,
      [],
      new Map(),
      { skipDuplicates: false }
    );

    expect(result.success).toBe(2);
    expect(result.items[0]).toMatchObject({ amount: 12.5, type: 'income' });
    expect(result.items[1]).toMatchObject({ amount: -30, type: 'expense' });
  });

  it('recognizes Withdrawals/Deposits columns via the shipped wells-fargo profile', async () => {
    const service = createService();
    const csv =
      'Date,Description,Withdrawals,Deposits\n' +
      '2025-06-01,Groceries,45.00,\n' +
      '2025-06-02,Payroll,,1500.00';

    const result = await service.importTransactions(
      csv,
      service.getBankMappings('wells-fargo'),
      [],
      new Map(),
      { skipDuplicates: false }
    );

    expect(result.success).toBe(2);
    expect(result.items[0]).toMatchObject({ amount: -45, type: 'expense' });
    expect(result.items[1]).toMatchObject({ amount: 1500, type: 'income' });
  });

  it('recognizes Dare/Avere columns via the shipped intesa-sanpaolo profile', async () => {
    const service = createService();
    const csv =
      'Data,Causale,Dare,Avere\n' +
      '2025-06-01,Spesa,20.00,\n' +
      '2025-06-02,Stipendio,,300.00';

    const result = await service.importTransactions(
      csv,
      service.getBankMappings('intesa-sanpaolo'),
      [],
      new Map(),
      { skipDuplicates: false }
    );

    expect(result.success).toBe(2);
    expect(result.items[0]).toMatchObject({ amount: -20, type: 'expense' });
    expect(result.items[1]).toMatchObject({ amount: 300, type: 'income' });
  });

  it('honours an explicit type column for unsigned magnitudes; a signed amount beats a contradictory type cell', async () => {
    const service = createService();
    // Mint-style export: unsigned magnitudes classified by a Transaction Type
    // column. The third row carries a SIGNED negative amount with a
    // contradictory 'credit' cell — the sign is authoritative (money OUT).
    const csv =
      'Date,Description,Amount,Transaction Type,Category\n' +
      '2025-06-01,Amazon,50.99,debit,Shopping\n' +
      '2025-06-02,Refund,25.00,credit,Shopping\n' +
      '2025-06-03,Reversed deposit,-100.00,credit,Income';

    const result = await service.importTransactions(
      csv,
      service.getBankMappings('mint'),
      [],
      new Map(),
      { skipDuplicates: false }
    );

    expect(result.success).toBe(3);
    expect(result.items[0]).toMatchObject({ amount: -50.99, type: 'expense' });
    expect(result.items[1]).toMatchObject({ amount: 25, type: 'income' });
    expect(result.items[2]).toMatchObject({ amount: -100, type: 'expense' });
  });

  it('skips rows whose debit/credit cells are zero or empty instead of importing an undefined amount', async () => {
    const service = createService();
    const csv =
      'Date,Description,Debit Amount,Credit Amount\n' +
      '2025-06-01,Zero row,0.00,\n' +
      '2025-06-02,Both empty,,\n' +
      '2025-06-03,Coffee,3.50,';
    const mappings: ColumnMapping[] = [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit Amount', targetField: 'amount' },
      { sourceColumn: 'Credit Amount', targetField: 'amount' }
    ];

    const result = await service.importTransactions(
      csv,
      mappings,
      [],
      new Map(),
      { skipDuplicates: false }
    );

    expect(result.success).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.errors).toEqual([
      { line: 2, error: expect.stringMatching(/debit\/credit/i) },
      { line: 3, error: expect.stringMatching(/debit\/credit/i) }
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ amount: -3.5, type: 'expense' });
  });

  it('generatePreview mirrors the debit/credit import handling so previews match what gets written', async () => {
    const service = createService();
    const mappings: ColumnMapping[] = [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit Amount', targetField: 'amount' },
      { sourceColumn: 'Credit Amount', targetField: 'amount' }
    ];
    const rows = [
      ['2025-06-01', 'Coffee', '50.00', ''],
      ['2025-06-02', 'Salary', '', '100.00'],
      ['2025-06-03', 'Refunded charge', '-12.50', ''],
      ['2025-06-04', 'Zero row', '0.00', '']
    ];
    const header = ['Date', 'Description', 'Debit Amount', 'Credit Amount'];

    // Headers and rows are separate arguments: the rows passed here are the
    // DATA rows, exactly as parseCSV hands them back.
    const preview = service.generatePreview(header, rows, mappings);

    // The zero row is skipped — it yields no usable amount.
    expect(preview.transactions).toHaveLength(3);
    expect(preview.transactions[0]).toMatchObject({ amount: -50, type: 'expense' });
    expect(preview.transactions[1]).toMatchObject({ amount: 100, type: 'income' });
    expect(preview.transactions[2]).toMatchObject({ amount: 12.5, type: 'income' });

    // Parity check: importing the same rows writes exactly what was previewed.
    const csv = [header, ...rows].map(row => row.join(',')).join('\n');
    const result = await service.importTransactions(
      csv,
      mappings,
      [],
      new Map(),
      { skipDuplicates: false }
    );
    expect(
      result.items.map(item => {
        const tx = item as Partial<Transaction>;
        return { amount: tx.amount, type: tx.type };
      })
    ).toEqual(
      preview.transactions.map(item => ({ amount: item.amount, type: item.type }))
    );
  });

  /**
   * The contract these two pin down is the one the old single-argument
   * signature could not express. It took `data: string[][]` and treated
   * `data[0]` as the header row, so a caller holding parseCSV's output — where
   * the header has already been split off — silently previewed nothing at all,
   * with no error and no empty-state anywhere to notice it by.
   */
  describe('generatePreview takes headers separately from rows', () => {
    const mappings: ColumnMapping[] = [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' }
    ];
    const csv = [
      'Date,Description,Amount',
      '2025-06-01,Coffee,-3.50',
      '2025-06-02,Salary,1200.00'
    ].join('\n');

    it('previews every row of parseCSV output, which is already header-stripped', () => {
      const service = createService();
      const parsed = service.parseCSV(csv);

      const preview = service.generatePreview(parsed.headers, parsed.data, mappings);

      expect(preview.transactions).toHaveLength(2);
      expect(preview.transactions[0]).toMatchObject({ description: 'Coffee', amount: -3.5 });
      expect(preview.transactions[1]).toMatchObject({ description: 'Salary', amount: 1200 });
    });

    it('reads column positions from the headers, not from the first row', () => {
      const service = createService();
      // Columns deliberately out of the mappings' order: the only thing that
      // can place them is the header array.
      const preview = service.generatePreview(
        ['Amount', 'Date', 'Description'],
        [['-9.99', '2025-06-03', 'Sandwich']],
        mappings
      );

      expect(preview.transactions).toHaveLength(1);
      expect(preview.transactions[0]).toMatchObject({
        description: 'Sandwich',
        amount: -9.99
      });
    });
  });

  /**
   * THE DEAD-BUTTON CLASS OF BUG, closed by construction.
   *
   * The bank list on screen was a separate hand-typed array of names, matched
   * against these ids by `name.toLowerCase()`. Twenty of the forty-one names
   * matched nothing — MBNA, Amex, Bank of America, Chase UK, Metro Bank — so
   * pressing them configured an EMPTY mapping and walked the user to a Column
   * Mapping step with no rows in it. Nothing failed; nothing said so.
   *
   * The list is now the registry, so these tests are what stops the two drifting
   * apart again.
   */
  /**
   * A blank line is not a row. Files that end with one, or that put one between
   * months, used to produce an empty row apiece — counted in the preview and
   * then reported as a row that could not be read: an error report about
   * nothing, on a screen whose whole job is to be believed.
   */
  it('does not turn blank lines into rows the import then complains about', async () => {
    const service = createService();
    const csv =
      'Date,Description,Amount\n' +
      '\n' +
      '2025-06-01,Coffee,-3.50\n' +
      '   \n' +
      '2025-06-02,Salary,1200.00\n';

    const parsed = service.parseCSV(csv);
    expect(parsed.data).toHaveLength(2);

    const result = await service.importTransactions(
      csv,
      [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' }
      ],
      [],
      new Map(),
      { skipDuplicates: false }
    );

    expect(result.success).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.errors).toEqual([]);
  });

  describe('the shipped bank templates', () => {
    it('offers nothing it cannot deliver: every listed template resolves to mappings', () => {
      const service = createService();
      const listed = service.listBankTemplates();

      expect(listed.length).toBeGreaterThan(0);
      for (const template of listed) {
        expect(service.getBankMappings(template.id)).toEqual(template.mappings);
        expect(template.mappings.length).toBeGreaterThan(0);
        expect(template.label.trim()).not.toBe('');
      }
    });

    it('gives every template the three fields an import cannot do without', () => {
      // Applied to a file that has exactly the columns it names, every shipped
      // template must produce an importable mapping. A template missing a date,
      // a payee or an amount is a template that can only disappoint.
      const service = createService();

      for (const template of service.listBankTemplates()) {
        const columns = template.mappings.map(mapping => mapping.sourceColumn);
        expect({
          template: template.id,
          missing: service.missingRequiredFields(template.mappings, columns)
        }).toEqual({ template: template.id, missing: [] });
      }
    });

    /**
     * A template that did not say which way round its bank writes dates would
     * leave the user to answer a question the bank has already answered — and
     * `undefined` here would mean "nobody thought about this bank", which is
     * exactly the state a prefill must never be in.
     */
    it('has every template declare which way round its bank writes dates', () => {
      const service = createService();

      for (const template of service.listBankTemplates()) {
        expect({ template: template.id, format: template.dateFormat }).toEqual({
          template: template.id,
          format: expect.stringMatching(/^(DD\/MM\/YYYY|MM\/DD\/YYYY|YYYY-MM-DD)$/)
        });
      }
    });

    it('gives the UK banks day-first and the American ones month-first', () => {
      // Spot-checked rather than exhaustively asserted: every entry is a guess
      // about somebody else's export, and the safety is the control the user
      // can see and the preview that prints the file's own string beside the
      // parsed one — not this table being eternally right.
      const service = createService();
      const format = (id: string) =>
        service.listBankTemplates().find(template => template.id === id)?.dateFormat;

      expect(format('nationwide')).toBe('DD/MM/YYYY');
      expect(format('lloyds')).toBe('DD/MM/YYYY');
      expect(format('chase')).toBe('MM/DD/YYYY');
      expect(format('wells-fargo')).toBe('MM/DD/YYYY');
      expect(format('stripe')).toBe('YYYY-MM-DD');
      expect(format('coinbase')).toBe('YYYY-MM-DD');
    });

    it('has no two templates sharing an id, and no two sharing a label', () => {
      // Two entries reading 'ANZ' is a coin toss presented as a choice.
      const service = createService();
      const listed = service.listBankTemplates();

      expect(new Set(listed.map(t => t.id)).size).toBe(listed.length);
      expect(new Set(listed.map(t => t.label)).size).toBe(listed.length);
    });

    it('hands out a copy, so an edited mapping cannot rewrite the shipped template', () => {
      const service = createService();
      const first = service.getBankMappings('lloyds');
      first[0].sourceColumn = 'CHANGED IN THE UI';

      expect(service.getBankMappings('lloyds')[0].sourceColumn).toBe('Transaction Date');
    });

    it('returns nothing for an id it does not ship', () => {
      expect(createService().getBankMappings('no-such-bank')).toEqual([]);
    });
  });

  describe('what a mapping still needs', () => {
    const headers = ['Date', 'Description', 'Amount'];

    it('counts only mappings whose column is actually in this file', () => {
      const service = createService();

      // A saved profile from another bank: the column names are plausible and
      // none of them are here. Half-applying it is how an import lands 900 rows
      // at £0.00.
      expect(
        service.missingRequiredFields(
          [
            { sourceColumn: 'Transaction Date', targetField: 'date' },
            { sourceColumn: 'Narrative', targetField: 'description' },
            { sourceColumn: 'Debit Amount', targetField: 'amount' }
          ],
          headers
        )
      ).toEqual(['date', 'description', 'amount']);
    });

    it('is satisfied by a debit/credit pair as readily as by one signed column', () => {
      const service = createService();
      const pairHeaders = ['Date', 'Description', 'Paid out', 'Paid in'];

      expect(
        service.missingRequiredFields(
          [
            { sourceColumn: 'Date', targetField: 'date' },
            { sourceColumn: 'Description', targetField: 'description' },
            { sourceColumn: 'Paid out', targetField: 'amount' },
            { sourceColumn: 'Paid in', targetField: 'amount' }
          ],
          pairHeaders
        )
      ).toEqual([]);
    });

    it('names each field that is missing, and nothing else', () => {
      const service = createService();

      expect(
        service.missingRequiredFields(
          [{ sourceColumn: 'Date', targetField: 'date' }],
          headers
        )
      ).toEqual(['description', 'amount']);
    });
  });

  /**
   * A two-column statement is the common UK case, and auto-detect used to take
   * whichever of "Paid out"/"Paid in" scored better on a spelling comparison
   * and drop the other — so every credit row (wages, refunds, transfers in)
   * came through with no usable amount and was skipped before anyone saw it.
   */
  it('auto-detects BOTH halves of a debit/credit statement', () => {
    const service = createService();

    const mappings = service.suggestMappings([
      'Date',
      'Transaction type',
      'Description',
      'Paid out',
      'Paid in',
      'Balance'
    ]);

    expect(mappings.filter(m => m.targetField === 'amount').map(m => m.sourceColumn)).toEqual([
      'Paid out',
      'Paid in'
    ]);
    expect(mappings.find(m => m.targetField === 'date')?.sourceColumn).toBe('Date');
    expect(mappings.find(m => m.targetField === 'description')?.sourceColumn).toBe('Description');
  });

  it('still maps a single signed Amount column when there is no pair', () => {
    const service = createService();

    const mappings = service.suggestMappings(['Date', 'Description', 'Amount']);

    expect(mappings.filter(m => m.targetField === 'amount').map(m => m.sourceColumn)).toEqual([
      'Amount'
    ]);
  });

  /**
   * ONE COLUMN, ONE MEANING.
   *
   * "Amount" and "account" are two edits apart — 0.71 on the fuzzy match, over
   * the 0.6 threshold — so the commonest CSV shape there is had its Amount
   * column mapped to `amount` AND to `accountName`. Every row then arrived
   * naming an account called "-4.20", every row was unroutable, and the import
   * finished with "3 transactions had no account to go into. Their Account
   * column names -4.20, -52.40, 1200.00". A plain three-column export imported
   * NOTHING and told the user to go and rename an account.
   */
  it('does not claim the Amount column as the account column as well', () => {
    const service = createService();

    const mappings = service.suggestMappings(['Date', 'Description', 'Amount']);

    expect(mappings.map(m => [m.sourceColumn, m.targetField])).toEqual([
      ['Date', 'date'],
      ['Description', 'description'],
      ['Amount', 'amount']
    ]);
  });

  it('still finds a real account column when the file has one', () => {
    const service = createService();

    const mappings = service.suggestMappings(['Date', 'Description', 'Amount', 'Account']);

    expect(mappings.find(m => m.targetField === 'accountName')?.sourceColumn).toBe('Account');
  });

  it('gives a plain three-column file rows that can actually be filed', async () => {
    // The end of the same bug, measured where it hurt: rows carrying an
    // accountName of "-3.50" cannot be routed anywhere.
    const service = createService();
    const csv = 'Date,Description,Amount\n2025-06-01,Coffee,-3.50';

    const result = await service.importTransactions(
      csv,
      service.suggestMappings(['Date', 'Description', 'Amount']),
      [],
      new Map(),
      { skipDuplicates: false }
    );

    expect(result.success).toBe(1);
    expect(result.items[0]).not.toHaveProperty('accountName');
  });

  describe('saved profiles have a life cycle', () => {
    const profile: ImportProfile = {
      id: 'p-1',
      name: 'Barclays monthly',
      mappings: [{ sourceColumn: 'Date', targetField: 'date' }],
      skipDuplicates: true,
      duplicateThreshold: 85
    };

    it('deletes a profile and persists the removal', () => {
      const storage = createStorage({ csvImportProfiles: [profile] });
      const service = createService(storage);

      expect(service.deleteProfile('p-1')).toBe(true);
      expect(service.getProfiles()).toEqual([]);
      expect(JSON.parse(storage.setItem.mock.calls.at(-1)?.[1] ?? 'null')).toEqual([]);
    });

    it('says so, and writes nothing, when there is no such profile to delete', () => {
      const storage = createStorage({ csvImportProfiles: [profile] });
      const service = createService(storage);
      storage.setItem.mockClear();

      expect(service.deleteProfile('p-2')).toBe(false);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(service.getProfiles()).toHaveLength(1);
    });

    it('renames a profile without changing its id', () => {
      const storage = createStorage({ csvImportProfiles: [profile] });
      const service = createService(storage);

      expect(service.renameProfile('p-1', '  Barclays — current account  ')).toBe(true);
      expect(service.getProfiles()[0]).toMatchObject({
        id: 'p-1',
        name: 'Barclays — current account'
      });
    });

    it('refuses a blank rename rather than leaving an unnameable row in the list', () => {
      const service = createService(createStorage({ csvImportProfiles: [profile] }));

      expect(service.renameProfile('p-1', '   ')).toBe(false);
      expect(service.getProfiles()[0].name).toBe('Barclays monthly');
    });

    it('keeps the duplicate settings that were saved with the columns', () => {
      const service = createService(createStorage({ csvImportProfiles: [profile] }));

      expect(service.getProfiles()[0]).toMatchObject({
        skipDuplicates: true,
        duplicateThreshold: 85
      });
    });

    /**
     * Storage is not a type system. This used to be `JSON.parse(saved)` handed
     * back as ImportProfile[] on the strength of the annotation, so anything in
     * that key became "profiles" and the first render to read `.mappings` threw.
     */
    it('ignores anything in storage that is not a profile', () => {
      const service = createService(
        createStorage({
          csvImportProfiles: [
            profile,
            { id: 'no-mappings', name: 'Broken' },
            { name: 'No id', mappings: [] },
            'not an object at all',
            null
          ]
        })
      );

      expect(service.getProfiles().map(p => p.id)).toEqual(['p-1']);
    });

    it('survives a storage value that is not JSON at all', () => {
      const service = createService(createStorage({ csvImportProfiles: '{oh dear' }));

      expect(service.getProfiles()).toEqual([]);
    });

    it('brings lastUsed back as a Date, not the string JSON left behind', () => {
      const service = createService(
        createStorage({
          csvImportProfiles: [{ ...profile, lastUsed: '2025-06-01T00:00:00.000Z' }]
        })
      );

      expect(service.getProfiles()[0].lastUsed).toBeInstanceOf(Date);
    });

    it('keeps a stored date format, and ignores one it does not recognise', () => {
      const service = createService(
        createStorage({
          csvImportProfiles: [
            { ...profile, id: 'p-good', dateFormat: 'DD/MM/YYYY' },
            { ...profile, id: 'p-auto', dateFormat: 'auto' },
            { ...profile, id: 'p-junk', dateFormat: 'DD.MM.YY-ish' }
          ]
        })
      );

      const stored = service.getProfiles();
      expect(stored.find(p => p.id === 'p-good')?.dateFormat).toBe('DD/MM/YYYY');
      // 'auto' is a stored ANSWER too: it means "this file proves its own
      // format", which is worth knowing next month.
      expect(stored.find(p => p.id === 'p-auto')?.dateFormat).toBe('auto');
      // Storage is not a type system. A format this app does not have is
      // dropped rather than carried into the parse, where it would decide
      // nothing and be believed anyway.
      expect(stored.find(p => p.id === 'p-junk')?.dateFormat).toBeUndefined();
    });

    /**
     * ── THE PROFILES FOR THE IMPORT THAT NEVER EXISTED ────────────────────────
     *
     * A profile marked `type: 'account'` could never have imported anything:
     * the wizard's account branch was a `// TODO` that wrote nothing, and
     * latterly a refusal that said so. Its columns name `name`, `balance`,
     * `institution` — fields no transaction has.
     *
     * DECISION: drop them, once, and say so. Coercing one into a transaction
     * profile would be worse than useless — it would apply zero mappings and
     * report every column as "not imported by this app", a profile that does
     * nothing presented as a profile, with no hint of why. Dropping it says
     * what happened; coercing hides that the app ever offered the thing.
     */
    describe('a saved profile for the account import that never existed', () => {
      const accountProfile = {
        id: 'p-acc',
        name: 'Account opening balances',
        type: 'account',
        mappings: [
          { sourceColumn: 'Name', targetField: 'name' },
          { sourceColumn: 'Balance', targetField: 'balance' }
        ]
      };

      it('is dropped rather than coerced into a transaction profile', () => {
        const service = createService(
          createStorage({ csvImportProfiles: [accountProfile, profile] })
        );

        expect(service.getProfiles().map(p => p.id)).toEqual(['p-1']);
      });

      it('is named, so the removal is not itself a silent change', () => {
        const service = createService(createStorage({ csvImportProfiles: [accountProfile] }));

        expect(service.consumeDiscardedProfileNotice()).toEqual(['Account opening balances']);
      });

      it('is said ONCE — reading the notice clears it', () => {
        // A notice about a one-time migration that reappears on every visit is
        // noise, and noise is how the notices that matter get ignored.
        const service = createService(createStorage({ csvImportProfiles: [accountProfile] }));

        expect(service.consumeDiscardedProfileNotice()).toHaveLength(1);
        expect(service.consumeDiscardedProfileNotice()).toEqual([]);
      });

      it('is removed from storage, so it is not dropped again on every load', () => {
        const storage = createStorage({ csvImportProfiles: [accountProfile, profile] });
        createService(storage);

        const written = JSON.parse(storage.setItem.mock.calls.at(-1)?.[1] ?? 'null');
        expect(written).toHaveLength(1);
        expect(written[0].id).toBe('p-1');
      });

      it('leaves a transaction profile alone, and strips the dead field off it', () => {
        // Profiles written before the field was dropped still carry
        // `type: 'transaction'`. They are perfectly good profiles, and the
        // field must not travel back out to storage on the next save.
        const storage = createStorage({
          csvImportProfiles: [{ ...profile, type: 'transaction' }]
        });
        const service = createService(storage);

        expect(service.getProfiles()).toHaveLength(1);
        expect(Object.keys(service.getProfiles()[0])).not.toContain('type');
      });

      it('writes nothing at all when there was nothing dead to remove', () => {
        const storage = createStorage({ csvImportProfiles: [profile] });
        createService(storage);

        expect(storage.setItem).not.toHaveBeenCalled();
      });
    });
  });

  /**
   * ── A FILE WITH A COVERING BLOCK ABOVE ITS TABLE ────────────────────────────
   * Reading line 1 as the headings gave a file with two columns called
   * "Account Name:" and "Everyday Current", no date column and no amount
   * column — and a mapping step offering the user nothing they could use.
   */
  describe('where the column headings are', () => {
    const WITH_PREAMBLE = [
      'Account Name:,"Everyday Current"',
      'Statement period:,"01 Jun 2026 to 30 Jun 2026"',
      '',
      'Date,Description,Amount',
      '2026-06-01,Coffee,-3.50',
      '2026-06-02,Salary,1200.00'
    ].join('\n');

    it('finds them under the covering block, and reports what it skipped', () => {
      const parsed = createService().parseCSV(WITH_PREAMBLE);

      expect(parsed.headers).toEqual(['Date', 'Description', 'Amount']);
      // The blank line counts as a line: the headings are the 3rd record and
      // the 4th line of the file.
      expect(parsed.headerLine).toBe(4);
      expect(parsed.data).toHaveLength(2);
      expect(parsed.lines).toEqual([5, 6]);
      expect(parsed.preamble.map(record => record.raw)).toEqual([
        'Account Name:,"Everyday Current"',
        'Statement period:,"01 Jun 2026 to 30 Jun 2026"'
      ]);
      expect(parsed.headerDetectedBecause).toContain('2 lines above it');
    });

    it('takes a heading line the caller names instead', () => {
      const parsed = createService().parseCSV(WITH_PREAMBLE, { headerLine: 1 });

      expect(parsed.headers).toEqual(['Account Name:', 'Everyday Current']);
      expect(parsed.preamble).toEqual([]);
      // Nothing was detected, so nothing is explained.
      expect(parsed.headerDetectedBecause).toBeNull();
    });

    it('keeps its own answer when the caller names a line no record starts on', () => {
      // Silently rounding to a neighbouring line would move the whole table by
      // one row without saying so.
      const parsed = createService().parseCSV(WITH_PREAMBLE, { headerLine: 99 });

      expect(parsed.headers).toEqual(['Date', 'Description', 'Amount']);
    });

    it('imports from the named heading line, so preview and write agree', async () => {
      const service = createService();
      const result = await service.importTransactions(
        WITH_PREAMBLE,
        [
          { sourceColumn: 'Date', targetField: 'date' },
          { sourceColumn: 'Description', targetField: 'description' },
          { sourceColumn: 'Amount', targetField: 'amount' }
        ],
        [],
        new Map(),
        { skipDuplicates: false }
      );

      expect(result.success).toBe(2);
    });

    it('does not disturb a file whose table starts at the top', () => {
      const parsed = createService().parseCSV('Date,Description,Amount\n2026-06-01,Coffee,-3.50');

      expect(parsed.headerLine).toBe(1);
      expect(parsed.preamble).toEqual([]);
      expect(parsed.headerDetectedBecause).toBeNull();
    });
  });

  /**
   * ── A DESCRIPTION WITH A LINE BREAK IN IT ───────────────────────────────────
   * Split-on-newline turned one transaction into two half-rows — one with no
   * amount, one with no date, both refused — and the figure that WAS in the
   * file simply absent from the register.
   */
  describe('a quoted field that spans lines', () => {
    const MULTILINE = [
      'Date,Description,Amount',
      '2026-06-01,Coffee,-3.50',
      '2026-06-02,"Bluebird Garage',
      'Invoice 4471, parts and labour",-52.40',
      'not-a-date,Mystery line,-10.00'
    ].join('\n');

    const mappings: ColumnMapping[] = [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' }
    ];

    it('reads it as one row, keeping the newline and the comma', () => {
      const parsed = createService().parseCSV(MULTILINE);

      expect(parsed.data).toHaveLength(3);
      expect(parsed.data[1][1]).toBe('Bluebird Garage\nInvoice 4471, parts and labour');
      expect(parsed.data[1][2]).toBe('-52.40');
    });

    /**
     * THE LINE-NUMBER BOOKKEEPING. `rowIndex + 2` assumes a one-line header and
     * a one-line row. The third row here is the 3rd record and the 5th LINE, so
     * the old arithmetic would have sent the reader to line 4 — a row that
     * imported perfectly well.
     */
    it('reports a refusal against the row’s real line in the file', async () => {
      const result = await createService().importTransactions(
        MULTILINE,
        mappings,
        [],
        new Map(),
        { skipDuplicates: false }
      );

      expect(result.success).toBe(2);
      expect(result.errors).toEqual([{ line: 5, error: 'Unreadable date: "not-a-date"' }]);
    });

    it('writes the whole description through the import, not the first line of it', async () => {
      const result = await createService().importTransactions(
        MULTILINE,
        mappings,
        [],
        new Map(),
        { skipDuplicates: false }
      );

      expect(result.items[1]).toMatchObject({
        description: 'Bluebird Garage\nInvoice 4471, parts and labour',
        amount: -52.4
      });
    });
  });

  /**
   * ── THE DATE FORMAT REACHES THE ROWS ────────────────────────────────────────
   * The preview and the write must read the same column the same way. They go
   * through one builder, and the format is an argument to it.
   */
  describe('reading a column of slash dates', () => {
    const csv = 'Date,Description,Amount\n01/06/2026,Coffee,-3.50';
    const mappings: ColumnMapping[] = [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' }
    ];

    it('reads 01/06/2026 as 1 June under DD/MM/YYYY', async () => {
      const result = await createService().importTransactions(csv, mappings, [], new Map(), {
        skipDuplicates: false,
        dateFormat: 'DD/MM/YYYY'
      });

      expect(result.items[0].date?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    });

    it('reads the same cell as 6 January under MM/DD/YYYY', async () => {
      const result = await createService().importTransactions(csv, mappings, [], new Map(), {
        skipDuplicates: false,
        dateFormat: 'MM/DD/YYYY'
      });

      expect(result.items[0].date?.toISOString()).toBe('2026-01-06T00:00:00.000Z');
    });

    it('refuses a 13 in the month position, naming the format and the cure', async () => {
      const result = await createService().importTransactions(
        'Date,Description,Amount\n13/06/2026,Coffee,-3.50',
        mappings,
        [],
        new Map(),
        { skipDuplicates: false, dateFormat: 'MM/DD/YYYY' }
      );

      expect(result.success).toBe(0);
      expect(result.errors[0].error).toContain('There is no month 13');
      expect(result.errors[0].error).toContain('MM/DD/YYYY (month first)');
      expect(result.errors[0].error).toContain('Choose DD/MM/YYYY');
    });

    it('builds the preview under the same format the import uses', () => {
      const service = createService();
      const parsed = service.parseCSV(csv);

      const preview = service.generatePreview(parsed.headers, parsed.data, mappings, 'DD/MM/YYYY');

      expect(preview.transactions[0].date?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    });

    it('hands the date column back with the line each cell sits on', () => {
      const service = createService();
      const parsed = service.parseCSV(
        'Date,Description,Amount\n01/06/2026,Coffee,-3.50\n13/06/2026,Bus,-2.40'
      );

      expect(
        service.dateColumnSamples(parsed.headers, parsed.data, mappings, parsed.lines)
      ).toEqual([
        { value: '01/06/2026', line: 2 },
        { value: '13/06/2026', line: 3 }
      ]);
    });

    it('hands back nothing when no column is mapped to the date', () => {
      const service = createService();
      const parsed = service.parseCSV(csv);

      expect(
        service.dateColumnSamples(parsed.headers, parsed.data, mappings.slice(1), parsed.lines)
      ).toEqual([]);
    });
  });
});
