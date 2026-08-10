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
      type: 'transaction',
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
      type: 'account',
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
      { row: 2, error: 'Unreadable date: "invalid-date"' },
      { row: 3, error: 'No date in this row' }
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
    expect(result.errors).toEqual([{ row: 2, error: 'No amount in this row' }]);
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
      { row: 2, error: expect.stringMatching(/debit\/credit/i) },
      { row: 3, error: expect.stringMatching(/debit\/credit/i) }
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

    const mappings = service.suggestMappings(
      ['Date', 'Transaction type', 'Description', 'Paid out', 'Paid in', 'Balance'],
      'transaction'
    );

    expect(mappings.filter(m => m.targetField === 'amount').map(m => m.sourceColumn)).toEqual([
      'Paid out',
      'Paid in'
    ]);
    expect(mappings.find(m => m.targetField === 'date')?.sourceColumn).toBe('Date');
    expect(mappings.find(m => m.targetField === 'description')?.sourceColumn).toBe('Description');
  });

  it('still maps a single signed Amount column when there is no pair', () => {
    const service = createService();

    const mappings = service.suggestMappings(['Date', 'Description', 'Amount'], 'transaction');

    expect(mappings.filter(m => m.targetField === 'amount').map(m => m.sourceColumn)).toEqual([
      'Amount'
    ]);
  });

  describe('saved profiles have a life cycle', () => {
    const profile: ImportProfile = {
      id: 'p-1',
      name: 'Barclays monthly',
      type: 'transaction',
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
            { id: 'no-mappings', name: 'Broken', type: 'transaction' },
            { name: 'No id', type: 'transaction', mappings: [] },
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
  });
});
