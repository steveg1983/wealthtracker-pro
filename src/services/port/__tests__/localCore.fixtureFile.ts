/**
 * A real `.db` file, seeded from an APP-shaped fixture and read back again.
 *
 * ── WHY THIS IS FOUR HUNDRED LINES AND NOT TWENTY ───────────────────────────
 *
 * `PortFixture` and `PortStoreState` are the APP's shapes: `Date`s, camelCase,
 * `number` money, tags as an array on the row, booleans as booleans. A SQLite
 * ledger is none of those things: minor units, ISO text, `YYYY-MM-DD` days,
 * snake_case, 0/1, and two child tables (`transaction_tags`,
 * `suggestion_dismissal_subjects`) where the app holds arrays. Seven entities,
 * both directions. That translation IS the work, and pretending otherwise is
 * how a harness comes to "pass" by comparing two things it converted the same
 * wrong way.
 *
 * ── THE READ-BACK IS INDEPENDENT OF THE PORT, AND THAT IS THE WHOLE POINT ───
 *
 * `read()` is the witness for every "the refusal changed nothing" and every
 * "the row really landed" assertion in the contract suite. If it were the
 * port's own reads, all of those would collapse into "the port agrees with
 * itself" — a property that a port which silently writes nothing and reads
 * nothing back satisfies perfectly.
 *
 * So nothing in this file imports `src/services/local`. It goes to the file
 * with `node:sqlite`, and it maps rows into app shapes with the mappers below,
 * which are this file's own. The contract suite does not take that on trust
 * either: the rule *"reads its own store back by some means other than itself"*
 * spies on every operation the port has and fails if `read()` touches one.
 *
 * ── ONE COLUMN TABLE, READ IN BOTH DIRECTIONS ───────────────────────────────
 *
 * The independence above is worth having; two independent CONVERSIONS would not
 * be. If the writer decided that £70.10 is 7010 and the reader decided it is
 * 7010 by its own route, a shared mistake in the two routes would still cancel
 * out and a real disagreement between them would look like a fixture bug.
 *
 * So the columns are declared ONCE — {@link ENTITIES} — as (column, app field,
 * kind) triples, and the writer and the reader are two interpretations of the
 * same list. A column added to one direction is added to both by construction.
 * What stays per-entity, and per-direction, is ASSEMBLY: which fields are
 * required, what a NOT NULL column with no app field is filled from, and the
 * two child tables. That is where the app's own defaults live and it is
 * deliberately not shared, because the two directions genuinely differ there.
 *
 * ── SEEDING IS DIRECT SQL, BECAUSE THE WRITES DO NOT EXIST YET ──────────────
 *
 * `LocalDataPort` implements the reads and none of the writes, so a fixture
 * cannot be seeded through the port at this slice — and once the writes DO
 * exist, seeding through them would make the same port-versus-itself mistake in
 * the other direction. PHASE3-PLAN D-6 also rejected the tidier-looking
 * alternative: test-only `seed`/`dump` verbs behind a cargo feature are a
 * SQL-shaped door one build configuration away from shipping.
 *
 * A fixture that the schema refuses is reported with the constraint's own name
 * and the row that broke it, never smoothed over. That is the harness doing its
 * job: the schema is a second opinion about what a ledger may contain, and the
 * first thing it found was a contract fixture with a category on a split parent
 * (`transactions_split_parent_has_blank_category`), which the other three split
 * fixtures in that file already knew not to do.
 */

import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type {
  Account,
  Budget,
  Category,
  Goal,
  SuggestionDismissal,
  Transaction,
  TransactionSplit
} from '../../../types';
import type { PortFixture, PortStoreState } from './contract';

// ── The bridge ──────────────────────────────────────────────────────────────

const REPO = path.resolve(__dirname, '..', '..', '..', '..');

/**
 * Where the built CLI is, or the sentence that says how to build it.
 *
 * IT REFUSES TO SKIP (R-8). A suite that quietly passes when the engine it is
 * about is not there is worse than no suite: it reports the local edition as
 * conforming on every machine that has not built it, which is most of them.
 */
export function locateBridge(): string {
  const override = process.env.WEALTH_CORE_CLI;
  if (override !== undefined && override !== '') return override;
  for (const profile of ['release', 'debug']) {
    const candidate = path.join(REPO, 'crates', 'target', profile, 'wealth-core-cli');
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    'The local-core contract suite needs the ledger crate, and it is not built.\n' +
      '    ~/.cargo/bin/cargo build --manifest-path crates/Cargo.toml --features cli\n' +
      '  (or point WEALTH_CORE_CLI at an existing binary), then re-run.'
  );
}

// ── Values, converted once, in both directions ──────────────────────────────

type Kind =
  | 'text'
  | 'money'
  | 'percent'
  | 'int'
  | 'bool'
  | 'day'
  | 'dayText'
  | 'instant'
  | 'accountType';

interface Column {
  /** The SQLite column. */
  column: string;
  /** The app field it holds. */
  field: string;
  kind: Kind;
}

/**
 * The database spells a current account 'checking'. The app says 'current'.
 * The same swap `accountMapping.ts` performs, written out here because this
 * file may not import the port's half of the translation.
 */
const DB_CURRENT = 'checking';

/**
 * An amount as the integer number of pennies the schema stores.
 *
 * Via the two-place decimal RENDERING, never via `amount * 100`: the latter is
 * 3059.9999999999995 for 30.6 and the rounding that hides it is exactly the
 * float arithmetic this repo bans on money. `toFixed(2)` produces the same text
 * the crate's `Money::to_decimal_string` produces, and the arithmetic that
 * follows is on two safe integers.
 *
 * A sub-penny amount is REFUSED rather than rounded — divergence M-1 says the
 * local core refuses one, and a seed writer that quietly rounded would put a
 * figure in the file that the engine under test would never have accepted.
 */
const toMinorUnits = (amount: number, where: string): number => {
  if (!Number.isFinite(amount)) throw new Error(`${where}: ${amount} is not an amount`);
  const rendered = amount.toFixed(2);
  if (Number(rendered) !== amount) {
    throw new Error(
      `${where}: ${amount} is smaller than a penny, and a local ledger refuses one (M-1).`
    );
  }
  const negative = rendered.startsWith('-');
  const [whole, fraction] = rendered.replace('-', '').split('.');
  const minor = Number(whole) * 100 + Number(fraction);
  return negative ? -minor : minor;
};

/** Pennies back to the app's number, by the same route in reverse. */
const fromMinorUnits = (minor: number): number => {
  const negative = minor < 0;
  const absolute = Math.abs(minor);
  const whole = (absolute - (absolute % 100)) / 100;
  const text = `${negative ? '-' : ''}${whole}.${String(absolute % 100).padStart(2, '0')}`;
  return Number(text);
};

/** A calendar day, from whatever the app holds. */
const toDay = (value: unknown, where: string): string => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  throw new Error(`${where}: ${String(value)} is not a day`);
};

/**
 * A day back as a `Date` at NOON — the hour that names the same calendar day in
 * every zone the app is used in. Midnight would put a row dated the 31st on the
 * 30th for everybody west of Greenwich, which is the bug `Account.bankBalanceDate`
 * exists as a string to avoid.
 */
const fromDay = (value: string): Date => new Date(`${value}T12:00:00.000Z`);

const toInstant = (value: unknown, where: string): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && value !== '') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  throw new Error(`${where}: ${String(value)} is not a timestamp`);
};

/** A value on its way into the file, or `null` for "the app did not state it". */
const toColumn = (kind: Kind, value: unknown, where: string): string | number | null => {
  if (value === undefined || value === null) return null;
  switch (kind) {
    case 'text':
      return typeof value === 'string' ? value : String(value);
    case 'accountType':
      return value === 'current' ? DB_CURRENT : String(value);
    case 'money':
      return typeof value === 'number' ? toMinorUnits(value, where) : null;
    // NOT money, and named apart from it for the reason `schema.sql` states in
    // capitals at the column: `alert_threshold_bp` is hundredths of a PERCENT
    // (8000 meaning 80.00%). The scaling is identical, the quantity is not, and
    // a `Money` that held a percentage would be eligible for arithmetic this
    // repo reserves for amounts.
    case 'percent':
      return typeof value === 'number' ? toMinorUnits(value, where) : null;
    case 'int':
      return typeof value === 'number' && Number.isInteger(value) ? value : null;
    case 'bool':
      return value === true ? 1 : 0;
    case 'day':
    case 'dayText':
      return toDay(value, where);
    case 'instant':
      return toInstant(value, where);
  }
};

/** A stored value on its way back out, or `undefined` for a NULL column. */
const fromColumn = (kind: Kind, value: unknown): unknown => {
  if (value === null || value === undefined) return undefined;
  switch (kind) {
    case 'text':
      return typeof value === 'string' ? value : String(value);
    case 'accountType':
      return value === DB_CURRENT ? 'current' : String(value);
    case 'money':
    case 'percent':
      return typeof value === 'number' ? fromMinorUnits(value) : undefined;
    case 'int':
      return typeof value === 'number' ? value : undefined;
    case 'bool':
      return value === 1;
    case 'day':
      return typeof value === 'string' ? fromDay(value) : undefined;
    case 'dayText':
      return typeof value === 'string' ? value : undefined;
    case 'instant':
      return typeof value === 'string' ? new Date(value) : undefined;
  }
};

// ── The one column table ────────────────────────────────────────────────────
//
// Columns the schema has and the app has no field for (`metadata`, `icon`,
// `color`, the promoted FX money, the import provenance) are absent from both
// directions on purpose: a fixture cannot state them and a read-back cannot
// invent them. Columns the APP has and this schema has not — `creditLimit`,
// `lastReconciledBalance`, `Transaction.reconciled` — are absent for the
// opposite reason, and that is a real gap in `scripts/local-sqlite/schema.sql`
// rather than a shortcut here: the mirror predates the two migrations that
// added them, and the day it catches up, one line in each list below is the
// whole change.

const ENTITIES = {
  accounts: [
    { column: 'id', field: 'id', kind: 'text' },
    { column: 'name', field: 'name', kind: 'text' },
    { column: 'type', field: 'type', kind: 'accountType' },
    { column: 'currency', field: 'currency', kind: 'text' },
    { column: 'balance_minor', field: 'balance', kind: 'money' },
    { column: 'initial_balance_minor', field: 'openingBalance', kind: 'money' },
    { column: 'bank_balance_minor', field: 'bankBalance', kind: 'money' },
    { column: 'bank_balance_date', field: 'bankBalanceDate', kind: 'dayText' },
    { column: 'last_reconciled_date', field: 'lastReconciledDate', kind: 'day' },
    { column: 'low_balance_alert_enabled', field: 'lowBalanceAlertEnabled', kind: 'bool' },
    { column: 'low_balance_threshold_minor', field: 'lowBalanceThreshold', kind: 'money' },
    { column: 'opening_balance_date', field: 'openingBalanceDate', kind: 'day' },
    { column: 'archive_through_date', field: 'archiveThroughDate', kind: 'day' },
    { column: 'parent_account_id', field: 'parentAccountId', kind: 'text' },
    { column: 'institution', field: 'institution', kind: 'text' },
    { column: 'account_number', field: 'accountNumber', kind: 'text' },
    { column: 'sort_code', field: 'sortCode', kind: 'text' },
    { column: 'notes', field: 'notes', kind: 'text' },
    { column: 'is_active', field: 'isActive', kind: 'bool' },
    { column: 'created_at', field: 'createdAt', kind: 'instant' },
    { column: 'updated_at', field: 'lastUpdated', kind: 'instant' }
  ],
  transactions: [
    { column: 'id', field: 'id', kind: 'text' },
    { column: 'account_id', field: 'accountId', kind: 'text' },
    { column: 'description', field: 'description', kind: 'text' },
    { column: 'amount_minor', field: 'amount', kind: 'money' },
    { column: 'type', field: 'type', kind: 'text' },
    { column: 'date', field: 'date', kind: 'day' },
    { column: 'category', field: 'category', kind: 'text' },
    { column: 'notes', field: 'notes', kind: 'text' },
    { column: 'is_recurring', field: 'isRecurring', kind: 'bool' },
    { column: 'is_cleared', field: 'cleared', kind: 'bool' },
    { column: 'is_split', field: 'isSplit', kind: 'bool' },
    { column: 'archived', field: 'archived', kind: 'bool' },
    { column: 'statement_sequence', field: 'statementSequence', kind: 'int' },
    { column: 'category_confirmed', field: 'categoryConfirmed', kind: 'bool' },
    { column: 'needs_review', field: 'needsReview', kind: 'bool' },
    { column: 'transfer_account_id', field: 'transferAccountId', kind: 'text' },
    { column: 'linked_transfer_id', field: 'linkedTransferId', kind: 'text' },
    { column: 'linked_transfer_split_id', field: 'linkedTransferSplitId', kind: 'text' },
    { column: 'created_at', field: 'createdAt', kind: 'instant' },
    { column: 'updated_at', field: 'updatedAt', kind: 'instant' }
  ],
  categories: [
    { column: 'id', field: 'id', kind: 'text' },
    { column: 'name', field: 'name', kind: 'text' },
    { column: 'type', field: 'type', kind: 'text' },
    { column: 'level', field: 'level', kind: 'text' },
    { column: 'parent_id', field: 'parentId', kind: 'text' },
    { column: 'account_id', field: 'accountId', kind: 'text' },
    { column: 'color', field: 'color', kind: 'text' },
    { column: 'icon', field: 'icon', kind: 'text' },
    { column: 'is_system', field: 'isSystem', kind: 'bool' },
    { column: 'is_transfer_category', field: 'isTransferCategory', kind: 'bool' },
    { column: 'is_revaluation_category', field: 'isRevaluationCategory', kind: 'bool' },
    { column: 'is_unassigned_bucket', field: 'isUnassignedBucket', kind: 'bool' },
    { column: 'is_active', field: 'isActive', kind: 'bool' }
  ],
  transaction_splits: [
    { column: 'id', field: 'id', kind: 'text' },
    { column: 'transaction_id', field: 'transactionId', kind: 'text' },
    { column: 'category', field: 'category', kind: 'text' },
    { column: 'amount_minor', field: 'amount', kind: 'money' },
    { column: 'memo', field: 'memo', kind: 'text' },
    { column: 'sort_order', field: 'sortOrder', kind: 'int' },
    { column: 'transfer_account_id', field: 'transferAccountId', kind: 'text' },
    { column: 'linked_transfer_id', field: 'linkedTransferId', kind: 'text' }
  ],
  budgets: [
    { column: 'id', field: 'id', kind: 'text' },
    { column: 'name', field: 'name', kind: 'text' },
    { column: 'amount_minor', field: 'amount', kind: 'money' },
    { column: 'period', field: 'period', kind: 'text' },
    { column: 'category', field: 'categoryId', kind: 'text' },
    { column: 'start_date', field: 'startDate', kind: 'dayText' },
    { column: 'end_date', field: 'endDate', kind: 'dayText' },
    { column: 'spent_minor', field: 'spent', kind: 'money' },
    { column: 'rollover', field: 'rollover', kind: 'bool' },
    { column: 'rollover_amount_minor', field: 'rolloverAmount', kind: 'money' },
    { column: 'alert_threshold_bp', field: 'alertThreshold', kind: 'percent' },
    { column: 'is_active', field: 'isActive', kind: 'bool' },
    { column: 'notes', field: 'notes', kind: 'text' },
    { column: 'created_at', field: 'createdAt', kind: 'instant' },
    { column: 'updated_at', field: 'updatedAt', kind: 'instant' }
  ],
  goals: [
    { column: 'id', field: 'id', kind: 'text' },
    { column: 'name', field: 'name', kind: 'text' },
    { column: 'description', field: 'description', kind: 'text' },
    { column: 'target_amount_minor', field: 'targetAmount', kind: 'money' },
    { column: 'current_amount_minor', field: 'currentAmount', kind: 'money' },
    { column: 'target_date', field: 'targetDate', kind: 'day' },
    { column: 'status', field: 'status', kind: 'text' },
    { column: 'category', field: 'category', kind: 'text' },
    { column: 'priority', field: 'priority', kind: 'text' },
    { column: 'account_id', field: 'accountId', kind: 'text' },
    { column: 'contribution_frequency', field: 'contributionFrequency', kind: 'text' },
    { column: 'auto_contribute', field: 'autoContribute', kind: 'bool' },
    { column: 'icon', field: 'icon', kind: 'text' },
    { column: 'color', field: 'color', kind: 'text' },
    { column: 'created_at', field: 'createdAt', kind: 'instant' },
    { column: 'updated_at', field: 'updatedAt', kind: 'instant' }
  ],
  suggestion_dismissals: [
    { column: 'id', field: 'id', kind: 'text' },
    { column: 'kind', field: 'kind', kind: 'text' },
    { column: 'subject_key', field: 'subjectKey', kind: 'text' },
    { column: 'dismissed_at', field: 'dismissedAt', kind: 'instant' }
  ]
} satisfies Record<string, readonly Column[]>;

type EntityName = keyof typeof ENTITIES;

// ── Writing ─────────────────────────────────────────────────────────────────

/** Anything a fixture object may carry, without asserting which. */
type FixtureRow = Record<string, unknown>;

const asRow = (value: object): FixtureRow => ({ ...value });

/**
 * One INSERT for one fixture row, plus whatever the schema requires that the
 * app does not state.
 *
 * `extra` is where a NOT NULL column with no app field is filled in, and every
 * one of them is a decision rather than a placeholder — see the call sites.
 */
function insert(
  database: DatabaseSync,
  entity: EntityName,
  value: object,
  extra: Record<string, string | number | null>
): void {
  const row = asRow(value);
  const columns: Record<string, string | number | null> = { ...extra };
  for (const { column, field, kind } of ENTITIES[entity]) {
    const stated = row[field];
    if (stated === undefined || stated === null) continue;
    columns[column] = toColumn(kind, stated, `${entity}.${field}`);
  }

  const names = Object.keys(columns);
  const statement = `INSERT INTO ${entity} (${names.join(', ')}) VALUES (${names
    .map(() => '?')
    .join(', ')})`;
  try {
    database.prepare(statement).run(...names.map(name => columns[name]));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    // Named loudly. The schema is a second opinion about what a ledger may
    // hold, and a fixture it refuses is a finding, not an inconvenience.
    throw new Error(
      `The ledger schema refused a ${entity} fixture row (${String(row.id)}): ${detail}`
    );
  }
}

/**
 * Seed one file from an app-shaped fixture.
 *
 * ORDER IS LOAD-BEARING, and it is the restore path's order for the restore
 * path's reason. `trg_create_transfer_category_for_account` mints a
 * 'To/From <account>' category on every account INSERT — but only once a
 * type-level Transfer category exists. Writing the accounts FIRST stands the
 * trigger down (exactly as `restore_user_chunk` relies on), so the store holds
 * what the fixture asked for and nothing else. The other order would seed
 * categories no test asked for, with ids nobody can predict.
 *
 * One transaction around the lot, because two of the foreign keys are DEFERRED:
 * a transfer's two halves name each other, so neither can be inserted second
 * without the other already being there.
 */
export function seed(file: string, fixture: PortFixture, owner: string): void {
  const database = new DatabaseSync(file);
  try {
    database.exec('PRAGMA foreign_keys = ON');
    database.exec('BEGIN');

    // The file's one login. `create_file` will mint this uuid when the desktop
    // shell exists (PHASE3-PLAN §5); until then the harness is what opens a
    // document, so the harness is what states its owner. The email is a stated
    // non-address rather than a blank, because the column is NOT NULL and a
    // device has no email to put there.
    database
      .prepare('INSERT INTO users (id, email) VALUES (?, ?)')
      .run(owner, 'device@localhost');

    for (const account of fixture.accounts ?? []) {
      insert(database, 'accounts', account, { user_id: owner });
    }
    for (const category of fixture.categories ?? []) {
      insert(database, 'categories', category, { user_id: owner });
    }
    for (const transaction of fixture.transactions ?? []) {
      insert(database, 'transactions', transaction, { user_id: owner });
      for (const tag of (transaction.tags ?? []).filter(entry => entry.trim() !== '')) {
        database
          .prepare('INSERT INTO transaction_tags (transaction_id, tag) VALUES (?, ?)')
          .run(transaction.id, tag);
      }
    }
    for (const split of fixture.splits ?? []) {
      insert(database, 'transaction_splits', split, { user_id: owner });
    }
    for (const budget of fixture.budgets ?? []) {
      insert(database, 'budgets', budget, {
        user_id: owner,
        // NOT NULL with no app field behind it. The cloud's writer makes the
        // same substitution in the same order (`planningService.budgetToDb`:
        // `b.name ?? b.categoryId ?? 'Budget'`), so a budget seeded here reads
        // back with the name a budget written there would have.
        name: budget.name ?? budget.categoryId ?? 'Budget',
        // NOT NULL, and a budget's period has to start somewhere. The day it
        // was created is the only honest answer available from a fixture that
        // did not state one.
        start_date: toDay(budget.startDate ?? budget.createdAt, 'budgets.startDate')
      });
    }
    for (const goal of fixture.goals ?? []) {
      insert(database, 'goals', goal, {
        user_id: owner,
        // One column answers isActive and achieved, exactly as `goalFromDb`
        // reads it back.
        status: goal.achieved === true ? 'completed' : goal.isActive === false ? 'paused' : 'active',
        // `Goal.type` is not a column in EITHER engine: the cloud keeps it in
        // the metadata blob and reads it from there, so a local file that put
        // it anywhere else would answer a different question.
        metadata: JSON.stringify({ type: goal.type })
      });
    }
    for (const dismissal of fixture.dismissals ?? []) {
      insert(database, 'suggestion_dismissals', dismissal, { user_id: owner });
      dismissal.subjectIds.forEach((transactionId, index) => {
        database
          .prepare(
            'INSERT INTO suggestion_dismissal_subjects (dismissal_id, transaction_id, role_order)' +
              ' VALUES (?, ?, ?)'
          )
          .run(dismissal.id, transactionId, index);
      });
    }

    database.exec('COMMIT');
  } finally {
    database.close();
  }
}

// ── Reading back ────────────────────────────────────────────────────────────

/** Every column of one entity, converted, keyed by APP field name. */
function fieldsOf(entity: EntityName, row: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const { column, field, kind } of ENTITIES[entity]) {
    values[field] = fromColumn(kind, row[column]);
  }
  return values;
}

const asText = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' ? value : fallback;
const asDate = (value: unknown): Date => (value instanceof Date ? value : new Date(0));
const asFlag = (value: unknown): boolean => value === true;

/**
 * The store as the app would see it.
 *
 * Assembly, not conversion: every value here has already come through the one
 * column table above. What this adds is the app's own required-field defaults,
 * and the two child tables folded back into arrays — which is the shape the
 * suite compares, and the shape a fixture went in as.
 *
 * The row ORDER is the file's own (`ORDER BY rowid`), not the read verbs'.
 * Deliberately: a read's ordering is part of what the contract asks the PORT
 * about, so a witness that imposed the same order would be agreeing with it for
 * free.
 */
export function readBack(file: string): PortStoreState {
  const database = new DatabaseSync(file);
  try {
    database.exec('PRAGMA foreign_keys = ON');
    const all = (sql: string): Record<string, unknown>[] => {
      const rows: unknown[] = database.prepare(sql).all();
      return rows.filter(
        (row): row is Record<string, unknown> => typeof row === 'object' && row !== null
      );
    };

    // ORDER BY the key, not by rowid: `transaction_tags` is WITHOUT ROWID (a
    // two-column primary key and nothing else), so it genuinely has no rowid to
    // order by — SQLite says "no such column" rather than ignoring it.
    const tagsByTransaction = new Map<string, string[]>();
    for (const row of all(
      'SELECT transaction_id, tag FROM transaction_tags ORDER BY transaction_id, tag'
    )) {
      const id = asText(row.transaction_id);
      const existing = tagsByTransaction.get(id) ?? [];
      existing.push(asText(row.tag));
      tagsByTransaction.set(id, existing);
    }

    const subjectsByDismissal = new Map<string, string[]>();
    for (const row of all(
      'SELECT dismissal_id, transaction_id FROM suggestion_dismissal_subjects ORDER BY dismissal_id, role_order'
    )) {
      const id = asText(row.dismissal_id);
      const existing = subjectsByDismissal.get(id) ?? [];
      existing.push(asText(row.transaction_id));
      subjectsByDismissal.set(id, existing);
    }

    const accounts: Account[] = all('SELECT * FROM accounts ORDER BY rowid').map(row => {
      const value = fieldsOf('accounts', row);
      return {
        id: asText(value.id),
        name: asText(value.name),
        type: accountTypeOf(value.type),
        balance: asNumber(value.balance),
        currency: asText(value.currency, 'GBP'),
        institution: asText(value.institution),
        isActive: asFlag(value.isActive),
        openingBalance: asNumber(value.openingBalance),
        openingBalanceDate: value.openingBalanceDate instanceof Date ? value.openingBalanceDate : undefined,
        createdAt: value.createdAt instanceof Date ? value.createdAt : undefined,
        updatedAt: asDate(value.lastUpdated),
        lastUpdated: asDate(value.lastUpdated),
        bankBalance: typeof value.bankBalance === 'number' ? value.bankBalance : null,
        bankBalanceDate: typeof value.bankBalanceDate === 'string' ? value.bankBalanceDate : null,
        lastReconciledDate: value.lastReconciledDate instanceof Date ? value.lastReconciledDate : null,
        sortCode: asText(value.sortCode),
        accountNumber: asText(value.accountNumber),
        notes: asText(value.notes),
        archiveThroughDate: value.archiveThroughDate instanceof Date ? value.archiveThroughDate : null,
        parentAccountId: typeof value.parentAccountId === 'string' ? value.parentAccountId : null,
        lowBalanceAlertEnabled: asFlag(value.lowBalanceAlertEnabled),
        lowBalanceThreshold:
          typeof value.lowBalanceThreshold === 'number' ? value.lowBalanceThreshold : undefined
      };
    });

    const transactions: Transaction[] = all('SELECT * FROM transactions ORDER BY rowid').map(row => {
      const value = fieldsOf('transactions', row);
      const id = asText(value.id);
      return {
        id,
        accountId: asText(value.accountId),
        amount: asNumber(value.amount),
        date: asDate(value.date),
        description: asText(value.description),
        category: asText(value.category),
        type: transactionTypeOf(value.type),
        notes: typeof value.notes === 'string' ? value.notes : undefined,
        tags: tagsByTransaction.get(id) ?? [],
        cleared: asFlag(value.cleared),
        isRecurring: asFlag(value.isRecurring),
        isSplit: asFlag(value.isSplit),
        archived: asFlag(value.archived),
        categoryConfirmed: asFlag(value.categoryConfirmed),
        needsReview: asFlag(value.needsReview),
        statementSequence: typeof value.statementSequence === 'number' ? value.statementSequence : null,
        transferAccountId: typeof value.transferAccountId === 'string' ? value.transferAccountId : undefined,
        linkedTransferId: typeof value.linkedTransferId === 'string' ? value.linkedTransferId : undefined,
        linkedTransferSplitId:
          typeof value.linkedTransferSplitId === 'string' ? value.linkedTransferSplitId : undefined,
        createdAt: value.createdAt instanceof Date ? value.createdAt : undefined,
        updatedAt: value.updatedAt instanceof Date ? value.updatedAt : undefined
      };
    });

    const splits: TransactionSplit[] = all('SELECT * FROM transaction_splits ORDER BY rowid').map(
      row => {
        const value = fieldsOf('transaction_splits', row);
        return {
          id: asText(value.id),
          transactionId: asText(value.transactionId),
          category: asText(value.category),
          amount: asNumber(value.amount),
          memo: typeof value.memo === 'string' ? value.memo : undefined,
          sortOrder: asNumber(value.sortOrder),
          ...(typeof value.transferAccountId === 'string'
            ? { transferAccountId: value.transferAccountId }
            : {}),
          ...(typeof value.linkedTransferId === 'string'
            ? { linkedTransferId: value.linkedTransferId }
            : {})
        };
      }
    );

    const categories: Category[] = all('SELECT * FROM categories ORDER BY rowid').map(row => {
      const value = fieldsOf('categories', row);
      return {
        id: asText(value.id),
        name: asText(value.name),
        type: categoryTypeOf(value.type),
        level: categoryLevelOf(value.level),
        parentId: typeof value.parentId === 'string' ? value.parentId : null,
        color: typeof value.color === 'string' ? value.color : undefined,
        icon: typeof value.icon === 'string' ? value.icon : undefined,
        isSystem: asFlag(value.isSystem),
        isTransferCategory: asFlag(value.isTransferCategory),
        isRevaluationCategory: asFlag(value.isRevaluationCategory),
        isUnassignedBucket: asFlag(value.isUnassignedBucket),
        accountId: typeof value.accountId === 'string' ? value.accountId : undefined,
        isActive: asFlag(value.isActive)
      };
    });

    const budgets: Budget[] = all('SELECT * FROM budgets ORDER BY rowid').map(row => {
      const value = fieldsOf('budgets', row);
      return {
        id: asText(value.id),
        categoryId: asText(value.categoryId),
        amount: asNumber(value.amount),
        period: budgetPeriodOf(value.period),
        isActive: asFlag(value.isActive),
        createdAt: asDate(value.createdAt),
        updatedAt: asDate(value.updatedAt),
        name: typeof value.name === 'string' ? value.name : undefined,
        spent: asNumber(value.spent),
        startDate: typeof value.startDate === 'string' ? value.startDate : undefined,
        endDate: typeof value.endDate === 'string' ? value.endDate : undefined,
        rollover: asFlag(value.rollover),
        rolloverAmount: asNumber(value.rolloverAmount),
        alertThreshold:
          typeof value.alertThreshold === 'number' ? value.alertThreshold : undefined,
        notes: typeof value.notes === 'string' ? value.notes : undefined
      };
    });

    const goals: Goal[] = all('SELECT * FROM goals ORDER BY rowid').map(row => {
      const value = fieldsOf('goals', row);
      const currentAmount = asNumber(value.currentAmount);
      const status = goalStatusOf(value.status);
      return {
        id: asText(value.id),
        name: asText(value.name),
        // Out of the metadata blob, which is where both engines keep it.
        type: goalTypeOf(readMetadata(row.metadata).type),
        targetAmount: asNumber(value.targetAmount),
        currentAmount,
        progress: currentAmount,
        targetDate: asDate(value.targetDate),
        description: typeof value.description === 'string' ? value.description : undefined,
        isActive: status !== 'paused',
        achieved: status === 'completed',
        status,
        createdAt: asDate(value.createdAt),
        updatedAt: asDate(value.updatedAt),
        category: typeof value.category === 'string' ? value.category : undefined,
        accountId: typeof value.accountId === 'string' ? value.accountId : undefined,
        autoContribute: asFlag(value.autoContribute),
        contributionFrequency:
          typeof value.contributionFrequency === 'string' ? value.contributionFrequency : undefined,
        icon: typeof value.icon === 'string' ? value.icon : undefined,
        color: typeof value.color === 'string' ? value.color : undefined
      };
    });

    const dismissals: SuggestionDismissal[] = all(
      'SELECT * FROM suggestion_dismissals ORDER BY rowid'
    ).map(row => {
      const value = fieldsOf('suggestion_dismissals', row);
      const id = asText(value.id);
      return {
        id,
        kind: dismissalKindOf(value.kind),
        subjectKey: asText(value.subjectKey),
        subjectIds: subjectsByDismissal.get(id) ?? [],
        dismissedAt: asDate(value.dismissedAt)
      };
    });

    return { accounts, transactions, splits, categories, budgets, goals, dismissals };
  } finally {
    database.close();
  }
}

const readMetadata = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? { ...parsed }
      : {};
  } catch {
    return {};
  }
};

// Closed sets, read back as the app's own unions. A stored value the app has no
// member for reads as the app's own catch-all rather than being asserted into
// the type — the same discipline `accountMapping.ts` uses, for the same reason.

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => {
  const isAllowed = (candidate: string): candidate is T =>
    (allowed as readonly string[]).includes(candidate);
  return typeof value === 'string' && isAllowed(value) ? value : fallback;
};

const accountTypeOf = (value: unknown): Account['type'] =>
  oneOf(
    value,
    [
      'current',
      'checking',
      'savings',
      'credit',
      'cash',
      'loan',
      'mortgage',
      'investment',
      'asset',
      'assets',
      'liability',
      'other'
    ] as const,
    'other'
  );

const transactionTypeOf = (value: unknown): Transaction['type'] =>
  oneOf(value, ['income', 'expense', 'transfer'] as const, 'expense');

const categoryTypeOf = (value: unknown): Category['type'] =>
  oneOf(value, ['income', 'expense', 'both'] as const, 'expense');

const categoryLevelOf = (value: unknown): Category['level'] =>
  oneOf(value, ['type', 'sub', 'detail'] as const, 'detail');

const budgetPeriodOf = (value: unknown): Budget['period'] =>
  oneOf(value, ['monthly', 'weekly', 'yearly', 'quarterly', 'custom'] as const, 'custom');

const goalTypeOf = (value: unknown): Goal['type'] =>
  oneOf(value, ['savings', 'debt-payoff', 'investment', 'custom'] as const, 'savings');

const goalStatusOf = (value: unknown): NonNullable<Goal['status']> =>
  oneOf(value, ['active', 'completed', 'paused'] as const, 'active');

const dismissalKindOf = (value: unknown): SuggestionDismissal['kind'] =>
  oneOf(
    value,
    [
      'transfer-pair',
      'transfer-leg',
      'stranded',
      'duplicate',
      'payee-merchant',
      'payee-line',
      'payee-hidden'
    ] as const,
    'duplicate'
  );

// ── Files ───────────────────────────────────────────────────────────────────

/**
 * A directory of ledgers, cleaned up whole.
 *
 * Every test gets a FILE of its own — never a shared one reset between tests —
 * because two of the contract's rules create two stores on purpose and ask each
 * whether it can see the other's rows.
 */
export class LedgerFiles {
  readonly #directory: string;

  readonly #binary: string;

  #count = 0;

  constructor(binary: string) {
    this.#binary = binary;
    this.#directory = mkdtempSync(path.join(tmpdir(), 'wt-local-contract-'));
  }

  /** A new file with the schema applied, by the crate's own opener. */
  create(label: string): string {
    const file = path.join(this.#directory, `${label}-${++this.#count}.db`);
    const applied = spawnSync(this.#binary, ['--apply-schema', '--db', file], {
      encoding: 'utf8'
    });
    if (applied.status !== 0) {
      throw new Error(
        `the ledger crate could not create ${file}: ${(applied.stderr || '').trim() || 'no output'}`
      );
    }
    return file;
  }

  /** A path inside the directory that deliberately does NOT exist. */
  missing(): string {
    return path.join(this.#directory, 'no-such-directory', 'ledger.db');
  }

  dispose(): void {
    rmSync(this.#directory, { recursive: true, force: true });
  }
}
