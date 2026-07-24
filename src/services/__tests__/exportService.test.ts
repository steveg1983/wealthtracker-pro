import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportService } from '../exportService';
import type { ExportOptions } from '../exportService';

const createStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    dump: () => store
  };
};

const baseOptions: ExportOptions = {
  startDate: new Date('2025-01-01T00:00:00Z'),
  endDate: new Date('2025-01-31T23:59:59Z'),
  format: 'pdf',
  includeCharts: true,
  includeTransactions: true,
  includeAccounts: false,
  includeInvestments: false,
  includeBudgets: false,
  groupBy: 'none'
};

describe('ExportService (deterministic)', () => {
  let storage: ReturnType<typeof createStorage>;
  const fixedDate = new Date('2025-02-01T09:00:00Z');
  let idCounter = 0;

  const buildService = () => {
    idCounter = 0;
    return new ExportService({
      storage,
      now: () => fixedDate,
      idGenerator: () => `id-${++idCounter}`
    });
  };

  beforeEach(() => {
    storage = createStorage();
    vi.clearAllMocks();
  });

  it('creates templates with injected id and timestamps', () => {
    const service = buildService();
    const template = service.createTemplate({
      name: 'Custom',
      description: '',
      options: baseOptions,
      isDefault: false
    });

    expect(template.id).toBe('id-1');
    expect(template.createdAt).toEqual(fixedDate);
    expect(storage.setItem).toHaveBeenCalledWith(
      'export-templates',
      expect.stringContaining('Custom')
    );
  });

  // Scheduled-report tests were removed with the scheduled-export feature — it
  // was client-only theatre (nothing ran server-side), so both the UI and the
  // orphaned exportService methods it exercised are gone.
});
