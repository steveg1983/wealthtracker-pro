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
    expect(logger.warn).toHaveBeenCalledWith('Cannot parse date: invalid-date, using today\'s date');
  });
});
