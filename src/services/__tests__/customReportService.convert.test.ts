/**
 * The custom-report flows seam (24 Aug — the LAST surface still summing
 * native units): aggregating generators receive rows already converted at
 * each row's own day's factor; the table generator keeps the raw rows,
 * because a listed transaction prints its own money and only aggregates
 * convert. Every figure below is invented; the repo is public.
 */
import { describe, it, expect } from 'vitest';
import { customReportService } from '../customReportService';
import { toDecimal } from '../../utils/decimal';
import type { FlowFactorResolver } from '../../utils/incomeExpense';
import type { Account, Category, Transaction } from '../../types';
import type { CustomReport } from '../../components/CustomReportBuilder';

const ACCOUNTS: Account[] = [
  { id: 'acc-gbp', name: 'Test Sterling', type: 'current', balance: 0, currency: 'GBP', lastUpdated: new Date(2026, 6, 1), openingBalance: 0 },
  { id: 'acc-usd', name: 'Test Dollar', type: 'savings', balance: 0, currency: 'USD', lastUpdated: new Date(2026, 6, 1), openingBalance: 0 },
];

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'cat-pay', name: 'Pay', type: 'income', level: 'detail', parentId: 'type-income' },
];

const TRANSACTIONS: Transaction[] = [
  { id: 't-gbp', date: new Date(2026, 6, 10), amount: 100, description: 'synthetic', category: 'cat-pay', accountId: 'acc-gbp', type: 'income', cleared: false },
  { id: 't-usd', date: new Date(2026, 6, 12), amount: 200, description: 'synthetic', category: 'cat-pay', accountId: 'acc-usd', type: 'income', cleared: false },
];

const REPORT: CustomReport = {
  id: 'r-1',
  name: 'Synthetic report',
  description: '',
  components: [
    { id: 'c-stats', type: 'summary-stats', config: {}, width: 'full' },
    { id: 'c-table', type: 'table', config: {}, width: 'full' },
  ],
  filters: { dateRange: 'custom', customStartDate: '2026-07-01', customEndDate: '2026-07-31' },
  createdAt: new Date(2026, 6, 1),
  updatedAt: new Date(2026, 6, 1),
};

/** Dollars at 0.8 to the display unit; sterling needs no factor. */
const convert: FlowFactorResolver = row =>
  row.accountId === 'acc-usd' ? toDecimal(0.8) : null;

const dataset = { transactions: TRANSACTIONS, accounts: ACCOUNTS, budgets: [], categories: CATEGORIES };

describe('the custom-report flows seam', () => {
  it('aggregates convert at each row’s own factor; listed table rows stay native', async () => {
    const generated = await customReportService.generateReportData(REPORT, dataset, convert);
    const stats = generated.data['c-stats'] as { income: number };
    // 100 native + 200 × 0.8 — never 100 + 200.
    expect(stats.income).toBe(260);
    const table = generated.data['c-table'] as Array<{ amount: number }>;
    // The dollar row prints its own 200 — rows are native everywhere.
    expect(table.map(r => r.amount).sort((a, b) => a - b)).toEqual([100, 200]);
    expect(generated.holdsForeign).toBe(true);
  });

  it('without the seam everything sums native and says so', async () => {
    const generated = await customReportService.generateReportData(REPORT, dataset);
    const stats = generated.data['c-stats'] as { income: number };
    expect(stats.income).toBe(300);
    expect(generated.holdsForeign).toBe(false);
  });
});
