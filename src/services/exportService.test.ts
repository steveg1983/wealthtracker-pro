/**
 * ExportService Tests
 * Validates scheduling and template management flows.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportService } from './exportService';
import { qifImportService } from './qifImportService';
import { ofxImportService } from './ofxImportService';
import type { Transaction, Account } from '../types';

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

  // SIGNED CONVENTION: transactions store SIGNED amounts (expenses negative,
  // income positive). Exports must emit those signed values untouched so that
  // group totals are true nets and QIF/OFX round-trips through the
  // sign-deriving importers are stable.
  describe('signed money exports', () => {
    const makeTransaction = (
      overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'amount' | 'type'>
    ): Transaction => ({
      date: new Date('2025-01-15T12:00:00Z'),
      description: 'Transaction',
      category: 'Uncategorized',
      accountId: 'acc-checking',
      ...overrides
    });

    const makeAccount = (
      overrides: Partial<Account> & Pick<Account, 'id' | 'name' | 'type' | 'balance'>
    ): Account => ({
      currency: 'USD',
      lastUpdated: new Date('2025-01-31T00:00:00Z'),
      ...overrides
    });

    const signedAccounts = () => [
      makeAccount({ id: 'acc-checking', name: 'Everyday Checking', type: 'checking', balance: 1234.5 }),
      makeAccount({ id: 'acc-credit', name: 'Rewards Card', type: 'credit', balance: -250.5 })
    ];

    const signedTransactions = () => [
      makeTransaction({
        id: 'tx-exp',
        amount: -54.99,
        type: 'expense',
        description: 'Coffee beans',
        category: 'Food',
        accountId: 'acc-checking'
      }),
      makeTransaction({
        id: 'tx-inc',
        amount: 100,
        type: 'income',
        description: 'Cashback rebate',
        category: 'Rewards',
        accountId: 'acc-checking'
      })
    ];

    it('exportToCSV with groupBy=category reports SIGNED nets per group (income − expenses)', async () => {
      const service = createService();
      const transactions: Transaction[] = [
        makeTransaction({ id: 't1', amount: -80, type: 'expense', category: 'Food', description: 'Groceries' }),
        makeTransaction({ id: 't2', amount: 30, type: 'income', category: 'Food', description: 'Refund' }),
        makeTransaction({ id: 't3', amount: 1000, type: 'income', category: 'Salary', description: 'Pay' }),
        makeTransaction({ id: 't4', amount: -55, type: 'expense', category: 'Travel', description: 'Train' }),
        makeTransaction({ id: 't5', amount: -20, type: 'expense', category: 'Travel', description: 'Bus' })
      ];

      const csv = await service.exportToCSV(transactions, { groupBy: 'category' });
      const lines = csv.split('\n');

      expect(lines[0]).toBe('id,Group,Count,Total');
      // −80 expense + 30 refund nets to −50; abs-ing would report 110 (or +50)
      expect(lines).toContain('Food,Food,2,-50');
      expect(lines).toContain('Salary,Salary,1,1000');
      // An all-expense group stays negative — never re-signed positive
      expect(lines).toContain('Travel,Travel,2,-75');
    });

    it('exportToCSV group totals keep account balances signed — a negative credit-card balance is never abs-ed', async () => {
      const service = createService();
      // Account objects carry no accountId/account string field, so groupBy
      // 'account' folds them into a single 'Unknown' group whose Total
      // exercises the balance branch of the group-total calculation.
      const csv = await service.exportToCSV(signedAccounts(), { groupBy: 'account' });
      const lines = csv.split('\n');

      // 1234.5 + (−250.5) = 984; abs-ing the credit balance would report 1485
      expect(lines).toContain('Unknown,Unknown,2,984');
      expect(csv).not.toContain('1485');
    });

    it('exportToCSV without grouping emits raw account rows with signed balances', async () => {
      const service = createService();
      const csv = await service.exportToCSV(signedAccounts());
      const creditRow = csv.split('\n').find(line => line.includes('Rewards Card'));

      expect(creditRow).toBeDefined();
      expect(creditRow).toContain('-250.5');
    });

    it('exportToQIF emits SIGNED amounts: expense −54.99 emits T-54.99, income 100 emits T100.00', () => {
      const service = createService();
      const qif = service.exportToQIF({ transactions: signedTransactions(), accounts: signedAccounts() });

      expect(qif).toMatch(/^T-54\.99$/m);
      expect(qif).toMatch(/^T100\.00$/m);
      // Never abs-ed or force-resigned against the stored sign
      expect(qif).not.toMatch(/^T54\.99$/m);
      expect(qif).not.toMatch(/^T-100\.00$/m);
      // Account header keeps the negative credit-card balance negative
      expect(qif).toMatch(/^\$-250\.50$/m);
    });

    it('round-trips exportToQIF output through the sign-deriving QIF importer without corruption', async () => {
      const service = createService();
      const qif = service.exportToQIF({ transactions: signedTransactions(), accounts: signedAccounts() });

      const result = await qifImportService.importTransactions(qif, 'acc-checking', []);
      expect(result.transactions).toHaveLength(2);

      const expense = result.transactions.find(t => t.description.includes('Coffee beans'));
      const income = result.transactions.find(t => t.description.includes('Cashback rebate'));

      expect(expense).toBeDefined();
      expect(expense?.amount).toBe(-54.99);
      expect(expense?.type).toBe('expense');

      expect(income).toBeDefined();
      expect(income?.amount).toBe(100);
      expect(income?.type).toBe('income');
    });

    it('exportToOFX emits SIGNED TRNAMT values and signed ledger balances', () => {
      const service = createService();
      const ofx = service.exportToOFX({ transactions: signedTransactions(), accounts: signedAccounts() });

      expect(ofx).toContain('<TRNAMT>-54.99');
      expect(ofx).toContain('<TRNAMT>100');
      // Never abs-ed or force-resigned against the stored sign
      expect(ofx).not.toContain('<TRNAMT>54.99');
      expect(ofx).not.toContain('<TRNAMT>-100');
      expect(ofx).toContain('<TRNTYPE>DEBIT');
      expect(ofx).toContain('<TRNTYPE>CREDIT');
      // Negative credit-card ledger balance stays negative
      expect(ofx).toContain('<BALAMT>-250.5');
    });

    it('round-trips exportToOFX output through the sign-deriving OFX importer without corruption', async () => {
      const service = createService();
      const ofx = service.exportToOFX({ transactions: signedTransactions(), accounts: signedAccounts() });

      const result = await ofxImportService.importTransactions(ofx, [], []);
      expect(result.transactions).toHaveLength(2);

      const expense = result.transactions.find(t => t.description.includes('Coffee beans'));
      const income = result.transactions.find(t => t.description.includes('Cashback rebate'));

      expect(expense).toBeDefined();
      expect(expense?.amount).toBe(-54.99);
      expect(expense?.type).toBe('expense');

      expect(income).toBeDefined();
      expect(income?.amount).toBe(100);
      expect(income?.type).toBe('income');
    });
  });
});
