import { describe, it, expect } from 'vitest';
import {
  BACKUP_ENTITIES,
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  RESTORE_STEPS,
  backupFileName,
  buildBackupBundle,
  MAX_EXACT_MONEY,
  chunkRows,
  extractAccountParents,
  extractTransactionLinks,
  rowsForStep,
  transactionDateRange,
  validateBackupBundle,
  type BackupRow,
} from './backupService';

// Every value below is invented. The shapes mirror the database's own columns
// (snake_case, whole rows) because that is exactly what a real backup carries.

const account = (over: Partial<BackupRow> = {}): BackupRow => ({
  id: 'a-1',
  user_id: 'u-1',
  name: 'Current',
  type: 'checking',
  balance: 1234.56,
  parent_account_id: null,
  ...over,
});

const transaction = (over: Partial<BackupRow> = {}): BackupRow => ({
  id: 't-1',
  user_id: 'u-1',
  account_id: 'a-1',
  date: '2021-06-06',
  amount: -80,
  linked_transfer_id: null,
  linked_transfer_split_id: null,
  ...over,
});

const category = (over: Partial<BackupRow> = {}): BackupRow => ({
  id: 'c-1',
  user_id: 'u-1',
  name: 'Food',
  type: 'expense',
  level: 'sub',
  parent_id: 'c-0',
  ...over,
});

/** A bundle good enough to pass validation, so each test can break one thing. */
const goodBundle = (over: Record<string, unknown> = {}): Record<string, unknown> =>
  JSON.parse(JSON.stringify({
    ...buildBackupBundle({
      sourceUserId: 'u-1',
      exportedAt: '2026-08-07T09:30:00.000Z',
      data: {
        accounts: [account()],
        categories: [category({ level: 'type', parent_id: null })],
        transactions: [transaction()],
      },
    }),
    ...over,
  })) as Record<string, unknown>;

describe('buildBackupBundle', () => {
  it('writes an entry for every table, empty ones included', () => {
    const bundle = buildBackupBundle({
      sourceUserId: 'u-1',
      exportedAt: '2026-08-07T09:30:00.000Z',
      data: { accounts: [account()] },
    });

    expect(Object.keys(bundle.data).sort()).toEqual([...BACKUP_ENTITIES].sort());
    expect(bundle.data.investments).toEqual([]);
    // A reader must not have to tell "no investments" from "forgot investments".
    expect(bundle.counts.investments).toBe(0);
    expect(bundle.counts.accounts).toBe(1);
  });

  it('stamps the format and schema version the restore checks', () => {
    const bundle = buildBackupBundle({
      sourceUserId: 'u-1',
      exportedAt: '2026-08-07T09:30:00.000Z',
      data: {},
    });

    expect(bundle.format).toBe(BACKUP_FORMAT);
    expect(bundle.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(bundle.exportedAt).toBe('2026-08-07T09:30:00.000Z');
    expect(bundle.sourceUserId).toBe('u-1');
  });

  it('keeps whole rows verbatim, including columns this code has never heard of', () => {
    const exotic = account({ some_column_added_next_year: 'kept', balance: 1234.56 });
    const bundle = buildBackupBundle({
      sourceUserId: 'u-1',
      exportedAt: '2026-08-07T09:30:00.000Z',
      data: { accounts: [exotic] },
    });

    expect(bundle.data.accounts[0]).toEqual(exotic);
    expect(bundle.data.accounts[0].some_column_added_next_year).toBe('kept');
  });

  it('counts match the arrays they describe', () => {
    const bundle = buildBackupBundle({
      sourceUserId: 'u-1',
      exportedAt: '2026-08-07T09:30:00.000Z',
      data: { transactions: [transaction({ id: 't-1' }), transaction({ id: 't-2' })] },
    });

    expect(bundle.counts.transactions).toBe(bundle.data.transactions.length);
  });
});

describe('link extraction', () => {
  it('carries only the accounts that actually hang under another one', () => {
    const links = extractAccountParents([
      account({ id: 'a-1', parent_account_id: null }),
      account({ id: 'a-2', parent_account_id: 'a-1' }),
      account({ id: 'a-3' }),
    ]);

    expect(links).toEqual([{ id: 'a-2', parent_account_id: 'a-1' }]);
  });

  it('carries only transactions with at least one link, keeping the null half', () => {
    const links = extractTransactionLinks([
      transaction({ id: 't-1' }),
      transaction({ id: 't-2', linked_transfer_id: 't-3' }),
      transaction({ id: 't-4', linked_transfer_split_id: 's-9' }),
    ]);

    // An unlinked row must not appear: finalize UPDATEs what it is given, and
    // an UPDATE re-dates updated_at on every row it touches.
    expect(links).toEqual([
      { id: 't-2', linked_transfer_id: 't-3', linked_transfer_split_id: null },
      { id: 't-4', linked_transfer_id: null, linked_transfer_split_id: 's-9' },
    ]);
  });

  it('ignores rows with no id rather than emitting a link that points nowhere', () => {
    expect(extractAccountParents([{ parent_account_id: 'a-1' }])).toEqual([]);
    expect(extractTransactionLinks([{ linked_transfer_id: 't-1' }])).toEqual([]);
  });

  it('builds both link lists into the bundle', () => {
    const bundle = buildBackupBundle({
      sourceUserId: 'u-1',
      exportedAt: '2026-08-07T09:30:00.000Z',
      data: {
        accounts: [account({ id: 'a-2', parent_account_id: 'a-1' })],
        transactions: [transaction({ id: 't-2', linked_transfer_id: 't-3' })],
      },
    });

    expect(bundle.links.account_parents).toHaveLength(1);
    expect(bundle.links.transaction_links).toHaveLength(1);
  });
});

describe('validateBackupBundle', () => {
  it('accepts a bundle this module just built', () => {
    const result = validateBackupBundle(goodBundle());
    expect(result.ok).toBe(true);
  });

  it('refuses anything that is not a JSON object', () => {
    const result = validateBackupBundle([1, 2, 3]);
    expect(result).toEqual({ ok: false, problem: expect.stringContaining('an array') });
  });

  it('names the old export format instead of failing vaguely', () => {
    const result = validateBackupBundle({
      format: 'wealthtracker-complete-export-v1',
      data: {},
      counts: {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toContain('wealthtracker-complete-export-v1');
    expect(result.problem).toContain(BACKUP_FORMAT);
  });

  it('refuses a file whose data is not an object', () => {
    const result = validateBackupBundle({ format: BACKUP_FORMAT, data: 'nope', counts: {} });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toContain('"data"');
  });

  it('refuses a table this version cannot restore, and says which', () => {
    const bundle = goodBundle();
    const data = bundle.data as Record<string, unknown>;
    data.mystery_table = [];

    const result = validateBackupBundle(bundle);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toContain('mystery_table');
  });

  it('refuses an entity that is not an array', () => {
    const bundle = goodBundle();
    (bundle.data as Record<string, unknown>).budgets = { a: 1 };

    const result = validateBackupBundle(bundle);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toContain('"data.budgets"');
  });

  it('refuses an entity holding something that is not a row, pointing at which one', () => {
    const bundle = goodBundle();
    (bundle.data as Record<string, unknown>).goals = [{ id: 'g-1' }, 'oops'];
    (bundle.counts as Record<string, unknown>).goals = 2;

    const result = validateBackupBundle(bundle);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toContain('entry 2');
  });

  it('refuses a file whose counts disagree with its rows', () => {
    const bundle = goodBundle();
    (bundle.counts as Record<string, unknown>).transactions = 99;

    const result = validateBackupBundle(bundle);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toContain('99');
    expect(result.problem).toContain('carries 1');
  });

  it('refuses a category level the level-by-level restore would drop on the floor', () => {
    const bundle = goodBundle();
    (bundle.data as Record<string, BackupRow[]>).categories = [category({ level: 'group' })];

    const result = validateBackupBundle(bundle);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toContain('group');
    expect(result.problem).toContain('type, sub or detail');
  });

  it('accepts a file with no links at all', () => {
    const bundle = goodBundle();
    delete bundle.links;

    const result = validateBackupBundle(bundle);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.links).toEqual({ account_parents: [], transaction_links: [] });
  });

  it('refuses a link entry missing the id it would have to patch', () => {
    const bundle = goodBundle({
      links: { account_parents: [{ parent_account_id: 'a-1' }], transaction_links: [] },
    });

    const result = validateBackupBundle(bundle);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toContain('account_parents');
  });

  it('fills in tables the file leaves out rather than refusing an older export', () => {
    const bundle = goodBundle();
    delete (bundle.data as Record<string, unknown>).widget_preferences;
    delete (bundle.counts as Record<string, unknown>).widget_preferences;

    const result = validateBackupBundle(bundle);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.data.widget_preferences).toEqual([]);
    expect(result.bundle.counts.widget_preferences).toBe(0);
  });

  it('hands back whole rows untouched', () => {
    const bundle = goodBundle();
    (bundle.data as Record<string, BackupRow[]>).accounts = [account({ odd_column: 'kept' })];

    const result = validateBackupBundle(bundle);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.data.accounts[0].odd_column).toBe('kept');
  });
});

describe('restore ordering', () => {
  it('sends accounts first and categories level by level', () => {
    expect(RESTORE_STEPS.map((step) => `${step.entity}${step.level ? `:${step.level}` : ''}`)).toEqual([
      'accounts',
      'categories:type',
      'categories:sub',
      'categories:detail',
      'budgets',
      'goals',
      'investments',
      'investment_transactions',
      'transactions',
      'transaction_splits',
      'goal_contributions',
      'recurring_transactions',
      'notifications',
      'dashboard_layouts',
      'widget_preferences',
      'suggestion_dismissals',
    ]);
  });

  it('splits categories by level and leaves other entities whole', () => {
    const bundle = buildBackupBundle({
      sourceUserId: 'u-1',
      exportedAt: '2026-08-07T09:30:00.000Z',
      data: {
        categories: [
          category({ id: 'c-1', level: 'type' }),
          category({ id: 'c-2', level: 'sub' }),
          category({ id: 'c-3', level: 'detail' }),
        ],
        transactions: [transaction()],
      },
    });

    expect(rowsForStep(bundle, { entity: 'categories', level: 'sub', label: '' })).toHaveLength(1);
    expect(rowsForStep(bundle, { entity: 'transactions', label: '' })).toHaveLength(1);
  });

  it('every entity in the backup has somewhere to go', () => {
    const covered = new Set(RESTORE_STEPS.map((step) => step.entity));
    expect([...covered].sort()).toEqual([...BACKUP_ENTITIES].sort());
  });
});

describe('chunkRows', () => {
  it('returns nothing for an empty list, so no pointless round trip happens', () => {
    expect(chunkRows([])).toEqual([]);
  });

  it('splits at the requested size with the remainder last', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: `r-${i}` }));
    expect(chunkRows(rows, 2).map((chunk) => chunk.length)).toEqual([2, 2, 1]);
  });

  it('keeps every row exactly once and in order', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ id: `r-${i}` }));
    expect(chunkRows(rows, 3).flat()).toEqual(rows);
  });
});

describe('transactionDateRange', () => {
  it('reports the earliest and latest date in the file', () => {
    const bundle = buildBackupBundle({
      sourceUserId: 'u-1',
      exportedAt: '2026-08-07T09:30:00.000Z',
      data: {
        transactions: [
          transaction({ id: 't-1', date: '2021-06-06' }),
          transaction({ id: 't-2', date: '2019-01-31' }),
          transaction({ id: 't-3', date: '2024-12-25' }),
        ],
      },
    });

    expect(transactionDateRange(bundle)).toEqual({ first: '2019-01-31', last: '2024-12-25' });
  });

  it('says nothing rather than guessing when there are no transactions', () => {
    const bundle = buildBackupBundle({ sourceUserId: 'u-1', exportedAt: '2026-08-07T09:30:00.000Z', data: {} });
    expect(transactionDateRange(bundle)).toBeNull();
  });
});

describe('backupFileName', () => {
  it('dates the file from when it was exported', () => {
    expect(backupFileName('2026-08-07T09:30:00.000Z')).toBe('wealthtracker-backup-2026-08-07.json');
  });

  it('still produces a usable name when the timestamp is unreadable', () => {
    expect(backupFileName('not a date')).toMatch(/^wealthtracker-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe('money precision guard', () => {
  it('passes every realistic money value through untouched', () => {
    const bundle = buildBackupBundle({
      exportedAt: '2026-08-07T00:00:00.000Z',
      sourceUserId: 'u1',
      data: {
        accounts: [{ id: 'a1', balance: 1234.56, initial_balance: 0.07 }],
        transactions: [{ id: 't1', amount: -0.29 }, { id: 't2', amount: 99999999999.99 }],
      },
    });
    expect(bundle.data.accounts[0].balance).toBe(1234.56);
    expect(bundle.data.transactions[1].amount).toBe(99999999999.99);
  });

  it('refuses to write a backup that would silently change an amount', () => {
    // Written as an expression, not a literal: the literal itself would lose
    // precision at parse time, which is the very thing being guarded against
    // (and eslint's no-loss-of-precision rightly rejects it).
    const tooBig = MAX_EXACT_MONEY * 10;
    expect(() => buildBackupBundle({
      exportedAt: '2026-08-07T00:00:00.000Z',
      sourceUserId: 'u1',
      data: { transactions: [{ id: 'huge', amount: tooBig }] },
    })).toThrow(/lose precision/);
  });

  it('names the row and field so the offending record can be found', () => {
    expect(() => buildBackupBundle({
      exportedAt: '2026-08-07T00:00:00.000Z',
      sourceUserId: 'u1',
      data: { accounts: [{ id: 'acc-42', balance: 1e15 }] },
    })).toThrow(/acc-42.*balance/);
  });
});
