-- ============================================================================
-- Restore — a backup is a snapshot of an OLDER schema, and it must still land
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). NO column changes, NO new objects, NO grant
-- widens, NO row rewritten. ONE existing function is restated whole —
-- restore_user_chunk — and its signature, its SECURITY INVOKER, its pinned
-- search_path and its grants are byte-for-byte what they already are.
--
-- ── WHY: A LIVE DATA-SAFETY DEFECT ──────────────────────────────────────────
-- EVERY BACKUP FILE EXPORTED BEFORE 2026-08-10 FAILS TO RESTORE TODAY.
--
--     ERROR: null value in column "needs_review" of relation "transactions"
--            violates not-null constraint
--
-- The mechanism, exactly:
--
--   1. 20260807083000 materialises a chunk with
--      `jsonb_populate_recordset(NULL::public.transactions, v_rows)`.
--   2. That function emits an EXPLICIT NULL for every column the JSON does not
--      mention. An explicit NULL is a value, and a value BYPASSES the column
--      default — `DEFAULT false` never runs, because the insert was not silent
--      about the column, it said NULL.
--   3. 20260810090000 added `needs_review boolean NOT NULL DEFAULT false`.
--   4. A file exported before step 3 has no `needs_review` key. So step 2 offers
--      NULL to a NOT NULL column and the whole chunk dies.
--
-- The user-visible shape of this is the worst one available: the safety net
-- offered before the MS Money migration ("replaces all current data") holds
-- until the day it is needed, and then refuses — and it refuses in language
-- about a column the user has never heard of, on the one operation there is no
-- second copy of.
--
-- ── THE ORIGINAL REASONING, AND WHERE IT WAS WRONG ──────────────────────────
-- 20260807083000:50-52 wrote the contract down and defended this behaviour:
--
--     "The contract this creates: the EXPORT must write whole rows (select *).
--      Missing keys arrive as SQL NULL, which a NOT NULL column will reject
--      rather than quietly default — loud, and in the right direction."
--
-- The first sentence is right and stays. The second is wrong, and it is wrong
-- because it silently assumes THE EXPORT AND THE SCHEMA ARE CONTEMPORARIES. A
-- backup is not a message from the current schema; it is a message from a past
-- one. `select *` did write whole rows — whole rows AS THEY WERE IN MAY. The
-- restore then judges that file against a schema from August and calls it
-- incomplete for not knowing the future.
--
-- "Loud, in the right direction" is also the wrong reading of the direction.
-- Loud is right when the alternative is silently WRONG DATA. Here the
-- alternative is a column default — a value the schema's own author wrote down
-- as the answer for a row that says nothing — so loud buys nothing and costs
-- the restore. Restore's contract is, and has to be:
--
--     AN OLDER BACKUP RESTORES INTO A NEWER SCHEMA, WITH THE SCHEMA'S OWN
--     DEFAULTS ANSWERING FOR WHAT THE PAST DID NOT KNOW.
--
-- ── WHY THIS IS NOT A ONE-COLUMN FIX ────────────────────────────────────────
-- Patching `needs_review` alone would fix today and reintroduce the defect the
-- next time anybody adds a flag. That is not hypothetical — it is exactly what
-- already happened. 20260810090000 is a careful migration: it reasons about
-- four functions it must carry the column into, about the backfill, about the
-- audit log, about the delta sync. It does not mention restore, and there is no
-- reason its author would have: restore is a function about no column in
-- particular, so nothing about adding a column points at it.
--
-- So the rule has to hold for columns that do not exist yet, which means it
-- cannot be a list. It is read from the schema itself, below.
--
-- ── THE RULE: OMITTED IS NOT THE SAME AS NULL ───────────────────────────────
-- jsonb tells the two apart (`?` is key presence) and this now turns on it:
--
--   KEY ABSENT
--     "the past did not know this column". Answered by the column default,
--     where the column has one it is safe to apply (see the next section).
--
--   KEY PRESENT, VALUE null, COLUMN NULLABLE
--     A DELIBERATE null. Kept, untouched. `transactions.is_reconciled` is the
--     case that proves this matters: 20260810200000 made NULL there MEAN
--     something ("this row predates the split between marking and committing;
--     ask is_cleared"), which is why that column is nullable on purpose. It is
--     nullable, so nothing below can reach it, so a restored row keeps NULL and
--     COALESCE(is_reconciled, is_cleared) goes on answering for history exactly
--     as it does for rows that were never exported at all.
--
--   KEY PRESENT, VALUE null, COLUMN NOT NULL
--     A file could never have LEGALLY produced this: the column refuses NULL,
--     so no row that was ever in the table could have been exported saying so.
--     It is either a hand-edited file or a client that wrote a key it had no
--     value for. The default is the only honest reading, and it is the same
--     answer the absent case gets, so the two are treated alike.
--
-- ── WHICH DEFAULTS ARE SAFE TO APPLY, AND WHICH ARE NOT ─────────────────────
-- Not every default may be used to fill a silence. Two must never be:
--
--   AN IDENTITY. `id uuid NOT NULL DEFAULT gen_random_uuid()`. Filling that in
--     would mint a FRESH id for a row whose id is what the rest of the file
--     points at — transaction_splits.transaction_id, categories.parent_id, the
--     link payload finalize_user_restore replays. The row would restore, and
--     everything referring to it would quietly refer to nothing. That is
--     silent corruption bought with a loud failure, which is the wrong trade in
--     the only direction that matters.
--
--   A TIME. `created_at timestamptz NOT NULL DEFAULT now()`. Filling that in
--     stamps the day of the restore onto history — the precise failure
--     20260807083000:35-38 built the whole INSERT-only design to avoid ("A
--     backup that returns a decade of transfers dated today is not a backup").
--
-- Both are the same kind of thing: a default that GENERATES a value rather than
-- stating one. And the catalogue already separates them, exactly, with no
-- judgement call and no list to keep:
--
--   A stored constant  -> pg_attrdef.adbin is a Const node   -> safe to apply
--   Anything else      -> a FuncExpr / SQLValueFunction node -> never applied
--
-- MEASURED on the reference cluster (17.10) across all fourteen restored
-- tables: 12 constants and 17 generated, split cleanly, no overlap —
--
--   FILLED IN (constant)                      NEVER FILLED IN (generated)
--   ---------------------------------------   ---------------------------------
--   accounts.low_balance_alert_enabled false   every table's id  (gen_random_uuid
--   categories.is_revaluation_category false                      / uuid_generate_v4)
--   categories.is_unassigned_bucket    false   suggestion_dismissals.dismissed_at now()
--   dashboard_layouts.widgets          '[]'    transaction_splits.created_at      now()
--   suggestion_dismissals.subject_ids  '{}'    transaction_splits.updated_at      now()
--   transaction_splits.sort_order      0
--   transactions.archived              false
--   transactions.category_confirmed    true
--   transactions.is_cleared            false
--   transactions.is_split              false
--   transactions.needs_review          false   <- the row this file is about
--   widget_preferences.settings        '{}'
--
-- Primary keys are excluded a SECOND time, by name, and that redundancy is
-- deliberate: today every id's default is generated so the Const test already
-- refuses them, but a primary key given a literal default would slip through a
-- test that only asks about constants, and identity is the one thing whose
-- silent replacement cannot be noticed afterwards.
--
-- ── NO MONEY CAN BE INVENTED BY THIS ────────────────────────────────────────
-- Balance-neutral, provably rather than by inspection, and it holds for two
-- independent reasons.
--
-- First, nothing below touches a balance statement: this migration adds no
-- arithmetic, and restore_user_chunk still contains none. accounts.balance
-- still arrives from the file verbatim and is still authoritative
-- (20260807083000:54-61).
--
-- Second, and this is the one that has to keep holding: EVERY money column on
-- every restored table is out of reach of the mechanism, and by construction
-- rather than by luck. A money column is one of two things here —
--
--   NOT NULL with NO default (transactions.amount, budgets.amount,
--     investments.quantity …): no default means nothing to fill in, so a file
--     that omits an amount is still refused, loudly, as it must be.
--   NULLABLE with a default (accounts.balance, accounts.initial_balance,
--     goals.current_amount, budgets.spent, investment_transactions.fees …):
--     nullable columns are never touched, so an omitted figure lands NULL and
--     is visibly absent rather than quietly 0.00.
--
-- Neither is NOT NULL WITH a default, which is the only class this fills in.
-- Verification 4 states that as a query rather than as a claim, so the next
-- person to add a money column finds out from the migration whether they have
-- moved it into reach.
--
-- ── THE ONE DYNAMIC STATEMENT, AND WHY IT IS ALLOWED HERE ───────────────────
-- 20260807083000:229 says "p_entity is matched against a fixed list; there is
-- no dynamic SQL", and that sentence is now half true, so it is restated
-- honestly: WHICH TABLE IS WRITTEN is still decided by the static ELSIF chain
-- and is still the only thing that decides it. What is dynamic is READING THE
-- SCHEMA'S OWN DEFAULTS, one `EXECUTE` per call, and it is safe for reasons
-- that are structural rather than careful:
--
--   * The statement is built ENTIRELY from the system catalogue. The only
--     caller-supplied value, p_entity, reaches it as an OID looked up by exact
--     name equality against pg_class — never concatenated, never parsed, so
--     there is no string for a caller to steer.
--   * The filter admits ONLY Const nodes, so the statement it builds can only
--     ever be a SELECT OF LITERALS. It cannot call a function, so it cannot
--     have a side effect, whatever is in the catalogue.
--   * Column names go through %I and the function is still SECURITY INVOKER
--     with search_path pinned to public, so the EXECUTE runs with exactly the
--     caller's own rights and RLS.
--
-- The alternative was a hand-written map of defaults per table. Rejected for
-- the reason at the top of this file: a hand-kept list is a promise to remember
-- restore every time anybody adds a column, and that promise has already been
-- broken once, by a careful person, in the migration that caused this bug. The
-- same argument 20260807083000:40-52 used to reject a hand-kept COLUMN list
-- applies with more force to a hand-kept DEFAULTS list, because a missing entry
-- there does not fail at review time, it fails at restore time, at the worst
-- possible moment, for one user, once.
--
-- IF THE READ FINDS NOTHING, NOTHING CHANGES. An empty defaults object merges
-- to a no-op and the function behaves exactly as it does today. So the failure
-- mode of the mechanism is "the bug is still there", never "the wrong data went
-- in" — and the guard below refuses to apply at all on a database where the
-- classification does not work, so that failure mode is not reached quietly.
-- ============================================================================

BEGIN;

-- ── Refuse, by name, unless this is the database these bodies were derived
--    from ─────────────────────────────────────────────────────────────────────
-- Same discipline as 20260810090000: a full restatement gives up the guarantee
-- that we are editing what is live rather than what we remember, so it is
-- bought back here.
DO $$
DECLARE
  v_src   text;
  v_const boolean;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'restore_user_chunk';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'restore_missing: expected restore_user_chunk to exist before changing how it fills a silence — apply 20260807083000_user_data_restore.sql first.'
      USING ERRCODE = 'P0002';
  END IF;

  -- The whole-row contract is what this body preserves. If it has been replaced
  -- by a hand-kept column list since, restating it would put the whole-row
  -- behaviour back over somebody's deliberate change.
  IF position('jsonb_populate_recordset' IN v_src) = 0 THEN
    RAISE EXCEPTION 'restore_not_whole_rows: restore_user_chunk no longer materialises rows through jsonb_populate_recordset — the body below assumes it does. Review by hand.'
      USING ERRCODE = 'P0001';
  END IF;

  -- The precondition the entire design rests on (20260807083000:17-38). It is
  -- restated verbatim below; if it is not live now, something removed it on
  -- purpose and this must not put it back silently.
  IF position('restore_target_not_empty' IN v_src) = 0 THEN
    RAISE EXCEPTION 'restore_precondition_absent: restore_user_chunk no longer refuses a login that holds data — review by hand rather than letting this restate it.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Not already done.
  IF position('v_defaults' IN v_src) > 0 THEN
    RAISE EXCEPTION 'restore_defaults_already_present: restore_user_chunk already fills omitted columns from their defaults — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── The classification itself, proved on THIS database ────────────────────
  -- `adbin::text LIKE '{CONST%'` reads the parsed default's node label, and it
  -- is load-bearing: it is the whole line between "a value the schema states"
  -- and "a value the schema generates". It is checked in BOTH directions here,
  -- against two columns of public.transactions that have existed since the
  -- initial schema, so this cannot be applied to a database where the test has
  -- stopped meaning what it means.
  --
  -- If a future Postgres ever renames that node, this refuses at apply time —
  -- which is the correct place to find out, and infinitely better than a
  -- restore that quietly stops filling anything in.
  SELECT d.adbin::text LIKE '{CONST%' INTO v_const
    FROM pg_attribute a
    JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE a.attrelid = 'public.transactions'::regclass AND a.attname = 'is_cleared';

  IF v_const IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'restore_constant_test_broken: transactions.is_cleared DEFAULT false is not being read as a stored constant, so this database would fill in nothing and the defect would remain. Do not apply.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT d.adbin::text LIKE '{CONST%' INTO v_const
    FROM pg_attribute a
    JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE a.attrelid = 'public.transactions'::regclass AND a.attname = 'id';

  IF v_const IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'restore_constant_test_unsafe: transactions.id DEFAULT uuid_generate_v4() is being read as a stored constant, which would let a restore MINT FRESH IDS for rows the rest of the file points at. Do not apply.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;


-- ── Restore one entity's rows ───────────────────────────────────────────────
-- 20260807083000_user_data_restore.sql:230-374 with THREE additions and no
-- deletions. Diff it and that is all there is:
--
--   1. three new DECLAREs (v_table, v_select, v_defaults);
--   2. the catalogue read that fills v_defaults;
--   3. the re-owning CASE moved, WORD FOR WORD, into a subquery so the merge
--      can be applied to its result. The declare block is realigned for the
--      longer names and the CASE is re-indented; neither changes a character
--      that executes.
--
-- Everything else is the live definition: every refusal, in the same order,
-- with the same names and the same wording; the same precondition on the same
-- entity; the same static whitelist deciding which table is written; the same
-- INSERT-only writes, so updated_at still survives; the same single return of
-- ROW_COUNT.
--
-- The two comments below that were true and are now incomplete are corrected in
-- place rather than left to be believed.
--
-- One call per entity, in the order the client sends them. Chunked rather than
-- one giant jsonb because a real dataset is 50k+ transactions — tens of
-- megabytes — and a single payload that size is a request-size cliff waiting to
-- be hit on the one operation a user cannot afford to have fail.
--
-- The trade-off is honest: chunks are not one transaction, so a mid-restore
-- failure leaves the login partly populated. That is survivable precisely
-- BECAUSE the target had to be empty — recovery is wipe and retry, and nothing
-- of the user's was ever at risk. It would not be survivable against a live
-- login, which is the other reason the precondition exists.
--
-- p_entity is matched against a fixed list, and that list is the ONLY thing
-- that decides which table is written. It reaches the catalogue read below as
-- an OID looked up by exact name equality — never as text in a statement.
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

  ELSE
    RAISE EXCEPTION 'restore_entity_unknown: "%" is not something this backup format carries', p_entity
      USING ERRCODE = '22023';
  END IF;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.restore_user_chunk(text, jsonb, uuid) IS
  'Inserts one entity''s whole rows from a backup, re-owning each to the caller. Refuses unless the login is empty (checked when entity = accounts). INSERT-only, so updated_at survives. Globally-unique provider ids are stripped; self-references and the transactions<->splits cycle are deferred to finalize_user_restore. A column the FILE does not mention is filled from the schema''s own default when that column is NOT NULL and its default is a stored constant outside the primary key — so a backup taken before a column existed still restores, while no identity, no timestamp and no figure is ever invented. A deliberate null on a nullable column is kept. Not balance-neutral: accounts.balance is restored verbatim and is authoritative.';


-- ── Grants ──────────────────────────────────────────────────────────────────
-- Restated, not assumed. CREATE OR REPLACE preserves an existing function's
-- ACL, so these are a no-op on a database that already has them — and the
-- correct grants on one that somehow does not. Naming anon explicitly because
-- REVOKE ... FROM PUBLIC alone does NOT remove Supabase's named default grant
-- to anon (the trap documented at length in 20260725120000).
REVOKE ALL ON FUNCTION public.restore_user_chunk(text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_user_chunk(text, jsonb, uuid) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- Verification — run after applying. NOTE: unapplied at the time of writing;
-- these are what to read, and what to expect, when it is.
-- ============================================================================

-- 1. The function kept its security posture and its grants. A restatement must
--    not quietly change SECURITY INVOKER or unpin search_path.
-- Expected: prosecdef = false, proconfig = {search_path=public}
SELECT p.proname, p.prosecdef, p.proconfig
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'restore_user_chunk';

-- Expected: authenticated and service_role, plus the owner's own entry, which
--           appears the moment an explicit ACL exists. Never anon, never
--           PUBLIC ('-').
SELECT a.grantee::regrole::text AS grantee, a.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 CROSS JOIN LATERAL aclexplode(p.proacl) AS a
 WHERE n.nspname = 'public' AND p.proname = 'restore_user_chunk'
 ORDER BY grantee;

-- 2. EXACTLY what a restore will now fill in, per restored table. This is the
--    audit the header's table was measured from; run it again after any
--    migration that adds a column, because it is the list that will have grown.
-- Expected today: 12 rows, every `filled_with` a literal, no id, no now().
SELECT c.relname AS tbl, a.attname AS col,
       format_type(a.atttypid, a.atttypmod) AS type,
       pg_get_expr(d.adbin, d.adrelid)      AS filled_with
  FROM pg_attribute a
  JOIN pg_class c     ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attrdef d   ON d.adrelid = a.attrelid AND d.adnum = a.attnum
 WHERE n.nspname = 'public'
   AND c.relname IN ('accounts','categories','transactions','transaction_splits',
                     'budgets','goals','goal_contributions','investments',
                     'investment_transactions','recurring_transactions',
                     'notifications','dashboard_layouts','widget_preferences',
                     'suggestion_dismissals')
   AND a.attnotnull
   AND d.adbin::text LIKE '{CONST%'
   AND NOT EXISTS (SELECT 1 FROM pg_index i
                    WHERE i.indrelid = a.attrelid AND i.indisprimary
                      AND a.attnum = ANY(i.indkey))
 ORDER BY c.relname, a.attnum;

-- 3. Nothing that GENERATES a value is in reach. The complement of query 2:
--    every id, and every now() — the identities and the times a restore must
--    never invent.
-- Expected: 17 rows, and every one of them is an id, a created_at, an
--           updated_at or a dismissed_at.
SELECT c.relname AS tbl, a.attname AS col,
       pg_get_expr(d.adbin, d.adrelid) AS never_filled_with
  FROM pg_attribute a
  JOIN pg_class c     ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attrdef d   ON d.adrelid = a.attrelid AND d.adnum = a.attnum
 WHERE n.nspname = 'public'
   AND c.relname IN ('accounts','categories','transactions','transaction_splits',
                     'budgets','goals','goal_contributions','investments',
                     'investment_transactions','recurring_transactions',
                     'notifications','dashboard_layouts','widget_preferences',
                     'suggestion_dismissals')
   AND a.attnotnull
   AND NOT (d.adbin::text LIKE '{CONST%'
            AND NOT EXISTS (SELECT 1 FROM pg_index i
                             WHERE i.indrelid = a.attrelid AND i.indisprimary
                               AND a.attnum = ANY(i.indkey)))
 ORDER BY c.relname, a.attnum;

-- 4. NO MONEY IS IN REACH. The header's second balance argument, as a query
--    rather than a claim: not one column this fills in is numeric.
--    A future NOT NULL numeric DEFAULT would appear here, and whoever added it
--    would then have to decide, on purpose, whether a restore may state a
--    figure the file did not.
-- Expected: zero rows, now and after every migration.
SELECT c.relname AS tbl, a.attname AS col,
       format_type(a.atttypid, a.atttypmod) AS type
  FROM pg_attribute a
  JOIN pg_class c     ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attrdef d   ON d.adrelid = a.attrelid AND d.adnum = a.attnum
 WHERE n.nspname = 'public'
   AND c.relname IN ('accounts','categories','transactions','transaction_splits',
                     'budgets','goals','goal_contributions','investments',
                     'investment_transactions','recurring_transactions',
                     'notifications','dashboard_layouts','widget_preferences',
                     'suggestion_dismissals')
   AND a.attnotnull
   AND d.adbin::text LIKE '{CONST%'
   AND NOT EXISTS (SELECT 1 FROM pg_index i
                    WHERE i.indrelid = a.attrelid AND i.indisprimary
                      AND a.attnum = ANY(i.indkey))
   AND a.atttypid IN ('numeric'::regtype, 'money'::regtype,
                      'double precision'::regtype, 'real'::regtype);

-- 5. is_reconciled is STILL out of reach, and stays out. 20260810200000 made
--    NULL there mean "this row predates the split; ask is_cleared", which only
--    survives a round trip while the column is nullable and therefore untouched
--    by the mechanism above.
-- Expected: one row — is_nullable = YES. If it ever reads NO, a restored
--           pre-split row would come back saying "explicitly not committed",
--           and the archive would change its mind about history.
SELECT column_name, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'transactions'
   AND column_name = 'is_reconciled';

-- 6. The balance invariant, untouched. This migration adds no arithmetic and
--    removes none; this is the check that proves it rather than asserting it.
-- Expected: zero rows
SELECT a.id, a.name, a.balance, a.initial_balance + COALESCE(t.total, 0) AS expected
  FROM public.accounts a
  LEFT JOIN (
    SELECT account_id, sum(amount) AS total
      FROM public.transactions
     GROUP BY account_id
  ) t ON t.account_id = a.id
 WHERE a.balance IS DISTINCT FROM a.initial_balance + COALESCE(t.total, 0);
