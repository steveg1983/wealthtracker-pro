import { describe, it, expect, vi } from 'vitest';
import { FinancialSummaryService, type SummaryData } from '../financialSummaryService';
import { toDecimal } from '../../utils/decimal';

const createStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value);
    }),
    dump: () => map
  };
};

const baseSummary: SummaryData = {
  period: 'weekly',
  startDate: new Date('2025-01-06T00:00:00Z'),
  endDate: new Date('2025-01-12T23:59:59Z'),
  totalIncome: toDecimal(1000),
  totalExpenses: toDecimal(500),
  netIncome: toDecimal(500),
  topCategories: [],
  savingsRate: 50,
  accountBalances: [],
  budgetPerformance: [],
  goalProgress: [],
  unusualTransactions: [],
  comparison: {
    incomeChange: 0,
    expenseChange: 0,
    savingsChange: 0
  }
};

describe('FinancialSummaryService (deterministic)', () => {
  it('persists summaries via injected storage and enforces history cap', () => {
    const storage = createStorage();
    const now = new Date('2025-01-13T10:00:00Z');
    const service = new FinancialSummaryService({
      storage,
      now: () => now
    });

    for (let i = 0; i < 55; i++) {
      service.saveSummary({
        ...baseSummary,
        startDate: new Date(baseSummary.startDate.getTime() + i * 7 * 86400000),
        endDate: new Date(baseSummary.endDate.getTime() + i * 7 * 86400000)
      });
    }

    const summaries = JSON.parse(storage.dump().get('financialSummaries') ?? '[]');
    expect(summaries).toHaveLength(52);
    expect(storage.setItem).toHaveBeenCalledWith('lastSummaryGenerated', now.toISOString());
  });

  it('determines summary cadence using injected clock and storage', () => {
    const storage = createStorage();
    storage.getItem.mockImplementation((key: string) =>
      key === 'lastSummaryGenerated' ? new Date('2025-01-06T09:00:00Z').toISOString() : null
    );
    const service = new FinancialSummaryService({
      storage,
      now: () => new Date('2025-01-13T09:00:00Z')
    });

    expect(service.shouldGenerateSummary('weekly')).toBe(true);
    expect(service.shouldGenerateSummary('monthly')).toBe(false);
  });
});
