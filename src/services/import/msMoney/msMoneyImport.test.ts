import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  planCloudImport, importToLocalStorage, wipeLocalData, executeCloudPlan,
  MS_MONEY_IMPORT_SOURCE, IMPORT_PROVENANCE_CONFLICT, IMPORT_BATCH_SIZE,
  isRetryableWriteStatus,
  type ExistingCategoryRow, type ExistingAccountRow, type CloudPlan,
  type CloudWriteClient, type WriteOutcome,
} from './msMoneyImport';
import type { TransferHandover } from './feedOverlap';
import type { MsMoneyImportResult } from './transform';

function sampleResult(): MsMoneyImportResult {
  return {
    accounts: [
      { id: 'mny-acct-1', name: 'Current', type: 'current', balance: 100, openingBalance: 0, currency: 'GBP', isActive: true, lastUpdated: new Date('2020-01-01') },
      { id: 'mny-acct-2', name: 'Savings', type: 'savings', balance: 50, openingBalance: 0, currency: 'GBP', isActive: false, lastUpdated: new Date('2020-01-01') },
      // investment↔cash pair (Money's hacctRel): the cash side carries the parent ref
      { id: 'mny-acct-3', name: 'Broker', type: 'investment', balance: 0, openingBalance: 0, currency: 'GBP', isActive: true, lastUpdated: new Date('2020-01-01') },
      { id: 'mny-acct-4', name: 'Broker (Cash)', type: 'current', parentAccountId: 'mny-acct-3', balance: 25, openingBalance: 0, currency: 'GBP', isActive: true, lastUpdated: new Date('2020-01-01') },
    ],
    categories: [
      // The transform always emits all three type roots as placeholders; they
      // are what a real user holds as UUIDs (see transformCategories).
      { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
      { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
      { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
      { id: 'mny-cat-10', name: 'Food', type: 'expense', level: 'detail', parentId: 'type-expense' },
      { id: 'mny-tofrom-2', name: 'To/From Savings', type: 'both', level: 'detail', parentId: 'type-transfer', isTransferCategory: true, accountId: 'mny-acct-2' },
    ],
    transactions: [
      { id: 'mny-txn-100', date: new Date('2020-02-01'), description: 'Shop', amount: -20, type: 'expense', category: 'mny-cat-10', accountId: 'mny-acct-1' },
      // transfer pair 200↔201
      { id: 'mny-txn-200', date: new Date('2020-02-02'), description: 'To savings', amount: -30, type: 'transfer', category: 'mny-tofrom-2', accountId: 'mny-acct-1', transferAccountId: 'mny-acct-2', linkedTransferId: 'mny-txn-201' },
      // …whose far leg is also pinned to the exact split line it answers.
      { id: 'mny-txn-201', date: new Date('2020-02-02'), description: 'From current', amount: 30, type: 'transfer', accountId: 'mny-acct-2', transferAccountId: 'mny-acct-1', linkedTransferId: 'mny-txn-200', linkedTransferSplitId: 'mny-split-300-1' },
      // a split parent
      { id: 'mny-txn-300', date: new Date('2020-02-03'), description: 'Split', amount: -50, type: 'expense', category: '', accountId: 'mny-acct-1', isSplit: true },
    ] as MsMoneyImportResult['transactions'],
    transactionSplits: [
      { id: 'mny-split-300-1', transactionId: 'mny-txn-300', category: 'mny-cat-10', amount: -50, sortOrder: 1 },
    ],
    summary: {
      accounts: { total: 4, open: 3, closed: 1, investmentCashPairs: 1 },
      categories: { subs: 0, details: 2, hidden: 0 },
      transactions: { imported: 4, standalone: 1, transfers: 2, splitTransactions: 1, splitLines: 1 },
      simplifications: [],
    },
  };
}

describe('executeCloudPlan write path', () => {
  const emptyPlan = (over: Partial<CloudPlan> = {}): CloudPlan => ({
    accounts: [], accountParents: [], categories: [], transactions: [],
    transferLinks: [], splits: [], splitLegPins: [],
    accountParentRows: [], linkRows: [],
    feedPromotions: [], feedPromotionRows: [], unpromotableHandovers: [],
    openingBalanceMismatches: [], accountOpeningBalanceRows: [],
    skippedExisting: 0, skippedFeedOverlap: 0, skippedExistingAccounts: 0,
    skippedExistingCategories: 0, categoriesWithUnresolvedParent: 0,
    ...over,
  });

  /** Records every write, and answers with whatever the script dictates. */
  const clientRecording = (
    answers: WriteOutcome[] = []
  ): { client: CloudWriteClient; calls: { table: string; rows: number; merge?: boolean; onConflict?: string }[] } => {
    const calls: { table: string; rows: number; merge?: boolean; onConflict?: string }[] = [];
    let i = 0;
    const next = (): WriteOutcome => answers[i++] ?? { error: null, status: 201 };
    const client: CloudWriteClient = {
      from: (table: string) => ({
        insert: (rows: Record<string, unknown>[]) => {
          calls.push({ table, rows: rows.length });
          return Promise.resolve(next());
        },
        upsert: (rows: Record<string, unknown>[], options: { onConflict: string; ignoreDuplicates: boolean }) => {
          calls.push({ table, rows: rows.length, merge: !options.ignoreDuplicates, onConflict: options.onConflict });
          return Promise.resolve(next());
        },
      }),
    };
    return { client, calls };
  };

  it('writes the link pass in batches, not one request per row', async () => {
    // The bug this replaced issued ONE http request per link — 11,218 of them
    // for the real file — and died partway through with no way to resume.
    const linkRows = Array.from({ length: IMPORT_BATCH_SIZE + 20 }, (_, n) => ({
      id: `txn-${n}`, user_id: 'u1', account_id: 'a1', amount: -1, date: '2026-01-01',
      linked_transfer_id: `txn-partner-${n}`,
    }));
    const { client, calls } = clientRecording();

    await executeCloudPlan(emptyPlan({ linkRows }), client);

    const linkCalls = calls.filter(c => c.table === 'transactions');
    expect(linkCalls).toHaveLength(2);                       // 520 rows → 2 batches, not 520 calls
    expect(linkCalls.map(c => c.rows)).toEqual([IMPORT_BATCH_SIZE, 20]);
    // Merge semantics: the row already exists, so the conflict must UPDATE it.
    expect(linkCalls.every(c => c.merge)).toBe(true);
  });

  it('writes nothing for the link pass when no row needs linking', async () => {
    const { client, calls } = clientRecording();
    await executeCloudPlan(emptyPlan({ transactions: [{ id: 't1' }] }), client);
    // The insert happens; no second pass follows it.
    expect(calls.filter(c => c.merge)).toHaveLength(0);
  });

  it('promotes bank-feed rows through the SAME batched merge, keyed on the primary key', async () => {
    // A feed row carries no import provenance, so the provenance conflict
    // target cannot address it — and there are only ever a handful, but they
    // still go through the batched path rather than a request each.
    const feedPromotionRows = Array.from({ length: IMPORT_BATCH_SIZE + 3 }, (_, n) => ({
      id: `feed-${n}`, user_id: 'u1', account_id: 'a1', amount: -1, date: '2026-01-01',
      type: 'transfer', linked_transfer_id: `txn-${n}`,
    }));
    const { client, calls } = clientRecording();

    await executeCloudPlan(emptyPlan({ feedPromotionRows }), client);

    const promotionCalls = calls.filter(c => c.table === 'transactions');
    expect(promotionCalls.map(c => c.rows)).toEqual([IMPORT_BATCH_SIZE, 3]);
    expect(promotionCalls.every(c => c.merge && c.onConflict === 'id')).toBe(true);
  });

  it('writes an opening-balance correction only when the plan carries one', async () => {
    const bare = clientRecording();
    await executeCloudPlan(emptyPlan({ accounts: [{ id: 'a1' }] }), bare.client);
    expect(bare.calls.filter(c => c.table === 'accounts' && c.merge)).toHaveLength(0);

    const rebasing = clientRecording();
    await executeCloudPlan(
      emptyPlan({ accountOpeningBalanceRows: [{ id: 'a1', user_id: 'u1', name: 'A', initial_balance: 0 }] }),
      rebasing.client
    );
    expect(rebasing.calls).toEqual([{ table: 'accounts', rows: 1, merge: true, onConflict: 'id' }]);
  });

  it('retries a transient failure and then succeeds', async () => {
    const slept: number[] = [];
    const { client, calls } = clientRecording([
      { error: { message: 'fetch failed' }, status: 0 },   // the failure seen for real
      { error: null, status: 201 },
    ]);

    await executeCloudPlan(
      emptyPlan({ transactions: [{ id: 't1' }] }),
      client,
      { retry: { sleep: (ms: number) => { slept.push(ms); return Promise.resolve(); } } }
    );

    expect(calls).toHaveLength(2);        // failed once, retried once
    expect(slept).toHaveLength(1);        // and backed off in between
  });

  it('does NOT retry a constraint violation — it fails immediately with the real message', async () => {
    // Retrying a genuine data error just wastes the user's time and buries the
    // message that explains what is actually wrong.
    const slept: number[] = [];
    const { client, calls } = clientRecording([
      { error: { message: 'violates check constraint "transaction_splits_amount_nonzero"' }, status: 400 },
    ]);

    await expect(
      executeCloudPlan(
        emptyPlan({ transactions: [{ id: 't1' }] }),
        client,
        { retry: { sleep: (ms: number) => { slept.push(ms); return Promise.resolve(); } } }
      )
    ).rejects.toThrow(/transaction_splits_amount_nonzero/);

    expect(calls).toHaveLength(1);        // one attempt only
    expect(slept).toHaveLength(0);        // never backed off
  });

  it('classifies which statuses are worth retrying', () => {
    for (const s of [0, 408, 425, 429, 500, 503]) expect(isRetryableWriteStatus(s)).toBe(true);
    for (const s of [400, 401, 403, 404, 409, 422]) expect(isRetryableWriteStatus(s)).toBe(false);
  });
});

describe('planCloudImport', () => {
  it('remaps every cross-reference onto fresh ids and stages links separately', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`);

    // Nothing exists yet, so the whole tree — roots included — is created.
    expect(plan.categories).toHaveLength(5);
    expect(plan.categories.filter(c => c.is_system === true).map(c => c.name).sort())
      .toEqual(['Expense', 'Income', 'Transfer']);

    // account 'current' maps to DB type 'checking'; closed stays is_active:false
    const current = plan.accounts.find(a => a.name === 'Current')!;
    expect(current.type).toBe('checking');
    expect(current.user_id).toBe('user-abc');
    expect(plan.accounts.find(a => a.name === 'Savings')!.is_active).toBe(false);

    // Every account/category/transaction id is a fresh generated id (no mny- ids leak).
    const allIds = [...plan.accounts, ...plan.categories, ...plan.transactions].map(r => String(r.id));
    expect(allIds.every(id => id.startsWith('new-'))).toBe(true);

    // Transactions insert WITHOUT linked_transfer_id; the two transfer legs are staged as links.
    expect(plan.transactions.every(t => !('linked_transfer_id' in t) || t.linked_transfer_id == null)).toBe(true);
    expect(plan.transferLinks).toHaveLength(2);
    // Each link points at the *remapped* counterpart, never the original mny id.
    for (const l of plan.transferLinks) {
      expect(l.id.startsWith('new-')).toBe(true);
      expect(l.linked_transfer_id.startsWith('new-')).toBe(true);
    }

    // Accounts insert WITHOUT parent_account_id; the investment↔cash pairing
    // is staged as a second pass against the remapped ids.
    expect(plan.accounts.every(a => !('parent_account_id' in a))).toBe(true);
    expect(plan.accountParents).toHaveLength(1);
    const broker = plan.accounts.find(a => a.name === 'Broker')!;
    const brokerCash = plan.accounts.find(a => a.name === 'Broker (Cash)')!;
    expect(plan.accountParents[0]).toEqual({ id: brokerCash.id, parent_account_id: broker.id });

    // Split parent keeps is_split + blank category; its line references the remapped parent + category.
    const splitParent = plan.transactions.find(t => t.is_split === true)!;
    expect(splitParent.category).toBe('');
    expect(plan.splits).toHaveLength(1);
    expect(plan.splits[0].transaction_id).toBe(splitParent.id);
    expect(String(plan.splits[0].category).startsWith('new-')).toBe(true);
  });
});

describe('planCloudImport — import provenance / idempotency', () => {
  it('stamps every transaction with its stable source id', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`);

    expect(plan.transactions).toHaveLength(4);
    for (const t of plan.transactions) {
      expect(t.import_source).toBe(MS_MONEY_IMPORT_SOURCE);
      expect(String(t.import_source_id)).toMatch(/^mny-txn-\d+$/);
    }
    // The source ids are unique — they are what the unique index keys on, so a
    // collision here would make the import unrunnable rather than idempotent.
    const sourceIds = plan.transactions.map(t => String(t.import_source_id));
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    expect(plan.skippedExisting).toBe(0);

    // The conflict target names exactly the unique index's columns.
    expect(IMPORT_PROVENANCE_CONFLICT).toBe('user_id,import_source,import_source_id');
  });

  it('re-running against rows already imported inserts nothing and reuses their ids', () => {
    // Everything the first run wrote, keyed by source id → the id it already has.
    const existing = new Map([
      ['mny-txn-100', 'db-100'],
      ['mny-txn-200', 'db-200'],
      ['mny-txn-201', 'db-201'],
      ['mny-txn-300', 'db-300'],
    ]);
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, { existingBySourceId: existing });

    // Nothing to insert — the second run is a no-op for transactions…
    expect(plan.transactions).toHaveLength(0);
    expect(plan.skippedExisting).toBe(4);
    // …and for the split lines hanging off an already-imported parent.
    expect(plan.splits).toHaveLength(0);

    // Cross-references still resolve, but to the EXISTING row ids.
    expect(plan.transferLinks).toEqual([
      { id: 'db-200', linked_transfer_id: 'db-201' },
      { id: 'db-201', linked_transfer_id: 'db-200' },
    ]);
  });

  it('a partial re-run inserts only the rows that are missing', () => {
    const existing = new Map([['mny-txn-100', 'db-100'], ['mny-txn-200', 'db-200']]);
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, { existingBySourceId: existing });

    expect(plan.transactions.map(t => t.import_source_id)).toEqual(['mny-txn-201', 'mny-txn-300']);
    expect(plan.skippedExisting).toBe(2);
    // The split parent is new, so its line is inserted and points at the new id.
    expect(plan.splits).toHaveLength(1);
    const splitParent = plan.transactions.find(t => t.import_source_id === 'mny-txn-300')!;
    expect(plan.splits[0].transaction_id).toBe(splitParent.id);
    // The surviving leg still links to the row that is already there.
    expect(plan.transferLinks).toContainEqual({ id: 'db-200', linked_transfer_id: plan.transactions.find(t => t.import_source_id === 'mny-txn-201')!.id });
  });

  it('never writes the bank feed\'s provenance columns', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`);
    // external_transaction_id / external_provider / connection_id belong to the
    // bank feed; import_bank_transactions_atomic keys its dedupe AND its
    // backfill-rebase decision off them.
    for (const t of plan.transactions) {
      expect('external_transaction_id' in t).toBe(false);
      expect('external_provider' in t).toBe(false);
      expect('connection_id' in t).toBe(false);
    }
  });
});

describe('planCloudImport — category tree resolution', () => {
  /** The three roots a real user holds, as `migrate_categories_atomic` writes them. */
  const userRoots = (): ExistingCategoryRow[] => [
    { id: 'db-root-income', name: 'Income', type: 'income', level: 'type', parent_id: null, is_system: true },
    { id: 'db-root-expense', name: 'Expense', type: 'expense', level: 'type', parent_id: null, is_system: true },
    { id: 'db-root-transfer', name: 'Transfer', type: 'both', level: 'type', parent_id: null, is_system: true },
  ];

  /** Every parent_id a plan emits must name a row that exists once it is written. */
  const assertNoDanglingParents = (
    plan: ReturnType<typeof planCloudImport>,
    existing: readonly ExistingCategoryRow[] = []
  ): void => {
    const written = new Set<string>([
      ...existing.map(r => r.id),
      ...plan.categories.map(c => String(c.id)),
    ]);
    for (const c of plan.categories) {
      if (c.parent_id != null) expect(written.has(String(c.parent_id))).toBe(true);
    }
  };

  it('resolves a child of a system root onto the root the user ALREADY has', () => {
    const existing = userRoots();
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      existingCategories: existing,
    });

    // The roots are matched, not minted: only the two Money-derived rows go in.
    expect(plan.categories).toHaveLength(2);
    expect(plan.skippedExistingCategories).toBe(3);
    const food = plan.categories.find(c => c.name === 'Food')!;
    expect(food.parent_id).toBe('db-root-expense');
    const toFrom = plan.categories.find(c => c.name === 'To/From Savings')!;
    expect(toFrom.parent_id).toBe('db-root-transfer');
    // …and never the seed's placeholder id, which is what used to leak through.
    expect(plan.categories.map(c => c.parent_id)).not.toContain('type-expense');
    assertNoDanglingParents(plan, existing);
  });

  it('CREATES the roots on a virgin database instead of assuming them', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`);

    const roots = plan.categories.filter(c => c.level === 'type');
    expect(roots.map(c => c.name).sort()).toEqual(['Expense', 'Income', 'Transfer']);
    expect(roots.every(c => c.is_system === true && c.parent_id === null)).toBe(true);
    expect(plan.skippedExistingCategories).toBe(0);
    // Parents are emitted before their children — a batched insert cannot
    // satisfy a forward foreign key across a batch boundary.
    const positions = new Map(plan.categories.map((c, i) => [String(c.id), i]));
    for (const [i, c] of plan.categories.entries()) {
      if (c.parent_id != null) expect(positions.get(String(c.parent_id))!).toBeLessThan(i);
    }
    assertNoDanglingParents(plan);
  });

  it('matches a renamed root structurally, on its type', () => {
    // Names no longer match anything, so the roots are identified structurally
    // — the same fallback the database's own
    // create_transfer_category_for_account uses.
    const existing: ExistingCategoryRow[] = [
      { id: 'db-root-income', name: 'Money In', type: 'income', level: 'type', parent_id: null, is_system: true },
      { id: 'db-root-expense', name: 'Money Out', type: 'expense', level: 'type', parent_id: null, is_system: true },
      { id: 'db-root-transfer', name: 'Moves', type: 'both', level: 'type', parent_id: null, is_system: true },
    ];
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      existingCategories: existing,
    });

    expect(plan.categories.filter(c => c.level === 'type')).toHaveLength(0);
    expect(plan.categories.find(c => c.name === 'Food')!.parent_id).toBe('db-root-expense');
    assertNoDanglingParents(plan, existing);
  });

  it('falls back to the name when no root carries the seed root\'s type', () => {
    const existing: ExistingCategoryRow[] = [
      // A legacy tree whose roots are all typed 'both' — only the name tells
      // them apart.
      { id: 'db-root-income', name: 'Income', type: 'both', level: 'type', parent_id: null, is_system: true },
      { id: 'db-root-expense', name: 'Expense', type: 'both', level: 'type', parent_id: null, is_system: true },
    ];
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      existingCategories: existing,
    });

    expect(plan.categories.find(c => c.name === 'Food')!.parent_id).toBe('db-root-expense');
    // The Transfer root has no counterpart at all, so it is created — and the
    // To/From category hangs off the row that was actually written.
    const transferRoot = plan.categories.find(c => c.name === 'Transfer' && c.level === 'type')!;
    expect(transferRoot).toBeDefined();
    expect(plan.categories.find(c => c.name === 'To/From Savings')!.parent_id).toBe(transferRoot.id);
    assertNoDanglingParents(plan, existing);
  });

  it('nulls and COUNTS a parent it cannot resolve, rather than emitting a dangling id', () => {
    const orphaned = sampleResult();
    orphaned.categories = [
      { id: 'mny-cat-99', name: 'Stranded', type: 'expense', level: 'detail', parentId: 'no-such-parent' },
    ];
    let n = 0;
    const plan = planCloudImport(orphaned, 'user-abc', () => `new-${n++}`);

    expect(plan.categoriesWithUnresolvedParent).toBe(1);
    expect(plan.categories).toHaveLength(1);
    expect(plan.categories[0].parent_id).toBeNull();
    assertNoDanglingParents(plan);
  });

  it('re-running against the tree it just wrote plans nothing', () => {
    // Snapshot of the database after a first import, as fetchExistingCategories
    // would return it.
    let n = 0;
    const first = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`);
    const written: ExistingCategoryRow[] = first.categories.map(c => ({
      id: String(c.id),
      name: String(c.name),
      type: String(c.type),
      level: String(c.level),
      parent_id: c.parent_id == null ? null : String(c.parent_id),
      is_system: c.is_system === true,
    }));
    const writtenAccounts: ExistingAccountRow[] = first.accounts.map(a => ({
      id: String(a.id), name: String(a.name),
    }));

    const second = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      existingCategories: written,
      existingAccounts: writtenAccounts,
      existingBySourceId: new Map(first.transactions.map(t => [String(t.import_source_id), String(t.id)])),
    });

    expect(second.categories).toHaveLength(0);
    expect(second.accounts).toHaveLength(0);
    expect(second.transactions).toHaveLength(0);
    expect(second.splits).toHaveLength(0);
    // Nothing may pin a leg to a split line this run does not write: split rows
    // carry no provenance, so a re-minted id names a row that does not exist —
    // and transactions.linked_transfer_split_id is a real foreign key.
    expect(first.splitLegPins).toHaveLength(1);
    expect(second.splitLegPins).toHaveLength(0);
    const writtenSplitIds = new Set(second.splits.map(s => String(s.id)));
    for (const pin of second.splitLegPins) {
      expect(writtenSplitIds.has(pin.linked_transfer_split_id)).toBe(true);
    }
    expect(second.skippedExistingCategories).toBe(5);
    expect(second.skippedExistingAccounts).toBe(4);
    // Cross-references still resolve onto the rows already in the database.
    expect(second.accountParents).toEqual(first.accountParents);
    expect(second.transferLinks).toEqual(first.transferLinks);
  });

  it('claims each existing account by name at most once', () => {
    // Two Money accounts share a name but the user holds only one such row:
    // the first claims it, the second is inserted rather than merged away.
    const twins = sampleResult();
    twins.accounts = [
      { ...twins.accounts[0] },
      { ...twins.accounts[0], id: 'mny-acct-9' },
    ];
    let n = 0;
    const plan = planCloudImport(twins, 'user-abc', () => `new-${n++}`, {
      existingAccounts: [{ id: 'db-acct-1', name: 'current' }],
    });

    expect(plan.skippedExistingAccounts).toBe(1);
    expect(plan.accounts).toHaveLength(1);
    expect(plan.accounts[0].id).not.toBe('db-acct-1');
  });
});

describe('planCloudImport — bank-feed overlap suppression', () => {
  it('drops the Money rows the feed already covers, and nothing else', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      suppressedSourceIds: new Set(['mny-txn-100']),
    });

    expect(plan.transactions.map(t => t.import_source_id)).toEqual([
      'mny-txn-200', 'mny-txn-201', 'mny-txn-300',
    ]);
    expect(plan.skippedFeedOverlap).toBe(1);
    expect(plan.skippedExisting).toBe(0);
    // The transfer pair is untouched — suppression never strands a leg.
    expect(plan.transferLinks).toHaveLength(2);
    // The split parent survived, so its line still goes in.
    expect(plan.splits).toHaveLength(1);
  });

  it('drops a suppressed split parent together with its lines', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      suppressedSourceIds: new Set(['mny-txn-300']),
    });
    expect(plan.transactions.map(t => t.import_source_id)).not.toContain('mny-txn-300');
    // No orphaned split line pointing at a row that was never written.
    expect(plan.splits).toHaveLength(0);
    expect(plan.skippedFeedOverlap).toBe(1);
  });
});

// ── Transfer-leg handover ────────────────────────────────────────────────────
// The two real shapes, on the sample's own transfer pair (200 in `Current`
// ⇄ 201 in `Savings`): one leg fed, and both legs fed. All ids invented.

/** The id the plan gave a freshly-inserted account / category, by name. */
const idOfAccount = (plan: CloudPlan, name: string): string =>
  String(plan.accounts.find(a => a.name === name)?.id);
const idOfCategory = (plan: CloudPlan, name: string): string =>
  String(plan.categories.find(c => c.name === name)?.id);

describe('planCloudImport — transfer-leg handover', () => {
  /** A complete `transactions` row as `select *` returns it. */
  const feedRow = (over: Record<string, unknown>): Record<string, unknown> => ({
    id: 'feed-out', user_id: 'user-abc', account_id: 'db-acct-1', description: 'CARD PAYMENT',
    amount: -30, type: 'expense', date: '2020-02-02', category: '', notes: null,
    is_cleared: true, is_split: false, transfer_account_id: null, linked_transfer_id: null,
    linked_transfer_split_id: null, external_transaction_id: 'bank-ref-1',
    import_source: null, import_source_id: null,
    ...over,
  });

  const handover = (over: Partial<TransferHandover> = {}): TransferHandover => ({
    importSourceId: 'mny-txn-200',
    feedTransactionId: 'feed-out',
    accountId: 'mny-acct-1',
    transferAccountId: 'mny-acct-2',
    counterpartSourceId: 'mny-txn-201',
    counterpartSplitSourceId: null,
    dayGap: 0,
    descriptionSimilarity: 0,
    ...over,
  });

  it('promotes the feed row into the transfer and re-points the surviving counterpart', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      suppressedSourceIds: new Set(['mny-txn-200']),
      transferHandovers: [handover()],
      feedTransactionRowsById: new Map([['feed-out', feedRow({})]]),
    });

    // The Money leg is gone…
    expect(plan.transactions.map(t => t.import_source_id)).not.toContain('mny-txn-200');
    expect(plan.unpromotableHandovers).toEqual([]);

    // …and the feed row is the transfer now.
    expect(plan.feedPromotions).toHaveLength(1);
    const promotion = plan.feedPromotions[0];
    expect(promotion.id).toBe('feed-out');
    expect(promotion.transfer_account_id).toBe(idOfAccount(plan, 'Savings'));
    const counterpartId = plan.transactions.find(t => t.import_source_id === 'mny-txn-201')?.id;
    expect(promotion.linked_transfer_id).toBe(counterpartId);

    const [row] = plan.feedPromotionRows;
    expect(row).toMatchObject({
      id: 'feed-out',
      type: 'transfer',
      linked_transfer_id: counterpartId,
      // Untouched: this is still the bank's row, with the bank's own identity.
      external_transaction_id: 'bank-ref-1',
      amount: -30,
      is_split: false,
    });
    // It files under the leg's own To/From category, like any other transfer.
    expect(row.category).toBe(idOfCategory(plan, 'To/From Savings'));

    // The surviving counterpart points at the FEED row, not at a row that will
    // never exist — the whole reason a handover is not just a suppression.
    const counterpartLink = plan.linkRows.find(r => r.import_source_id === 'mny-txn-201');
    expect(counterpartLink?.linked_transfer_id).toBe('feed-out');
    expect(plan.transferLinks).toContainEqual({ id: counterpartId, linked_transfer_id: 'feed-out' });
  });

  it('re-points a split LINE that pointed at the suppressed leg', () => {
    const withSplitLeg = sampleResult();
    withSplitLeg.transactionSplits[0] = {
      ...withSplitLeg.transactionSplits[0],
      linkedTransferId: 'mny-txn-200',
      transferAccountId: 'mny-acct-1',
    };
    let n = 0;
    const plan = planCloudImport(withSplitLeg, 'user-abc', () => `new-${n++}`, {
      suppressedSourceIds: new Set(['mny-txn-200']),
      transferHandovers: [handover()],
      feedTransactionRowsById: new Map([['feed-out', feedRow({})]]),
    });
    // Without the handover this would be NULL — the line would quietly stop
    // being half of a transfer.
    expect(plan.splits[0].linked_transfer_id).toBe('feed-out');
  });

  it('links the two feed rows to each other when both legs are fed', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      suppressedSourceIds: new Set(['mny-txn-200', 'mny-txn-201']),
      transferHandovers: [
        handover(),
        handover({
          importSourceId: 'mny-txn-201', feedTransactionId: 'feed-in',
          accountId: 'mny-acct-2', transferAccountId: 'mny-acct-1',
          counterpartSourceId: 'mny-txn-200', counterpartSplitSourceId: 'mny-split-300-1',
        }),
      ],
      feedTransactionRowsById: new Map([
        ['feed-out', feedRow({})],
        ['feed-in', feedRow({ id: 'feed-in', account_id: 'db-acct-2', amount: 30, type: 'income', external_transaction_id: 'bank-ref-2' })],
      ]),
    });

    expect(plan.transactions.map(t => t.import_source_id)).toEqual(['mny-txn-100', 'mny-txn-300']);
    const byId = new Map(plan.feedPromotions.map(p => [p.id, p]));
    expect(byId.get('feed-out')?.linked_transfer_id).toBe('feed-in');
    expect(byId.get('feed-in')?.linked_transfer_id).toBe('feed-out');
    // The far leg was pinned to a split LINE; that pin moves across too.
    expect(byId.get('feed-in')?.linked_transfer_split_id).toBe(plan.splits[0].id);
    expect(plan.feedPromotionRows).toHaveLength(2);
  });

  it('writes nothing when the feed row is already the transfer (a second run)', () => {
    let n = 0;
    const first = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      suppressedSourceIds: new Set(['mny-txn-200']),
      transferHandovers: [handover()],
      feedTransactionRowsById: new Map([['feed-out', feedRow({})]]),
    });
    const [written] = first.feedPromotionRows;

    // Replay against the database exactly as that first run left it: the same
    // accounts, the same categories, the same rows, the same links.
    const existing = new Map(first.transactions.map(t => [String(t.import_source_id), String(t.id)]));
    const counterpartId = existing.get('mny-txn-201');
    let m = 0;
    const second = planCloudImport(sampleResult(), 'user-abc', () => `again-${m++}`, {
      suppressedSourceIds: new Set(['mny-txn-200']),
      transferHandovers: [handover()],
      feedTransactionRowsById: new Map([['feed-out', written]]),
      existingBySourceId: existing,
      existingAccounts: first.accounts.map(a => ({ id: String(a.id), name: String(a.name) })),
      existingCategories: first.categories.map(c => ({
        id: String(c.id), name: String(c.name), type: String(c.type), level: String(c.level),
        parent_id: c.parent_id == null ? null : String(c.parent_id), is_system: c.is_system === true,
      })),
      existingTransactionLinks: new Map([
        ['mny-txn-201', { linkedTransferId: counterpartId ? 'feed-out' : null, linkedTransferSplitId: null }],
      ]),
    });

    expect(second.transactions).toEqual([]);
    expect(second.accounts).toEqual([]);
    expect(second.categories).toEqual([]);
    expect(second.feedPromotions).toHaveLength(1);       // still known…
    expect(second.feedPromotionRows).toEqual([]);        // …but nothing to write
    expect(second.linkRows.map(r => r.import_source_id)).not.toContain('mny-txn-201');
  });

  it('imports the leg rather than dropping it when the feed row was not supplied', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      suppressedSourceIds: new Set(['mny-txn-200']),
      transferHandovers: [handover()],
      // …and no feedTransactionRowsById at all.
    });
    // Losing a real transfer is worse than leaving a duplicate: the leg goes in.
    expect(plan.transactions.map(t => t.import_source_id)).toContain('mny-txn-200');
    expect(plan.unpromotableHandovers.map(h => h.importSourceId)).toEqual(['mny-txn-200']);
    expect(plan.feedPromotionRows).toEqual([]);
    expect(plan.skippedFeedOverlap).toBe(0);
  });

  it('ignores a handover for a row that is not being suppressed', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      transferHandovers: [handover()],
      feedTransactionRowsById: new Map([['feed-out', feedRow({})]]),
    });
    expect(plan.transactions.map(t => t.import_source_id)).toContain('mny-txn-200');
    expect(plan.feedPromotions).toEqual([]);
    expect(plan.unpromotableHandovers).toEqual([]);
  });
});

describe('planCloudImport — opening balances on reused accounts', () => {
  const reused = (initial: number | null): ExistingAccountRow[] => [
    { id: 'db-acct-1', name: 'Current', initial_balance: initial },
  ];
  /** The file says 0 for every sample account; this row says otherwise. */
  const completeAccountRow = { id: 'db-acct-1', user_id: 'user-abc', name: 'Current',
    type: 'checking', balance: -26727.29, initial_balance: -26727.29, currency: 'GBP',
    is_active: true, notes: null, parent_account_id: null };

  it('reports a reused account whose opening balance disagrees with the file', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      existingAccounts: reused(-26727.29),
    });
    expect(plan.skippedExistingAccounts).toBe(1);
    expect(plan.openingBalanceMismatches).toEqual([{
      accountId: 'db-acct-1', accountName: 'Current',
      fileValue: '0.00', storedValue: '-26727.29', rebased: false,
    }]);
    // Reported, never silently corrected.
    expect(plan.accountOpeningBalanceRows).toEqual([]);
  });

  it('corrects it only when asked, and only with the complete row to write back', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      existingAccounts: reused(-26727.29),
      existingAccountRowsById: new Map([['db-acct-1', completeAccountRow]]),
      rebaseOpeningBalances: true,
    });
    expect(plan.openingBalanceMismatches[0].rebased).toBe(true);
    expect(plan.accountOpeningBalanceRows).toEqual([{
      ...completeAccountRow,
      initial_balance: 0,
    }]);
    // The stored balance is NOT touched — that is a separate repair.
    expect(plan.accountOpeningBalanceRows[0].balance).toBe(-26727.29);
  });

  it('says nothing when the two agree, or when no opening balance was offered', () => {
    let n = 0;
    expect(planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      existingAccounts: reused(0),
      rebaseOpeningBalances: true,
    }).openingBalanceMismatches).toEqual([]);
    expect(planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      existingAccounts: [{ id: 'db-acct-1', name: 'Current' }],
    }).openingBalanceMismatches).toEqual([]);
  });

  it('asks for a rebase but cannot write one without the complete row', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      existingAccounts: reused(-26727.29),
      rebaseOpeningBalances: true,
    });
    expect(plan.openingBalanceMismatches[0].rebased).toBe(false);
    expect(plan.accountOpeningBalanceRows).toEqual([]);
  });
});

describe('wipeLocalData', () => {
  it('empties every financial collection', () => {
    const KEYS = { ACCOUNTS: 'a', TRANSACTIONS: 't', CATEGORIES: 'c', TRANSACTION_SPLITS: 's', BUDGETS: 'b', GOALS: 'g', RECURRING: 'r' };
    for (const k of Object.values(KEYS)) window.localStorage.setItem(k, '[{"id":"x"}]');
    wipeLocalData(KEYS);
    for (const k of Object.values(KEYS)) expect(window.localStorage.getItem(k)).toBe('[]');
  });
});

describe('importToLocalStorage', () => {
  const KEYS = { ACCOUNTS: 'a', TRANSACTIONS: 't', CATEGORIES: 'c', TRANSACTION_SPLITS: 's', BUDGETS: 'b', GOALS: 'g', RECURRING: 'r' };
  beforeEach(() => { window.localStorage.clear(); });

  it('writes the imported collections and clears the rest', async () => {
    const onProgress = vi.fn();
    await importToLocalStorage(sampleResult(), KEYS, { onProgress });

    expect(JSON.parse(window.localStorage.getItem('a')!)).toHaveLength(4);
    expect(JSON.parse(window.localStorage.getItem('t')!)).toHaveLength(4);
    expect(JSON.parse(window.localStorage.getItem('c')!)).toHaveLength(5);
    expect(JSON.parse(window.localStorage.getItem('s')!)).toHaveLength(1);
    // A total migration replaces — the other collections are emptied.
    expect(window.localStorage.getItem('b')).toBe('[]');
    expect(window.localStorage.getItem('g')).toBe('[]');
    expect(window.localStorage.getItem('r')).toBe('[]');
    // progress reaches the terminal phase
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'done', fraction: 1 }));
  });
});
