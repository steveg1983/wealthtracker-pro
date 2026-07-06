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

  it('falls back to the injected clock when a date cannot be parsed', async () => {
    const storage = createStorage();
    const service = createService(storage);
    const csv = 'Date,Description,Amount\ninvalid-date,Coffee,-12.50';
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
    expect(result.items[0].id).toBe(`import-${FIXED_NOW}-0-0`);
    expect(result.items[0].date?.toISOString()).toBe('2025-06-01T00:00:00.000Z');
    // Signed convention: an imported expense must be stored negative.
    expect(result.items[0].amount).toBe(-12.5);
    expect(result.items[0].type).toBe('expense');
    expect(logger.warn).toHaveBeenCalledWith('Cannot parse date: invalid-date, using today\'s date');
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

    const preview = service.generatePreview([header, ...rows], mappings);

    // Header row (unparseable amount) and zero row are skipped.
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
});
