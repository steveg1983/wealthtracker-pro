-- ============================================================================
-- VENDORED COPY — provenance
-- ============================================================================
-- Origin: the Phase 1 local-edition design draft, written to the session
--         scratchpad as local-core/schema.sql and companion to local-core/
--         DESIGN.md. Copied here on 2026-08-08, byte-for-byte below this
--         header, so the constraint harness has a version-controlled schema to
--         test rather than a file in a temp directory.
--
-- Status: NOT a migration. Nothing applies this to any database except
--         scripts/local-sqlite/run.mjs, which applies it to a throwaway file.
--         supabase/migrations/ remains the only schema anything ships.
--
-- Rule:   this file is a COPY, not a fork. Edit the design first, re-copy, and
--         re-run `npm run test:local-sqlite`. A change made only here is drift,
--         and the parity table in README.md stops meaning anything.
--
-- AMENDED 2026-08-08, in BOTH copies together, by the differential harness:
--         the harness found C-3 and C-4 classified as ported triggers in
--         DESIGN.md §1.4 and absent from the DDL — a new account got no
--         To/From category, and a renamed one kept the old category name.
--         trg_create_transfer_category_for_account and
--         trg_sync_transfer_category_for_account were written from
--         supabase/migrations/20260708140000_transfer_categories_lifecycle.sql,
--         and trg_protect_transfer_category regained the users-row clause it
--         had dropped (C-5): without it DELETE FROM users is refused outright.
--         Both copies were edited in the same change and diffed to prove they
--         differ by this header alone:
--             diff <(tail -n +35 scripts/local-sqlite/schema.sql) \
--                  <scratchpad>/local-core/schema.sql   -> no output
--         (35 = this header is 34 lines; the rest is the original, verbatim.)
--         Specs: specs/c3-*, specs/c4-*, specs/c5-*.
-- ============================================================================

-- ============================================================================
-- WealthTracker — local edition core schema (SQLite)
-- Phase 1 design draft. NOT applied anywhere. NOT a migration.
-- ============================================================================
--
-- Source of truth for every rule reproduced here: supabase/migrations/*.sql.
-- packages/types/supabase.ts is NOT a source — it declares eight tables with no
-- migration behind them (mortgage_calculations, financial_plans,
-- saved_calculations, recurring_templates, tags, sync_queue, user_id_mappings,
-- audit_log — all verified: zero matching CREATE TABLE in supabase/migrations).
--
-- ── THE FOUR RULES THIS FILE EXISTS TO ENFORCE ──────────────────────────────
--
-- 1. Money is INTEGER minor units. Never REAL. Every table is STRICT, so this
--    is enforced by the storage engine, not by convention:
--        sqlite> CREATE TABLE s(amt INTEGER NOT NULL) STRICT;
--        sqlite> INSERT INTO s VALUES (1.5);
--        Error: cannot store REAL value in INTEGER column s.amt
--    (verified, SQLite 3.54.0). Without STRICT, INTEGER is only an affinity and
--    a float sails straight in.
--
-- 2. Scale is per column, and the column NAME says which:
--        _minor  INTEGER, 1e2   money            (matches numeric(x,2) exactly)
--        _e8     INTEGER, 1e8   quantity, price  (numeric(20,8) / price fix)
--        _e10    INTEGER, 1e10  fx rate
--        _bp     INTEGER, 1e2   percentage, NOT money
--    A reader who cannot see the scale in the name will eventually get it wrong.
--
-- 3. Every money column carries a bounded CHECK, because SQLite integers are
--    int64 and the declared Postgres types are wider than int64 once scaled.
--    See "OVERFLOW ARITHMETIC" below.
--
-- 4. Foreign keys are only enforced when the connection says so.
--        sqlite> PRAGMA foreign_keys;   -->  0
--    (verified). Every ON DELETE SET NULL in this file — including the one that
--    deliberately strands a transfer's other leg — is inert unless the opening
--    code sets PRAGMA foreign_keys = ON. That PRAGMA belongs in the Rust
--    connection setup where no caller can forget it.
--
-- ── OVERFLOW ARITHMETIC (this is why the bounds are what they are) ──────────
--
-- INT64_MAX = 9,223,372,036,854,775,807 ≈ 9.223e18.
--
-- Postgres numeric(20,2) permits up to 1e18 − 0.01. Scaled by 100 that needs
-- 1e20, which int64 CANNOT hold. The same is true of numeric(20,8) scaled by
-- 1e8. The prior spike flagged this for quantity only; it is true of EVERY
-- numeric(20,x) column in the schema, money included.
--
-- SQLite's sum() over INTEGER raises "integer overflow" rather than silently
-- promoting to float (verified: SELECT sum(x) FROM (9223372036854775807, 1)
-- --> Error: integer overflow). Fail-loud is the behaviour we want, but the
-- bounds are chosen so it never fires on real data:
--
--   MONEY_ROW  = ±1e11 minor  = ±£1,000,000,000.00 per row
--                9.223e18 / 1e11 = 92,233,720 rows summable before overflow.
--   MONEY_STOCK= ±1e15 minor  = ±£10,000,000,000,000.00 per balance/target
--                9.223e18 / 1e15 = 9,223 accounts summable.
--   QTY        = ±9e18 raw at 1e8 = ±90,000,000,000 units, 8dp exact.
--                Postgres numeric(20,8) permits 1e12 units, so a position
--                larger than 9e10 units exists in the cloud type and is
--                REFUSED here. That divergence is deliberate and tested.
--                Quantities are NEVER summed in SQL — the command layer sums
--                them in i128 — so no aggregate bound is needed.
--   PRICE      = 0..1e16 raw at 1e8 = £0.00000001 .. £100,000,000.00 per unit.
--                price_e8 * quantity_e8 is 1e16-scaled and overflows int64 for
--                any position over ~£92; it is therefore NEVER computed in SQL.
--                The command layer does it in i128 and stores the result in a
--                _minor column.
--
-- ── WHAT IS NOT HERE, AND WHY ───────────────────────────────────────────────
--
-- subscriptions, subscription_usage, subscription_events, subscription_logs,
-- invoices, payment_methods, user_profiles, plaid_* (already dropped by
-- 20260613100000_drop_legacy_plaid_tables.sql), bank_connections,
-- linked_accounts, sync_history, sync_metadata, banking_ops_alert_counters.
-- These are SaaS billing and bank-feed plumbing. A local file has no
-- subscription and no bank feed. transactions keeps connection_id,
-- external_transaction_id and external_provider as plain nullable columns with
-- no FK, so a cloud backup restores into a local file without loss.
--
-- ============================================================================


-- ── Connection setup. Every one of these is per-connection, not per-file. ───
-- Belongs in Rust, applied on open, verified by a startup assertion.
PRAGMA journal_mode = WAL;      -- persistent (stored in the file header)
PRAGMA foreign_keys = ON;       -- PER CONNECTION. Default 0. Verified.
PRAGMA synchronous = FULL;      -- measured cost: insert median 0.114ms vs
                                -- 0.069ms at NORMAL (storage-spike,
                                -- results-node-sqlite.json, n=50000); bulk
                                -- writes 38.4ms vs 38.0ms. Money buys FULL.
PRAGMA busy_timeout = 5000;
PRAGMA trusted_schema = OFF;
PRAGMA recursive_triggers = OFF; -- default; the updated_at triggers rely on it


-- ============================================================================
-- 0. FILE IDENTITY
-- ============================================================================

CREATE TABLE schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;
-- rows: schema_version, created_at, created_by_app_version, money_scale='100',
--       qty_scale='100000000', price_scale='100000000', fx_scale='10000000000'
-- The scales are written into the FILE so a future reader can never guess.


-- ============================================================================
-- 1. IDENTITY
-- ============================================================================
-- Kept for parity with the cloud so backup files interchange and every
-- user_id FK in this file means what it means in Postgres. A local file holds
-- exactly one row in practice; nothing here enforces that, because a future
-- "household" file may hold more and a CHECK would then be a migration.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  first_name    TEXT,
  last_name     TEXT,
  settings      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings)),
  preferences   TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(preferences)),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (id = lower(id) AND length(id) = 36),
  CHECK (created_at LIKE '____-__-__T%Z'),
  CHECK (updated_at LIKE '____-__-__T%Z')
) STRICT;
-- Deliberately dropped vs cloud: clerk_id, stripe_customer_id,
-- subscription_tier, subscription_status, last_sync_at. None has a local
-- meaning; keeping them would invite code that reads them.


-- ============================================================================
-- 2. ACCOUNTS
-- ============================================================================

CREATE TABLE accounts (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'GBP',

  -- balance = initial_balance + SUM(transactions.amount) for this account.
  -- That identity is INVARIANT B-1. Nothing in this file can enforce it (see
  -- DESIGN.md); it is enforced by never exposing an absolute balance setter,
  -- and proved by verify_integrity().
  balance_minor         INTEGER NOT NULL DEFAULT 0,
  initial_balance_minor INTEGER NOT NULL DEFAULT 0,

  -- The bank's own figure. COMPARED against, never added to — the rule
  -- 20260807200000_bank_balance_as_of_date.sql:50-58 states and
  -- api/banking/sync-accounts.ts has kept since audit finding #12.
  bank_balance_minor  INTEGER,
  bank_balance_date   TEXT,
  last_reconciled_date TEXT,

  low_balance_alert_enabled INTEGER NOT NULL DEFAULT 0 CHECK (low_balance_alert_enabled IN (0,1)),
  low_balance_threshold_minor INTEGER,

  opening_balance_date TEXT,
  archive_through_date TEXT,

  -- The investment/(Cash) pairing. ON DELETE SET NULL so losing the investment
  -- account gracefully un-nests the cash account rather than blocking the
  -- delete (20260722090000_investment_cash_pairing.sql:17-25).
  parent_account_id   TEXT REFERENCES accounts(id) ON DELETE SET NULL,

  institution         TEXT,
  account_number      TEXT,
  sort_code           TEXT,
  icon                TEXT,
  color               TEXT,
  notes               TEXT,
  is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  metadata            TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  -- 20260720120000_split_leg_transfers.sql:32-38 — the current live list.
  CONSTRAINT accounts_type_check CHECK (type IN (
    'checking','savings','credit','cash','investment','loan',
    'assets','other','asset','liability','mortgage')),

  -- 20260722090000_investment_cash_pairing.sql:33-35
  CONSTRAINT accounts_parent_not_self CHECK (parent_account_id IS NULL OR parent_account_id <> id),

  CONSTRAINT accounts_balance_bounded CHECK (
    balance_minor         BETWEEN -1000000000000000 AND 1000000000000000 AND
    initial_balance_minor BETWEEN -1000000000000000 AND 1000000000000000 AND
    (bank_balance_minor IS NULL OR bank_balance_minor BETWEEN -1000000000000000 AND 1000000000000000) AND
    (low_balance_threshold_minor IS NULL OR low_balance_threshold_minor BETWEEN -1000000000000000 AND 1000000000000000)),

  CONSTRAINT accounts_dates_shaped CHECK (
    (bank_balance_date    IS NULL OR bank_balance_date    LIKE '____-__-__') AND
    (last_reconciled_date IS NULL OR last_reconciled_date LIKE '____-__-__') AND
    (opening_balance_date IS NULL OR opening_balance_date LIKE '____-__-__') AND
    (archive_through_date IS NULL OR archive_through_date LIKE '____-__-__')),

  CONSTRAINT accounts_currency_shaped CHECK (length(currency) = 3 AND currency = upper(currency))
) STRICT;

CREATE INDEX idx_accounts_user       ON accounts(user_id);
CREATE INDEX idx_accounts_parent     ON accounts(parent_account_id) WHERE parent_account_id IS NOT NULL;


-- ============================================================================
-- 3. CATEGORIES
-- ============================================================================

CREATE TABLE categories (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('income','expense','both')),
  level        TEXT NOT NULL CHECK (level IN ('type','sub','detail')),
  parent_id    TEXT REFERENCES categories(id) ON DELETE CASCADE,
  account_id   TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  color        TEXT,
  icon         TEXT,
  is_system                INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0,1)),
  is_transfer_category     INTEGER NOT NULL DEFAULT 0 CHECK (is_transfer_category IN (0,1)),
  is_revaluation_category  INTEGER NOT NULL DEFAULT 0 CHECK (is_revaluation_category IN (0,1)),
  is_unassigned_bucket     INTEGER NOT NULL DEFAULT 0 CHECK (is_unassigned_bucket IN (0,1)),
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  -- A To/From category belongs to exactly one account, and only that kind does
  -- (20260708140000_transfer_categories_lifecycle.sql). NEW — the cloud has no
  -- such constraint and nothing stops an ordinary category acquiring an
  -- account_id.
  CONSTRAINT categories_account_only_for_transfer
    CHECK ((account_id IS NULL) OR is_transfer_category = 1),

  -- The three semantic flags are mutually exclusive. is_unassigned_bucket
  -- DECLASSIFIES (20260724100000:21-23) while the other two CLASSIFY; a row
  -- carrying two of them has no defined meaning in utils/incomeExpense.ts.
  -- NEW — the cloud has no such constraint.
  CONSTRAINT categories_flags_exclusive
    CHECK (is_transfer_category + is_revaluation_category + is_unassigned_bucket <= 1)
) STRICT;

-- initial-schema.sql:938. NULLs are distinct in a UNIQUE index in BOTH engines
-- (verified in SQLite), so two type-level roots may share a name — same
-- behaviour as Postgres, deliberately.
CREATE UNIQUE INDEX ux_categories_user_name_parent ON categories(user_id, name, parent_id);
CREATE INDEX idx_categories_user     ON categories(user_id);
CREATE INDEX idx_categories_parent   ON categories(parent_id);
CREATE INDEX idx_categories_account  ON categories(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_categories_transfer ON categories(user_id, is_transfer_category) WHERE is_transfer_category = 1;


-- ============================================================================
-- 4. TRANSACTIONS
-- ============================================================================

CREATE TABLE transactions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,

  -- Signed, minor units. Expenses negative, income positive — the convention
  -- 20260310000500_fix_expense_amount_signs.sql normalised the data to.
  amount_minor  INTEGER NOT NULL,

  type          TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  date          TEXT NOT NULL CHECK (date LIKE '____-__-__'),

  -- TEXT holding a category id. Deliberately NOT a foreign key — see
  -- DESIGN.md invariant R-3. The cloud has the same gap and legacy sentinels
  -- ('transfer-in'/'transfer-out') live in this column, so an FK would reject
  -- data the cloud accepts. A verify_integrity() check reports danglers.
  category      TEXT,
  category_id   TEXT REFERENCES categories(id) ON DELETE SET NULL,

  notes         TEXT,
  merchant_name TEXT,
  location_city TEXT,
  location_country TEXT,
  payment_channel  TEXT,

  is_recurring  INTEGER NOT NULL DEFAULT 0 CHECK (is_recurring IN (0,1)),
  is_cleared    INTEGER NOT NULL DEFAULT 0 CHECK (is_cleared IN (0,1)),
  is_split      INTEGER NOT NULL DEFAULT 0 CHECK (is_split IN (0,1)),
  archived      INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),

  -- The bank's own order within a day. Ordinal, never a time
  -- (20260808090000_transaction_statement_sequence.sql:75-78).
  statement_sequence INTEGER,

  -- Transfer structure (20260716100000, 20260720120000).
  transfer_account_id      TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  linked_transfer_id       TEXT REFERENCES transactions(id) ON DELETE SET NULL
                             DEFERRABLE INITIALLY DEFERRED,
  linked_transfer_split_id TEXT REFERENCES transaction_splits(id) ON DELETE SET NULL
                             DEFERRABLE INITIALLY DEFERRED,

  -- File-import provenance (20260722170000). NOT the bank feed.
  import_source    TEXT,
  import_source_id TEXT,

  -- Bank-feed provenance. Kept so a cloud backup restores losslessly; no FK,
  -- because bank_connections does not exist in a local file.
  connection_id           TEXT,
  external_transaction_id TEXT,
  external_provider       TEXT CHECK (external_provider IS NULL OR external_provider IN ('truelayer','plaid')),

  -- ── Money promoted out of the JSONB blob ─────────────────────────────────
  -- See DESIGN.md §3. These were untyped floats inside metadata
  -- (src/types/index.ts:160-166). Anything that can change a figure is a
  -- typed integer column now.
  fee_minor             INTEGER,
  original_amount_minor INTEGER,
  original_currency     TEXT,
  fx_rate_e10           INTEGER,

  -- Everything else the blob carried. Money is BANNED from it by CHECK, so it
  -- cannot creep back in as a float (verified: the CHECK fires).
  metadata      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),

  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  -- 20260722170000:60-63 — both or neither.
  CONSTRAINT transactions_import_provenance_complete
    CHECK ((import_source IS NULL) = (import_source_id IS NULL)),

  CONSTRAINT transactions_amount_bounded
    CHECK (amount_minor BETWEEN -100000000000 AND 100000000000),

  CONSTRAINT transactions_promoted_money_bounded CHECK (
    (fee_minor IS NULL OR fee_minor BETWEEN -100000000000 AND 100000000000) AND
    (original_amount_minor IS NULL OR original_amount_minor BETWEEN -100000000000 AND 100000000000) AND
    (fx_rate_e10 IS NULL OR (fx_rate_e10 > 0 AND fx_rate_e10 <= 1000000000000000000))),

  -- FX triple is all-or-nothing: a converted amount with no rate, or a rate
  -- with no source currency, is unusable. NEW — the blob enforced nothing.
  CONSTRAINT transactions_fx_complete CHECK (
    (original_amount_minor IS NULL AND original_currency IS NULL AND fx_rate_e10 IS NULL)
    OR (original_amount_minor IS NOT NULL AND original_currency IS NOT NULL AND fx_rate_e10 IS NOT NULL)),

  -- Money may not hide in the blob again. Each key listed here is one that
  -- src/types/index.ts declared as `number`.
  CONSTRAINT transactions_no_money_in_metadata CHECK (
    json_extract(metadata,'$.transferMetadata.fees')           IS NULL AND
    json_extract(metadata,'$.transferMetadata.exchangeRate')   IS NULL AND
    json_extract(metadata,'$.transferMetadata.originalAmount') IS NULL AND
    json_extract(metadata,'$.transferMetadata.pricePerUnit')   IS NULL AND
    json_extract(metadata,'$.transferMetadata.marketValue')    IS NULL AND
    json_extract(metadata,'$.transferMetadata.costBasis')      IS NULL AND
    json_extract(metadata,'$.transferMetadata.units')          IS NULL AND
    json_extract(metadata,'$.transferMetadata.expectedAmount') IS NULL AND
    json_extract(metadata,'$.transferMetadata.actualAmount')   IS NULL AND
    json_extract(metadata,'$.transferMetadata.discrepancy')    IS NULL AND
    json_extract(metadata,'$.investmentData')                  IS NULL),

  -- A split parent's categorisation lives in its lines
  -- (20260713100000:225-227). In the cloud this is only ever true because the
  -- RPC writes it; here it is a constraint.  NEW.
  CONSTRAINT transactions_split_parent_has_blank_category
    CHECK (is_split = 0 OR COALESCE(trim(category),'') = ''),

  -- A transfer cannot be split (20260713100000:153-155). NEW as a constraint.
  CONSTRAINT transactions_transfer_not_split
    CHECK (NOT (is_split = 1 AND type = 'transfer')),

  -- A linked transfer must name the other account (20260716100000:121-137).
  CONSTRAINT transactions_linked_has_target
    CHECK (linked_transfer_id IS NULL OR transfer_account_id IS NOT NULL),

  -- A transfer never points at its own account.
  CONSTRAINT transactions_transfer_two_accounts
    CHECK (transfer_account_id IS NULL OR transfer_account_id <> account_id),

  CONSTRAINT transactions_no_self_link
    CHECK (linked_transfer_id IS NULL OR linked_transfer_id <> id),

  CONSTRAINT transactions_timestamps_shaped
    CHECK (created_at LIKE '____-__-__T%Z' AND updated_at LIKE '____-__-__T%Z')
) STRICT;

-- ── Indexes. Measured, not guessed. ────────────────────────────────────────
-- Benchmark: 50,000 transactions / 8 accounts, this schema, SQLite 3.54,
-- median of 40 runs after 3 warm-ups (scratchpad/local-core/bench/):
--
--   balances aggregate      106.493 ms  →   3.463 ms   (30.8x)
--   register page, 200 rows   3.037 ms  →   0.098 ms   (31.0x)
--   category rollup, 6 mths   7.417 ms  →   3.921 ms   ( 1.9x)
--   file size                 8.90 MB   →  17.87 MB    ( 2.0x — the price)
--
-- The Phase 0 spike measured the whole IPC boundary at 0.145–0.162 ms per
-- invoke. The balances index is worth 103 ms. Index design carries roughly
-- 640x the leverage of transport design; that ratio is the reason this section
-- exists at all.

-- Covering index for the balances aggregate. The four columns are exactly what
-- the aggregate touches, so the query is index-only (EXPLAIN QUERY PLAN:
-- "SEARCH t USING COVERING INDEX idx_txn_balance_cover").
CREATE INDEX idx_txn_balance_cover ON transactions(account_id, user_id, amount_minor, id);

-- The register: one account, newest first, the bank's own order breaking ties
-- within a day. SQLite does NOT accept NULLS LAST in an index definition
-- (verified: "unsupported use of NULLS LAST"), so the NULLS-LAST semantics of
-- idx_transactions_statement_order (20260808090000:92-93) are expressed as the
-- expression `(statement_sequence IS NULL)`, which sorts 0 (known) before
-- 1 (unknown) — exactly compareChronological's rule. Partial on archived = 0
-- to match the live register, mirroring idx_transactions_live.
CREATE INDEX idx_txn_register ON transactions(
  account_id, date DESC, (statement_sequence IS NULL), statement_sequence DESC
) WHERE archived = 0;

-- Whole-user paging: transactionService.ts:389-391 orders date DESC, id DESC.
CREATE INDEX idx_txn_user_page ON transactions(user_id, date DESC, id DESC);

-- Reports: category totals over a period, index-only.
CREATE INDEX idx_txn_cat_period ON transactions(user_id, date, category, amount_minor);

-- Reconciliation: the uncleared list (mirrors idx_transactions_account_cleared,
-- 20260310000200:20-21).
CREATE INDEX idx_txn_uncleared ON transactions(account_id, date) WHERE is_cleared = 0;

-- Transfer navigation (mirrors idx_transactions_linked_transfer and
-- idx_transactions_linked_transfer_split).
CREATE INDEX idx_txn_linked       ON transactions(linked_transfer_id)       WHERE linked_transfer_id IS NOT NULL;
CREATE INDEX idx_txn_linked_split ON transactions(linked_transfer_split_id) WHERE linked_transfer_split_id IS NOT NULL;

-- Payee memory. The cloud indexes upper(btrim(description))
-- (20260708100000:24-26). SQLite's upper() is ASCII-ONLY — verified:
--     upper('café') --> 'CAFé'   (Postgres gives 'CAFÉ')
-- so a payee with a non-ASCII letter groups DIFFERENTLY on the two engines.
-- The generated column below is the single place that normalisation is
-- defined, so the divergence has exactly one site to fix (an ICU collation, or
-- a Rust-side normaliser writing the column) and exactly one test.
ALTER TABLE transactions ADD COLUMN description_norm TEXT
  GENERATED ALWAYS AS (upper(trim(description))) VIRTUAL;
CREATE INDEX idx_txn_payee ON transactions(account_id, description_norm, type, date DESC)
  WHERE category IS NOT NULL AND trim(category) <> '';

-- Import idempotence (20260722170000:67-68). Non-partial deliberately, as in
-- the cloud: NULLs are distinct in both engines, so unprovenanced rows never
-- collide.
CREATE UNIQUE INDEX ux_txn_import_source ON transactions(user_id, import_source, import_source_id);

-- Bank-feed dedupe (20260308000000:115-117), kept for restored cloud data.
CREATE UNIQUE INDEX ux_txn_external ON transactions(connection_id, external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;


-- ── Tags: text[] has no SQLite equivalent, so it becomes a child table. ────
CREATE TABLE transaction_tags (
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag            TEXT NOT NULL CHECK (trim(tag) <> ''),
  PRIMARY KEY (transaction_id, tag)
) STRICT, WITHOUT ROWID;
CREATE INDEX idx_transaction_tags_tag ON transaction_tags(tag);


-- ============================================================================
-- 5. TRANSACTION SPLITS
-- ============================================================================

CREATE TABLE transaction_splits (
  id             TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,          -- category id as text; see R-3
  amount_minor   INTEGER NOT NULL,       -- signed, same convention as transactions
  memo           TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,

  -- Split-line transfer legs (20260720120000:40-44).
  transfer_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  linked_transfer_id  TEXT REFERENCES transactions(id) ON DELETE SET NULL
                        DEFERRABLE INITIALLY DEFERRED,

  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  -- 20260713100000:43-44
  CONSTRAINT transaction_splits_category_not_blank CHECK (trim(category) <> ''),
  CONSTRAINT transaction_splits_amount_nonzero     CHECK (amount_minor <> 0),

  CONSTRAINT transaction_splits_amount_bounded
    CHECK (amount_minor BETWEEN -100000000000 AND 100000000000),

  -- A linked leg must name the account on the other side
  -- (20260806094058:314-331). NEW as a constraint.
  CONSTRAINT transaction_splits_linked_has_target
    CHECK (linked_transfer_id IS NULL OR transfer_account_id IS NOT NULL)
) STRICT;

CREATE INDEX idx_splits_transaction ON transaction_splits(transaction_id, sort_order);
CREATE INDEX idx_splits_user_cat    ON transaction_splits(user_id, category);
CREATE INDEX idx_splits_linked      ON transaction_splits(linked_transfer_id) WHERE linked_transfer_id IS NOT NULL;
-- Covering index for the sum-check verify_integrity() runs after every split write.
CREATE INDEX idx_splits_sum_cover   ON transaction_splits(transaction_id, amount_minor);


-- ============================================================================
-- 6. THE RPC GUARD
-- ============================================================================
-- Postgres gates its split guard on a transaction-local session variable
-- (`current_setting('app.split_rpc', true)`, 20260713100000:73). SQLite has no
-- session variables, so the same mechanism is a one-row temp table that only
-- the command layer creates, and only for the life of one transaction.
--
--   BEGIN IMMEDIATE;
--   INSERT OR IGNORE INTO _rpc_guard VALUES ('split');
--   ... writes ...
--   DELETE FROM _rpc_guard WHERE flag = 'split';
--   COMMIT;
--
-- It must be a REAL table, not a TEMP one. VERIFIED: a persistent trigger
-- cannot reference temp objects —
--     Parse error: trigger trg_protect_split_is_split cannot reference
--                  objects in database temp
-- so the TEMP-table version of this design does not compile. The real table
-- is set and cleared inside the SAME transaction as the writes it authorises,
-- so a crash rolls the flag back with everything else; a stray row is
-- therefore impossible rather than merely unlikely, and verify_integrity()
-- reports one anyway.
--
-- HARDENING OPTION (not taken in Phase 1, recorded here): replace the table
-- with an application-defined SQL function `rpc_guard(flag)` registered by the
-- Rust layer. The file then stays READABLE by any tool while being WRITABLE
-- only by a process that supplies the function — the closest local analogue of
-- "only the RPC may write". Rejected for Phase 1 because it makes the
-- differential harness's SQLite driver depend on the Rust binary even for
-- setup fixtures.

CREATE TABLE _rpc_guard(flag TEXT PRIMARY KEY) STRICT;


-- ── Split parents are read-only outside the split writers ──────────────────
-- Port of protect_split_transaction_fields (20260713100000:67-105). BEFORE
-- UPDATE + RAISE(ABORT) works verbatim in SQLite (verified). The error strings
-- are the cloud's, character for character, because the client surfaces
-- error.message to the user.

CREATE TRIGGER trg_protect_split_is_split
BEFORE UPDATE OF is_split ON transactions
WHEN NEW.is_split IS NOT OLD.is_split
 AND NOT EXISTS (SELECT 1 FROM _rpc_guard WHERE flag = 'split')
BEGIN
  SELECT RAISE(ABORT, 'is_split can only change through set_transaction_splits');
END;

CREATE TRIGGER trg_protect_split_amount
BEFORE UPDATE OF amount_minor ON transactions
WHEN OLD.is_split = 1 AND NEW.amount_minor IS NOT OLD.amount_minor
 AND NOT EXISTS (SELECT 1 FROM _rpc_guard WHERE flag = 'split')
BEGIN
  SELECT RAISE(ABORT, 'split_amount_locked: this transaction is split — its amount is the sum of its splits; edit the splits instead');
END;

CREATE TRIGGER trg_protect_split_type
BEFORE UPDATE OF type ON transactions
WHEN OLD.is_split = 1 AND NEW.type IS NOT OLD.type
 AND NOT EXISTS (SELECT 1 FROM _rpc_guard WHERE flag = 'split')
BEGIN
  SELECT RAISE(ABORT, 'split_type_locked: remove the split before changing the transaction type');
END;

CREATE TRIGGER trg_protect_split_category
BEFORE UPDATE OF category ON transactions
WHEN OLD.is_split = 1 AND trim(COALESCE(NEW.category,'')) <> ''
 AND NOT EXISTS (SELECT 1 FROM _rpc_guard WHERE flag = 'split')
BEGIN
  SELECT RAISE(ABORT, 'split_category_locked: this transaction is split — its categorisation lives in its split lines');
END;

-- ── A linked split leg is immutable except for memo and position ───────────
-- Port of 20260806094058:314-331. In the cloud these are procedural checks
-- inside set_transaction_splits_with_legs; here they are constraints, so a
-- future code path that forgets them still cannot break the pair.
CREATE TRIGGER trg_protect_linked_leg
BEFORE UPDATE ON transaction_splits
WHEN OLD.linked_transfer_id IS NOT NULL
 AND (NEW.amount_minor IS NOT OLD.amount_minor
   OR NEW.transfer_account_id IS NOT OLD.transfer_account_id
   OR NEW.category IS NOT OLD.category
   OR NEW.linked_transfer_id IS NOT OLD.linked_transfer_id)
 AND NOT EXISTS (SELECT 1 FROM _rpc_guard WHERE flag = 'leg')
BEGIN
  SELECT RAISE(ABORT, 'split_leg_locked: that line is one half of a transfer — delete that transfer first, then edit the split');
END;

CREATE TRIGGER trg_protect_linked_leg_delete
BEFORE DELETE ON transaction_splits
WHEN OLD.linked_transfer_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM _rpc_guard WHERE flag = 'leg')
BEGIN
  SELECT RAISE(ABORT, 'split_leg_line_removed: that line is one half of a transfer — the transaction on the other side would be left pointing at a line that no longer exists');
END;

-- ── Transfer categories are managed from their account ─────────────────────
-- The whole lifecycle from 20260708140000_transfer_categories_lifecycle.sql:
-- an account MINTS its To/From category on insert (C-3), the category FOLLOWS
-- the account's name and open/closed state (C-4), and it cannot be deleted
-- while the account is there (C-5). All three are AFTER/BEFORE-shaped already,
-- so §2.3's "SQLite BEFORE triggers cannot assign to NEW" does not bite here:
-- the create and sync ports issue their own statements, and the protect port
-- only RAISEs. Verified: all three compile and fire under
-- PRAGMA trusted_schema = OFF.

-- C-3. Port of create_transfer_category_for_account (20260708140000:34-82).
--
-- Two behaviours are load-bearing and both are reproduced:
--   * it SKIPS when the user has no Transfer type anchor yet. The cloud comment
--     explains it (categories seed lazily; a parentless category renders as
--     junk) and the RESTORE PATH DEPENDS ON IT: restore_user_chunk inserts
--     accounts first, when no categories exist, so this trigger stands itself
--     down and the backup's own To/From rows land unopposed. A local restore
--     must keep that order for the same reason.
--   * it is COLLISION-GUARDED. categories are UNIQUE (user_id, name, parent_id)
--     while account names are not unique, so two accounts of the same name
--     would collide. The cloud uses ON CONFLICT … DO NOTHING so account
--     creation survives the clash; SQLite spells it identically. NOT
--     `INSERT OR IGNORE`, which would swallow every other constraint too.
--
-- The id: the cloud column defaults to gen_random_uuid(); this schema has no
-- such default, so the trigger builds a v4 UUID from randomblob(). random() is
-- non-deterministic, which bars it from CHECKs, generated columns and index
-- expressions — but not from a trigger body. Verified firing.
CREATE TRIGGER trg_create_transfer_category_for_account
AFTER INSERT ON accounts
WHEN EXISTS (SELECT 1 FROM categories
              WHERE user_id = NEW.user_id AND level = 'type'
                AND (type = 'both' OR name = 'Transfer'))
 AND NOT EXISTS (SELECT 1 FROM categories
                  WHERE account_id = NEW.id AND is_transfer_category = 1)
BEGIN
  INSERT INTO categories (id, user_id, name, type, level, parent_id,
                          is_system, is_transfer_category, account_id, is_active)
  VALUES (
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2)
          || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2)
          || '-' || hex(randomblob(6))),
    NEW.user_id,
    'To/From ' || NEW.name,
    'both',
    'detail',
    -- Prefer the structural match (the Transfer type category is the only
    -- type-level 'both'); fall back to the name for legacy datasets.
    (SELECT id FROM categories
      WHERE user_id = NEW.user_id AND level = 'type'
        AND (type = 'both' OR name = 'Transfer')
      ORDER BY (type = 'both') DESC LIMIT 1),
    0, 1, NEW.id, NEW.is_active)
  ON CONFLICT (user_id, name, parent_id) DO NOTHING;
END;

-- C-4. Port of sync_transfer_category_for_account (20260708140000:90-119).
-- The rename follows the account and open/closed mirrors onto the category, so
-- a closed account's To/From row leaves the transaction dropdowns.
--
-- Collision-guarded the same way, and for the stated reason: an account rename
-- or a bank sync must NEVER abort on a category naming clash. A clash keeps the
-- old category name; is_active still syncs.
--
-- `AFTER UPDATE OF name, is_active` is narrower than the cloud's bare AFTER
-- UPDATE, and equivalent: a column's value cannot change unless it is in the
-- SET list. Writing updated_at here also stands the generic updated_at trigger
-- down (its WHEN is `NEW.updated_at IS OLD.updated_at`), so there is exactly
-- one write per row.
CREATE TRIGGER trg_sync_transfer_category_for_account
AFTER UPDATE OF name, is_active ON accounts
WHEN NEW.name IS NOT OLD.name OR NEW.is_active IS NOT OLD.is_active
BEGIN
  UPDATE categories
     SET name = CASE
           WHEN NOT EXISTS (SELECT 1 FROM categories x
                             WHERE x.user_id = categories.user_id
                               AND x.parent_id IS categories.parent_id
                               AND x.name = 'To/From ' || NEW.name
                               AND x.id <> categories.id)
           THEN 'To/From ' || NEW.name
           ELSE categories.name
         END,
         is_active = NEW.is_active,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE account_id = NEW.id AND is_transfer_category = 1;
END;

-- C-5. Port of protect_transfer_category (20260708140000:127-146), THREE
-- conditions, not two.
--
-- The users-row clause is not decoration. Without it, `DELETE FROM users` is
-- refused outright: the cascade reaches this category while its account row is
-- still there, this trigger raises, and the whole erasure aborts leaving every
-- row in place. MEASURED, both ways, on this schema:
--
--   two-condition  -> user erasure REFUSED: transfer_category_protected
--                     rows left: users 1, accounts 1, categories 2
--   THREE-condition-> user erasure SUCCEEDED, rows left: 0, 0, 0
--   Postgres, same operation -> SUCCEEDED, 0 rows left
--
-- So the cloud's third clause is what makes erasure immune to cascade ordering,
-- and dropping it locally (as an earlier draft of this file did, on the grounds
-- that a local file has no GDPR cascade) would have made "delete everything"
-- impossible rather than merely different.
CREATE TRIGGER trg_protect_transfer_category
BEFORE DELETE ON categories
WHEN OLD.is_transfer_category = 1
 AND OLD.account_id IS NOT NULL
 AND EXISTS (SELECT 1 FROM accounts WHERE id = OLD.account_id)
 AND EXISTS (SELECT 1 FROM users    WHERE id = OLD.user_id)
BEGIN
  SELECT RAISE(ABORT, 'transfer_category_protected');
END;


-- ── updated_at ─────────────────────────────────────────────────────────────
-- Postgres uses a BEFORE UPDATE trigger that ASSIGNS NEW.updated_at
-- (update_updated_at_column, initial-schema.sql:354). SQLite triggers CANNOT
-- assign to NEW — verified: `SET NEW.u = 'x'` is a syntax error. The port is an
-- AFTER UPDATE trigger issuing its own UPDATE, which is safe only because
-- PRAGMA recursive_triggers defaults to OFF (verified: 0). If that pragma is
-- ever turned on, these loop.
--
-- The WHEN clause reproduces the restore exemption: the cloud stands the
-- trigger down while app.restore_in_progress is set (20260807083000:87-99) so
-- a restore does not re-date a decade of history. Here that is the guard flag.
CREATE TRIGGER trg_transactions_updated_at
AFTER UPDATE ON transactions
WHEN NEW.updated_at IS OLD.updated_at
 AND NOT EXISTS (SELECT 1 FROM _rpc_guard WHERE flag = 'restore')
BEGIN
  UPDATE transactions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_accounts_updated_at
AFTER UPDATE ON accounts
WHEN NEW.updated_at IS OLD.updated_at
 AND NOT EXISTS (SELECT 1 FROM _rpc_guard WHERE flag = 'restore')
BEGIN
  UPDATE accounts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_categories_updated_at
AFTER UPDATE ON categories
WHEN NEW.updated_at IS OLD.updated_at
 AND NOT EXISTS (SELECT 1 FROM _rpc_guard WHERE flag = 'restore')
BEGIN
  UPDATE categories SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_splits_updated_at
AFTER UPDATE ON transaction_splits
WHEN NEW.updated_at IS OLD.updated_at
 AND NOT EXISTS (SELECT 1 FROM _rpc_guard WHERE flag = 'restore')
BEGIN
  UPDATE transaction_splits SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;
-- (the same shape for budgets, goals, investments, notifications,
--  recurring_transactions, dashboard_layouts, widget_preferences — eleven
--  tables in the cloud, per the comment at 20260807083000:101)


-- ── The reconcile-sweep ────────────────────────────────────────────────────
-- Port of sweep_reconciled_into_archive (20260721130000:123-148). The cloud's
-- version is a BEFORE trigger that ASSIGNS NEW.archived := true. That cannot be
-- done in SQLite, so it becomes an AFTER trigger issuing an UPDATE.
--
-- This is a REAL behavioural difference, not just a syntactic one: the cloud
-- archives the row in the same statement that clears it, while this fires a
-- second statement afterwards. Anything watching for a single-statement change
-- sees two here. It is safe because recursive_triggers is OFF (the inner UPDATE
-- does not re-fire this trigger) and because both statements are inside the
-- caller's transaction.
CREATE TRIGGER trg_sweep_reconciled_into_archive
AFTER UPDATE OF is_cleared ON transactions
WHEN NEW.is_cleared = 1 AND OLD.is_cleared IS NOT NEW.is_cleared AND NEW.archived = 0
 AND EXISTS (
   SELECT 1 FROM accounts a
    WHERE a.id = NEW.account_id
      AND a.archive_through_date IS NOT NULL
      AND NEW.date <= a.archive_through_date)
BEGIN
  UPDATE transactions SET archived = 1 WHERE id = NEW.id;
END;


-- ── Suggestion dismissals die with their subject ───────────────────────────
-- Port of prune_suggestion_dismissals_for_transaction (20260806180000:156-170).
CREATE TRIGGER trg_prune_suggestion_dismissals
AFTER DELETE ON transactions
BEGIN
  DELETE FROM suggestion_dismissals
   WHERE user_id = OLD.user_id
     AND id IN (SELECT dismissal_id FROM suggestion_dismissal_subjects WHERE transaction_id = OLD.id);
END;


-- ============================================================================
-- 7. BUDGETS, GOALS
-- ============================================================================

CREATE TABLE budgets (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  amount_minor  INTEGER NOT NULL,
  period        TEXT NOT NULL CHECK (period IN ('weekly','biweekly','monthly','quarterly','yearly','custom')),
  category      TEXT,                                          -- category id as text
  category_id   TEXT REFERENCES categories(id) ON DELETE SET NULL,
  start_date    TEXT NOT NULL CHECK (start_date LIKE '____-__-__'),
  end_date      TEXT CHECK (end_date IS NULL OR end_date LIKE '____-__-__'),
  spent_minor           INTEGER NOT NULL DEFAULT 0,
  rollover              INTEGER NOT NULL DEFAULT 0 CHECK (rollover IN (0,1)),
  rollover_amount_minor INTEGER NOT NULL DEFAULT 0,

  -- NOT MONEY. numeric(5,2) in the cloud, default 80, meaning 80%.
  -- Stored as basis-points-of-a-percent (1e2), so 80.00% = 8000.
  alert_threshold_bp INTEGER NOT NULL DEFAULT 8000 CHECK (alert_threshold_bp BETWEEN 0 AND 10000),

  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  notes         TEXT,
  metadata      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  CONSTRAINT budgets_money_bounded CHECK (
    amount_minor          BETWEEN -1000000000000000 AND 1000000000000000 AND
    spent_minor           BETWEEN -1000000000000000 AND 1000000000000000 AND
    rollover_amount_minor BETWEEN -1000000000000000 AND 1000000000000000),
  CONSTRAINT budgets_period_ordered CHECK (end_date IS NULL OR end_date >= start_date)
) STRICT;
CREATE INDEX idx_budgets_user ON budgets(user_id);

-- NOTE the widening vs cloud: budgets.spent and rollover_amount are
-- numeric(10,2) in Postgres (max ~£99.9m) while budgets.amount is
-- numeric(20,2). A budget over £99,999,999.99 already cannot record its own
-- spend in the cloud. Local uses one bound for all three. That is a deliberate
-- divergence and a differential test must expect it.

CREATE TABLE goals (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  target_amount_minor  INTEGER NOT NULL,
  current_amount_minor INTEGER NOT NULL DEFAULT 0,
  target_date         TEXT CHECK (target_date IS NULL OR target_date LIKE '____-__-__'),
  category            TEXT,
  priority            TEXT CHECK (priority IS NULL OR priority IN ('low','medium','high')),
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused','canceled')),
  account_id          TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  contribution_frequency TEXT CHECK (contribution_frequency IS NULL OR contribution_frequency IN ('daily','weekly','biweekly','monthly','yearly')),
  auto_contribute     INTEGER NOT NULL DEFAULT 0 CHECK (auto_contribute IN (0,1)),
  icon                TEXT,
  color               TEXT,
  completed_at        TEXT,
  metadata            TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT goals_money_bounded CHECK (
    target_amount_minor  BETWEEN -1000000000000000 AND 1000000000000000 AND
    current_amount_minor BETWEEN -1000000000000000 AND 1000000000000000)
) STRICT;
CREATE INDEX idx_goals_user ON goals(user_id);

CREATE TABLE goal_contributions (
  id             TEXT PRIMARY KEY,
  goal_id        TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_minor   INTEGER NOT NULL CHECK (amount_minor BETWEEN -100000000000 AND 100000000000),
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  date           TEXT NOT NULL CHECK (date LIKE '____-__-__'),
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) STRICT;
CREATE INDEX idx_goal_contributions_goal ON goal_contributions(goal_id, date);


-- ============================================================================
-- 8. INVESTMENTS
-- ============================================================================
-- THE PRICE FIX. The cloud stores every unit price as numeric(10,2)
-- (initial-schema.sql:553, :575, :581) against quantities at numeric(20,8).
-- A share priced at £12.345 cannot be written; it rounds to £12.35 or £12.34
-- and the position value is wrong from that moment on. That is a pre-existing
-- schema bug, and this is a fresh schema, so it is fixed here:
--
--   prices are _e8 (8 decimal places), the same scale as quantity.
--
-- 8dp is chosen, not measured: it is exact for UK fund prices (4dp), US equity
-- (4dp), and sub-cent crypto down to £0.00000001. It is NOT enough for tokens
-- quoted below that, and the file records the scale in schema_meta so a later
-- widening is a migration rather than an archaeology exercise.
--
-- price_e8 * quantity_e8 is 1e16-scaled and overflows int64 for any position
-- over about £92. It is therefore NEVER computed in SQL. market_value_minor is
-- computed in the command layer in i128, rounded half-up to minor units, and
-- stored. cost_basis_minor likewise.

CREATE TABLE investments (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id         TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  symbol             TEXT NOT NULL,
  name               TEXT NOT NULL,
  asset_type         TEXT NOT NULL CHECK (asset_type IN
                       ('stock','bond','etf','mutual_fund','crypto','commodity','real_estate','other')),
  exchange           TEXT,
  currency           TEXT NOT NULL DEFAULT 'GBP' CHECK (length(currency) = 3),

  quantity_e8        INTEGER NOT NULL CHECK (quantity_e8 BETWEEN -9000000000000000000 AND 9000000000000000000),
  cost_basis_minor   INTEGER NOT NULL CHECK (cost_basis_minor BETWEEN -1000000000000000 AND 1000000000000000),
  current_price_e8   INTEGER CHECK (current_price_e8 IS NULL OR (current_price_e8 >= 0 AND current_price_e8 <= 10000000000000000)),
  market_value_minor INTEGER CHECK (market_value_minor IS NULL OR market_value_minor BETWEEN -1000000000000000 AND 1000000000000000),
  purchase_date      TEXT CHECK (purchase_date IS NULL OR purchase_date LIKE '____-__-__'),
  purchase_price_e8  INTEGER CHECK (purchase_price_e8 IS NULL OR (purchase_price_e8 >= 0 AND purchase_price_e8 <= 10000000000000000)),
  last_updated       TEXT,
  notes              TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) STRICT;
CREATE INDEX idx_investments_user    ON investments(user_id);
CREATE INDEX idx_investments_account ON investments(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_investments_symbol  ON investments(user_id, symbol);

CREATE TABLE investment_transactions (
  id                 TEXT PRIMARY KEY,
  investment_id      TEXT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type   TEXT NOT NULL CHECK (transaction_type IN ('buy','sell','dividend','split','transfer')),
  quantity_e8        INTEGER NOT NULL CHECK (quantity_e8 BETWEEN -9000000000000000000 AND 9000000000000000000),
  unit_price_e8      INTEGER NOT NULL CHECK (unit_price_e8 >= 0 AND unit_price_e8 <= 10000000000000000),
  total_amount_minor INTEGER NOT NULL CHECK (total_amount_minor BETWEEN -100000000000 AND 100000000000),
  fee_minor          INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor BETWEEN -100000000000 AND 100000000000),
  tax_minor          INTEGER NOT NULL DEFAULT 0 CHECK (tax_minor BETWEEN -100000000000 AND 100000000000),
  date               TEXT NOT NULL CHECK (date LIKE '____-__-__'),
  notes              TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) STRICT;
CREATE INDEX idx_inv_txn_investment ON investment_transactions(investment_id, date);
-- tax_minor is NEW: investmentData.stampDuty was a float in the metadata blob
-- (src/types/index.ts:200) with nowhere typed to live.


-- ============================================================================
-- 9. RECURRING TEMPLATES
-- ============================================================================
-- The cloud keys these by user_profiles(clerk_user_id) TEXT, not users(id)
-- uuid — the odd one out that the restore RPC has to special-case
-- (20260807083000:337-346). Locally there is no Clerk, so this is a plain
-- users(id) FK and the special case disappears.

CREATE TABLE recurring_transactions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id   TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor BETWEEN -100000000000 AND 100000000000),
  type         TEXT NOT NULL CHECK (type IN ('income','expense')),
  category     TEXT NOT NULL,
  frequency    TEXT NOT NULL CHECK (frequency IN ('daily','weekly','biweekly','monthly','quarterly','yearly')),
  start_date   TEXT NOT NULL CHECK (start_date LIKE '____-__-__'),
  end_date     TEXT CHECK (end_date IS NULL OR end_date LIKE '____-__-__'),
  next_date    TEXT NOT NULL CHECK (next_date LIKE '____-__-__'),
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  auto_create  INTEGER NOT NULL DEFAULT 1 CHECK (auto_create IN (0,1)),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) STRICT;
CREATE INDEX idx_recurring_user_next ON recurring_transactions(user_id, next_date) WHERE is_active = 1;


-- ============================================================================
-- 10. AUDIT LOG
-- ============================================================================
-- In the cloud this table is immutable from the client because it has no
-- INSERT/UPDATE/DELETE policy and only a SECURITY DEFINER helper writes it
-- (20260610150000:35-43). None of that survives locally: the user owns the
-- file and can open it with any SQLite tool.
--
-- The honest local property is TAMPER-EVIDENT, not tamper-proof. The triggers
-- below stop the APP from rewriting history; the hash chain makes an
-- out-of-band edit detectable. Both are stated as such in DESIGN.md.

CREATE TABLE financial_audit_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('create','update','delete')),
  before_data TEXT CHECK (before_data IS NULL OR json_valid(before_data)),
  after_data  TEXT CHECK (after_data  IS NULL OR json_valid(after_data)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  -- Tamper evidence. seq is dense and monotonic; row_hash =
  -- SHA256(prev_hash || seq || entity || entity_id || action || before || after
  --        || created_at), computed in Rust. A gap in seq, or a hash that does
  -- not chain, is a report from verify_integrity() — not an error the app can
  -- prevent.
  seq         INTEGER NOT NULL UNIQUE,
  prev_hash   TEXT,
  row_hash    TEXT NOT NULL,

  CONSTRAINT audit_create_has_no_before CHECK (action <> 'create' OR before_data IS NULL),
  CONSTRAINT audit_delete_has_no_after  CHECK (action <> 'delete' OR after_data  IS NULL),
  CONSTRAINT audit_update_has_both      CHECK (action <> 'update' OR (before_data IS NOT NULL AND after_data IS NOT NULL))
) STRICT;

CREATE INDEX idx_audit_user_created ON financial_audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_entity       ON financial_audit_log(entity, entity_id);

CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON financial_audit_log
BEGIN SELECT RAISE(ABORT,'audit_immutable'); END;
CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON financial_audit_log
WHEN NOT EXISTS (SELECT 1 FROM _rpc_guard WHERE flag = 'audit_purge')
BEGIN SELECT RAISE(ABORT,'audit_immutable'); END;
-- The purge exemption is the local counterpart of purge_expired_audit_log
-- (20260611150000). It deletes from the OLD end only; verify_integrity()
-- re-checks that the surviving chain still chains from its new head.


-- ============================================================================
-- 11. SUGGESTION DISMISSALS
-- ============================================================================
-- The cloud stores subject_ids as uuid[] with a GIN index
-- (20260806180000:95, :109-110). SQLite has neither, so the array becomes a
-- child table — which is strictly better here: the prune trigger becomes an
-- indexed join instead of an array containment scan, and the "every id
-- resolves in exactly one table" property the column comment claims becomes a
-- foreign key instead of a promise.

CREATE TABLE suggestion_dismissals (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('transfer-pair','transfer-leg','stranded','duplicate')),
  subject_key  TEXT NOT NULL CHECK (trim(subject_key) <> ''),
  dismissed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT suggestion_dismissals_unique_subject UNIQUE (user_id, kind, subject_key)
) STRICT;

CREATE TABLE suggestion_dismissal_subjects (
  dismissal_id   TEXT NOT NULL REFERENCES suggestion_dismissals(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  role_order     INTEGER NOT NULL,
  PRIMARY KEY (dismissal_id, role_order)
) STRICT, WITHOUT ROWID;
CREATE INDEX idx_dismissal_subjects_txn ON suggestion_dismissal_subjects(transaction_id);

CREATE TRIGGER trg_dismissals_no_update BEFORE UPDATE ON suggestion_dismissals
BEGIN SELECT RAISE(ABORT,'dismissal_immutable: a dismissal is created or deleted, never edited'); END;
-- Matches the cloud, which has no UPDATE policy for the same reason
-- (20260806180000:129-133).


-- ============================================================================
-- 12. UI STATE (carried so a cloud backup restores whole)
-- ============================================================================

CREATE TABLE notifications (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('info','success','warning','error')),
  title        TEXT NOT NULL,
  message      TEXT,
  is_read      INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  action_label TEXT,
  action_url   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) STRICT;
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE dashboard_layouts (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  widgets    TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(widgets)),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) STRICT;
-- initial-schema.sql:1295. The cloud ALSO has a BEFORE trigger doing the same
-- job (initial-schema.sql:1617); the index alone is sufficient and the trigger
-- is not ported.
CREATE UNIQUE INDEX ux_one_default_layout ON dashboard_layouts(user_id) WHERE is_default = 1;

CREATE TABLE widget_preferences (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  widget_type    TEXT NOT NULL,
  settings       TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings)),
  is_collapsed   INTEGER NOT NULL DEFAULT 0 CHECK (is_collapsed IN (0,1)),
  last_refreshed TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, widget_type)
) STRICT;


-- ============================================================================
-- 13. verify_integrity() — the invariants no constraint can hold
-- ============================================================================
-- One view per whole-database invariant, plus one union that reports every
-- violation with a name. The Rust command runs it after every write in debug
-- and test builds, and on demand ("Check this file") in release. It is the
-- single highest-leverage artifact in the local core: every procedural
-- invariant that a future code path might drop is caught here.
--
-- Each of these has a Postgres twin, textually different but semantically
-- identical, so the differential harness can compare violation NAMES across
-- engines. The Postgres twin of B-1 already exists as the verification query
-- at 20260808090000:292-299 and 20260807200000:100-110.

CREATE VIEW v_integrity_violations AS

  -- B-1: balance = initial_balance + SUM(amount). Not enforceable by any
  --      constraint in either engine.
  SELECT 'balance_identity' AS check_name, a.id AS subject,
         'account balance is not initial_balance + sum(transactions)' AS detail
    FROM accounts a
    LEFT JOIN (SELECT account_id, SUM(amount_minor) AS total
                 FROM transactions GROUP BY account_id) t ON t.account_id = a.id
   WHERE a.balance_minor <> a.initial_balance_minor + COALESCE(t.total, 0)

UNION ALL
  -- S-1: split lines sum exactly to their parent.
  SELECT 'split_sum', t.id, 'split lines do not sum to the parent amount'
    FROM transactions t
    JOIN (SELECT transaction_id, SUM(amount_minor) AS total, COUNT(*) AS n
            FROM transaction_splits GROUP BY transaction_id) s
      ON s.transaction_id = t.id
   WHERE t.is_split = 1 AND s.total <> t.amount_minor

UNION ALL
  -- S-2: a split parent has at least two lines (20260713100000:185).
  SELECT 'split_min_lines', t.id, 'a split has fewer than two lines'
    FROM transactions t
   WHERE t.is_split = 1
     AND (SELECT COUNT(*) FROM transaction_splits s WHERE s.transaction_id = t.id) < 2

UNION ALL
  -- S-3: an unsplit transaction has no lines.
  SELECT 'orphan_split_lines', s.transaction_id, 'split lines on a transaction that is not split'
    FROM transaction_splits s
    JOIN transactions t ON t.id = s.transaction_id
   WHERE t.is_split = 0
   GROUP BY s.transaction_id

UNION ALL
  -- T-1: transfer links are MUTUAL. Enforced nowhere in the cloud; only
  --      repair_claimed_transfer even checks it (20260805145035:327-331).
  SELECT 'transfer_link_not_mutual', a.id, 'this row links to one that does not link back'
    FROM transactions a
    LEFT JOIN transactions b ON b.id = a.linked_transfer_id
   WHERE a.linked_transfer_id IS NOT NULL
     AND a.linked_transfer_split_id IS NULL
     AND (b.id IS NULL OR b.linked_transfer_id IS NOT a.id)

UNION ALL
  -- T-2: the two sides of a transfer are exactly opposite and non-zero
  --      (20260716100000:108-111).
  SELECT 'transfer_amounts_not_opposite', a.id, 'linked transfer sides are not exact opposites'
    FROM transactions a
    JOIN transactions b ON b.id = a.linked_transfer_id
   WHERE a.linked_transfer_split_id IS NULL
     AND (a.amount_minor = 0 OR a.amount_minor <> -b.amount_minor)

UNION ALL
  -- T-3: a transfer's two sides are in different accounts.
  SELECT 'transfer_same_account', a.id, 'both sides of this transfer are in one account'
    FROM transactions a
    JOIN transactions b ON b.id = a.linked_transfer_id
   WHERE a.account_id = b.account_id

UNION ALL
  -- T-4: a split-line leg is opposite to the LINE, never the parent
  --      (20260720120000:15-17).
  SELECT 'split_leg_amounts_not_opposite', s.id, 'a split leg and its counterpart are not exact opposites'
    FROM transaction_splits s
    JOIN transactions c ON c.id = s.linked_transfer_id
   WHERE s.amount_minor = 0 OR c.amount_minor <> -s.amount_minor

UNION ALL
  -- T-5: a counterpart that names a split line must be named back by it.
  SELECT 'split_leg_link_not_mutual', c.id, 'this row names a split line that does not name it back'
    FROM transactions c
    LEFT JOIN transaction_splits s ON s.id = c.linked_transfer_split_id
   WHERE c.linked_transfer_split_id IS NOT NULL
     AND (s.id IS NULL OR s.linked_transfer_id IS NOT c.id)

UNION ALL
  -- R-3: transactions.category and transaction_splits.category are TEXT with
  --      no FK, in BOTH engines. Danglers are reported, not rejected — the
  --      legacy 'transfer-in'/'transfer-out' sentinels are legal values.
  SELECT 'dangling_category_ref', t.id, 'category text names no category of this user'
    FROM transactions t
   WHERE t.category IS NOT NULL
     AND trim(t.category) <> ''
     AND t.category NOT IN ('transfer-in','transfer-out')
     AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = t.category AND c.user_id = t.user_id)

UNION ALL
  SELECT 'dangling_split_category_ref', s.id, 'split line category names no category of this user'
    FROM transaction_splits s
   WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = s.category AND c.user_id = s.user_id)

UNION ALL
  -- C-3: every account has exactly one transfer category
  --      (20260708140000:57-78).
  SELECT 'account_missing_transfer_category', a.id, 'this account has no To/From category'
    FROM accounts a
   WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.account_id = a.id AND c.is_transfer_category = 1)

UNION ALL
  SELECT 'account_multiple_transfer_categories', a.id, 'this account has more than one To/From category'
    FROM accounts a
   WHERE (SELECT COUNT(*) FROM categories c WHERE c.account_id = a.id AND c.is_transfer_category = 1) > 1

UNION ALL
  -- A-1: the audit chain is dense and links.
  SELECT 'audit_chain_broken', l.id, 'this audit row does not chain to its predecessor'
    FROM financial_audit_log l
    LEFT JOIN financial_audit_log p ON p.seq = l.seq - 1
   WHERE (l.seq > (SELECT MIN(seq) FROM financial_audit_log))
     AND (p.id IS NULL OR l.prev_hash IS NOT p.row_hash)

UNION ALL
  -- I-1: an account nested under another must not itself be a parent
  --      (one level only — the (Cash) pairing, 20260722090000).
  SELECT 'account_nesting_too_deep', a.id, 'a nested account is itself a parent'
    FROM accounts a
   WHERE a.parent_account_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM accounts c WHERE c.parent_account_id = a.id);

-- The one-line answer.
CREATE VIEW v_integrity_ok AS
  SELECT (SELECT COUNT(*) FROM v_integrity_violations) = 0 AS ok;
