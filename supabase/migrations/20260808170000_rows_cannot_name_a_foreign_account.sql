-- ============================================================================
-- A row may not name an account that belongs to somebody else — enforced by
-- the schema, not by whoever remembered to write the WHERE clause
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). ONE new UNIQUE constraint and SEVEN foreign
-- keys widened from one column to two. No new table, no new column, no new
-- index, no policy change, no grant change, no function redefined, and not one
-- existing row is read for its value or written by applying this.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Two facts about this database are each individually correct and, put
-- together, leave a hole.
--
--   1. Row-level security on `transactions` gates on ONE column.
--      20260610130000_restore_rls_data_isolation.sql:153-165 — all four
--      policies are `user_id = public.requesting_user_id()`, and nothing more.
--      That is the right shape for "whose row is this?", and it is complete as
--      far as it goes.
--
--   2. The link from a transaction to its account is a SINGLE-column foreign
--      key. 20251030003814__initial-schema.sql:1928-1932 —
--      `FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE`.
--      It answers "does this account exist?" and it was never asked to answer
--      "does it belong to the same person as this row?".
--
-- Nothing in the database joins those two questions up. And referential
-- integrity checks run as the CONSTRAINT's own internal query — they are
-- exempt from row-level security by design (that is why an FK can point at a
-- row you cannot SELECT). So the existence check in (2) happily resolves
-- against an account that policy (1) would never let the writer see.
--
-- The consequence: a direct PostgREST insert carrying `user_id` = me and
-- `account_id` = yours satisfies the INSERT policy (my user_id is mine) and
-- satisfies the foreign key (your account exists). The row lands. It is then
-- invisible to YOU, because it carries MY user_id and your SELECT policy will
-- never return it — but it is counted by every service-role aggregate that
-- reaches your data through `account_id`: backup, export, the balance RPCs,
-- reconciliation. Your ledger stops adding up, server-side, with nothing in
-- your own data to explain why. The same reasoning applies to any writer with
-- the service-role key that forgets a `user_id` filter, which is the failure
-- mode that does not need an attacker at all.
--
-- ── HOW IT SURFACED ─────────────────────────────────────────────────────────
-- 20260721090000_transfer_counterpart_currency_guard.sql:65-74 reads:
--
--     SELECT * INTO v_src_acct FROM public.accounts
--      WHERE id = v_src.account_id AND user_id = v_src.user_id;
--     IF FOUND
--        AND v_src_acct.currency IS NOT NULL ...
--
-- For an ordinary row that is a currency check. For a row whose account_id
-- belongs to another login the lookup finds NOTHING, `IF FOUND` is false, and
-- the guard is skipped in silence — so a counterpart is minted with no currency
-- comparison at all, which is precisely the movement that guard exists to
-- refuse. The guard is not wrong; its premise is. Every RPC in this schema
-- assumes the pairing below, and the schema never promised it.
--
-- MEASURED, read-only, against production on 2026-08-08:
-- `count(*) FROM transactions t JOIN accounts a ON a.id = t.account_id
--  WHERE t.user_id <> a.user_id` = 0. The hole is latent, not exploited: no
-- client path builds such an insert, the one service-role writer filters
-- correctly, and every existing row already satisfies the constraint added
-- below. This migration closes a door that has never been walked through, on
-- the day it can still be closed for free.
--
-- ── THE FIX, AND WHY IT IS STRUCTURAL RATHER THAN A POLICY ──────────────────
-- Give `accounts` a UNIQUE (id, user_id) — redundant for uniqueness, since
-- `id` is already the primary key, and that is the point: it exists purely so
-- that (id, user_id) can be the TARGET of a foreign key. Then repoint every
-- foreign key that names an account so it carries the owner along with the id.
-- After that, "this row's account belongs to this row's user" is not a rule
-- anyone can forget to apply — it is the only shape the table will accept.
--
-- A policy could not do this job. Policies are not consulted during RI checks,
-- and a CHECK constraint cannot query another table. A trigger could, but a
-- trigger is code that can be dropped, replaced or bypassed by the next
-- SECURITY DEFINER function; a foreign key cannot.
--
-- ── WHICH TABLES, AND WHY ───────────────────────────────────────────────────
-- Inventoried from the migrations: every foreign key in this schema whose
-- referenced table is `accounts`, matched against whether the referencing row
-- also carries a uuid `user_id` to pair it with.
--
--   COVERED (7) — the pairing is possible today and nothing prevents it:
--
--   transactions.account_id           The ledger itself. This is the defect
--                                     above; everything else here is the same
--                                     shape found while looking for it.
--   transactions.transfer_account_id  The other end of a transfer, and the
--                                     WEAKER of the two: create_transfer_
--                                     counterpart validates its target
--                                     (20260721090000:56-61), but
--                                     create_transaction_atomic passes
--                                     transfer_account_id straight from the
--                                     caller's payload with no ownership check
--                                     at all (20260808150000:196), so this one
--                                     is reachable through a trusted RPC and
--                                     not only through a raw insert.
--   transaction_splits
--     .transfer_account_id            A split leg moves money to an account
--                                     the same way a transfer does
--                                     (20260720120000:40-42) and is written by
--                                     the same class of payload.
--   accounts.parent_account_id        The investment/cash pairing
--                                     (20260722090000:22-24). Self-referential:
--                                     an account may only be paired with an
--                                     account of the same owner, which was
--                                     always the intent and never the rule.
--   categories.account_id             Account-scoped categories, including the
--                                     per-account transfer categories the
--                                     account trigger mints
--                                     (20251030003814:1744-1748). Not money,
--                                     but a category filed against a stranger's
--                                     account is a category nothing can ever
--                                     clean up through the UI.
--   goals.account_id                  Same shape, tiny table
--                                     (20251030003814:1800-1804).
--   investments.account_id            Same shape; holdings roll up into a
--                                     portfolio figure
--                                     (20251030003814:1832-1836).
--
--   NOT COVERED (2), deliberately:
--
--   linked_accounts.account_id        The table has NO user_id column at all
--                                     (20260308000000:58). Ownership is
--                                     single-sourced through accounts, so there
--                                     is no second opinion for the schema to
--                                     catch disagreeing with the first — the
--                                     pairing is structurally impossible, and a
--                                     composite key here would be ceremony.
--   recurring_transactions
--     .account_id                     Its user_id is TEXT holding a Clerk id
--                                     against user_profiles(clerk_user_id), not
--                                     a uuid against users(id) — see
--                                     20260807083000_user_data_restore.sql:
--                                     335-338, which has to overwrite the
--                                     column a second time for exactly this
--                                     reason. The two columns are not in the
--                                     same identity space, so no foreign key
--                                     can pair them. Worth recording that this
--                                     table also has NO foreign key on
--                                     account_id whatsoever and a NULLABLE
--                                     user_id: it is a separate, larger defect
--                                     than the one this file fixes, and pulling
--                                     it in here would mean changing a column's
--                                     type in the same breath as a security
--                                     fix. Left as a finding.
--
-- ── WHAT DOES NOT CHANGE ────────────────────────────────────────────────────
-- * **Every row already in the table.** Production was measured at zero
--   mismatched rows across all seven pairings before this was written, so every
--   validating scan below can only confirm what is already true. No row is
--   moved, re-owned, deleted or rewritten; no amount, date, account_id or
--   user_id is assigned a new value anywhere in this file.
-- * **ON DELETE behaviour, exactly as it stands.** Each existing action was
--   read from pg_constraint first, not assumed, and each is restated verbatim:
--   CASCADE for transactions.account_id, categories and investments; SET NULL
--   for the two transfer columns, parent_account_id and goals. The SET NULL
--   cases MUST name their column — a bare `ON DELETE SET NULL` on a composite
--   key nulls EVERY referencing column, including user_id, which is NOT NULL on
--   all four; that would turn "delete an account someone transferred to" into a
--   constraint violation. `ON DELETE SET NULL (col)` is PostgreSQL 15+, which
--   the guard below verifies rather than hopes for.
-- * **Row-level security.** Not one policy is created, dropped or altered. The
--   `user_id = requesting_user_id()` shape stays exactly as
--   20260610130000 left it; this migration works underneath it, on the axis
--   policies cannot reach.
-- * **Grants and functions.** No GRANT or REVOKE. No function redefined — in
--   particular the RPCs' own `account_not_found_or_not_owned` refusals stay
--   where they are (see BLAST RADIUS for where they now come second).
-- * **Indexes on the seven child tables.** None added, none needed: a delete on
--   accounts resolves each composite key by its leading column, which is
--   indexed already (idx_transactions_account_id and siblings), so the existing
--   indexes serve the new keys unchanged. The ONE index this migration does
--   create is the unique index behind accounts_id_user_unique, on the smallest
--   table in the schema — one row per account.
-- * **PostgREST embedding.** Nothing in src/ or api/ names a foreign key
--   constraint or embeds `accounts` from these tables, so renaming the keys
--   breaks no query. Names change (…_account_id_fkey → …_account_id_user_fkey)
--   so that a reader can tell the two-column key from the one-column key it
--   replaced without having to read the definition.
--
-- ── BALANCE REASONING ───────────────────────────────────────────────────────
-- Balance-neutral, and structurally so: this file contains no UPDATE, no
-- INSERT and no DELETE. It cannot move a figure because it never writes one.
-- The ledger invariant `balance = initial_balance + Σ(amount)` is not just
-- preserved but PROTECTED by what is added — the way that invariant breaks
-- server-side today is exactly a row counted against an account whose owner
-- cannot see it, which is the row now refused. Verification 6 measures the
-- drift rather than asserting it is zero.
--
-- ── BLAST RADIUS (measured on the reference cluster, 2026-08-08) ────────────
-- `npm run test:local-verbs` went from 124/124 to 119 passed · 5 failed. All
-- five are the fix working, and every one of them is a statement about the
-- SQLite twin lagging, not about the cloud schema being wrong.
--
-- THREE cannot build their fixture any more. scripts/local-sqlite/verb-specs/
-- _shared.mjs:286-306 plants a row whose comment reads "The pairing neither
-- schema forbids: transactions.user_id is this caller and
-- transactions.account_id belongs to somebody else." Postgres forbids it from
-- now on, so the setup INSERT is refused and the spec cannot run:
--     b1-a-delete-that-cannot-reach-its-account-refuses-rather-than-losing-the-money
--     split-a-parent-whose-account-is-not-yours-refuses-rather-than-losing-the-money
--     counterpart-a-row-against-a-foreign-account-skips-the-currency-guard
-- The third of those is the spec that measures the symptom described under HOW
-- IT SURFACED. It cannot be set up because the state it measures no longer
-- exists — which is the strongest evidence available that this migration does
-- what it claims. Those three specs are now about SQLite's behaviour on a row
-- Postgres will not hold; they need the parity work below before they can mean
-- the same thing on both engines again.
--
-- TWO now refuse under a different name. Both still refuse, both engines still
-- agree the write is refused, and nothing partial survives on either:
--     b2-an-account-owned-by-somebody-else-is-refused-by-name — Postgres now
--       stops this at the foreign key (SQLSTATE 23503,
--       transactions_account_id_user_fkey) BEFORE create_transaction_atomic
--       reaches its own `account_not_found_or_not_owned`
--       (20260808150000:208-218).
--     b2-an-account-that-does-not-exist-is-stopped-by-the-foreign-key — pins
--       the constraint NAME, which this file changes.
-- Those two together are one finding worth stating plainly: on the create path
-- the "account does not exist" case and the "account is not yours" case are now
-- stopped by the SAME mechanism, where the pair of specs exists precisely to
-- keep them apart. The RPC's named refusal is deliberately left in place
-- unchanged — it still guards update, delete and split, where the row's account
-- can change without the foreign key having anything new to check — but on
-- create it has become the second line of defence rather than the first, and
-- the message a user sees there is now the database's rather than ours.
--
-- The keys were NOT given their old names back to keep that second spec green.
-- A composite key called `transactions_account_id_fkey` would leave the spec
-- passing while it silently stopped distinguishing the two cases it was written
-- to distinguish, which is worse than a red spec that says so.
--
-- Making these keys DEFERRABLE would restore the nicer message by letting the
-- RPC's own check fire first, and is rejected: it would change when RI fires
-- for every bulk import, and contradict the "none is DEFERRABLE" assumption
-- 20260807083000 builds its two-pass restore on.
--
-- ── PARITY OBLIGATION (not discharged here) ─────────────────────────────────
-- scripts/local-sqlite/schema.sql — the local edition's twin of this schema —
-- should gain the same composite foreign keys, or the two engines disagree
-- about what a legal row is, and the differential harness is measuring a
-- difference in schemas rather than a difference in implementations. That file
-- is another change's territory today, so the obligation is RECORDED here and
-- deliberately not acted on. Until it is discharged, the five spec results
-- described above are expected, and they are the list of what to re-check once
-- it is.
--
-- ── ON RE-RUNNING THIS FILE ─────────────────────────────────────────────────
-- It refuses a second run by name (below), because it DROPs seven constraints
-- and a migration that silently re-does destructive DDL is how a deliberately
-- changed key gets reverted by a replay.
--
-- One consequence, stated plainly and measured rather than predicted:
-- scripts/local-db/up.sh replays the whole directory up to three times and
-- counts non-zero exits, and four unrelated files fail every pass, so a second
-- and third pass always run. This file therefore APPLIES on pass 1 and is then
-- REFUSED on passes 2 and 3 — the cluster reported `unapplied: 4` before this
-- file existed and `unapplied: 5` after, with this file named. Verified
-- immediately afterwards on that same cluster: accounts_id_user_unique present,
-- seven composite keys, one single-column key left (linked_accounts, by
-- design). The listing is the guard doing its job, not a failure to apply, and
-- verification 1 below tells the two apart in one query. Sibling files survive
-- the replay only because a later pass re-runs the migration that undoes their
-- precondition; this one has no such accident available to it, and buying a
-- quiet replay by weakening the refusal to a no-op is not a trade worth making
-- for a tool's tidier output.
-- ============================================================================

BEGIN;

-- ── Guard 1: the server can express what this migration needs ───────────────
-- `ON DELETE SET NULL (column_list)` arrived in PostgreSQL 15. On anything
-- older the four SET NULL keys below would have to null user_id too, which is
-- NOT NULL — the failure would be at account-deletion time, months later, not
-- here. Fail here.
DO $$
BEGIN
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION 'server_too_old_for_column_list_set_null: this migration needs PostgreSQL 15+ for "ON DELETE SET NULL (column)"; this server is %', current_setting('server_version')
      USING ERRCODE = 'P0001',
            HINT = 'Without the column list a bare SET NULL would also null user_id, which is NOT NULL on all four tables, and deleting a transferred-to account would start failing.';
  END IF;
END;
$$;

-- ── Guard 2: refuse a double-run ────────────────────────────────────────────
-- The anchor constraint is the thing this migration exists to add; if it is
-- already there, the seven DROPs below would be dropping keys this file already
-- replaced — or, worse, keys someone has deliberately changed since.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'accounts_id_user_unique'
       AND conrelid = 'public.accounts'::regclass
  ) THEN
    RAISE EXCEPTION 'account_ownership_pairs_already_enforced: accounts_id_user_unique already exists — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001',
            HINT = 'Verification 1 at the foot of this file shows the current state. If a key needs changing, write a new migration for it.';
  END IF;
END;
$$;

-- ── Guard 3: the keys being replaced are the keys this file was written for ──
-- Each one is checked by name, by referencing column, and by ON DELETE action.
-- The whole point of the DDL below is to preserve behaviour while widening the
-- key; if the behaviour on disk is not what was read on 2026-08-08, the
-- restatement below would be silently changing it. Refuse instead of guess.
DO $$
DECLARE
  r     record;
  v_bad text := '';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('transactions'::text,      'transactions_account_id_fkey'::text,                'account_id'::text,          'c'::"char"),
      ('transactions',            'transactions_transfer_account_id_fkey',             'transfer_account_id',       'n'),
      ('transaction_splits',      'transaction_splits_transfer_account_id_fkey',       'transfer_account_id',       'n'),
      ('accounts',                'accounts_parent_account_id_fkey',                   'parent_account_id',         'n'),
      ('categories',              'categories_account_id_fkey',                        'account_id',                'c'),
      ('goals',                   'goals_account_id_fkey',                             'account_id',                'n'),
      ('investments',             'investments_account_id_fkey',                       'account_id',                'c')
    ) AS t(tbl, con, col, del)
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_constraint c
       WHERE c.conname   = r.con
         AND c.contype   = 'f'
         AND c.conrelid  = ('public.' || r.tbl)::regclass
         AND c.confrelid = 'public.accounts'::regclass
         AND c.confdeltype = r.del
         AND (
              SELECT array_agg(a.attname::text ORDER BY k.ord)
                FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
                JOIN pg_attribute a
                  ON a.attrelid = c.conrelid AND a.attnum = k.attnum
             ) = ARRAY[r.col]
    ) THEN
      v_bad := v_bad || format(
        E'\n  %s.%s — expected a single-column key on (%s) with ON DELETE %s',
        r.tbl, r.con, r.col,
        CASE r.del WHEN 'c' THEN 'CASCADE' ELSE 'SET NULL' END);
    END IF;
  END LOOP;

  IF v_bad <> '' THEN
    RAISE EXCEPTION 'account_foreign_keys_not_in_expected_shape: this migration restates the ON DELETE behaviour it found on 2026-08-08, and one or more keys are not what it found:%', v_bad
      USING ERRCODE = 'P0001',
            HINT = 'Read the current definitions (SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE confrelid = ''public.accounts''::regclass) and reconcile this file with them before applying. Do not let it guess.';
  END IF;
END;
$$;

-- ── Guard 4: nothing on disk already breaks the rule ────────────────────────
-- Each ADD CONSTRAINT below validates the whole table and would fail on the
-- first offending row — but it would fail with the constraint's own message,
-- naming a key nobody has heard of yet and not saying which rows or how many.
-- This says it in the vocabulary of the problem, counts EVERY pairing in one
-- pass so a repair can be planned once rather than seven times, and does it
-- before anything has been dropped.
DO $$
DECLARE
  v_report text := '';
  v_n      bigint;
BEGIN
  SELECT count(*) INTO v_n
    FROM public.transactions t
    JOIN public.accounts a ON a.id = t.account_id
   WHERE a.user_id <> t.user_id;
  IF v_n > 0 THEN v_report := v_report || format(E'\n  transactions.account_id — %s row(s)', v_n); END IF;

  SELECT count(*) INTO v_n
    FROM public.transactions t
    JOIN public.accounts a ON a.id = t.transfer_account_id
   WHERE a.user_id <> t.user_id;
  IF v_n > 0 THEN v_report := v_report || format(E'\n  transactions.transfer_account_id — %s row(s)', v_n); END IF;

  SELECT count(*) INTO v_n
    FROM public.transaction_splits s
    JOIN public.accounts a ON a.id = s.transfer_account_id
   WHERE a.user_id <> s.user_id;
  IF v_n > 0 THEN v_report := v_report || format(E'\n  transaction_splits.transfer_account_id — %s row(s)', v_n); END IF;

  SELECT count(*) INTO v_n
    FROM public.accounts c
    JOIN public.accounts p ON p.id = c.parent_account_id
   WHERE p.user_id <> c.user_id;
  IF v_n > 0 THEN v_report := v_report || format(E'\n  accounts.parent_account_id — %s row(s)', v_n); END IF;

  SELECT count(*) INTO v_n
    FROM public.categories x
    JOIN public.accounts a ON a.id = x.account_id
   WHERE a.user_id <> x.user_id;
  IF v_n > 0 THEN v_report := v_report || format(E'\n  categories.account_id — %s row(s)', v_n); END IF;

  SELECT count(*) INTO v_n
    FROM public.goals x
    JOIN public.accounts a ON a.id = x.account_id
   WHERE a.user_id <> x.user_id;
  IF v_n > 0 THEN v_report := v_report || format(E'\n  goals.account_id — %s row(s)', v_n); END IF;

  SELECT count(*) INTO v_n
    FROM public.investments x
    JOIN public.accounts a ON a.id = x.account_id
   WHERE a.user_id <> x.user_id;
  IF v_n > 0 THEN v_report := v_report || format(E'\n  investments.account_id — %s row(s)', v_n); END IF;

  IF v_report <> '' THEN
    RAISE EXCEPTION 'cross_tenant_account_references_present: rows exist whose account belongs to a different login, so the ownership pairing cannot be enforced yet:%', v_report
      USING ERRCODE = 'P0001',
            HINT = 'Each one is a row filed against a stranger''s account. Decide per row whether it belongs to the account''s owner (fix user_id) or to the row''s owner (fix account_id) — do not delete anything until the balances either side have been read, because a fix that moves a row moves both ledgers. Verification 5 at the foot of this file lists them.';
  END IF;
END;
$$;

-- ── The anchor ──────────────────────────────────────────────────────────────
-- Redundant as a uniqueness claim — `id` is already the primary key, so
-- (id, user_id) could not have been non-unique. It exists so that (id, user_id)
-- is a legal foreign-key target, which is the only way a child row can be made
-- to carry its account's owner. Cost: one small btree index on a table with one
-- row per account.
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_id_user_unique UNIQUE (id, user_id);

COMMENT ON CONSTRAINT accounts_id_user_unique ON public.accounts IS
  'Not a uniqueness rule — id is already the primary key. This exists solely as the target of the composite foreign keys that make every account reference carry its owner, so that "this row''s account belongs to this row''s user" is enforced by the schema rather than by each writer remembering a WHERE clause. Added 20260808170000.';

-- ── transactions.account_id — the ledger ────────────────────────────────────
-- Was: FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE.
-- Now the same, plus user_id. CASCADE needs no column list: deleting the
-- account deletes the row entire, exactly as it does today.
ALTER TABLE public.transactions
  DROP CONSTRAINT transactions_account_id_fkey;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_account_id_user_fkey
  FOREIGN KEY (account_id, user_id)
  REFERENCES public.accounts (id, user_id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT transactions_account_id_user_fkey ON public.transactions IS
  'A transaction may only name an account owned by the same login. Two columns rather than one because RLS gates on user_id alone and referential-integrity checks bypass RLS, so a single-column key let a row be filed against another tenant''s account — invisible to that tenant, counted by every service-role aggregate over their account. ON DELETE CASCADE is unchanged from the single-column key it replaced.';

-- ── transactions.transfer_account_id — the other end ────────────────────────
-- Was: ON DELETE SET NULL. The column list is mandatory here: user_id is NOT
-- NULL, so a bare SET NULL on a two-column key would make deleting a
-- transferred-to account impossible. Nullable and MATCH SIMPLE, so a row with
-- no transfer_account_id is unconstrained, exactly as before.
ALTER TABLE public.transactions
  DROP CONSTRAINT transactions_transfer_account_id_fkey;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transfer_account_id_user_fkey
  FOREIGN KEY (transfer_account_id, user_id)
  REFERENCES public.accounts (id, user_id)
  ON DELETE SET NULL (transfer_account_id);

COMMENT ON CONSTRAINT transactions_transfer_account_id_user_fkey ON public.transactions IS
  'The far side of a transfer may only be an account owned by the same login. This is the weaker of the two account references and the reason this key is not optional: create_transfer_counterpart validates its target, but create_transaction_atomic copies transfer_account_id straight out of the caller''s payload unchecked. ON DELETE SET NULL is unchanged; it names its column because user_id is NOT NULL and must not be nulled with it.';

-- ── transaction_splits.transfer_account_id — a split leg's far side ─────────
-- Was: ON DELETE SET NULL (20260720120000:40-42). Same reasoning, same shape.
ALTER TABLE public.transaction_splits
  DROP CONSTRAINT transaction_splits_transfer_account_id_fkey;

ALTER TABLE public.transaction_splits
  ADD CONSTRAINT transaction_splits_transfer_account_id_user_fkey
  FOREIGN KEY (transfer_account_id, user_id)
  REFERENCES public.accounts (id, user_id)
  ON DELETE SET NULL (transfer_account_id);

-- ── accounts.parent_account_id — the investment/cash pairing ────────────────
-- Was: ON DELETE SET NULL (20260722090000:22-24). Self-referential, so the
-- pairing now says an account may only be paired with an account of the same
-- owner — which is what the feature always meant. The restore path is
-- unaffected: it inserts accounts with parent_account_id NULL and patches it in
-- a second pass once every account is present and owned
-- (20260807083000:408-417).
ALTER TABLE public.accounts
  DROP CONSTRAINT accounts_parent_account_id_fkey;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_parent_account_id_user_fkey
  FOREIGN KEY (parent_account_id, user_id)
  REFERENCES public.accounts (id, user_id)
  ON DELETE SET NULL (parent_account_id);

-- ── categories.account_id — account-scoped categories ───────────────────────
-- Was: ON DELETE CASCADE. Includes the per-account transfer categories minted
-- by the account trigger, which fires AFTER INSERT and so always finds its
-- account present and owned.
ALTER TABLE public.categories
  DROP CONSTRAINT categories_account_id_fkey;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_account_id_user_fkey
  FOREIGN KEY (account_id, user_id)
  REFERENCES public.accounts (id, user_id)
  ON DELETE CASCADE;

-- ── goals.account_id ────────────────────────────────────────────────────────
-- Was: ON DELETE SET NULL. Column list for the same NOT NULL reason.
ALTER TABLE public.goals
  DROP CONSTRAINT goals_account_id_fkey;

ALTER TABLE public.goals
  ADD CONSTRAINT goals_account_id_user_fkey
  FOREIGN KEY (account_id, user_id)
  REFERENCES public.accounts (id, user_id)
  ON DELETE SET NULL (account_id);

-- ── investments.account_id ──────────────────────────────────────────────────
-- Was: ON DELETE CASCADE.
ALTER TABLE public.investments
  DROP CONSTRAINT investments_account_id_fkey;

ALTER TABLE public.investments
  ADD CONSTRAINT investments_account_id_user_fkey
  FOREIGN KEY (account_id, user_id)
  REFERENCES public.accounts (id, user_id)
  ON DELETE CASCADE;

COMMIT;

-- ============================================================================
-- Verification — run after applying
-- ============================================================================

-- 1. The anchor exists, and it is what it claims to be. This is also the query
--    that tells "applied" from "the double-run guard fired": if this returns a
--    row, the migration is applied and any later refusal was the guard.
-- Expected: one row, UNIQUE (id, user_id)
SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid = 'public.accounts'::regclass
   AND conname = 'accounts_id_user_unique';

-- 2. Every account reference is now a PAIR, and each kept the ON DELETE
--    behaviour it had. Read the definitions, do not trust the count.
-- Expected: seven rows, every one FOREIGN KEY (…, user_id) REFERENCES
--           accounts(id, user_id); CASCADE on transactions.account_id,
--           categories and investments; SET NULL (col) on the other four.
SELECT c.conrelid::regclass::text AS child_table,
       c.conname,
       pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
 WHERE c.contype = 'f'
   AND c.confrelid = 'public.accounts'::regclass
 ORDER BY 1, 2;

-- 3. No single-column account reference survived — the check that this widened
--    every key rather than most of them. linked_accounts.account_id is the one
--    legitimate exception: that table has no user_id to pair with.
-- Expected: exactly one row, linked_accounts_account_id_fkey
SELECT c.conrelid::regclass::text AS child_table,
       c.conname,
       pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
 WHERE c.contype = 'f'
   AND c.confrelid = 'public.accounts'::regclass
   AND array_length(c.conkey, 1) = 1
 ORDER BY 1, 2;

-- 4. The rule holds for every row, measured rather than assumed. Each branch
--    counts rows whose account belongs to a different login.
-- Expected: seven rows, every mismatched = 0
SELECT 'transactions.account_id' AS pairing, count(*) AS mismatched
  FROM public.transactions t JOIN public.accounts a ON a.id = t.account_id
 WHERE a.user_id <> t.user_id
UNION ALL
SELECT 'transactions.transfer_account_id', count(*)
  FROM public.transactions t JOIN public.accounts a ON a.id = t.transfer_account_id
 WHERE a.user_id <> t.user_id
UNION ALL
SELECT 'transaction_splits.transfer_account_id', count(*)
  FROM public.transaction_splits s JOIN public.accounts a ON a.id = s.transfer_account_id
 WHERE a.user_id <> s.user_id
UNION ALL
SELECT 'accounts.parent_account_id', count(*)
  FROM public.accounts c JOIN public.accounts p ON p.id = c.parent_account_id
 WHERE p.user_id <> c.user_id
UNION ALL
SELECT 'categories.account_id', count(*)
  FROM public.categories x JOIN public.accounts a ON a.id = x.account_id
 WHERE a.user_id <> x.user_id
UNION ALL
SELECT 'goals.account_id', count(*)
  FROM public.goals x JOIN public.accounts a ON a.id = x.account_id
 WHERE a.user_id <> x.user_id
UNION ALL
SELECT 'investments.account_id', count(*)
  FROM public.investments x JOIN public.accounts a ON a.id = x.account_id
 WHERE a.user_id <> x.user_id
 ORDER BY 1;

-- 5. If guard 4 ever refuses, this is what it was looking at: the offending
--    ledger rows, with both owners named, so a repair can be reasoned about
--    before anything is moved. Expected today: zero rows.
SELECT t.id           AS transaction_id,
       t.date,
       t.user_id      AS row_owner,
       a.user_id      AS account_owner,
       a.id           AS account_id
  FROM public.transactions t
  JOIN public.accounts a ON a.id = t.account_id
 WHERE a.user_id <> t.user_id
 ORDER BY t.date;

-- 6. The ledger invariant, unmoved: balance must still equal initial_balance +
--    Σ(amount) for every account. This migration writes no data, so it cannot
--    have shifted one — this proves it rather than claiming it.
-- Expected: zero rows
SELECT a.id, a.name, a.balance, a.initial_balance + COALESCE(t.total, 0) AS expected
  FROM public.accounts a
  LEFT JOIN (
    SELECT account_id, sum(amount) AS total
      FROM public.transactions
     GROUP BY account_id
  ) t ON t.account_id = a.id
 WHERE a.balance IS DISTINCT FROM a.initial_balance + COALESCE(t.total, 0);

-- 7. Row-level security untouched: same tables enabled, same policy counts as
--    before. Redefining a foreign key must not disturb a policy, and this
--    proves it did not.
-- Expected: accounts 4, categories 4, transactions 4, goals 1, investments 1,
--           transaction_splits 1 — all with rls_enabled = true
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('accounts', 'transactions', 'transaction_splits',
                     'categories', 'goals', 'investments')
 ORDER BY 1;
