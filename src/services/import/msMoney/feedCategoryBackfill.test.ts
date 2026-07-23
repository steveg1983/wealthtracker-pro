import { describe, it, expect } from 'vitest';
import {
  planFeedCategoryBackfill,
  summariseByCategoryGroup,
  compareBackfillBaseline,
  applyCategoryBackfill,
  batchedIds,
  proposalKey,
  BACKFILL_PLAN_VERSION,
  type BackedUpFileRow,
  type LiveFeedRow,
  type CategoryRow,
  type CategoryProposal,
  type BackfillBaseline,
  type MutationOutcome,
  type UpdateQuery,
  type UpdateClient,
} from './feedCategoryBackfill';

// Every value here is invented. The shapes mirror the transactions and
// categories tables and the backup the re-import wrote; none of it came from a
// real database, and no amount, payee or account name below is anyone's.

const file = (over: Partial<BackedUpFileRow> & Pick<BackedUpFileRow, 'id'>): BackedUpFileRow => ({
  account_id: 'acct-1',
  date: '2026-05-04',
  amount: '-12.34',
  description: 'SHOP',
  category: 'cat-food',
  type: 'expense',
  is_split: false,
  external_transaction_id: null,
  ...over,
});

const feed = (over: Partial<LiveFeedRow> & Pick<LiveFeedRow, 'id'>): LiveFeedRow => ({
  account_id: 'acct-1',
  date: '2026-05-04',
  amount: '-12.34',
  description: 'SHOP LTD 004',
  category: null,
  external_transaction_id: 'tl-1',
  ...over,
});

const categories: CategoryRow[] = [
  { id: 'type-expense', name: 'Expense', parent_id: null, level: 'type' },
  { id: 'grp-food', name: 'Food Related', parent_id: 'type-expense', level: 'sub' },
  { id: 'cat-food', name: 'Groceries', parent_id: 'grp-food', level: 'detail' },
  { id: 'cat-dining', name: 'Dining Out', parent_id: 'grp-food', level: 'detail' },
  { id: 'grp-home', name: 'Household', parent_id: 'type-expense', level: 'sub' },
  { id: 'cat-rent', name: 'Rent', parent_id: 'grp-home', level: 'detail' },
  { id: 'cat-transfer', name: 'To Savings', parent_id: null, level: 'detail', is_transfer_category: true },
];

const plan = (fileRows: BackedUpFileRow[], feedRows: LiveFeedRow[], days = 3) =>
  planFeedCategoryBackfill({ fileRows, feedRows, categories, dateToleranceDays: days });

describe('planFeedCategoryBackfill', () => {
  it('proposes the deleted file row\'s category for an uncategorised feed row it paired with', () => {
    const result = plan([file({ id: 'f-1' })], [feed({ id: 'b-1' })]);
    expect(result.pairsFound).toBe(1);
    expect(result.proposals).toEqual([
      { feedTransactionId: 'b-1', fileTransactionId: 'f-1', categoryId: 'cat-food', dayGap: 0 },
    ]);
    expect(result.anomalies).toEqual([]);
  });

  it('pairs across the date tolerance, and not beyond it', () => {
    const within = plan([file({ id: 'f-1', date: '2026-05-01' })], [feed({ id: 'b-1', date: '2026-05-04' })]);
    expect(within.proposals.map(p => p.dayGap)).toEqual([3]);

    const beyond = plan([file({ id: 'f-1', date: '2026-04-30' })], [feed({ id: 'b-1', date: '2026-05-04' })]);
    expect(beyond.pairsFound).toBe(0);
    expect(beyond.proposals).toEqual([]);
    expect(beyond.feedRowsWithoutFileCounterpart).toBe(1);
  });

  it('does not pair a different amount, or the same amount in another account', () => {
    const amount = plan([file({ id: 'f-1', amount: '-12.35' })], [feed({ id: 'b-1' })]);
    expect(amount.pairsFound).toBe(0);

    const account = plan([file({ id: 'f-1', account_id: 'acct-2' })], [feed({ id: 'b-1' })]);
    expect(account.pairsFound).toBe(0);
  });

  it('never overwrites a category the feed row already has', () => {
    const result = plan([file({ id: 'f-1' })], [feed({ id: 'b-1', category: 'cat-rent' })]);
    expect(result.pairsFound).toBe(1);
    expect(result.proposals).toEqual([]);
    expect(result.skipped.feedAlreadyCategorised).toBe(1);
  });

  it('treats an empty-string category on the feed row as no category', () => {
    const result = plan([file({ id: 'f-1' })], [feed({ id: 'b-1', category: '' })]);
    expect(result.proposals).toHaveLength(1);
    expect(result.skipped.feedAlreadyCategorised).toBe(0);
  });

  it('skips a pair whose file row had no category of its own', () => {
    const none = plan([file({ id: 'f-1', category: null })], [feed({ id: 'b-1' })]);
    expect(none.skipped.fileHadNoCategory).toBe(1);
    expect(none.proposals).toEqual([]);

    const blank = plan([file({ id: 'f-2', category: '' })], [feed({ id: 'b-2' })]);
    expect(blank.skipped.fileHadNoCategory).toBe(1);
  });

  it('refuses, loudly and by id, a file category that no longer exists', () => {
    const result = plan([file({ id: 'f-1', category: 'cat-deleted' })], [feed({ id: 'b-1' })]);
    expect(result.skipped.fileCategoryMissing).toBe(1);
    expect(result.missingCategoryIds).toEqual(['cat-deleted']);
    expect(result.proposals).toEqual([]);
  });

  it('never writes a transfer category onto a feed row', () => {
    const result = plan([file({ id: 'f-1', category: 'cat-transfer' })], [feed({ id: 'b-1' })]);
    expect(result.skipped.fileCategoryIsTransfer).toBe(1);
    expect(result.proposals).toEqual([]);
  });

  it('inherits the matcher\'s exclusions: a split parent is never a source', () => {
    const split = plan([file({ id: 'f-2', is_split: true })], [feed({ id: 'b-2' })]);
    expect(split.pairsFound).toBe(0);
  });

  it('never takes a category from a transfer leg, even though the matcher now pairs one', () => {
    // The matcher hands a fed transfer leg over to its feed row (feedOverlap.ts),
    // so the pair exists. It is still never a category source: a leg files under
    // a To/From category, and the refusal below is what stops that landing on a
    // bank-fed row.
    const transfer = plan([file({ id: 'f-1', type: 'transfer', category: 'cat-transfer' })], [feed({ id: 'b-1' })]);
    expect(transfer.pairsFound).toBe(1);
    expect(transfer.skipped.fileCategoryIsTransfer).toBe(1);
    expect(transfer.proposals).toEqual([]);
  });

  it('pairs 1:1 — two identical file rows against one feed row yields one proposal', () => {
    const result = plan(
      [file({ id: 'f-1' }), file({ id: 'f-2', category: 'cat-rent' })],
      [feed({ id: 'b-1' })]
    );
    expect(result.pairsFound).toBe(1);
    expect(result.proposals).toHaveLength(1);
    expect(result.anomalies).toEqual([]);
  });

  it('pairs 1:1 — two identical feed rows against one file row leaves one feed row unmatched', () => {
    const result = plan([file({ id: 'f-1' })], [feed({ id: 'b-1' }), feed({ id: 'b-2', external_transaction_id: 'tl-2' })]);
    expect(result.pairsFound).toBe(1);
    expect(result.feedRowsWithoutFileCounterpart).toBe(1);
    expect(result.proposals).toHaveLength(1);
  });

  it('counts the feed-only residual that belongs to the review workflow, not to this repair', () => {
    const result = plan(
      [file({ id: 'f-1' })],
      [
        feed({ id: 'b-1' }),
        feed({ id: 'b-2', amount: '-99.99', external_transaction_id: 'tl-2' }),
        feed({ id: 'b-3', amount: '-88.88', category: 'cat-rent', external_transaction_id: 'tl-3' }),
      ]
    );
    expect(result.feedRowsTotal).toBe(3);
    expect(result.feedRowsWithoutCategory).toBe(2);
    expect(result.feedRowsWithoutFileCounterpart).toBe(2);
    expect(result.feedOnlyWithoutCategory).toBe(1);
  });

  it('reports a bank-feed row hiding in the backup as an anomaly', () => {
    const result = plan([file({ id: 'f-1', external_transaction_id: 'tl-9' })], [feed({ id: 'b-1' })]);
    expect(result.anomalies.join(' ')).toContain('carry a bank-feed id');
  });

  it('reports duplicate ids in either input as an anomaly', () => {
    const result = plan([file({ id: 'dup' }), file({ id: 'dup' })], [feed({ id: 'b-1' })]);
    expect(result.anomalies.join(' ')).toContain('duplicate transaction ids');
  });
});

describe('summariseByCategoryGroup', () => {
  const proposal = (categoryId: string, n: number): CategoryProposal[] =>
    Array.from({ length: n }, (_, i) => ({
      feedTransactionId: `${categoryId}-${i}`, fileTransactionId: `f-${categoryId}-${i}`, categoryId, dayGap: 0,
    }));

  it('rolls detail categories up to their sub-level group, biggest first', () => {
    const summary = summariseByCategoryGroup(
      [...proposal('cat-food', 3), ...proposal('cat-dining', 2), ...proposal('cat-rent', 4)],
      categories
    );
    expect(summary).toEqual([
      { group: 'Food Related', count: 5 },
      { group: 'Household', count: 4 },
    ]);
  });

  it('never rolls up as far as the type root', () => {
    const summary = summariseByCategoryGroup(proposal('grp-food', 1), categories);
    expect(summary).toEqual([{ group: 'Food Related', count: 1 }]);
  });

  it('names an unknown category rather than dropping it', () => {
    expect(summariseByCategoryGroup(proposal('cat-gone', 2), categories)).toEqual([
      { group: '(unknown category)', count: 2 },
    ]);
  });

  it('terminates on a parent cycle instead of hanging', () => {
    const cyclic: CategoryRow[] = [
      { id: 'a', name: 'A', parent_id: 'b', level: 'detail' },
      { id: 'b', name: 'B', parent_id: 'a', level: 'detail' },
    ];
    expect(summariseByCategoryGroup(proposal('a', 1), cyclic)).toEqual([{ group: 'B', count: 1 }]);
  });
});

describe('compareBackfillBaseline', () => {
  const baseline: BackfillBaseline = {
    version: BACKFILL_PLAN_VERSION,
    userId: 'user-1',
    dateToleranceDays: 3,
    backupSha256: 'abc',
    proposalKeys: ['b-1:cat-food', 'b-2:cat-rent'],
    feedRowsTotal: 10,
    feedRowsWithoutCategory: 6,
  };
  const liveOf = (over: Partial<Omit<BackfillBaseline, 'version'>>): Omit<BackfillBaseline, 'version'> => {
    const { version: _version, ...rest } = baseline;
    void _version;
    return { ...rest, ...over };
  };

  it('passes when nothing moved', () => {
    const report = compareBackfillBaseline(baseline, liveOf({}));
    expect(report.drifted).toBe(false);
    expect(report.benign).toBe(false);
    expect(report.lines).toEqual([]);
  });

  it('accepts proposals that have disappeared — those rows have since been categorised', () => {
    const report = compareBackfillBaseline(baseline, liveOf({ proposalKeys: ['b-1:cat-food'] }));
    expect(report.drifted).toBe(false);
    expect(report.benign).toBe(true);
    expect(report.lines.join(' ')).toContain('1 proposal(s) no longer apply');
  });

  it('refuses a proposal that is new since the dry run', () => {
    const report = compareBackfillBaseline(baseline, liveOf({ proposalKeys: [...baseline.proposalKeys, 'b-3:cat-rent'] }));
    expect(report.drifted).toBe(true);
  });

  it('refuses a proposal whose category changed', () => {
    const report = compareBackfillBaseline(baseline, liveOf({ proposalKeys: ['b-1:cat-food', 'b-2:cat-dining'] }));
    expect(report.drifted).toBe(true);
  });

  it('refuses a different backup, user, tolerance or plan version', () => {
    expect(compareBackfillBaseline(baseline, liveOf({ backupSha256: 'zzz' })).drifted).toBe(true);
    expect(compareBackfillBaseline(baseline, liveOf({ userId: 'user-2' })).drifted).toBe(true);
    expect(compareBackfillBaseline(baseline, liveOf({ dateToleranceDays: 5 })).drifted).toBe(true);
    expect(compareBackfillBaseline({ ...baseline, version: 0 }, liveOf({})).drifted).toBe(true);
  });

  it('notes a moved feed-row count without refusing — this repair does not change it', () => {
    const report = compareBackfillBaseline(baseline, liveOf({ feedRowsTotal: 12, feedRowsWithoutCategory: 5 }));
    expect(report.drifted).toBe(false);
    expect(report.lines).toHaveLength(2);
  });
});

describe('proposalKey', () => {
  it('identifies a decision by the row it changes and the value it writes', () => {
    expect(proposalKey({ feedTransactionId: 'b-1', fileTransactionId: 'f-1', categoryId: 'c-1', dayGap: 0 }))
      .toBe('b-1:c-1');
  });
});

describe('batchedIds', () => {
  it('splits into request-sized batches and refuses a nonsense size', () => {
    expect(batchedIds([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(batchedIds([], 2)).toEqual([]);
    expect(() => batchedIds([1], 0)).toThrow('batch size must be at least 1');
  });
});

// ── The write pass, against a client that records every statement ────────────

interface RecordedStatement {
  table: string;
  values: { category: string };
  filters: string[];
  ids: string[];
}

function recordingClient(
  outcomeFor: (statement: RecordedStatement) => MutationOutcome = s => ({ error: null, count: s.ids.length })
): { client: UpdateClient; statements: RecordedStatement[] } {
  const statements: RecordedStatement[] = [];

  const build = (statement: RecordedStatement): UpdateQuery => {
    const query: UpdateQuery = {
      eq: (column, value) => { statement.filters.push(`${column}=${value}`); return query; },
      is: (column, value) => { statement.filters.push(`${column} IS ${String(value)}`); return query; },
      not: (column, operator, value) => { statement.filters.push(`${column} NOT ${operator} ${String(value)}`); return query; },
      in: (column, values) => { statement.ids = [...values]; statement.filters.push(`${column} IN (${values.length})`); return query; },
      then: (onFulfilled) => Promise.resolve(outcomeFor(statement)).then(onFulfilled),
    };
    return query;
  };

  return {
    statements,
    client: {
      from: (table: string) => ({
        update: (values: { category: string }, options: { count: 'exact' }) => {
          if (options.count !== 'exact') throw new Error('the row count must be requested');
          const statement: RecordedStatement = { table, values, filters: [], ids: [] };
          statements.push(statement);
          return build(statement);
        },
      }),
    },
  };
}

const proposalsFor = (categoryId: string, n: number, offset = 0): CategoryProposal[] =>
  Array.from({ length: n }, (_, i) => ({
    feedTransactionId: `b-${offset + i}`, fileTransactionId: `f-${offset + i}`, categoryId, dayGap: 0,
  }));

describe('applyCategoryBackfill', () => {
  it('scopes every statement to the user, to feed rows, and to rows with no category', async () => {
    const { client, statements } = recordingClient();
    await applyCategoryBackfill(client, 'user-1', proposalsFor('cat-food', 2));
    expect(statements).toHaveLength(1);
    expect(statements[0].table).toBe('transactions');
    expect(statements[0].values).toEqual({ category: 'cat-food' });
    expect(statements[0].filters).toEqual([
      'user_id=user-1',
      'external_transaction_id NOT is null',
      'category IS null',
      'id IN (2)',
    ]);
    expect(statements[0].ids).toEqual(['b-0', 'b-1']);
  });

  it('issues one request per category per batch, never one per row', async () => {
    const { client, statements } = recordingClient();
    const outcome = await applyCategoryBackfill(client, 'user-1', [
      ...proposalsFor('cat-food', 250),
      ...proposalsFor('cat-rent', 30, 250),
    ]);
    // 250 food rows → 3 batches of ≤100; 30 rent rows → 1.
    expect(statements).toHaveLength(4);
    expect(outcome.requests).toBe(4);
    expect(outcome.rowsUpdated).toBe(280);
    expect(outcome.rowsDeclined).toBe(0);
    expect(statements.map(s => s.ids.length)).toEqual([100, 100, 50, 30]);
  });

  it('reports rows the database declined rather than assuming they changed', async () => {
    const { client } = recordingClient(s => ({ error: null, count: s.ids.length - 1 }));
    const outcome = await applyCategoryBackfill(client, 'user-1', proposalsFor('cat-food', 5));
    expect(outcome.rowsUpdated).toBe(4);
    expect(outcome.rowsDeclined).toBe(1);
  });

  it('throws when the database reports an error', async () => {
    const { client } = recordingClient(() => ({ error: { message: 'permission denied' }, count: null }));
    await expect(applyCategoryBackfill(client, 'user-1', proposalsFor('cat-food', 1)))
      .rejects.toThrow('permission denied');
  });

  it('refuses to assume success when the database does not report a count', async () => {
    const { client } = recordingClient(() => ({ error: null, count: null }));
    await expect(applyCategoryBackfill(client, 'user-1', proposalsFor('cat-food', 1)))
      .rejects.toThrow('did not report how many rows it updated');
  });

  it('reports progress against the total, not per request', async () => {
    const { client } = recordingClient();
    const seen: Array<[number, number]> = [];
    await applyCategoryBackfill(client, 'user-1', proposalsFor('cat-food', 150), (done, total) => seen.push([done, total]));
    expect(seen).toEqual([[100, 150], [150, 150]]);
  });

  it('does nothing at all when there is nothing to propose', async () => {
    const { client, statements } = recordingClient();
    const outcome = await applyCategoryBackfill(client, 'user-1', []);
    expect(statements).toEqual([]);
    expect(outcome).toEqual({ rowsUpdated: 0, requests: 0, rowsDeclined: 0 });
  });
});
