/**
 * A whole Microsoft Money migration, into a real `.db` file, through the real
 * ledger crate.
 *
 * @vitest-environment node
 *
 * ── WHY THIS IS NOT A CONTRACT RULE ─────────────────────────────────────────
 *
 * `contract.ts` says what an OPERATION of the seam promises, in the app's own
 * shapes, so that three engines can be held to the same sentence. `importMsMoney`
 * has no such sentence to add: the ratchet that carried it for eight slices said
 * so in as many words — *"it needs no new rule at all"* — because everything it
 * promises is already promised by the wipe and the restore it is made of, and
 * both of those are covered by rules the local engine already passes.
 *
 * What has no coverage anywhere is the COMPOSITION: that this port really does
 * compose them, in that order, over the plan the cloud migration uses, and that
 * a .mny file's own facts survive the trip. That is a whole-journey question
 * about one engine, so it is a spec of its own rather than a rule for everybody.
 *
 * ── THE DATA IS INVENTED, AND IT HAS TO BE ──────────────────────────────────
 *
 * Every figure, name and date below is made up. A real .mny file is somebody's
 * thirty-year financial history and cannot be committed to a public repository;
 * a fixture built from one would leak it into every CI log that printed a diff.
 * The fixture is instead built to exercise the SHAPES that are hard — the three
 * `cs` states, a transfer pair, an investment↔cash pairing, a closed account, a
 * split whose LINE is half of a transfer — because those are what a migration
 * gets wrong, not the arithmetic.
 *
 * It goes in as an `MnyExport`, the reader's own output shape, and through the
 * REAL `transformMsMoneyExport`. Handing the port a hand-built
 * `MsMoneyImportResult` would skip the one place Money's `cs` scale becomes the
 * app's two flags, which is exactly the fact this file is here to check.
 */

import { DatabaseSync } from 'node:sqlite';
import { afterAll, describe, expect, it } from 'vitest';
import {
  RESTORE_STEPS,
  buildBackupBundle,
  remapBackupIds,
  rowsForStep,
  type RestoreStep
} from '../../backupService';
import {
  importToLocalStorage,
  planCloudImport
} from '../../import/msMoney/msMoneyImport';
import {
  transformMsMoneyExport,
  type MnyExport,
  type MsMoneyImportResult
} from '../../import/msMoney/transform';
import { createSpawnTransport } from '../../local/spawnTransport';
import {
  LocalDataPort,
  type BackupFormat,
  type MsMoneyMigration
} from '../../local/localDataPort';
import type { Account, Transaction, TransactionSplit } from '../../../types';
import type { ImportProgress } from '../dataPort';
import { LedgerFiles, locateBridge, readBack } from './localCore.fixtureFile';

const OWNER = '11111111-1111-1111-1111-111111111111';

const bridge = locateBridge();
const files = new LedgerFiles(bridge);

afterAll(() => {
  files.dispose();
});

// ── The two injected halves, as the desktop shell will supply them ──────────
//
// The REAL functions, for the reason `localCore.contract.test.ts` gives about
// the format: a harness that handed the port its own builder or its own planner
// would prove only that the local engine agrees with something written for the
// test. They are declared here rather than shared with that file because two of
// the mutations this spec exists to survive are mutations OF them, and a
// mutation should not reach a suite it is not about.

const backupFormat = (steps: readonly RestoreStep[] = RESTORE_STEPS): BackupFormat => {
  let sequence = 0;
  const mint = (): string =>
    `00000000-0000-4000-8000-${String((sequence += 1)).padStart(12, '0')}`;
  return { steps, build: buildBackupBundle, rowsForStep, remapIds: bundle => remapBackupIds(bundle, mint) };
};

/** The plan's own generator. See `MsMoneyMigration`: these ids never reach the file. */
const planIds = (): (() => string) => {
  let sequence = 0;
  return () => `ffffffff-0000-4000-8000-${String((sequence += 1)).padStart(12, '0')}`;
};

const msMoneyMigration = (): MsMoneyMigration => {
  const mint = planIds();
  return { plan: (result, owner) => planCloudImport(result, owner, mint) };
};

// ── The invented .mny file ──────────────────────────────────────────────────

/** Money's account ids. Numbers, as `hacct` is. */
const EVERYDAY = 1;
const RAINY_DAY = 2;
const PORTFOLIO = 3;
const PORTFOLIO_CASH = 4;
const OLD_CARD = 5;

/** Money's transaction ids (`htrn`), spaced so the roles read at a glance. */
const UNMARKED = 100;
const MARKED_C = 101;
const RECONCILED_R = 102;
const SPLIT_PARENT = 500;
const SPLIT_LINE_GROCERIES = 501;
const SPLIT_LINE_TRANSFER = 502;
const SPLIT_COUNTERPART = 600;
const TRANSFER_OUT = 700;
const TRANSFER_IN = 701;

/**
 * A Money file with one of everything that is hard.
 *
 * The balances are INTERNALLY CONSISTENT — `reconstructedBalance` is
 * `openingBalance` plus the account's own rows, to the penny — because the
 * ledger's invariant B-1 is exactly that identity and `verify_integrity` below
 * checks it. A fixture that did not add up would fail this spec for a reason
 * that has nothing to do with the migration.
 *
 *   Everyday       opening   500.00  rows  -12.50 -100.00  -25.00    =  362.50
 *   Rainy Day      opening  1000.00  rows   40.00   40.00   25.00     = 1105.00
 *   Portfolio      opening     0.00  rows  (none)                     =    0.00
 *   Portfolio Cash opening   250.00  rows  (none)                     =  250.00
 *   Old Card       opening     0.00  rows   90.00                     =   90.00
 *
 * The two halves of each transfer are EXACT OPPOSITES, which the crate checks
 * (T-2 for a pair, T-4 for a split leg): the £40 line inside the split is
 * answered by a £40 row in Rainy Day, never by the split's £100 parent.
 */
const moneyFile = (): MnyExport => ({
  accounts: [
    {
      id: EVERYDAY, name: 'Everyday', moneyType: 'bank', relatedAccountId: null,
      currencyCode: 'GBP', openingBalance: '500.00', reconstructedBalance: '362.50',
      closed: false, openDate: '2019-04-06', closeDate: null, comment: null
    },
    {
      id: RAINY_DAY, name: 'Rainy Day', moneyType: 'bank', relatedAccountId: null,
      currencyCode: 'GBP', openingBalance: '1000.00', reconstructedBalance: '1105.00',
      closed: false, openDate: '2019-04-06', closeDate: null, comment: 'The buffer'
    },
    // The investment↔cash pair. Money sets `hacctRel` on BOTH sides; the
    // transform nests the CASH side under the investment one, which is the
    // `parent_account_id` this migration has to carry through a restore's
    // deferred second pass.
    {
      id: PORTFOLIO, name: 'Portfolio', moneyType: 'investment', relatedAccountId: PORTFOLIO_CASH,
      currencyCode: 'GBP', openingBalance: '0.00', reconstructedBalance: '0.00',
      closed: false, openDate: '2020-01-02', closeDate: null, comment: null
    },
    {
      id: PORTFOLIO_CASH, name: 'Portfolio Cash', moneyType: 'cash', relatedAccountId: PORTFOLIO,
      currencyCode: 'GBP', openingBalance: '250.00', reconstructedBalance: '250.00',
      closed: false, openDate: '2020-01-02', closeDate: null, comment: null
    },
    // Closed, not deleted — Money's own distinction, and the app's `isActive`.
    {
      id: OLD_CARD, name: 'Old Card', moneyType: 'credit', relatedAccountId: null,
      currencyCode: 'GBP', openingBalance: '0.00', reconstructedBalance: '90.00',
      closed: true, openDate: '2016-06-01', closeDate: '2021-09-30', comment: null
    }
  ],
  categories: [
    { id: 10, name: 'INCOME', parentId: null, level: 0, fullPath: 'INCOME', hidden: false, kind: 'income' },
    { id: 11, name: 'EXPENSE', parentId: null, level: 0, fullPath: 'EXPENSE', hidden: false, kind: 'expense' },
    { id: 20, name: 'Food', parentId: 11, level: 1, fullPath: 'EXPENSE:Food', hidden: false, kind: 'expense' },
    { id: 21, name: 'Groceries', parentId: 20, level: 2, fullPath: 'EXPENSE:Food:Groceries', hidden: false, kind: 'expense' },
    { id: 22, name: 'Takeaway', parentId: 20, level: 2, fullPath: 'EXPENSE:Food:Takeaway', hidden: true, kind: 'expense' },
    { id: 30, name: 'Salary', parentId: 10, level: 1, fullPath: 'INCOME:Salary', hidden: false, kind: 'income' }
  ],
  payees: [
    { id: 900, name: 'Corner Shop', parentId: null, hidden: false },
    { id: 901, name: 'Employer Ltd', parentId: null, hidden: false },
    { id: 902, name: 'Big Shop', parentId: null, hidden: false }
  ],
  transactions: [
    // cs 0 — never marked at all.
    {
      id: UNMARKED, accountId: EVERYDAY, date: '2024-01-15', amount: '-12.50', categoryId: 21,
      payeeId: 900, memo: 'bread and milk', ref: null, clearedStatus: 0, linkAccountId: null,
      role: 'standalone'
    },
    // cs 1 — C. A working mark on a balance session that was never finished.
    // MARKED, and emphatically NOT committed.
    {
      id: MARKED_C, accountId: RAINY_DAY, date: '2024-02-01', amount: '40.00', categoryId: 30,
      payeeId: 901, memo: null, ref: null, clearedStatus: 1, linkAccountId: null,
      role: 'standalone'
    },
    // cs 2 — R. Committed against a statement.
    {
      id: RECONCILED_R, accountId: OLD_CARD, date: '2023-11-20', amount: '90.00', categoryId: null,
      payeeId: null, memo: 'balance transfer in', ref: 'BT-1', clearedStatus: 2, linkAccountId: null,
      role: 'standalone'
    },
    // A split, one of whose LINES is half of a transfer. The parent is in
    // Everyday; the line moves £40 to Rainy Day and its counterpart is a
    // top-level row there.
    {
      id: SPLIT_PARENT, accountId: EVERYDAY, date: '2024-03-03', amount: '-100.00', categoryId: null,
      payeeId: 902, memo: null, ref: null, clearedStatus: 1, linkAccountId: null,
      role: 'splitParent', splitChildCount: 2, splitChildSum: '-100.00'
    },
    {
      id: SPLIT_LINE_GROCERIES, accountId: EVERYDAY, date: '2024-03-03', amount: '-60.00', categoryId: 21,
      payeeId: 902, memo: 'the shop', ref: null, clearedStatus: 1, linkAccountId: null,
      role: 'splitChild', splitParentId: SPLIT_PARENT
    },
    {
      id: SPLIT_LINE_TRANSFER, accountId: EVERYDAY, date: '2024-03-03', amount: '-40.00', categoryId: null,
      payeeId: null, memo: 'to the buffer', ref: null, clearedStatus: 1, linkAccountId: RAINY_DAY,
      role: 'splitChild', splitParentId: SPLIT_PARENT, isTransferLine: true,
      transferPairTxnId: SPLIT_COUNTERPART
    },
    {
      id: SPLIT_COUNTERPART, accountId: RAINY_DAY, date: '2024-03-03', amount: '40.00', categoryId: null,
      payeeId: null, memo: 'from Everyday', ref: null, clearedStatus: 0, linkAccountId: EVERYDAY,
      role: 'transfer', transferPairTxnId: SPLIT_LINE_TRANSFER
    },
    // An ordinary transfer pair: two top-level rows naming each other.
    {
      id: TRANSFER_OUT, accountId: EVERYDAY, date: '2024-04-10', amount: '-25.00', categoryId: null,
      payeeId: null, memo: null, ref: null, clearedStatus: 2, linkAccountId: RAINY_DAY,
      role: 'transfer', transferPairTxnId: TRANSFER_IN
    },
    {
      id: TRANSFER_IN, accountId: RAINY_DAY, date: '2024-04-10', amount: '25.00', categoryId: null,
      payeeId: null, memo: null, ref: null, clearedStatus: 2, linkAccountId: EVERYDAY,
      role: 'transfer', transferPairTxnId: TRANSFER_OUT
    }
  ]
});

const parsedFile = (): MsMoneyImportResult =>
  transformMsMoneyExport(moneyFile(), '2026-08-11T00:00:00.000Z');

/**
 * The ledger this migration REPLACES.
 *
 * Not an empty file. A total migration's whole promise is that whatever was
 * there is gone, and a spec that imported into a blank ledger could not tell a
 * wipe from a no-op — which is the shape of the first mutation below.
 */
const aLedgerAlreadyInUse = (file: string): void => {
  const database = new DatabaseSync(file);
  try {
    database.exec('PRAGMA foreign_keys = ON');
    database.exec('BEGIN');
    database.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run(OWNER, 'device@localhost');
    database
      .prepare(
        'INSERT INTO accounts (id, user_id, name, type, currency, balance_minor, initial_balance_minor)' +
          " VALUES (?, ?, 'Doomed Current', 'checking', 'GBP', 4242, 0)"
      )
      .run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OWNER);
    database
      .prepare(
        "INSERT INTO categories (id, user_id, name, type, level) VALUES (?, ?, 'Doomed Category', 'expense', 'detail')"
      )
      .run('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', OWNER);
    database
      .prepare(
        'INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, category)' +
          " VALUES (?, ?, ?, 'Doomed row', 4242, 'income', '2020-01-01', ?)"
      )
      .run(
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        OWNER,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      );
    database.exec('COMMIT');
  } finally {
    database.close();
  }
};

/** Columns `readBack` does not carry, read straight out of the file. */
const provenanceOf = (file: string): { id: string; source: string | null; sourceId: string | null }[] => {
  const database = new DatabaseSync(file);
  try {
    const rows: unknown[] = database
      .prepare('SELECT id, import_source, import_source_id FROM transactions ORDER BY rowid')
      .all();
    return rows
      .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
      .map(row => ({
        id: String(row.id),
        source: typeof row.import_source === 'string' ? row.import_source : null,
        sourceId: typeof row.import_source_id === 'string' ? row.import_source_id : null
      }));
  } finally {
    database.close();
  }
};

interface Migrated {
  file: string;
  progress: ImportProgress[];
}

/**
 * The journey: a ledger already in use, a .mny file, and the one call.
 *
 * `steps` is a seam only a mutation uses. The production order is the format's
 * own, and the C-3 mutation below is the whole reason it can be handed in.
 */
const migrate = async (
  options: { steps?: readonly RestoreStep[] } = {}
): Promise<Migrated> => {
  const file = files.create('msmoney');
  aLedgerAlreadyInUse(file);

  const port = new LocalDataPort({
    owner: OWNER,
    transport: createSpawnTransport({ binary: bridge, database: file }),
    format: backupFormat(options.steps),
    migration: msMoneyMigration(),
    logger: {
      error: (message, error) => {
        throw new Error(`${message}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });

  const progress: ImportProgress[] = [];
  await port.importMsMoney(parsedFile(), { onProgress: entry => progress.push(entry) });
  return { file, progress };
};

const byName = (accounts: readonly Account[], name: string): Account => {
  const found = accounts.find(account => account.name === name);
  if (!found) throw new Error(`No account called ${name}. Got: ${accounts.map(a => a.name).join(', ')}`);
  return found;
};

const byDescription = (transactions: readonly Transaction[], description: string): Transaction => {
  const found = transactions.filter(transaction => transaction.description === description);
  if (found.length !== 1) {
    throw new Error(`Expected exactly one row called ${description}, found ${found.length}`);
  }
  return found[0];
};

describe('a Microsoft Money file, into a ledger file on this device', () => {
  it('replaces the ledger that was there — the wipe is the restore’s precondition', async () => {
    const { file } = await migrate();
    const store = readBack(file);

    // Nothing of the old ledger is left. Not "the accounts were replaced": the
    // row, the category and the account are gone, and the file's own emptiness
    // check agreed before a single imported row landed — `restore_backup`
    // refuses a store that still holds an account, a category or a transaction,
    // so an import that skipped the wipe would REJECT rather than merge.
    expect(store.accounts.map(account => account.name)).not.toContain('Doomed Current');
    expect(store.categories.map(category => category.name)).not.toContain('Doomed Category');
    expect(store.transactions.map(transaction => transaction.description)).not.toContain('Doomed row');

    // And the file's own rows are there instead.
    expect(store.accounts.map(account => account.name).sort()).toEqual([
      'Everyday',
      'Old Card',
      'Portfolio',
      'Portfolio Cash',
      'Rainy Day'
    ]);
  });

  it('lands every account, with the investment↔cash pairing and the closure', async () => {
    const { file } = await migrate();
    const { accounts } = readBack(file);

    const everyday = byName(accounts, 'Everyday');
    // THREE SPELLINGS, one kind of account, and the round trip closes: Money
    // says `bank`, the transform says `current` (the app's word), the plan
    // says `checking` (the column's word, in both engines), and the witness
    // reads it back as `current` again. The witness is what makes that
    // checkable — it converts through its own column table, so agreeing here
    // means the two conversions really are inverses.
    expect(everyday.type).toBe('current');
    // Money's opening balance is authoritative and its reconstructed balance
    // rides along as the display figure. Both cross to the penny.
    expect(everyday.openingBalance).toBe(500);
    expect(everyday.balance).toBe(362.5);

    // The pairing is a SECOND PASS in a restore — `parent_account_id` is not a
    // backup column, it travels in the `links` payload and is closed after every
    // account row exists. This is the assertion that the port put the plan's
    // `accountParents` back onto the rows so the format could extract them.
    const portfolio = byName(accounts, 'Portfolio');
    const cash = byName(accounts, 'Portfolio Cash');
    expect(cash.parentAccountId).toBe(portfolio.id);
    expect(portfolio.parentAccountId).toBeNull();

    // Closed, not deleted.
    expect(byName(accounts, 'Old Card').isActive).toBe(false);
    expect(everyday.isActive).toBe(true);
  });

  it('keeps Money’s C and its R apart, and stamps the committed flag on every row', async () => {
    const { file } = await migrate();
    const { transactions } = readBack(file);

    // cs 0 — neither.
    const unmarked = byDescription(transactions, 'Corner Shop');
    expect(unmarked.cleared).toBe(false);
    expect(unmarked.reconciled).toBe(false);

    // cs 1 — C. MARKED and NOT committed, which is the whole of the split: a
    // balance session its owner never finished must not come back as settled
    // work, and an unstated `reconciled` would read as "ask cleared" and do
    // exactly that.
    const markedOnly = byDescription(transactions, 'Employer Ltd');
    expect(markedOnly.cleared).toBe(true);
    expect(markedOnly.reconciled).toBe(false);

    // cs 2 — R. Both.
    const committed = byDescription(transactions, 'balance transfer in');
    expect(committed.cleared).toBe(true);
    expect(committed.reconciled).toBe(true);

    // NEVER `undefined`. That value means "this row predates the split between
    // marking and committing; ask `cleared`", and an imported row is not
    // history the importer has to guess about — it has read Money's own answer.
    transactions.forEach(transaction => {
      expect(typeof transaction.reconciled).toBe('boolean');
    });
  });

  it('lands as history rather than as work: nothing arrives needing review', async () => {
    const { file } = await migrate();
    const { transactions } = readBack(file);

    // The importer law, and the one place it points the OTHER way from
    // `importTransactions`. Migration 20260810090000: a statement file's rows
    // arrive `needs_review = true` because they are new work, and *"the
    // Microsoft Money importer … is left alone for the same reason in reverse:
    // it is a migration of history the user already worked through in Money …
    // lighting up eleven thousand rows of it would be the 'mark history NEW'
    // mistake by another route."*
    //
    // Structurally rather than by stamping a false: the plan names no
    // `needs_review` at all, and `crate::backup` gives a NOT NULL column its
    // schema default when the file is silent. The cloud's INSERT produces the
    // same row by the same silence.
    expect(transactions.map(transaction => transaction.needsReview)).toEqual(
      transactions.map(() => false)
    );
    expect(transactions.length).toBeGreaterThan(0);
  });

  it('pairs the transfers, and pins the leg whose other half is a split LINE', async () => {
    const { file } = await migrate();
    const { transactions, splits } = readBack(file);

    // ── The ordinary pair ──────────────────────────────────────────────────
    const legs = transactions.filter(transaction => transaction.type === 'transfer');
    const out = legs.find(leg => leg.amount === -25);
    const back = legs.find(leg => leg.amount === 25);
    if (!out || !back) throw new Error('the transfer pair did not land');
    expect(out.linkedTransferId).toBe(back.id);
    expect(back.linkedTransferId).toBe(out.id);
    // A linked leg must name the account on the other side — the schema says so
    // and so does the seam.
    expect(out.transferAccountId).toBe(back.accountId);
    expect(back.transferAccountId).toBe(out.accountId);

    // ── The split-leg pin ──────────────────────────────────────────────────
    // The counterpart of a transfer recorded INSIDE another account's split
    // points at the split's PARENT and pins the exact LINE that is the opposite
    // half. Both columns, or the pair is half-joined: `linked_transfer_id`
    // alone would take a reader to a hundred-pound split when the transfer was
    // forty.
    const parent = transactions.find(transaction => transaction.isSplit === true);
    const counterpart = byDescription(transactions, 'from Everyday');
    if (!parent) throw new Error('the split parent did not land');
    expect(counterpart.linkedTransferId).toBe(parent.id);

    const lines = splits.filter(split => split.transactionId === parent.id);
    expect(lines.map(line => line.amount).sort((a, b) => a - b)).toEqual([-60, -40]);
    // Every line sums back to the parent, to the penny.
    expect(lines.reduce((total, line) => total + line.amount, 0)).toBe(parent.amount);

    const leg = lines.find(line => line.amount === -40);
    if (!leg) throw new Error('the transfer line did not land');
    expect(counterpart.linkedTransferSplitId).toBe(leg.id);
    // And the line points back at the row that pinned it.
    expect(leg.linkedTransferId).toBe(counterpart.id);
    expect(leg.transferAccountId).toBe(counterpart.accountId);
  });

  it('brings Money’s own To/From categories, and the file mints none beside them', async () => {
    const { file } = await migrate();
    const { accounts, categories } = readBack(file);

    // ── C-3, and how the collision is avoided ──────────────────────────────
    // This schema mints a `To/From <account>` category on every account INSERT,
    // and a Money file BRINGS its own. Two for one account is not cosmetic: the
    // transfer picker offers the same account twice under two ids and half the
    // history files under the one the other half does not use.
    //
    // Neither engine has a special case for it. The accounts land FIRST — the
    // restore's step order, and `importToCloud`'s insert order — so the store
    // holds no type-level Transfer anchor at the moment they arrive, and both
    // triggers stand themselves down without one.
    const transferCategories = categories.filter(category => category.isTransferCategory === true);
    expect(transferCategories.map(category => category.name).sort()).toEqual([
      'To/From Everyday',
      'To/From Rainy Day'
    ]);

    // Exactly one per account, and it names the account it is for.
    const everyday = byName(accounts, 'Everyday');
    const forEveryday = transferCategories.filter(category => category.accountId === everyday.id);
    expect(forEveryday).toHaveLength(1);
    expect(forEveryday[0].name).toBe('To/From Everyday');

    // Money's own tree came too, hidden categories included — Money's "hidden"
    // is the app's "inactive", kept for the rows filed under it.
    const takeaway = categories.find(category => category.name === 'Takeaway');
    expect(takeaway?.isActive).toBe(false);
    expect(categories.map(category => category.name)).toContain('Unassigned (MS Money import)');

    // And every transaction is filed under a category the file actually holds,
    // or under nothing at all. A dangling category id renders as a blank cell
    // and throws nothing, which is why it is asserted.
    const known = new Set(categories.map(category => category.id));
    readBack(file).transactions.forEach(transaction => {
      if (transaction.category === '') return;
      expect(known.has(transaction.category)).toBe(true);
    });
  });

  it('depends on the accounts going in FIRST, and says so if they do not', async () => {
    // ── C-3, PROVED FROM THE OTHER SIDE ────────────────────────────────────
    // The test above says the collision does not happen. This one says WHY, by
    // making it happen: the same file, the same port, the same plan, with the
    // format's step order changed so that the type-level categories land BEFORE
    // the accounts. A Transfer anchor now exists at the moment each account row
    // arrives, `trg_create_transfer_category_for_account` no longer stands
    // itself down, and it mints a `To/From <account>` of its own.
    //
    // Worth a test rather than a comment, because the mechanism is invisible in
    // the passing case: a step order that happened to be right for some other
    // reason would read identically.
    //
    // ── WHAT ACTUALLY HAPPENS, MEASURED ───────────────────────────────────
    // Not two categories side by side. `restore_backup.rs` and `schema.sql`
    // both describe the hazard as the trigger minting one *"and then insert[ing]
    // the file's own beside it"*, and in THIS schema it cannot get that far: the
    // trigger's row and the file's row have the same name under the same parent,
    // and `categories UNIQUE (user_id, name, parent_id)` refuses the second.
    // The trigger's own insert carries `ON CONFLICT DO NOTHING` and goes first;
    // the file's does not and is refused, by name:
    //
    //   categories <id>: constraint_violated: UNIQUE constraint failed:
    //   categories.user_id, categories.name, categories.parent_id
    //
    // So on a file the wrong order costs the whole migration rather than the
    // register's transfer picker — loud instead of silent, which is the better
    // of the two failures and is a property of the schema rather than of this
    // port. Rule 84 asserts the OUTCOME for all three engines; this records the
    // failure mode for the one that has the key.
    const [accounts, typeLevel, ...rest] = RESTORE_STEPS;

    await expect(migrate({ steps: [typeLevel, accounts, ...rest] })).rejects.toThrow(
      /UNIQUE constraint failed: categories/
    );
  });

  it('gives every row a fresh id, and keeps Money’s own as provenance', async () => {
    const { file } = await migrate();
    const store = readBack(file);
    const stored = [
      ...store.accounts.map(account => account.id),
      ...store.categories.map(category => category.id),
      ...store.transactions.map(transaction => transaction.id),
      ...store.splits.map(split => split.id)
    ];

    // TWO remaps, and neither is this port's. `planCloudImport` replaces Money's
    // stable ids and follows every cross-reference; `remapBackupIds` then does
    // the same to the plan's, which is the rule every restore gets on every
    // engine. So nothing Money numbered survives as a KEY…
    expect(stored.filter(id => id.startsWith('mny-'))).toEqual([]);
    // …and nothing the plan minted does either: the ids in the file are the
    // format's, which is what proves the second remap really ran.
    expect(stored.filter(id => id.startsWith('ffffffff-'))).toEqual([]);
    expect(stored.every(id => id.startsWith('00000000-0000-4000-8000-'))).toBe(true);

    // Money's ids DO survive, as provenance rather than as keys: a stable
    // per-source id is what lets a later re-import recognise what it already
    // holds, and it is not a reference, so no remap touches it.
    const provenance = provenanceOf(file);
    expect(provenance.every(row => row.source === 'ms-money')).toBe(true);
    expect(provenance.map(row => row.sourceId).sort()).toEqual(
      [UNMARKED, MARKED_C, RECONCILED_R, SPLIT_PARENT, SPLIT_COUNTERPART, TRANSFER_OUT, TRANSFER_IN]
        .map(id => `mny-txn-${id}`)
        .sort()
    );
  });

  it('leaves a ledger that checks out — the crate’s own seventeen rules', async () => {
    const { file } = await migrate();
    const answer: unknown = await createSpawnTransport({ binary: bridge, database: file })
      .call('verify_integrity', {});
    const report = (answer as {
      answer: { ok: boolean; findings: { check: string; id: string; severity: string }[] };
    }).answer;
    const violations = report.findings.filter(finding => finding.severity === 'violation');
    const fired = new Set(violations.map(finding => finding.check));

    // The balance identity, the split sums, both mutuality rules on a transfer
    // and both on a split leg, the dangling-reference checks, and — the one
    // this migration could most easily break — `account_multiple_transfer_
    // categories`, which is C-3's collision as a check rather than as a hope.
    expect([...fired].filter(check => check !== 'account_missing_transfer_category')).toEqual([]);

    // ── THE ONE THING THAT DOES FIRE, AND IT IS TRUE OF BOTH ENGINES ───────
    // MEASURED rather than designed around: the transform mints a To/From
    // category only for accounts Money used as a transfer COUNTERPART, and the
    // schema's trigger — which would have covered the rest — is standing itself
    // down for the whole import so the file's own categories can land. So an
    // account that never received a transfer in Money comes out of a migration
    // without one, on this engine and in the cloud, by the same mechanism.
    //
    // Recorded here rather than hidden by a fixture in which every account is a
    // transfer target. It is a real gap and it belongs to whoever gives this
    // port a caller.
    const missing = report.findings
      .filter(finding => finding.check === 'account_missing_transfer_category')
      .map(finding => finding.id);
    const { accounts } = readBack(file);
    expect(missing.sort()).toEqual(
      ['Old Card', 'Portfolio', 'Portfolio Cash'].map(name => byName(accounts, name).id).sort()
    );
    expect(report.ok).toBe(false);

    // ── AND ONE WARNING, WHICH THE IMPORT IS THE REASON ANYBODY CAN SEE ────
    // A heuristic rather than a rule, and `ok` ignores it on purpose: a credit
    // card genuinely can be in credit. What makes it worth printing is its
    // provenance clause — it only fires on a card whose rows were IMPORTED,
    // because a hand-typed positive balance is a decision and an imported one
    // is a guess. The migration's `import_source` stamp is what puts this
    // account in range of the check at all, which is a second reason the
    // provenance is not decoration.
    //
    // Found by this spec on its first run, against a fixture that did not
    // expect it. Kept rather than smoothed away: the fixture is a card carrying
    // a £90 credit, which is exactly the shape the check is for.
    expect(report.findings.filter(finding => finding.severity === 'warning').map(f => f.check))
      .toEqual(['card_account_sign_implausible']);
    expect(report.warnings).toBe(1);
  });

  it('reports four phases, every one of them something that happened', async () => {
    const { progress } = await migrate();

    // Not a progress bar drawn from a loop. There are exactly two crossings
    // here — one wipe, one restore — and neither has an honest fraction inside
    // it, so the phases are the things that really occurred and nothing else.
    expect(progress.map(entry => entry.phase)).toEqual([
      'wiping',
      'accounts',
      'transactions',
      'done'
    ]);
    expect(progress.map(entry => entry.fraction)).toEqual([0.02, 0.2, 0.5, 1]);
    expect(progress[progress.length - 1].message).toBe('Import complete.');
  });

  it('refuses, rather than reporting, and changes nothing when it does', async () => {
    // The seam's own distinction: `importTransactions` REPORTS ("412 of 900
    // landed" is a thing a caller renders), and a total migration REJECTS —
    // there is no halfway answer to draw.
    const file = files.create('msmoney-refused');
    aLedgerAlreadyInUse(file);

    const port = new LocalDataPort({
      owner: OWNER,
      transport: createSpawnTransport({ binary: bridge, database: file }),
      format: backupFormat(),
      migration: {
        // A plan naming a category level the format's steps never send. The rows
        // arrive, the file refuses them, and the whole transaction goes back.
        plan: (result, owner) => {
          const plan = planCloudImport(result, owner, planIds());
          return {
            ...plan,
            transactions: plan.transactions.map(row => ({ ...row, type: 'sideways' }))
          };
        }
      },
      logger: { error: () => {} }
    });

    await expect(port.importMsMoney(parsedFile())).rejects.toThrow();

    // The wipe DID run — it is the first of the two calls and it committed. So
    // the store is empty rather than as it was, which is exactly the state the
    // seam describes for a migration that stopped part-way and exactly what the
    // "run it again" recovery expects. Nothing is half-imported.
    const store = readBack(file);
    expect(store.accounts).toEqual([]);
    expect(store.transactions).toEqual([]);
    expect(await port.financialDataIsEmpty()).toBe(true);
  });

  it('agrees with the browser edition about what the same file MEANS', async () => {
    // ── THE DIFFERENTIAL ───────────────────────────────────────────────────
    // One .mny file, two of the app's three write paths, compared on everything
    // that is comparable. The ids are not: `importToLocalStorage` writes the
    // transform's own (`mny-txn-…`) into a browser store, and a ledger file
    // re-keys everything twice. What must agree is the LEDGER — which accounts,
    // which rows, which flags, which lines — because that is what the user has
    // either way, and a migration that meant two different things depending on
    // whether somebody was signed in would be the defect this seam exists to
    // make impossible.
    const { file } = await migrate();
    const local = readBack(file);

    const written = new Map<string, unknown>();
    await importToLocalStorage(
      parsedFile(),
      {
        ACCOUNTS: 'accounts', TRANSACTIONS: 'transactions', CATEGORIES: 'categories',
        TRANSACTION_SPLITS: 'splits', BUDGETS: 'budgets', GOALS: 'goals', RECURRING: 'recurring'
      },
      { store: { setMany: async entries => { entries.forEach(({ key, value }) => written.set(key, value)); } } }
    );
    const device = {
      accounts: written.get('accounts') as Account[],
      transactions: written.get('transactions') as Transaction[],
      splits: written.get('splits') as TransactionSplit[]
    };

    const accountShape = (accounts: readonly Account[]): string[] =>
      accounts.map(a => `${a.name}|${a.type}|${a.balance}|${a.openingBalance}|${a.isActive}`).sort();
    const rowShape = (transactions: readonly Transaction[]): string[] =>
      transactions
        .map(t => `${t.description}|${t.amount}|${t.type}|${t.cleared}|${t.reconciled}|${t.isSplit === true}`)
        .sort();
    const lineShape = (splits: readonly TransactionSplit[]): string[] =>
      splits.map(s => `${s.amount}|${s.memo ?? ''}|${s.sortOrder}`).sort();

    expect(accountShape(local.accounts)).toEqual(accountShape(device.accounts));
    expect(rowShape(local.transactions)).toEqual(rowShape(device.transactions));
    expect(lineShape(local.splits)).toEqual(lineShape(device.splits));

    // Both editions stamp the committed flag, and both get it from the one rule
    // (`reconciledFromMoney`) rather than from two readings of `cleared`.
    expect(device.transactions.filter(t => t.reconciled === true)).toHaveLength(
      local.transactions.filter(t => t.reconciled === true).length
    );
  });
});
