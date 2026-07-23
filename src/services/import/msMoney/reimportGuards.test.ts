import { describe, it, expect } from 'vitest';
import {
  splitPopulations,
  findFeedRowsInDeleteSet,
  batched,
  compareToBaseline,
  verifyBackupContents,
  describeTargetState,
  mapFeedRowsToSeedNamespace,
  findOrphanedCategoryIds,
  findParentlessSplitIds,
  deleteFileOriginRows,
  REIMPORT_PLAN_VERSION,
  type PlanBaseline,
  type LivePlanState,
  type ProvenanceMarkers,
  type MutationOutcome,
  type DeleteQuery,
  type DeleteClient,
  type BackupReceipt,
} from './reimportGuards';

// Every value here is invented. The shapes mirror the transactions table and the
// plan file the dry run writes; none of it came from a real database.

const row = (over: Partial<ProvenanceMarkers> & Pick<ProvenanceMarkers, 'id'>): ProvenanceMarkers => ({
  external_transaction_id: null,
  import_source: null,
  import_source_id: null,
  ...over,
});

describe('splitPopulations', () => {
  it('separates the bank feed from the file import, both marker styles', () => {
    const result = splitPopulations([
      row({ id: 'feed-1', external_transaction_id: 'tl-1' }),
      row({ id: 'file-1', import_source: 'ms-money', import_source_id: 'mny-txn-1' }),
      row({ id: 'file-2' }),
    ]);
    expect(result.feed.map(r => r.id)).toEqual(['feed-1']);
    expect(result.provenanced.map(r => r.id)).toEqual(['file-1']);
    expect(result.legacy.map(r => r.id)).toEqual(['file-2']);
    expect(result.conflicted).toEqual([]);
  });

  it('puts a row carrying BOTH markers in its own bucket, never in either population', () => {
    const both = row({ id: 'x', external_transaction_id: 'tl-9', import_source: 'ms-money', import_source_id: 'mny-txn-9' });
    const result = splitPopulations([both]);
    expect(result.conflicted.map(r => r.id)).toEqual(['x']);
    expect(result.feed).toEqual([]);
    expect(result.provenanced).toEqual([]);
    expect(result.legacy).toEqual([]);
  });
});

describe('findFeedRowsInDeleteSet', () => {
  it('names any row in the delete set that carries a bank-feed id', () => {
    const found = findFeedRowsInDeleteSet([
      row({ id: 'ok' }),
      row({ id: 'not-ok', external_transaction_id: 'tl-2' }),
    ]);
    expect(found.map(r => r.id)).toEqual(['not-ok']);
  });

  it('is empty for a clean delete set', () => {
    expect(findFeedRowsInDeleteSet([row({ id: 'a' }), row({ id: 'b' })])).toEqual([]);
  });
});

describe('batched', () => {
  it('splits into request-sized chunks and keeps every item exactly once', () => {
    const items = Array.from({ length: 7 }, (_, i) => `id-${i}`);
    expect(batched(items, 3)).toEqual([
      ['id-0', 'id-1', 'id-2'], ['id-3', 'id-4', 'id-5'], ['id-6'],
    ]);
    expect(batched([], 3)).toEqual([]);
    expect(() => batched(items, 0)).toThrow(/at least 1/);
  });
});

// ── Drift detection ─────────────────────────────────────────────────────────

const baseline: PlanBaseline = {
  version: REIMPORT_PLAN_VERSION,
  userId: 'user-1',
  toleranceDays: 3,
  seedSha256: 'abc123',
  seedTransactionCount: 4,
  deleteTransactionIds: ['t1', 't2', 't3'],
  deleteSplitIds: ['s1'],
  feedTransactionIds: ['f1', 'f2'],
  suppressedSourceIds: ['mny-txn-2'],
  expectedImportCount: 3,
  expectedNetCount: 5,
};
const live = (over: Partial<LivePlanState> = {}): LivePlanState => {
  const { version: _version, ...rest } = baseline;
  return { ...rest, ...over };
};

describe('compareToBaseline', () => {
  it('passes when the database is exactly what the dry run reported', () => {
    expect(compareToBaseline(baseline, live())).toEqual({ drifted: false, lines: [] });
  });

  it('catches a row that disappeared and a row that appeared, even at equal counts', () => {
    const report = compareToBaseline(baseline, live({ deleteTransactionIds: ['t1', 't2', 't9'] }));
    expect(report.drifted).toBe(true);
    expect(report.lines.join('\n')).toContain('1 gone since the dry run');
    expect(report.lines.join('\n')).toContain('1 new since the dry run');
  });

  it('refuses a different seed file, a different user, and a moved tolerance', () => {
    expect(compareToBaseline(baseline, live({ seedSha256: 'deadbeef' })).lines.join()).toContain('seed file is not the one');
    expect(compareToBaseline(baseline, live({ userId: 'user-2' })).lines.join()).toContain('target user changed');
    expect(compareToBaseline(baseline, live({ toleranceDays: 5 })).lines.join()).toContain('tolerance changed');
  });

  it('catches a bank-feed row that vanished between preview and apply', () => {
    const report = compareToBaseline(baseline, live({ feedTransactionIds: ['f1'] }));
    expect(report.drifted).toBe(true);
    expect(report.lines.join('\n')).toContain('bank-feed rows to keep');
  });

  it('refuses a plan file written by a different version of the script', () => {
    const stale = { ...baseline, version: REIMPORT_PLAN_VERSION - 1 };
    expect(compareToBaseline(stale, live()).drifted).toBe(true);
  });

  it('catches a changed import count or final count', () => {
    expect(compareToBaseline(baseline, live({ expectedImportCount: 2 })).drifted).toBe(true);
    expect(compareToBaseline(baseline, live({ expectedNetCount: 99 })).drifted).toBe(true);
  });
});

// ── Backup verification ─────────────────────────────────────────────────────

const goodBackup = JSON.stringify({
  transactions: [
    { id: 't1', external_transaction_id: null, amount: '-1.00' },
    { id: 't2', external_transaction_id: null, amount: '-2.00' },
  ],
  splits: [{ id: 's1', transaction_id: 't1', amount: '-1.00' }],
});
const expectation = { path: '/outside/repo/backup.json', transactionIds: ['t1', 't2'], splitIds: ['s1'] };

describe('verifyBackupContents', () => {
  it('issues a receipt only when every row about to be deleted is in the file', () => {
    const { receipt, problems } = verifyBackupContents(goodBackup, expectation, () => '2026-07-23T00:00:00.000Z');
    expect(problems).toEqual([]);
    expect(receipt).not.toBeNull();
    expect([...receipt!.transactionIds]).toEqual(['t1', 't2']);
    expect([...receipt!.splitIds]).toEqual(['s1']);
    expect(receipt!.path).toBe(expectation.path);
  });

  it('refuses a truncated backup — a missing row means no receipt', () => {
    const short = JSON.stringify({ transactions: [{ id: 't1', external_transaction_id: null }], splits: [] });
    const { receipt, problems } = verifyBackupContents(short, expectation);
    expect(receipt).toBeNull();
    expect(problems.join('\n')).toContain('1 gone since the dry run');
  });

  it('refuses a backup that does not parse or is not an object', () => {
    expect(verifyBackupContents('{not json', expectation).receipt).toBeNull();
    expect(verifyBackupContents('[]', expectation).problems.join()).toContain('not a JSON object');
    expect(verifyBackupContents('{}', expectation).problems.join()).toContain('no `transactions` array');
  });

  it('refuses a backup holding a bank-feed row — that row should never have been in the set', () => {
    const contaminated = JSON.stringify({
      transactions: [
        { id: 't1', external_transaction_id: null },
        { id: 't2', external_transaction_id: 'tl-77' },
      ],
      splits: [{ id: 's1', transaction_id: 't1' }],
    });
    const { receipt, problems } = verifyBackupContents(contaminated, expectation);
    expect(receipt).toBeNull();
    expect(problems.join('\n')).toContain('carries a bank-feed id');
  });

  it('refuses a split line whose parent is not in the backup', () => {
    const orphan = JSON.stringify({
      transactions: [{ id: 't1', external_transaction_id: null }, { id: 't2', external_transaction_id: null }],
      splits: [{ id: 's1', transaction_id: 'somewhere-else' }],
    });
    expect(verifyBackupContents(orphan, expectation).problems.join('\n')).toContain('names a parent that is not in the backup');
  });
});

// ── Already-applied ─────────────────────────────────────────────────────────

describe('describeTargetState', () => {
  const seedSourceIds = new Set(['mny-txn-1', 'mny-txn-2', 'mny-txn-3']);
  const suppressed = new Set(['mny-txn-2']);

  it('is satisfied when exactly the unsuppressed seed rows are present with provenance', () => {
    const result = describeTargetState({
      fileRows: [
        row({ id: 'a', import_source: 'ms-money', import_source_id: 'mny-txn-1' }),
        row({ id: 'b', import_source: 'ms-money', import_source_id: 'mny-txn-3' }),
      ],
      seedSourceIds, suppressedSourceIds: suppressed, importSource: 'ms-money',
    });
    expect(result).toEqual({ satisfied: true, reasons: [] });
  });

  it('is not satisfied while legacy rows remain', () => {
    const result = describeTargetState({
      fileRows: [row({ id: 'legacy' })],
      seedSourceIds, suppressedSourceIds: suppressed, importSource: 'ms-money',
    });
    expect(result.satisfied).toBe(false);
    expect(result.reasons.join('\n')).toContain('no import provenance');
  });

  it('is not satisfied when a feed-covered row is present, or a seed row is missing', () => {
    const feedCovered = describeTargetState({
      fileRows: [
        row({ id: 'a', import_source: 'ms-money', import_source_id: 'mny-txn-1' }),
        row({ id: 'b', import_source: 'ms-money', import_source_id: 'mny-txn-2' }),
        row({ id: 'c', import_source: 'ms-money', import_source_id: 'mny-txn-3' }),
      ],
      seedSourceIds, suppressedSourceIds: suppressed, importSource: 'ms-money',
    });
    expect(feedCovered.satisfied).toBe(false);
    expect(feedCovered.reasons.join('\n')).toContain('not in the seed, or are feed-covered');

    const missing = describeTargetState({
      fileRows: [row({ id: 'a', import_source: 'ms-money', import_source_id: 'mny-txn-1' })],
      seedSourceIds, suppressedSourceIds: suppressed, importSource: 'ms-money',
    });
    expect(missing.reasons.join('\n')).toContain('are not in the database');
  });

  it('notices rows written by a different importer', () => {
    const result = describeTargetState({
      fileRows: [
        row({ id: 'a', import_source: 'qif', import_source_id: 'mny-txn-1' }),
        row({ id: 'b', import_source: 'ms-money', import_source_id: 'mny-txn-3' }),
      ],
      seedSourceIds, suppressedSourceIds: suppressed, importSource: 'ms-money',
    });
    expect(result.reasons.join('\n')).toContain('different importer');
  });
});

// ── Account namespace mapping ───────────────────────────────────────────────

describe('mapFeedRowsToSeedNamespace', () => {
  const seedAccounts = [{ id: 'mny-acct-1', name: 'Everyday' }, { id: 'mny-acct-2', name: 'Savings' }];
  const dbAccounts = [{ id: 'uuid-a', name: 'everyday ' }, { id: 'uuid-b', name: 'Savings' }];

  it('translates feed rows into the seed account ids, matching on name like the importer does', () => {
    const { rows, unmapped, duplicateNames } = mapFeedRowsToSeedNamespace(seedAccounts, dbAccounts, [
      { id: 'f1', account_id: 'uuid-a', date: '2026-05-01', amount: '-9.99', description: 'SHOP' },
    ]);
    expect(rows).toEqual([{ id: 'f1', accountId: 'mny-acct-1', date: '2026-05-01', amount: '-9.99', description: 'SHOP' }]);
    expect(unmapped).toEqual([]);
    expect(duplicateNames).toEqual([]);
  });

  it('keeps — never drops — a feed row in an account the seed does not have', () => {
    const { rows, unmapped } = mapFeedRowsToSeedNamespace(seedAccounts, [...dbAccounts, { id: 'uuid-c', name: 'Bank Only' }], [
      { id: 'f2', account_id: 'uuid-c', date: '2026-05-01', amount: '-1.00', description: null },
    ]);
    expect(rows).toEqual([]);
    expect(unmapped.map(r => r.id)).toEqual(['f2']);
  });

  it('claims each existing account once and reports duplicate names', () => {
    const { rows, duplicateNames } = mapFeedRowsToSeedNamespace(
      [{ id: 'mny-acct-1', name: 'Everyday' }, { id: 'mny-acct-9', name: 'Everyday' }],
      [{ id: 'uuid-a', name: 'Everyday' }, { id: 'uuid-b', name: 'Everyday' }],
      [
        { id: 'f1', account_id: 'uuid-a', date: '2026-05-01', amount: '-1.00', description: '' },
        { id: 'f2', account_id: 'uuid-b', date: '2026-05-01', amount: '-1.00', description: '' },
      ]
    );
    expect(rows.map(r => r.accountId)).toEqual(['mny-acct-1', 'mny-acct-9']);
    expect(duplicateNames).toEqual(['everyday']);
  });
});

// ── Post-apply integrity ────────────────────────────────────────────────────

describe('integrity helpers', () => {
  it('finds categories pointing at a parent that does not exist', () => {
    expect(findOrphanedCategoryIds([
      { id: 'c1', parent_id: null },
      { id: 'c2', parent_id: 'c1' },
      { id: 'c3', parent_id: 'gone' },
    ])).toEqual(['c3']);
  });

  it('finds split lines whose parent transaction is gone', () => {
    expect(findParentlessSplitIds(
      [{ id: 's1', transaction_id: 't1' }, { id: 's2', transaction_id: 't-gone' }],
      new Set(['t1'])
    )).toEqual(['s2']);
  });
});

// ── The delete pass ─────────────────────────────────────────────────────────

interface RecordedCall { table: string; countRequested: string; filters: string[] }

/** A real (if tiny) implementation of the client slice the delete pass uses. */
function fakeClient(options: { failOn?: string; silentCount?: boolean } = {}): { client: DeleteClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const client: DeleteClient = {
    from(table: string) {
      return {
        delete(deleteOptions: { count: 'exact' }): DeleteQuery {
          const call: RecordedCall = { table, countRequested: deleteOptions.count, filters: [] };
          calls.push(call);
          let matched = 0;
          const query: DeleteQuery = {
            in(column, values) {
              call.filters.push(`in:${column}=${values.length}`);
              matched += values.length;
              return query;
            },
            is(column, value) {
              call.filters.push(`is:${column}=${String(value)}`);
              return query;
            },
            then<R1 = MutationOutcome, R2 = never>(
              onfulfilled?: ((value: MutationOutcome) => R1 | PromiseLike<R1>) | null,
              onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
            ): PromiseLike<R1 | R2> {
              const outcome: MutationOutcome = options.failOn === table
                ? { error: { message: 'connection reset' }, status: 0 }
                : { error: null, status: 204, count: options.silentCount ? null : matched };
              return Promise.resolve(outcome).then(onfulfilled, onrejected);
            },
          };
          return query;
        },
      };
    },
  };
  return { client, calls };
}

const receiptFor = (transactionIds: string[], splitIds: string[]): BackupReceipt => ({
  path: '/outside/repo/backup.json',
  transactionIds: new Set(transactionIds),
  splitIds: new Set(splitIds),
  verifiedAt: '2026-07-23T00:00:00.000Z',
});

describe('deleteFileOriginRows', () => {
  it('deletes splits before transactions and filters every delete on external_transaction_id IS NULL', async () => {
    const { client, calls } = fakeClient();
    const result = await deleteFileOriginRows(client, receiptFor(['t1', 't2'], ['s1']), ['t1', 't2'], ['s1']);

    expect(result).toEqual({ splitsDeleted: 1, transactionsDeleted: 2 });
    expect(calls.map(c => c.table)).toEqual(['transaction_splits', 'transactions']);
    expect(calls[1].filters).toContain('is:external_transaction_id=null');
    // The split delete is keyed on the line's own id — never on a broad filter.
    expect(calls[0].filters).toContain('in:id=1');
    // Every statement asks the database how many rows it actually removed.
    expect(calls.map(c => c.countRequested)).toEqual(['exact', 'exact']);
  });

  it('refuses to assume a count the database did not report', async () => {
    const { client } = fakeClient({ silentCount: true });
    await expect(deleteFileOriginRows(client, receiptFor(['t1'], []), ['t1'], []))
      .rejects.toThrow(/did not report how many rows it deleted/);
  });

  it('refuses ids the verified backup does not cover — the backup is the authority', async () => {
    const { client, calls } = fakeClient();
    await expect(deleteFileOriginRows(client, receiptFor(['t1'], []), ['t1', 'not-backed-up'], []))
      .rejects.toThrow(/not in the verified backup/);
    expect(calls).toEqual([]);

    await expect(deleteFileOriginRows(client, receiptFor(['t1'], []), ['t1'], ['s-unknown']))
      .rejects.toThrow(/split line\(s\) that are not in the verified backup/);
    expect(calls).toEqual([]);
  });

  it('stops on the first failed batch instead of carrying on', async () => {
    const { client, calls } = fakeClient({ failOn: 'transaction_splits' });
    await expect(deleteFileOriginRows(client, receiptFor(['t1'], ['s1']), ['t1'], ['s1']))
      .rejects.toThrow(/deleting split lines: connection reset/);
    // The transaction delete was never reached.
    expect(calls.map(c => c.table)).toEqual(['transaction_splits']);
  });

  it('batches large id lists and reports progress against the total', async () => {
    const { client, calls } = fakeClient();
    const ids = Array.from({ length: 250 }, (_, i) => `t${i}`);
    const seen: number[] = [];
    const result = await deleteFileOriginRows(client, receiptFor(ids, []), ids, [], (stage, done) => {
      if (stage === 'transactions') seen.push(done);
    });
    expect(result.transactionsDeleted).toBe(250);
    expect(calls.filter(c => c.table === 'transactions')).toHaveLength(3);
    expect(seen).toEqual([100, 200, 250]);
  });
});
