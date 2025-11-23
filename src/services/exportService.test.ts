/**
 * ExportService Tests
 * Validates scheduling and template management flows.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportService } from './exportService';

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

const FIXED_NOW = new Date('2025-01-01T08:00:00.000Z');

describe('ExportService', () => {
  let storage: ReturnType<typeof createStorage>;

  beforeEach(() => {
    storage = createStorage();
  });

  const createService = () =>
    new ExportService({
      storage,
      now: () => new Date(FIXED_NOW),
      idGenerator: () => `id-${Math.random().toString(36).slice(2, 8)}`
    });

  it('creates scheduled reports and persists them with calculated next run', () => {
    const service = createService();
    const report = service.createScheduledReport({
      name: 'Weekly Summary',
      frequency: 'weekly',
      email: 'team@example.com',
      isActive: true,
      options: {
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-31'),
        format: 'csv',
        includeTransactions: true,
        includeCharts: false,
        includeAccounts: false,
        includeInvestments: false,
        includeBudgets: false,
      }
    });

    expect(report.id).toMatch(/^id-/);
    expect(report.nextRun.toISOString()).toBe('2025-01-08T09:00:00.000Z');
    expect(storage.setItem).toHaveBeenCalledWith(
      'scheduled-reports',
      expect.stringContaining('"name":"Weekly Summary"')
    );
    expect(service.getScheduledReports()).toHaveLength(1);
  });

  it('updates scheduled report frequency and recalculates next run', () => {
    const service = createService();
    const report = service.createScheduledReport({
      name: 'Monthly Budget',
      frequency: 'monthly',
      email: 'finance@example.com',
      isActive: true,
      options: {
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-31'),
        format: 'pdf',
        includeTransactions: false,
        includeCharts: true,
        includeAccounts: true,
        includeInvestments: false,
        includeBudgets: true,
      }
    });

    const updated = service.updateScheduledReport(report.id, { frequency: 'daily' });
    expect(updated?.frequency).toBe('daily');
    expect(updated?.nextRun.toISOString()).toBe('2025-01-02T09:00:00.000Z');
  });

  it('manages export templates via storage-backed persistence', () => {
    const service = createService();
    const template = service.createTemplate({
      name: 'Quarterly Board Pack',
      description: 'Includes charts and account summaries',
      options: {
        startDate: new Date('2024-10-01'),
        endDate: new Date('2024-12-31'),
        format: 'pdf',
        includeCharts: true,
        includeTransactions: true,
        includeAccounts: true,
        includeInvestments: true,
        includeBudgets: false,
      },
      isDefault: false
    });

    expect(template.id).toMatch(/^id-/);
    expect(storage.setItem).toHaveBeenCalledWith(
      'export-templates',
      expect.stringContaining('"name":"Quarterly Board Pack"')
    );

    const updated = service.updateTemplate(template.id, { description: 'Updated description' });
    expect(updated?.description).toBe('Updated description');

    const deleted = service.deleteTemplate(template.id);
    expect(deleted).toBe(true);
  });
});
