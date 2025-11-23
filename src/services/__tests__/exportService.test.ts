import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportService } from '../exportService';
import type { ScheduledReport, ExportOptions } from '../exportService';

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

  it('creates scheduled reports with deterministic next runs', () => {
    const service = buildService();
    const report = service.createScheduledReport({
      name: 'Weekly Digest',
      email: 'demo@example.com',
      frequency: 'weekly',
      options: baseOptions,
      isActive: true,
      lastRun: undefined
    } as Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>);

    expect(report.id).toBe('id-1');
    expect(report.createdAt).toEqual(fixedDate);
    expect(report.nextRun.getDay()).toBe(6); // 7 days after Feb 1 2025 (Saturday)
    expect(storage.setItem).toHaveBeenCalledWith(
      'scheduled-reports',
      expect.stringContaining('Weekly Digest')
    );
  });

  it('loads scheduled reports from injected storage', () => {
    const saved = [
      {
        id: 'persisted',
        name: 'Persisted Report',
        frequency: 'monthly',
        email: 'demo@example.com',
        options: baseOptions,
        nextRun: fixedDate.toISOString(),
        isActive: true,
        createdAt: fixedDate.toISOString()
      }
    ];
    storage.getItem.mockImplementation((key: string) => {
      if (key === 'scheduled-reports') {
        return JSON.stringify(saved);
      }
      if (key === 'export-templates') {
        return JSON.stringify([]);
      }
      return null;
    });

    const service = buildService();
    expect(service.getScheduledReports()[0].id).toBe('persisted');
  });
});
