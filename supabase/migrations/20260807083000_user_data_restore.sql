-- ============================================================================
-- Restore a user's financial data from a backup file
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). Safe to apply before the matching client
-- deploys, and no column changes. One EXISTING function is redefined —
-- update_updated_at_column — but only to add a guard on a session flag nothing
-- else sets, so a database with this applied and the old client running behaves
-- exactly as it does now.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- The app could export data and could never read it back. "Export everything"
-- wrote a file no code in the product can consume, so the safety net offered
-- before the MS Money migration ("replaces all current data") could not be
-- unpacked. A backup is defined by its restore; without one there was no backup.
--
-- ── WHY THE TARGET MUST BE EMPTY ────────────────────────────────────────────
-- This is the decision the whole file turns on, and it is not timidity.
--
-- Inserting an account fires create_transfer_category_for_account, which mints
-- a "To/From <name>" category with a FRESH uuid. The backup already contains
-- that category under its ORIGINAL uuid, and transactions.category holds that
-- uuid as text. Let the trigger fire and every transfer in the file points at a
-- category that no longer exists — or the insert dies on
-- categories_user_id_name_parent_id_key. No ordering avoids it while categories
-- already exist.
--
-- But that trigger returns early when the user has no level='type' Transfer
-- anchor (20260708140000:53). Zero categories means zero anchor means the
-- trigger no-ops — so the collision class disappears rather than being worked
-- around. The same precondition kills three more hazards for free: the seeded
-- default-category set cannot collide, transactions_import_source_unique cannot
-- collide with a previous import, and every write is an INSERT.
--
-- That last one matters more than it looks. Eleven update_*_updated_at triggers
-- stamp updated_at := now() on any UPDATE, so an upsert-based restore CANNOT
-- preserve updated_at — it would silently re-date a decade of history to the
-- day of the restore. INSERT-only is the only faithful path.
--
-- ── WHY THIS TAKES WHOLE ROWS ───────────────────────────────────────────────
-- Each branch below hands the incoming JSON straight to jsonb_populate_recordset
-- against the table's own rowtype, rather than naming columns. Naming them was
-- the first draft and it was wrong within the hour: goals has no
-- contribution_amount, investments spells it cost_basis not average_cost,
-- transaction_splits calls it memo not notes, suggestion_dismissals has
-- dismissed_at and no created_at. A hand-kept column list is a promise to get
-- that right forever, including for every column added after this is written —
-- and a restore that silently drops a column is worse than one that fails.
--
-- The contract this creates: the EXPORT must write whole rows (select *).
-- Missing keys arrive as SQL NULL, which a NOT NULL column will reject rather
-- than quietly default — loud, and in the right direction.
--
-- ── BALANCE REASONING ───────────────────────────────────────────────────────
-- Not balance-neutral, deliberately. No trigger maintains accounts.balance; it
-- is a stored column written explicitly by each RPC, and inserting transactions
-- moves nothing. The backup's own balance is restored verbatim and is
-- authoritative. That is correct rather than convenient: recomputing from
-- transactions would discard any balance reconciled against a statement, and
-- would differ from the source wherever archived history sits behind an
-- opening balance.
--
-- ── AUDIT REASONING ─────────────────────────────────────────────────────────
-- Restore writes ONE audit row for the whole operation, not one per transaction,
-- departing from the per-row rule set out in 20260805214322. That rule exists
-- because the log must answer "what happened to THIS transaction". Here the
-- honest answer for every row is identical and is a property of the operation,
-- not the row: it did not exist, then a restore created it. Fifty thousand rows
-- each saying so would bury the entries that carry real information.
-- The wipe that must precede a restore IS audited per row — there the per-row
-- answer differs, and it is the thing a user would later need to reconstruct.
-- ============================================================================

BEGIN;

-- ── Let updated_at survive a restore ────────────────────────────────────────
-- Eleven triggers share this function, and it is the reason a restore could not
-- be fully faithful: the second pass below MUST use UPDATE to close the link
-- cycles, and every UPDATE stamped now() over the row's real updated_at. A
-- backup that returns a decade of transfers dated today is not a backup.
--
-- The guard mirrors app.split_rpc (20260713100000): a session flag that only
-- this file's functions ever set, checked first, changing nothing for any other
-- caller. Deliberately NOT a blanket "skip when restoring" — set_config is
-- transaction-local (the `true` argument), so the exemption cannot leak beyond
-- the statement that opened it.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.restore_in_progress', true) = '1' THEN
    RETURN NEW;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_updated_at_column() IS
  'Maintains updated_at on UPDATE for eleven tables. Stands aside while app.restore_in_progress is set, so finalize_user_restore can close the link cycles without re-dating restored history. No other caller sets that flag.';


-- ── Is this account empty enough to restore into? ───────────────────────────
-- Exposed so the UI can say so BEFORE the user picks a file, rather than
-- letting them choose one and then refusing.
CREATE OR REPLACE FUNCTION public.user_financial_data_is_empty(
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_found boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.accounts
     WHERE (p_user_id IS NULL OR user_id = p_user_id)
    UNION ALL
    SELECT 1 FROM public.categories
     WHERE (p_user_id IS NULL OR user_id = p_user_id)
    UNION ALL
    SELECT 1 FROM public.transactions
     WHERE (p_user_id IS NULL OR user_id = p_user_id)
  ) INTO v_found;

  RETURN NOT v_found;
END;
$$;

COMMENT ON FUNCTION public.user_financial_data_is_empty(uuid) IS
  'True when the caller has no accounts, categories or transactions — the precondition restore_user_chunk enforces. Reads only; RLS scopes the rows.';


-- ── Clear the way for a restore ─────────────────────────────────────────────
-- Deliberately separate from the restore: destroying data is its own decision
-- and gets its own confirmation. Order matters — accounts go FIRST so categories
-- arrive by ON DELETE CASCADE with their parent account row already gone, which
-- makes protect_transfer_category_on_delete's EXISTS guard false. Deleting
-- categories directly while accounts remain raises transfer_category_protected
-- and the wipe stalls half-done.
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

  DELETE FROM public.suggestion_dismissals WHERE user_id = v_owner;
  DELETE FROM public.dashboard_layouts     WHERE user_id = v_owner;
  DELETE FROM public.widget_preferences    WHERE user_id = v_owner;
  DELETE FROM public.notifications         WHERE user_id = v_owner;

  RETURN v_counts;
END;
$$;

COMMENT ON FUNCTION public.wipe_user_financial_data(text, uuid) IS
  'Erases the caller''s financial data so a backup can be restored into a clean login. Requires the literal confirmation phrase. Deletes accounts first so cascaded category deletion clears protect_transfer_category_on_delete. Audits every transaction and account row individually before deleting. Returns per-table counts.';


-- ── Restore one entity's rows ───────────────────────────────────────────────
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
-- p_entity is matched against a fixed list; there is no dynamic SQL.
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
  v_owner uuid;
  v_clerk text;
  v_rows  jsonb;
  v_n     bigint := 0;
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

  -- Re-own every row to the caller, and strip the columns that must not travel:
  --   plaid_* are GLOBALLY unique, so restoring them collides with whoever
  --     exported the file;
  --   connection_id points at bank_connections, which a backup deliberately
  --     does not carry (it holds credentials);
  --   the two self-references and the transactions<->splits cycle are deferred
  --     to finalize_user_restore because no constraint here is DEFERRABLE.
  SELECT jsonb_agg(
           CASE p_entity
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
           END)
    INTO v_rows
    FROM jsonb_array_elements(p_rows) AS e;

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
  'Inserts one entity''s whole rows from a backup, re-owning each to the caller. Refuses unless the login is empty (checked when entity = accounts). INSERT-only, so updated_at survives. Globally-unique provider ids are stripped; self-references and the transactions<->splits cycle are deferred to finalize_user_restore. Not balance-neutral: accounts.balance is restored verbatim and is authoritative.';


-- ── Close the link cycles ───────────────────────────────────────────────────
-- Everything deferred above, patched once every row exists. These are UPDATEs,
-- so they re-stamp updated_at on the rows they touch — which is why only rows
-- that genuinely carry a link are updated, rather than the whole table.
CREATE OR REPLACE FUNCTION public.finalize_user_restore(
  p_links   jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner    uuid;
  v_accounts bigint := 0;
  v_txns     bigint := 0;
BEGIN
  v_owner := COALESCE(p_user_id, public.requesting_user_id());
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'owner_unknown: could not establish which login to finalise'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.split_rpc', '1', true);
  -- Keeps the UPDATEs below from re-dating restored history. Transaction-local,
  -- so it lapses the moment this call returns.
  PERFORM set_config('app.restore_in_progress', '1', true);

  IF p_links ? 'account_parents' THEN
    UPDATE public.accounts a
       SET parent_account_id = l.parent_account_id
      FROM jsonb_to_recordset(p_links->'account_parents')
             AS l(id uuid, parent_account_id uuid)
     WHERE a.id = l.id
       AND a.user_id = v_owner
       AND l.parent_account_id IS NOT NULL;
    GET DIAGNOSTICS v_accounts = ROW_COUNT;
  END IF;

  IF p_links ? 'transaction_links' THEN
    UPDATE public.transactions t
       SET linked_transfer_id       = l.linked_transfer_id,
           linked_transfer_split_id = l.linked_transfer_split_id
      FROM jsonb_to_recordset(p_links->'transaction_links')
             AS l(id uuid, linked_transfer_id uuid, linked_transfer_split_id uuid)
     WHERE t.id = l.id
       AND t.user_id = v_owner
       AND (l.linked_transfer_id IS NOT NULL
            OR l.linked_transfer_split_id IS NOT NULL);
    GET DIAGNOSTICS v_txns = ROW_COUNT;
  END IF;

  PERFORM public.write_financial_audit(
    v_owner, 'account', v_owner, 'update', NULL,
    jsonb_build_object('event', 'restore_completed',
                       'accounts_relinked', v_accounts,
                       'transactions_relinked', v_txns));

  RETURN jsonb_build_object('accounts_relinked', v_accounts,
                            'transactions_relinked', v_txns);
END;
$$;

COMMENT ON FUNCTION public.finalize_user_restore(jsonb, uuid) IS
  'Second pass of a restore: patches accounts.parent_account_id and the transactions linked_transfer_id / linked_transfer_split_id pair deferred because their constraints form cycles and none is DEFERRABLE. Balance-neutral. Writes one audit entry recording that a restore completed.';


-- ── Grants ──────────────────────────────────────────────────────────────────
-- FROM PUBLIC, anon — naming anon explicitly, because REVOKE ... FROM PUBLIC
-- alone does NOT remove Supabase's named default grant to anon (the trap
-- documented at length in 20260725120000). Re-running these is a no-op.
REVOKE ALL ON FUNCTION public.user_financial_data_is_empty(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_financial_data_is_empty(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.wipe_user_financial_data(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wipe_user_financial_data(text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.restore_user_chunk(text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_user_chunk(text, jsonb, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.finalize_user_restore(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_user_restore(jsonb, uuid) TO authenticated, service_role;

COMMIT;

-- ==== VERIFICATION — read this output after applying ====

-- 1. All four functions exist, are INVOKER, and pin search_path.
-- Expected: 4 rows, prosecdef = false, proconfig = {search_path=public}
SELECT p.proname, p.prosecdef, p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('user_financial_data_is_empty', 'wipe_user_financial_data',
                     'restore_user_chunk', 'finalize_user_restore')
 ORDER BY p.proname;

-- 2. Grants: authenticated + service_role only. Neither PUBLIC nor anon.
-- Expected: 8 rows (4 functions x 2 roles), no 'anon', no '-' (PUBLIC)
SELECT p.proname, a.grantee::regrole::text AS grantee, a.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 CROSS JOIN LATERAL aclexplode(p.proacl) AS a
 WHERE n.nspname = 'public'
   AND p.proname IN ('user_financial_data_is_empty', 'wipe_user_financial_data',
                     'restore_user_chunk', 'finalize_user_restore')
 ORDER BY p.proname, grantee;

-- 3. No constraint anywhere is DEFERRABLE — the assumption the two-pass restore
--    is built on. Expected: 0 rows.
SELECT conrelid::regclass AS tbl, conname
  FROM pg_constraint
 WHERE condeferrable
   AND connamespace = 'public'::regnamespace;

-- 4. The trigger this design depends on still returns early with no anchor.
-- Expected: 1 row, has_early_return = true
SELECT p.proname,
       position('IF transfer_type_id IS NULL' IN pg_get_functiondef(p.oid)) > 0
         AS has_early_return
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname = 'create_transfer_category_for_account';
