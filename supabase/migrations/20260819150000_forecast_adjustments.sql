-- ============================================================================
-- FORECAST ADJUSTMENTS — the scenario's stated deviations from the base
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ORDERING: apply AFTER 20260819130000_forecast_exclusions.sql (the timestamps
-- order them; one `npm run db:migrate` applies both), and BEFORE the matching
-- client deploys. A database with this applied and the old client running
-- behaves exactly as now — nothing reads the new table until a client that
-- knows about it arrives.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- The forecast is a SCENARIO TOOL (owner's ruling, 17 Aug —
-- docs/forecast-direction.md): the user plays against the twelve-month base,
-- and every deviation is STATED — "Food at £900 a month, base says £843" —
-- because a scenario whose adjustments cannot be interrogated is Design's
-- named failure mode. This table is those deviations: one row per category
-- the user has adjusted, holding the monthly figure the scenario uses in
-- place of the base average. No row here changes a register, a budget or a
-- report — the scenario READS the base and lays these on top, and Budget is
-- only ever written by the user''s explicit stage-2 promotion, which does not
-- exist yet.
--
-- ── WHY A RELATIONAL TABLE AND NOT A JSONB DOCUMENT ─────────────────────────
--
-- The obvious shape is one row holding {categoryId: monthly} — and it is the
-- wrong one, for a reason measured in the backup format rather than argued
-- from taste. remapBackupIds rewrites row ids on restore through three
-- declared mechanisms (uuid columns, id arrays, named arrays INSIDE a jsonb
-- value); the KEYS of a jsonb object are deliberately none of them. A
-- document keyed by category ids would restore verbatim into a login whose
-- categories have fresh ids and silently adjust nothing. As a table, the
-- reference is a plain uuid column — the remapper''s simplest case — a
-- dangling one is REPORTED, and ON DELETE CASCADE means an adjustment dies
-- with its category instead of lingering as a phantom judgment.
--
-- `monthly_minor` is a bigint of pennies: the one representation both engines
-- hold exactly, per the local schema''s money discipline.
--
-- ── SAFE TO RUN TWICE? ──────────────────────────────────────────────────────
-- No — guard 2 refuses a second run by name, exactly as 20260812140000 does
-- and for its reason.
-- ============================================================================

BEGIN;

-- ── Guard 1: this is the database this migration was written against ────────
DO $g$
BEGIN
  IF to_regprocedure('public.requesting_user_id()') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_requesting_user_id: public.requesting_user_id() does not exist, so this database predates 20260610130000_restore_rls_data_isolation and cannot express owner-only policies.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply the migrations in order with `npm run db:migrate`.';
  END IF;
  IF to_regclass('public.categories') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_categories: public.categories does not exist, so an adjustment has nothing to reference.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply 20251030003814__initial-schema.sql first.';
  END IF;
END;
$g$;

-- ── Guard 2: refuse a double-run, by name ───────────────────────────────────
DO $g$
BEGIN
  IF to_regclass('public.forecast_adjustments') IS NOT NULL THEN
    RAISE EXCEPTION 'forecast_adjustments_already_exists: this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001',
            HINT = 'If something needs changing, write a new migration for it.';
  END IF;
END;
$g$;

-- ── Guard 3: the shared updated_at trigger is the one expected ──────────────
DO $g$
DECLARE
  v_body text;
BEGIN
  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_update_updated_at_column: forecast_adjustments.updated_at would never be stamped.'
      USING ERRCODE = 'P0001';
  END IF;
  SELECT pg_get_functiondef(to_regprocedure('public.update_updated_at_column()')) INTO v_body;
  IF v_body !~* 'updated_at' THEN
    RAISE EXCEPTION 'update_updated_at_column_not_recognised: the shared trigger function no longer mentions updated_at.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$g$;

-- ── Guard 4: the two functions this file redefines actually exist ───────────
DO $g$
BEGIN
  IF to_regprocedure('public.restore_user_chunk(text, jsonb, uuid)') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_restore_user_chunk: this database predates 20260807083000_user_data_restore — the redefinition below would create a PARTIAL restore path rather than extend a whole one.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply the migrations in order with `npm run db:migrate`.';
  END IF;
  IF to_regprocedure('public.wipe_user_financial_data(text, uuid)') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_wipe_user_financial_data: this database predates 20260807083000_user_data_restore.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$g$;

-- ── Guard 5: the copies below were taken from the LATEST definitions ────────
-- The rule 20260812140000 wrote after making this mistake once: when
-- redefining a shared function, take the text from the LATEST migration that
-- defines it, never from the one that created it. These copies were taken
-- from 20260812140000 itself, whose marker in both functions is the
-- custom_reports branch — absent, and the database''s current functions are
-- not the ones these copies extend.
DO $g$
BEGIN
  IF pg_get_functiondef(to_regprocedure('public.restore_user_chunk(text, jsonb, uuid)'))
       NOT LIKE '%custom_reports%' THEN
    RAISE EXCEPTION 'restore_user_chunk_predates_20260812140000: replacing it with this file''s copy would be a downgrade rather than an extension.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply 20260812140000_reports_outlive_the_browser.sql first, with `npm run db:migrate`.';
  END IF;
  IF pg_get_functiondef(to_regprocedure('public.wipe_user_financial_data(text, uuid)'))
       NOT LIKE '%custom_reports%' THEN
    RAISE EXCEPTION 'wipe_user_financial_data_predates_20260812140000: replacing it with this file''s copy would be a downgrade rather than an extension.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply 20260812140000_reports_outlive_the_browser.sql first, with `npm run db:migrate`.';
  END IF;
END;
$g$;

-- ── The table ───────────────────────────────────────────────────────────────

CREATE TABLE public.forecast_adjustments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- The category whose monthly figure the scenario overrides. CASCADE: an
  -- adjustment of a deleted category adjusts nothing and must not linger.
  category_id   uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,

  -- The scenario''s monthly figure for that category, in PENNIES — a bigint,
  -- because an integer of minor units is the one representation of money both
  -- engines hold exactly. Non-negative: a scenario states what a category
  -- will cost or bring, and a negative monthly figure is a different category.
  monthly_minor bigint NOT NULL CHECK (monthly_minor >= 0),

  -- Nullable for restore_user_chunk''s reason, argued at length on
  -- custom_reports: rows arrive through jsonb_populate_recordset, absent keys
  -- become SQL NULL, and NOT NULL here would refuse a file whose rows lack a
  -- timestamp — the one operation a user cannot afford to have fail.
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),

  -- ONE adjustment per category per user — the scenario is a single stated
  -- figure, not a history of edits (updated_at is the history''s one honest
  -- remnant). Doubles as the list''s index: every lookup here is by user.
  CONSTRAINT forecast_adjustments_one_per_category UNIQUE (user_id, category_id)
);

COMMENT ON TABLE public.forecast_adjustments IS
  'One row per category the user has adjusted in the forecast scenario: the monthly figure the scenario uses in place of the twelve-month base average. Holds no ledger data and changes no figure anywhere — the scenario reads the base and lays these on top, and Budget is only ever written by the explicit stage-2 promotion (docs/forecast-direction.md). Created by 20260819150000.';

COMMENT ON COLUMN public.forecast_adjustments.monthly_minor IS
  'The adjusted monthly figure in pennies (bigint). The category''s own income/expense type says which side it lands on; the amount is a magnitude.';

CREATE TRIGGER update_forecast_adjustments_updated_at
  BEFORE UPDATE ON public.forecast_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS: the owner, and nobody else ─────────────────────────────────────────
ALTER TABLE public.forecast_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forecast_adjustments_select_own ON public.forecast_adjustments;
CREATE POLICY forecast_adjustments_select_own ON public.forecast_adjustments
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS forecast_adjustments_insert_own ON public.forecast_adjustments;
CREATE POLICY forecast_adjustments_insert_own ON public.forecast_adjustments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS forecast_adjustments_update_own ON public.forecast_adjustments;
CREATE POLICY forecast_adjustments_update_own ON public.forecast_adjustments
  FOR UPDATE TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS forecast_adjustments_delete_own ON public.forecast_adjustments;
CREATE POLICY forecast_adjustments_delete_own ON public.forecast_adjustments
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Naming anon explicitly — REVOKE FROM PUBLIC alone does not remove Supabase''s
-- named default grant to anon (the 20260725120000 trap).
REVOKE ALL ON TABLE public.forecast_adjustments FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.forecast_adjustments TO authenticated;
GRANT ALL ON TABLE public.forecast_adjustments TO service_role;


-- ── The wipe learns about adjustments ───────────────────────────────────────
-- Redefined from 20260812140000 with ONE uncounted statement added beside the
-- dismissals. Everything else is that file''s text, unchanged.
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
  -- Uncounted, WITH the dismissals rather than with the counted reports,
  -- and the line the reports migration drew is why: an adjustment is a
  -- JUDGMENT about how the ledger is read ("this one-off is not my typical
  -- month"), not work the person authored. The local crate's wipe puts it
  -- in the same uncounted loop, so `npm run test:local-verbs` sees the two
  -- engines answer with the same keys.
  DELETE FROM public.forecast_adjustments  WHERE user_id = v_owner;
  DELETE FROM public.dashboard_layouts     WHERE user_id = v_owner;
  DELETE FROM public.widget_preferences    WHERE user_id = v_owner;
  DELETE FROM public.notifications         WHERE user_id = v_owner;

  RETURN v_counts;
END;
$$;

COMMENT ON FUNCTION public.wipe_user_financial_data(text, uuid) IS
  'Erases the caller''s financial data so a backup can be restored into a clean login. Requires the literal confirmation phrase. Deletes accounts first so cascaded category deletion clears protect_transfer_category_on_delete. Audits every transaction and account row individually before deleting. Clears custom_reports (counted — authored work) and forecast_adjustments (uncounted, with the dismissals — a judgment about how the ledger is read). Returns per-table counts.';


-- ── The restore learns about adjustments ────────────────────────────────────
-- Redefined from 20260812140000 with ONE branch added immediately before the
-- ELSE. Every other line is that file''s, unchanged — including the
-- catalogue-read defaults 20260811090000 added, which guard 5 protects.
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

  ELSIF p_entity = 'forecast_adjustments' THEN
    -- category_id was already rewritten on the client by remapBackupIds — a
    -- plain uuid column, the remapper's own simplest case, which is the whole
    -- reason this table is relational rather than a jsonb keyed by ids. The
    -- generic re-owning arm above is exactly right for it.
    INSERT INTO public.forecast_adjustments
    SELECT r.* FROM jsonb_populate_recordset(NULL::public.forecast_adjustments, v_rows) AS r;

  ELSE
    RAISE EXCEPTION 'restore_entity_unknown: "%" is not something this backup format carries', p_entity
      USING ERRCODE = '22023';
  END IF;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

COMMIT;


-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- 1. The table, its policies and its grants. Expected: rls_enabled = true,
--    four policies (DELETE, INSERT, SELECT, UPDATE), no anon privileges.
SELECT
  c.relrowsecurity AS rls_enabled,
  (SELECT string_agg(p.cmd, ', ' ORDER BY p.cmd) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'forecast_adjustments') AS commands
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'forecast_adjustments';

-- 2. Both functions now carry the forecast_adjustments branch AND still carry
--    custom_reports — extension, not downgrade. Expected: t, t.
SELECT
  pg_get_functiondef(to_regprocedure('public.restore_user_chunk(text, jsonb, uuid)')) LIKE '%forecast_adjustments%'
    AND pg_get_functiondef(to_regprocedure('public.restore_user_chunk(text, jsonb, uuid)')) LIKE '%custom_reports%' AS restore_extended,
  pg_get_functiondef(to_regprocedure('public.wipe_user_financial_data(text, uuid)')) LIKE '%forecast_adjustments%'
    AND pg_get_functiondef(to_regprocedure('public.wipe_user_financial_data(text, uuid)')) LIKE '%custom_reports%' AS wipe_extended;

-- 3. Adjustments held. Expected: zero immediately after applying.
SELECT count(*) AS adjustments FROM public.forecast_adjustments;
