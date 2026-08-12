-- ============================================================================
-- REPORTS OUTLIVE THE BROWSER — the one thing the builder built and did not keep
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ORDERING: apply this AFTER 20260807083000_user_data_restore.sql, because it
-- redefines two of that file's functions rather than adding beside them. Guard 4
-- refuses to run if either is missing. A database with this applied and the OLD
-- client running behaves exactly as it does now — nothing reads the new table
-- until a client that knows about it arrives, and the two redefined functions
-- keep every branch they had.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- `src/services/customReportService.ts` is a real builder. It computes summary
-- statistics, line, pie and bar charts, tables, category breakdowns and
-- period-over-period comparisons out of the user's actual transactions, and
-- `CustomReportBuilder` gives it full CRUD. Everything about it works.
--
-- Then it saved the result to `window.localStorage`, under one key, on one
-- machine.
--
-- So a report the owner spent an afternoon composing did not follow him to his
-- second computer, was not in the backup file, did not survive clearing the
-- browser's data, and — in the desktop edition, where the whole promise is that
-- the FILE is everything — lived in the WebView's storage rather than in the
-- ledger he was looking at. Nothing anywhere said so. It is the same failure
-- 20260809160000 fixed for preferences, one tier up: that one lost the choices
-- about how to read the ledger, this one loses work the person AUTHORED.
--
-- ── WHY COLUMNS AND NOT ONE DOCUMENT ────────────────────────────────────────
--
-- user_preferences is deliberately one row per user holding one jsonb document,
-- because preferences are read as a set exactly once at boot and written a
-- toggle at a time. Reports are not that shape and must not borrow it:
--
--   * they are a COLLECTION whose members are created, renamed, duplicated and
--     deleted individually, so each needs its own id — the dashboard pins them
--     by it (`custom:<id>` in the pinned-reports preference) and a document
--     would have to invent one anyway;
--   * they carry REFERENCES to other rows. `filters.accounts` and
--     `filters.categories` hold account and category ids, which means a restore
--     has to rewrite them (see remapBackupIds) — and the remapper walks entities
--     and rows, not the inside of one user's settings blob;
--   * one row per report is what lets a single corrupt report be deleted
--     without taking the other nine with it.
--
-- So: a row per report, `name` and `description` as real columns because they
-- are what every list of them displays, and the two structural halves as jsonb
-- because their shape is the client's (`ReportComponent[]` and the filter
-- object in src/components/CustomReportBuilder.tsx) and must be free to gain
-- keys without a migration.
--
-- ── WHY THE SIZE IS A CONSTRAINT AND NOT A CONVENTION ───────────────────────
--
-- Same argument 20260809160000 makes about `prefs`, and it applies harder here
-- because this table has a plausible wrong use: a report is a thing that
-- PRODUCES rows, and the temptation is to cache the produced rows next to the
-- definition. The day something does, every boot downloads a second copy of the
-- ledger. A report DEFINITION is a few components and a filter — a couple of
-- kilobytes at the very most — so 256 KiB can only ever fire on a mistake, and
-- the mistake it fires on is exactly the one worth catching.
--
-- ── WHAT THIS DOES CHANGE, AND WHY IT HAS TO ────────────────────────────────
--
-- Two functions from 20260807083000 are redefined. Neither loses a branch;
-- both gain custom_reports:
--
--   restore_user_chunk — a fifteenth entity, an ordinary "insert whole rows
--     into an empty login" branch, which is what makes it belong here where
--     preferences did not. The rows are many, inserted, and carry ids that the
--     remapper has already rewritten.
--
--   wipe_user_financial_data — and this one is a genuine departure from the
--     precedent next door, so it is argued rather than assumed. Preferences are
--     deliberately spared by the wipe: erasing your transactions is not a
--     request to forget that you prefer twelve-month charts. Reports look like
--     the same kind of thing, and are not, for a mechanical reason —
--     preferences are ONE row, RESTORED BY UPSERT, so sparing them is
--     idempotent. Reports are MANY rows, RESTORED BY INSERT. A wipe that spared
--     them, followed by the restore the wipe exists to make room for, would
--     leave the user with two of every report and no way to tell which was
--     which. The emptiness precondition would not catch it either: it looks at
--     accounts, categories and transactions, and would see a clean login.
--
-- Nothing else is touched. No existing table gains, loses or alters a column;
-- no policy on any other table changes; user_financial_data_is_empty is left
-- exactly as it is, because a login holding nothing but reports is still empty
-- enough to restore into — the reports are about to be replaced by the file's.
--
-- ── SAFE TO RUN TWICE? ──────────────────────────────────────────────────────
-- No, and guard 2 refuses a second run BY NAME rather than letting CREATE TABLE
-- IF NOT EXISTS quietly leave an older definition in place while the policies
-- are recreated around it. If something here needs changing, write a new
-- migration for it.
-- ============================================================================

BEGIN;

-- ── Guard 1: this is the database this migration was written against ────────
-- The policies below are written in terms of public.requesting_user_id() and
-- the FK in terms of public.users(id). Both arrived in 20260610130000. Against
-- an older base CREATE POLICY would fail with "function does not exist" halfway
-- through the file — true, but naming the symptom rather than the cause.
DO $$
BEGIN
  IF to_regprocedure('public.requesting_user_id()') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_requesting_user_id: public.requesting_user_id() does not exist, so this database predates 20260610130000_restore_rls_data_isolation and cannot express owner-only policies.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply the migrations in order with `npm run db:migrate`. Do not apply this file to an older base.';
  END IF;

  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_users_table: public.users does not exist, so custom_reports has nothing to hang off.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply 20251030003814__initial-schema.sql first.';
  END IF;
END;
$$;

-- ── Guard 2: refuse a double-run, by name ───────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.custom_reports') IS NOT NULL THEN
    RAISE EXCEPTION 'custom_reports_already_exists: public.custom_reports is already present — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001',
            HINT = 'The verification queries at the foot of this file show the current state. If something needs changing, write a new migration for it.';
  END IF;
END;
$$;

-- ── Guard 3: the shared updated_at trigger is the one expected ──────────────
-- Attached by name below. If it were ever replaced by something that does NOT
-- set updated_at, this table would silently stop stamping and two devices would
-- have no way to tell whose copy of a report was newer.
DO $$
DECLARE
  v_body text;
BEGIN
  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_update_updated_at_column: public.update_updated_at_column() does not exist, so custom_reports.updated_at would never be stamped.'
      USING ERRCODE = 'P0001',
            HINT = 'It is created by 20251030003814__initial-schema.sql and reasserted by 20260807083000_user_data_restore.sql.';
  END IF;

  SELECT pg_get_functiondef(to_regprocedure('public.update_updated_at_column()')) INTO v_body;
  IF v_body !~* 'updated_at' THEN
    RAISE EXCEPTION 'update_updated_at_column_not_recognised: the shared trigger function no longer mentions updated_at, so attaching it here would produce rows whose timestamp never moves.'
      USING ERRCODE = 'P0001',
            HINT = 'Read its current definition before continuing: SELECT pg_get_functiondef(to_regprocedure(''public.update_updated_at_column()''));';
  END IF;
END;
$$;

-- ── Guard 4: the two functions this file redefines actually exist ───────────
-- CREATE OR REPLACE would happily CREATE them if they did not, which would
-- leave a database with a restore path assembled from one migration instead of
-- two — every branch this file writes and none of the ones it does not.
DO $$
BEGIN
  IF to_regprocedure('public.restore_user_chunk(text, jsonb, uuid)') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_restore_user_chunk: public.restore_user_chunk(text, jsonb, uuid) does not exist, so this database predates 20260807083000_user_data_restore and the redefinition below would create a PARTIAL restore path rather than extend a whole one.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply 20260807083000_user_data_restore.sql first, with `npm run db:migrate`.';
  END IF;

  IF to_regprocedure('public.wipe_user_financial_data(text, uuid)') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_wipe_user_financial_data: public.wipe_user_financial_data(text, uuid) does not exist, so this database predates 20260807083000_user_data_restore.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply 20260807083000_user_data_restore.sql first, with `npm run db:migrate`.';
  END IF;
END;
$$;

-- ── Guard 5: the restore path here is the LATEST one, not the original ──────
-- The failure this exists to stop is the one this file already made once, and
-- it is invisible in SQL: `CREATE OR REPLACE` overwrites, so redefining a
-- function from an out-of-date copy silently deletes every later migration's
-- work on it. 20260811090000 gave restore_user_chunk its catalogue-read
-- defaults, and a copy taken from 20260807083000 threw them away.
--
-- `v_defaults` is that migration's marker: it is declared and used only by the
-- version this file is based on. If it is absent, the database's current
-- function is older than the one below was copied from, which means either
-- 20260811090000 has not been applied or something has already reverted it —
-- and applying this file would compound it rather than fix it.
DO $$
BEGIN
  IF pg_get_functiondef(to_regprocedure('public.restore_user_chunk(text, jsonb, uuid)'))
       NOT LIKE '%v_defaults%' THEN
    RAISE EXCEPTION 'restore_user_chunk_predates_20260811090000: the restore function in this database does not carry the catalogue-read defaults that 20260811090000 added, so replacing it with this file''s copy would be a downgrade rather than an extension.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply 20260811090000_a_backup_is_older_than_the_schema_it_returns_to.sql first, with `npm run db:migrate`, then re-run this one.';
  END IF;
END;
$$;

-- ── The table ───────────────────────────────────────────────────────────────

CREATE TABLE public.custom_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- What every list of reports displays. A real column rather than a key in the
  -- jsonb because it is the only thing here that is ever sorted or searched by.
  name        text NOT NULL,
  -- NOT NULL with an empty default: the builder's field is optional, and a
  -- reader should never have to tell "no description" from "description
  -- unknown".
  description text NOT NULL DEFAULT '',

  -- ReportComponent[] — the blocks the report is made of, each with its own
  -- id, type, title, width and config. An ARRAY because order is what the
  -- reader sees: components render top to bottom in the order stored here.
  --
  -- No row references live in here today: a component's config holds metric
  -- names, limits, sort keys and free text, never an account or category id
  -- (those are filters, below, and are shared by every component). Should that
  -- ever change, the remapper has to learn about it — see
  -- ENTITY_REFERENCES in src/services/backup/format.ts, which is where a
  -- reference the restore must rewrite is declared.
  components  jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- The report's date range, and which accounts, categories and tags it is
  -- narrowed to. An OBJECT, and the one place in this table that names other
  -- rows: `accounts` and `categories` are arrays of ids, which is why this
  -- column is declared to the backup remapper and `tags` — labels, not ids —
  -- is not.
  filters     jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- NULLABLE, and that is not an oversight copied from a laxer table — it is
  -- what a table reachable from restore_user_chunk has to be.
  --
  -- user_preferences next door declares both NOT NULL and is right to: it is
  -- restored by an ordinary upsert from the client, which always sends whole
  -- values. Everything in `restore_user_chunk` arrives instead through
  -- jsonb_populate_recordset against the table's own rowtype, and that turns a
  -- key the file does not carry into SQL NULL rather than into "unspecified" —
  -- so NULL is what reaches the column, and a NULL beats the DEFAULT. Declaring
  -- NOT NULL here would therefore REFUSE any file whose rows lack a timestamp,
  -- which is the one operation a user cannot afford to have fail.
  --
  -- Measured rather than reasoned: accounts, budgets and goals all declare these
  -- two nullable, and a restore of a report row without them failed with
  -- "null value in column created_at violates not-null constraint" until this
  -- matched them. In practice a backup carries whole rows (the export is
  -- `select *`), so the default does the work on every ordinary path; this is
  -- about the path where it does not.
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),

  -- A report with no name is one the list cannot offer you. The builder already
  -- refuses to save one; this is the same rule where it cannot be bypassed.
  CONSTRAINT custom_reports_name_not_blank
    CHECK (length(btrim(name)) > 0),

  -- An array and an object respectively, because every reader iterates the one
  -- and indexes into the other. The SHAPE inside stays the client's business
  -- (see src/components/CustomReportBuilder.tsx) so it can gain keys without a
  -- migration; what must not vary is the container.
  CONSTRAINT custom_reports_components_is_array
    CHECK (jsonb_typeof(components) = 'array'),
  CONSTRAINT custom_reports_filters_is_object
    CHECK (jsonb_typeof(filters) = 'object'),

  -- See "WHY THE SIZE IS A CONSTRAINT" above. The cast jsonb -> text is
  -- IMMUTABLE, which is what makes this legal in a CHECK.
  CONSTRAINT custom_reports_definition_is_small
    CHECK (length(components::text) + length(filters::text) <= 262144)
);

-- The only lookup this table does: every report belonging to one user, newest
-- first, which is the order the page lists them in.
CREATE INDEX custom_reports_user_id_updated_at_idx
  ON public.custom_reports (user_id, updated_at DESC);

COMMENT ON TABLE public.custom_reports IS
  'One row per report the user has composed in the custom report builder: its name, the components it is made of and the filters it runs under. Holds no money and changes no figure — a report is a QUESTION about the ledger, computed fresh from transactions every time it is generated, never a stored answer. Lived in window.localStorage until 20260812140000, which meant it did not sync, did not back up and did not survive clearing the browser.';

COMMENT ON COLUMN public.custom_reports.components IS
  'ReportComponent[] exactly as src/components/CustomReportBuilder.tsx defines it: [{id, type, title, config, width}]. Order is meaningful — it is the order the components render in. Carries no references to other rows.';

COMMENT ON COLUMN public.custom_reports.filters IS
  'The report''s scope: {dateRange, customStartDate?, customEndDate?, accounts?, categories?, tags?}. `accounts` and `categories` hold row ids and are rewritten on restore by remapBackupIds; `tags` holds labels and is not.';

-- updated_at is what orders the list and what two devices compare, so it is
-- stamped by the shared trigger rather than by whichever client remembered to
-- send it.
CREATE TRIGGER update_custom_reports_updated_at
  BEFORE UPDATE ON public.custom_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS: the owner, and nobody else ─────────────────────────────────────────
-- All four commands: a report is created, edited repeatedly, and deleted, and
-- every one of those must be expressible without a service key.
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_reports_select_own ON public.custom_reports;
CREATE POLICY custom_reports_select_own ON public.custom_reports
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS custom_reports_insert_own ON public.custom_reports;
CREATE POLICY custom_reports_insert_own ON public.custom_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS custom_reports_update_own ON public.custom_reports;
CREATE POLICY custom_reports_update_own ON public.custom_reports
  FOR UPDATE TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS custom_reports_delete_own ON public.custom_reports;
CREATE POLICY custom_reports_delete_own ON public.custom_reports
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());

-- ── Grants ──────────────────────────────────────────────────────────────────
-- FROM PUBLIC, anon — naming anon explicitly, because REVOKE ... FROM PUBLIC
-- alone does NOT remove Supabase's named default grant to anon (the trap
-- documented at length in 20260725120000). RLS already denies anon every row;
-- this removes the privilege as well, so both layers say no.
REVOKE ALL ON TABLE public.custom_reports FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.custom_reports TO authenticated;
GRANT ALL ON TABLE public.custom_reports TO service_role;


-- ── The wipe learns about reports ───────────────────────────────────────────
-- Redefined from 20260807083000 with ONE statement added. Everything else is
-- that file's text, unchanged, including the ordering comment it opens with —
-- accounts first so cascaded category deletion clears
-- protect_transfer_category_on_delete.
--
-- The added DELETE sits with dashboard_layouts and widget_preferences rather
-- than with the counted tables above them: like those two it is about how the
-- ledger is READ rather than what it contains, so it is cleared without being
-- reported. The header argues why it is cleared at all, and it comes down to
-- INSERT versus UPSERT — see "WHAT THIS DOES CHANGE".
CREATE OR REPLACE FUNCTION public.wipe_user_financial_data(
  p_confirm text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner  uuid;
  v_counts jsonb := '{}'::jsonb;
  v_n      bigint;
  v_row    record;
BEGIN
  IF p_confirm IS DISTINCT FROM 'DELETE EVERYTHING' THEN
    RAISE EXCEPTION 'wipe_not_confirmed: this erases every account, transaction, budget and goal in this login — the caller must pass the exact confirmation phrase'
      USING ERRCODE = 'P0001';
  END IF;

  v_owner := COALESCE(p_user_id, public.requesting_user_id());
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'owner_unknown: could not establish which account to clear'
      USING ERRCODE = '42501';
  END IF;

  -- Per-row audit BEFORE deleting, while the rows still exist to describe.
  FOR v_row IN SELECT * FROM public.transactions WHERE user_id = v_owner LOOP
    PERFORM public.write_financial_audit(
      v_owner, 'transaction', v_row.id, 'delete', to_jsonb(v_row), NULL);
  END LOOP;

  FOR v_row IN SELECT * FROM public.accounts WHERE user_id = v_owner LOOP
    PERFORM public.write_financial_audit(
      v_owner, 'account', v_row.id, 'delete', to_jsonb(v_row), NULL);
  END LOOP;

  -- Accounts first: categories and transactions follow by cascade.
  DELETE FROM public.accounts WHERE user_id = v_owner;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('accounts', v_n);

  DELETE FROM public.transactions WHERE user_id = v_owner;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('transactions', v_n);

  DELETE FROM public.categories WHERE user_id = v_owner;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('categories', v_n);

  DELETE FROM public.budgets WHERE user_id = v_owner;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('budgets', v_n);

  DELETE FROM public.goals WHERE user_id = v_owner;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('goals', v_n);

  DELETE FROM public.investments WHERE user_id = v_owner;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('investments', v_n);

  -- COUNTED, unlike the four below it, and the line between them is what the
  -- row IS rather than which table it sits in. A dismissal, a layout and a
  -- widget setting are all records of how somebody has arranged the app; a
  -- custom report is something they WROTE. A wipe that reported six numbers and
  -- silently took a year of composed reports with them would be under-reporting
  -- the loss in the one place a person is looking for its size.
  --
  -- It is also what the local edition already answers: `wipe_user_financial_data`
  -- in the crate returns a `custom_reports` count, and `npm run test:local-verbs`
  -- compares the two answers key for key. Leaving it uncounted here made five
  -- wipe specs fail with "row.custom_reports: 0 vs (absent)" — a divergence
  -- nobody had declared and nobody wanted.
  DELETE FROM public.custom_reports WHERE user_id = v_owner;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('custom_reports', v_n);

  DELETE FROM public.suggestion_dismissals WHERE user_id = v_owner;
  DELETE FROM public.dashboard_layouts     WHERE user_id = v_owner;
  DELETE FROM public.widget_preferences    WHERE user_id = v_owner;
  DELETE FROM public.notifications         WHERE user_id = v_owner;

  RETURN v_counts;
END;
$$;

COMMENT ON FUNCTION public.wipe_user_financial_data(text, uuid) IS
  'Erases the caller''s financial data so a backup can be restored into a clean login. Requires the literal confirmation phrase. Deletes accounts first so cascaded category deletion clears protect_transfer_category_on_delete. Audits every transaction and account row individually before deleting. Also clears custom_reports — unlike user_preferences, which is spared — because reports are restored by INSERT rather than by upsert, so sparing them would double every report on the restore this wipe exists to make room for. Returns per-table counts.';


-- ── The restore learns about reports ────────────────────────────────────────
-- Redefined from **20260811090000**, not from 20260807083000, with ONE branch
-- added immediately before the ELSE. Every other line is that file's, unchanged.
--
-- ⚠ READ THIS BEFORE REDEFINING IT AGAIN. This function has been redefined
-- twice now, and the second time (here) was WRONG on the first attempt in a way
-- that no amount of reading this file would have shown: the copy was taken from
-- 20260807083000, which created the function, rather than from 20260811090000,
-- which had since replaced it. `CREATE OR REPLACE` does not merge — it
-- overwrites — so that copy silently REVERTED the later migration's whole
-- contribution: the catalogue-read defaults that let a backup taken before a
-- NOT NULL column existed still restore. Nothing in the SQL complained. What
-- caught it was `npm run test:local-verbs`, four X-7 specs failing with "null
-- value in column needs_review violates not-null constraint" — a message about
-- transactions, in a slice about reports.
--
-- Guard 5 below now refuses that mistake by name. The general rule it encodes:
-- when redefining a shared function, take the text from the LATEST migration
-- that defines it (`grep -l 'CREATE OR REPLACE FUNCTION public.<name>'
-- supabase/migrations/*.sql | sort | tail -1`), never from the one that created
-- it.
--
-- custom_reports needs no special handling in the re-owning pass above the
-- branches — it has no globally-unique provider id to strip and no self
-- reference to defer, so the generic `e || jsonb_build_object('user_id', …)`
-- arm is exactly right for it. The ids INSIDE `filters` were already rewritten
-- on the client by remapBackupIds, which is the only place that can do it: it
-- is the only thing holding the map from the file's ids to the fresh ones.
CREATE OR REPLACE FUNCTION public.restore_user_chunk(
  p_entity  text,
  p_rows    jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner    uuid;
  v_clerk    text;
  v_rows     jsonb;
  v_n        bigint := 0;
  -- The table p_entity names, if it names one. Only ever used to READ that
  -- table's defaults; which table is WRITTEN is decided by the chain below.
  v_table    oid;
  -- The SELECT list of that table's applicable defaults, built from the
  -- catalogue. NULL when the table has none, which is the common case.
  v_select   text;
  -- Those defaults, evaluated: {column: value}. Empty until proven otherwise,
  -- so every path through this function that does not fill it in behaves
  -- exactly as this function did before.
  v_defaults jsonb := '{}'::jsonb;
BEGIN
  v_owner := COALESCE(p_user_id, public.requesting_user_id());
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'owner_unknown: could not establish which login to restore into'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'rows_not_an_array: each chunk must be a JSON array of whole rows'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_rows) = 0 THEN
    RETURN 0;
  END IF;

  -- The precondition, checked on the first chunk. accounts always leads the
  -- order, so this fires before a single row lands.
  IF p_entity = 'accounts' AND NOT public.user_financial_data_is_empty(v_owner) THEN
    RAISE EXCEPTION 'restore_target_not_empty: this login already holds data — clear it first, because restoring on top would mix two datasets and silently re-date your history'
      USING ERRCODE = 'P0001',
            HINT = 'Erase everything first, or restore into a fresh login.';
  END IF;

  -- Whitelists the split guard for this transaction so restored split parents
  -- can carry is_split = true. Same mechanism set_transaction_splits uses.
  PERFORM set_config('app.split_rpc', '1', true);

  -- ── What the past did not know ────────────────────────────────────────────
  -- The defaults this schema would apply to a row that stays silent about a
  -- column — read from the catalogue rather than remembered, so a column added
  -- after this file was written is covered without anybody thinking of it.
  --
  -- Restricted to NOT NULL columns because that is exactly the class whose
  -- omission is FATAL: a nullable column takes the NULL and the row lands, and
  -- filling one in would overwrite a deliberate absence (money that was never
  -- stated, an is_reconciled that means "ask is_cleared").
  --
  -- Restricted to Const defaults, and to columns outside the primary key,
  -- because a generated default invents an identity or a time. See the header.
  --
  -- Not found, not a table, or nothing applicable: v_defaults stays empty and
  -- the merge below is a no-op.
  SELECT c.oid INTO v_table
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = p_entity AND c.relkind = 'r';

  IF v_table IS NOT NULL THEN
    SELECT string_agg(format('%s AS %I', pg_get_expr(d.adbin, d.adrelid), a.attname), ', '
                      ORDER BY a.attnum)
      INTO v_select
      FROM pg_attribute a
      JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = v_table
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND a.attnotnull
       AND d.adbin::text LIKE '{CONST%'
       AND NOT EXISTS (
             SELECT 1 FROM pg_index i
              WHERE i.indrelid = a.attrelid
                AND i.indisprimary
                AND a.attnum = ANY(i.indkey));

    IF v_select IS NOT NULL THEN
      -- Only ever a SELECT of literals: the filter above admits no expression
      -- that can call anything.
      EXECUTE format('SELECT to_jsonb(d) FROM (SELECT %s) AS d', v_select)
         INTO v_defaults;
    END IF;
  END IF;

  -- Re-own every row to the caller, and strip the columns that must not travel:
  --   plaid_* are GLOBALLY unique, so restoring them collides with whoever
  --     exported the file;
  --   connection_id points at bank_connections, which a backup deliberately
  --     does not carry (it holds credentials);
  --   the two self-references and the transactions<->splits cycle are deferred
  --     to finalize_user_restore because no constraint here is DEFERRABLE.
  --
  -- Then lay the defaults UNDERNEATH the result, which is where the file wins:
  -- `v_defaults || stated` keeps every key the file states, including a
  -- deliberate null on a nullable column, and answers only for keys it does not
  -- state. The subtraction first turns "stated as null on a column that cannot
  -- hold null" into "not stated", because no legal export could have produced
  -- it — see the header. Only keys that carry a default are considered, so a
  -- NOT NULL column WITHOUT one still refuses a null, loudly, as it must.
  SELECT jsonb_agg(
           v_defaults || (stated.doc - ARRAY(
             SELECT k
               FROM jsonb_object_keys(v_defaults) AS k
              WHERE stated.doc -> k = 'null'::jsonb)))
    INTO v_rows
    FROM (
      SELECT CASE p_entity
               WHEN 'accounts' THEN
                 (e - 'plaid_account_id' - 'plaid_connection_id')
                   || jsonb_build_object('user_id', v_owner, 'parent_account_id', NULL)
               WHEN 'transactions' THEN
                 (e - 'plaid_transaction_id' - 'connection_id'
                    - 'external_transaction_id' - 'external_provider')
                   || jsonb_build_object('user_id', v_owner,
                                         'linked_transfer_id', NULL,
                                         'linked_transfer_split_id', NULL)
               ELSE
                 e || jsonb_build_object('user_id', v_owner)
             END AS doc
        FROM jsonb_array_elements(p_rows) AS e
    ) AS stated;

  IF p_entity = 'accounts' THEN
    INSERT INTO public.accounts
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.accounts, v_rows) AS r;

  ELSIF p_entity = 'categories' THEN
    -- Sent level by level (type, then sub, then detail) so parent_id always
    -- resolves and categories_user_id_name_parent_id_key cannot be tripped by
    -- two same-named details under different parents.
    INSERT INTO public.categories
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.categories, v_rows) AS r;

  ELSIF p_entity = 'transactions' THEN
    INSERT INTO public.transactions
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.transactions, v_rows) AS r;

  ELSIF p_entity = 'transaction_splits' THEN
    INSERT INTO public.transaction_splits
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.transaction_splits, v_rows) AS r;

  ELSIF p_entity = 'budgets' THEN
    INSERT INTO public.budgets
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.budgets, v_rows) AS r;

  ELSIF p_entity = 'goals' THEN
    INSERT INTO public.goals
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.goals, v_rows) AS r;

  ELSIF p_entity = 'goal_contributions' THEN
    INSERT INTO public.goal_contributions
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.goal_contributions, v_rows) AS r;

  ELSIF p_entity = 'investments' THEN
    INSERT INTO public.investments
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.investments, v_rows) AS r;

  ELSIF p_entity = 'investment_transactions' THEN
    INSERT INTO public.investment_transactions
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.investment_transactions, v_rows) AS r;

  ELSIF p_entity = 'recurring_transactions' THEN
    -- The odd one out: user_id here is TEXT referencing
    -- user_profiles(clerk_user_id), not users(id). The uuid written above would
    -- be the wrong shape AND the wrong identity, so overwrite it again.
    v_clerk := public.requesting_clerk_id();
    IF v_clerk IS NULL THEN
      RAISE EXCEPTION 'clerk_identity_unknown: recurring templates are keyed by sign-in identity and this session has none'
        USING ERRCODE = '42501';
    END IF;
    SELECT jsonb_agg(e || jsonb_build_object('user_id', v_clerk))
      INTO v_rows
      FROM jsonb_array_elements(v_rows) AS e;
    INSERT INTO public.recurring_transactions
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.recurring_transactions, v_rows) AS r;

  ELSIF p_entity = 'notifications' THEN
    INSERT INTO public.notifications
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.notifications, v_rows) AS r;

  ELSIF p_entity = 'dashboard_layouts' THEN
    INSERT INTO public.dashboard_layouts
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.dashboard_layouts, v_rows) AS r;

  ELSIF p_entity = 'widget_preferences' THEN
    INSERT INTO public.widget_preferences
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.widget_preferences, v_rows) AS r;

  ELSIF p_entity = 'suggestion_dismissals' THEN
    INSERT INTO public.suggestion_dismissals
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.suggestion_dismissals, v_rows) AS r;

  ELSIF p_entity = 'custom_reports' THEN
    INSERT INTO public.custom_reports
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.custom_reports, v_rows) AS r;

  ELSE
    RAISE EXCEPTION 'restore_entity_unknown: "%" is not something this backup format carries', p_entity
      USING ERRCODE = '22023';
  END IF;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.restore_user_chunk(text, jsonb, uuid) IS
  'Inserts one entity''s whole rows from a backup, re-owning each to the caller. Refuses unless the login is empty (checked when entity = accounts). INSERT-only, so updated_at survives. Globally-unique provider ids are stripped; self-references and the transactions<->splits cycle are deferred to finalize_user_restore. Not balance-neutral: accounts.balance is restored verbatim and is authoritative. Carries fifteen entities as of 20260812140000, custom_reports being the newest.';

COMMIT;

-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- 1. The table exists with RLS on and every one of the four commands covered.
--    Expected: one row, rls_enabled = true, commands = 'DELETE, INSERT, SELECT,
--    UPDATE'.
SELECT
  c.relname,
  c.relrowsecurity AS rls_enabled,
  (SELECT string_agg(p.cmd, ', ' ORDER BY p.cmd) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'custom_reports') AS commands
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'custom_reports';

-- 2. Every policy scopes to the owner and to `authenticated` alone. Expected:
--    four rows, roles = {authenticated}, and requesting_user_id() named in
--    every qualifier. A policy reading USING (true) here is the June 2026
--    isolation failure returning; there must be none.
SELECT policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'custom_reports'
 ORDER BY cmd, policyname;

-- 3. Privileges. Expected: exactly `authenticated` and `service_role`; neither
--    PUBLIC nor anon.
SELECT
  'public.custom_reports' AS relation,
  string_agg(DISTINCT grantee::text, ', ' ORDER BY grantee::text) AS granted_to
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'custom_reports';

-- 4. The constraints that keep this table what it says it is. Expected: four
--    rows — the blank-name check, the array check, the object check and the
--    size check.
SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid = 'public.custom_reports'::regclass
   AND conname LIKE 'custom_reports_%'
 ORDER BY conname;

-- 5. Both redefined functions now know about the table. Expected: two rows,
--    restore_user_chunk and wipe_user_financial_data. If either is missing, the
--    CREATE OR REPLACE above did not take and a restore will refuse the entity
--    ("restore_entity_unknown") while a wipe silently leaves reports behind to
--    be duplicated by the next one.
SELECT p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('restore_user_chunk', 'wipe_user_financial_data')
   AND pg_get_functiondef(p.oid) ILIKE '%custom_reports%'
 ORDER BY p.proname;

-- 6. The restore still carries everything it carried before. Expected: 15 —
--    the fourteen entities 20260807083000 handled plus custom_reports. A lower
--    number means this file's copy of the function dropped a branch.
SELECT count(*) AS entities_handled
  FROM regexp_matches(
         pg_get_functiondef(to_regprocedure('public.restore_user_chunk(text, jsonb, uuid)')),
         'INSERT INTO public\.', 'g');

-- 7. Nothing has been written yet. Expected: zero rows immediately after
--    applying. Afterwards this is one row per report anyone has composed, and
--    `components` is how many blocks it is made of — work that until today
--    lived in one browser's localStorage and was one "clear site data" from
--    being gone.
SELECT
  u.email,
  r.name,
  jsonb_array_length(r.components) AS components,
  length(r.components::text) + length(r.filters::text) AS definition_bytes,
  r.updated_at
FROM public.custom_reports r
JOIN public.users u ON u.id = r.user_id
ORDER BY r.updated_at DESC;

-- 8. Preferences are still spared by the wipe. Expected: zero rows. This file
--    changed what the wipe touches, and the assertion 20260809160000 left
--    behind must still hold: "Delete all data" must not have become "and forget
--    how I read it".
SELECT p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname = 'wipe_user_financial_data'
   AND pg_get_functiondef(p.oid) ILIKE '%user_preferences%';
