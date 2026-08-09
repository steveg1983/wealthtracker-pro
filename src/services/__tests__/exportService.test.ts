/**
 * ExportService tests — templates (stored as a RULE, not two dates) and the
 * signed-money interchange writers (QIF/OFX).
 *
 * Merged from the two files that used to cover this service separately and
 * both covered template CRUD; PDF/CSV coverage went with the PDF and CSV
 * builders, which now live in utils/pdfExport and utils/csvExport.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportService, inferRelativeRange, type ExportOptions } from '../exportService';
import { qifImportService } from '../qifImportService';
import { ofxImportService } from '../ofxImportService';
import type { Transaction, Account, Category } from '../../types';

const createStorage = (initial: Record<string, unknown> = {}) => {
  const backing = new Map<string, string>();
  Object.entries(initial).forEach(([key, value]) => {
    backing.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  });

  return {
    getItem: vi.fn((key: string) => backing.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      backing.set(key, value);
    }),
    raw: backing
  };
};

const FIXED_NOW = new Date('2025-06-15T08:00:00.000Z');

const baseOptions: ExportOptions = {
  range: 'this-month',
  customStart: '',
  customEnd: '',
  format: 'pdf',
  includeTransactions: true,
  includeAccounts: false
};

describe('ExportService', () => {
  let storage: ReturnType<typeof createStorage>;
  let idCounter = 0;

  beforeEach(() => {
    storage = createStorage();
    idCounter = 0;
  });

  const createService = (store: ReturnType<typeof createStorage> = storage) =>
    new ExportService({
      storage: store,
      now: () => new Date(FIXED_NOW),
      idGenerator: () => `id-${++idCounter}`
    });

  describe('templates', () => {
    it('creates a template with the injected id and timestamp, and persists it', () => {
      const service = createService();
      const template = service.createTemplate({
        name: 'Quarterly Board Pack',
        description: 'Accounts and transactions',
        options: { ...baseOptions, includeAccounts: true },
        isStarter: false
      });

      expect(template.id).toBe('id-1');
      expect(template.createdAt).toEqual(FIXED_NOW);
      expect(storage.setItem).toHaveBeenCalledWith(
        'export-templates',
        expect.stringContaining('"name":"Quarterly Board Pack"')
      );
    });

    /**
     * The point of the whole redesign: a template holds the RULE ("last
     * month"), so reusing it next year still means last month. Nothing the
     * user chose is dropped on the way in or the way out.
     */
    it('round-trips every saved option, keeping the period as a rule', () => {
      const service = createService();
      const saved = service.createTemplate({
        name: 'Last month, as OFX',
        description: '',
        options: {
          range: 'last-month',
          customStart: '',
          customEnd: '',
          format: 'ofx',
          includeTransactions: true,
          includeAccounts: true
        },
        isStarter: false
      });

      // A fresh service reading the same storage — i.e. the next visit.
      const reloaded = createService().getTemplates().find(t => t.id === saved.id);

      expect(reloaded).toBeDefined();
      expect(reloaded?.options).toEqual({
        range: 'last-month',
        customStart: '',
        customEnd: '',
        format: 'ofx',
        includeTransactions: true,
        includeAccounts: true
      });
    });

    it('keeps the exact dates of a custom range', () => {
      const service = createService();
      service.createTemplate({
        name: 'Audit window',
        description: '',
        options: {
          range: 'custom',
          customStart: '2024-04-06',
          customEnd: '2024-07-05',
          format: 'csv',
          includeTransactions: true,
          includeAccounts: false
        },
        isStarter: false
      });

      const reloaded = createService().getTemplates().find(t => t.name === 'Audit window');
      expect(reloaded?.options.range).toBe('custom');
      expect(reloaded?.options.customStart).toBe('2024-04-06');
      expect(reloaded?.options.customEnd).toBe('2024-07-05');
    });

    it('seeds starter templates into a store it has never seen', () => {
      const service = createService();
      const names = service.getTemplates().map(t => t.name);

      expect(names).toEqual(['Monthly Summary', 'Transaction Report']);
      expect(service.getTemplates().every(t => t.isStarter)).toBe(true);
    });

    // Every template is deletable — the "Default" badge used to disable the
    // delete button, which made three of them permanent.
    it('deletes starter templates like any other', () => {
      const service = createService();
      const starter = service.getTemplates()[0];

      expect(starter.isStarter).toBe(true);
      expect(service.deleteTemplate(starter.id)).toBe(true);
      expect(service.getTemplates().map(t => t.id)).not.toContain(starter.id);
    });

    /**
     * Deleting the last template must leave an empty list, not bring the
     * starters back. Judging the store by "is it empty?" made the starters
     * undeletable however many times you deleted them.
     */
    it('does not reseed after every template has been deleted', () => {
      const service = createService();
      for (const template of service.getTemplates()) {
        service.deleteTemplate(template.id);
      }
      expect(service.getTemplates()).toHaveLength(0);

      // Next visit.
      expect(createService().getTemplates()).toHaveLength(0);
    });

    it('does not seed starters over templates the user already has', () => {
      const existing = createStorage({
        'export-templates': [
          {
            id: 'mine',
            name: 'Mine',
            description: '',
            options: {
              range: 'all',
              customStart: '',
              customEnd: '',
              format: 'csv',
              includeTransactions: true,
              includeAccounts: false
            },
            isStarter: false,
            createdAt: '2025-01-01T00:00:00.000Z'
          }
        ]
      });

      const templates = createService(existing).getTemplates();
      expect(templates.map(t => t.name)).toEqual(['Mine']);
    });
  });

  /**
   * Templates written before periods became rules hold two fixed dates. They
   * are read back as the rule they were standing in for, judged against the
   * day they were saved — and where no rule fits, the dates the user actually
   * chose are kept rather than guessed away.
   */
  describe('migrating templates saved with absolute dates', () => {
    const legacyTemplate = (options: Record<string, unknown>, createdAt: string) => ({
      id: 'legacy',
      name: 'Legacy',
      description: 'Saved by an older build',
      options,
      isDefault: true,
      createdAt
    });

    const migrate = (options: Record<string, unknown>, createdAt: string) => {
      const store = createStorage({ 'export-templates': [legacyTemplate(options, createdAt)] });
      const template = createService(store).getTemplates()[0];
      return template;
    };

    it('reads a whole calendar month saved in that month as "this month"', () => {
      const template = migrate(
        {
          startDate: '2025-03-01T00:00:00.000Z',
          endDate: '2025-03-31T00:00:00.000Z',
          format: 'pdf',
          includeTransactions: true,
          includeAccounts: true
        },
        '2025-03-20T00:00:00.000Z'
      );

      expect(template.options.range).toBe('this-month');
      expect(template.options.format).toBe('pdf');
      expect(template.options.includeAccounts).toBe(true);
    });

    it('reads the month before the saving month as "last month"', () => {
      const template = migrate(
        {
          startDate: '2025-02-01T00:00:00.000Z',
          endDate: '2025-02-28T00:00:00.000Z',
          format: 'csv',
          includeTransactions: true,
          includeAccounts: false
        },
        '2025-03-20T00:00:00.000Z'
      );

      expect(template.options.range).toBe('last-month');
    });

    it('keeps a window that fits no rule as a custom range, dates intact', () => {
      const template = migrate(
        {
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-03-20T00:00:00.000Z',
          format: 'pdf',
          includeTransactions: true,
          includeAccounts: false
        },
        '2025-03-20T00:00:00.000Z'
      );

      expect(template.options.range).toBe('custom');
      expect(template.options.customStart).toBe('2025-01-01');
      expect(template.options.customEnd).toBe('2025-03-20');
    });

    it('carries the old isDefault flag across as a starter LABEL, still deletable', () => {
      const store = createStorage({
        'export-templates': [
          legacyTemplate(
            {
              startDate: '2025-03-01T00:00:00.000Z',
              endDate: '2025-03-31T00:00:00.000Z',
              format: 'pdf',
              includeTransactions: true,
              includeAccounts: true
            },
            '2025-03-20T00:00:00.000Z'
          )
        ]
      });
      const service = createService(store);

      expect(service.getTemplates()[0].isStarter).toBe(true);
      expect(service.deleteTemplate('legacy')).toBe(true);
      expect(service.getTemplates()).toHaveLength(0);
    });

    // 'xlsx' and 'json' were switch cases that returned an empty buffer and a
    // raw JSON dump. Neither is offered now, so a template holding one falls
    // back to the format that always works rather than failing at click time.
    it('falls back to CSV for a format this page cannot write', () => {
      const template = migrate(
        {
          startDate: '2025-03-01T00:00:00.000Z',
          endDate: '2025-03-31T00:00:00.000Z',
          format: 'xlsx',
          includeTransactions: true,
          includeAccounts: false
        },
        '2025-03-20T00:00:00.000Z'
      );

      expect(template.options.format).toBe('csv');
    });

    it('drops a record it cannot make sense of rather than half-restoring it', () => {
      const store = createStorage({
        'export-templates': [{ nonsense: true }, 'not an object']
      });

      expect(createService(store).getTemplates()).toHaveLength(0);
    });
  });

  describe('inferRelativeRange', () => {
    it('recognises the tax year still running', () => {
      const inferred = inferRelativeRange(
        new Date(2025, 3, 6),
        new Date(2026, 3, 5),
        new Date(2025, 8, 1)
      );
      expect(inferred.range).toBe('tax-year');
    });

    it('does not force a two-month window into a rule', () => {
      const inferred = inferRelativeRange(
        new Date(2025, 0, 15),
        new Date(2025, 2, 15),
        new Date(2025, 2, 20)
      );
      expect(inferred).toEqual({ range: 'custom', customStart: '2025-01-15', customEnd: '2025-03-15' });
    });
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

    /**
     * The L field is what the receiving app turns into a category. A UUID
     * there creates a category called "cat-groceries" wherever the file lands.
     * QIF spells a subcategory Parent:Child, unpadded.
     */
    it('exportToQIF writes category NAMES, never ids', () => {
      const service = createService();
      const categories: Category[] = [
        { id: 'cat-food', name: 'Food', type: 'expense', level: 'sub' },
        { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'cat-food' }
      ];
      const transactions = [
        makeTransaction({
          id: 'tx-1',
          amount: -12.5,
          type: 'expense',
          description: 'Corner shop',
          category: 'cat-groceries',
          accountId: 'acc-checking'
        })
      ];

      const qif = service.exportToQIF({
        transactions,
        accounts: [signedAccounts()[0]],
        categories
      });

      expect(qif).toMatch(/^LFood:Groceries$/m);
      expect(qif).not.toContain('cat-groceries');
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

    // CURDEF was hard-coded to USD, in an app whose default currency is GBP.
    it('exportToOFX declares the account currency, not a hard-coded one', () => {
      const service = createService();
      const ofx = service.exportToOFX({
        transactions: [],
        accounts: [makeAccount({ id: 'a', name: 'Current', type: 'current', balance: 10, currency: 'GBP' })]
      });

      expect(ofx).toContain('<CURDEF>GBP');
      expect(ofx).not.toContain('<CURDEF>USD');
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
