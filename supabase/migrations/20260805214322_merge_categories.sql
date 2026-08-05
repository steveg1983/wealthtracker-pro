-- ============================================================================
-- CATEGORY MERGE — "these two are the same thing" becomes ONE transaction
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). Safe to apply before the matching client
-- deploys: everything here is a NEW function, nothing existing is redefined,
-- and no column changes. A database with this applied and the old client
-- running behaves exactly as it does now.
--
-- ── WHY: a merge is one intention, and it was five half-done writes ────────
--
-- Two categories that mean the same thing ("Groceries" and "Food Shopping")
-- are the commonest mess in imported history, and until now the only way to
-- join them was to DELETE one and use the reassignment dialog that appears —
-- a merge in disguise, and an incomplete one. That dialog moved whole
-- transactions (one HTTP round trip per row) and split lines, then deleted the
-- category. It never moved:
--
--   * budgets            — budgets.category is TEXT with no FK, so a budget
--                          pointing at the deleted category kept a dangling id
--                          and silently reported £0 spent for ever after;
--                          budgets.category_id (uuid, FK ON DELETE SET NULL)
--                          was quietly nulled instead;
--   * recurring templates — recurring_transactions.category, same TEXT-no-FK
--                          shape, same silent orphan;
--   * transactions.category_id — the uuid twin of the text column, also
--                          ON DELETE SET NULL.
--
-- And it was not atomic: a browser closed (or a token expired) between the row
-- updates and the delete left the history half-moved, with no record of which
-- half. For a ledger that is not untidiness, it is a hole in the compliance
-- artifact — financial_audit_log is supposed to answer "what happened to this
-- row and who did it", and for a partly-applied merge it could not.
--
-- merge_categories below moves EVERY reference and removes the source in one
-- database transaction. Either the user's history is joined or it is untouched;
-- there is no third outcome.
--
-- Balance-neutral by construction: no amount, sign or account_id is written by
-- any statement here, so no account balance arithmetic appears — the same
-- property (and the same reasoning) as link_transfer_pair and
-- repair_claimed_transfer.
--
-- ── AUDIT VOLUME: one entry per row, deliberately ──────────────────────────
--
-- A merge can rewrite thousands of transactions, so "one summary entry" is
-- tempting. It is also wrong, and the schema already settled the question:
-- apply_category_to_uncategorized (20260708100000) is the other bulk
-- re-categorisation in this database, over exactly the same kind of row
-- volume (a payee fan-out across a whole import), and it writes one
-- financial_audit_log entry per row changed. So does set_transactions_cleared,
-- and so does clear_transfer_links. The log's job is to answer "what happened
-- to THIS transaction"; a summary row cannot answer it for any of them.
--
-- Split lines follow the other half of the house pattern: set_transaction_splits
-- audits a split at its PARENT transaction, with the whole line set embedded in
-- before/after. This does the same — one entry per affected parent, carrying
-- the before and after line sets — rather than inventing a per-line entity that
-- nothing else in the schema writes.
--
-- The source category's removal gets its own entry (entity 'category', action
-- 'delete'), which is the line that says "the merge happened, and when".
-- ============================================================================

BEGIN;

-- ── merge_categories: every reference moves, or none does ───────────────────
--
--   p_source_id  the category being merged away — it is removed at the end;
--   p_target_id  the category everything is filed under afterwards;
--   p_user_id    the usual defence-in-depth owner guard (RLS scopes the rows;
--                this makes a mis-routed id fail closed one step earlier).
--
-- Returns the counts of what actually moved, as jsonb, so the client reports
-- what the database did rather than what it predicted:
--   {transactions, split_lines, split_transactions, budgets, recurring}
--
-- Error style follows split_amount_locked (20260713100000) and
-- repair_claimed_transfer (20260805145035): a machine-readable code, then the
-- sentence the user actually needs. The client surfaces error.message verbatim,
-- so a bare code would reach a human toast.
CREATE OR REPLACE FUNCTION public.merge_categories(
  p_source_id uuid,
  p_target_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_source public.categories;
  v_target public.categories;
  v_owner  uuid;
  v_old_txn       public.transactions;
  v_new_txn       public.transactions;
  v_parent        public.transactions;
  v_old_budget    public.budgets;
  v_new_budget    public.budgets;
  v_old_recurring public.recurring_transactions;
  v_new_recurring public.recurring_transactions;
  v_before_splits jsonb;
  v_after_splits  jsonb;
  v_lines_moved      integer;
  v_transactions     integer := 0;
  v_split_lines      integer := 0;
  v_split_parents    integer := 0;
  v_budgets          integer := 0;
  v_recurring        integer := 0;
BEGIN
  IF p_source_id IS NULL OR p_target_id IS NULL THEN
    RAISE EXCEPTION 'merge_needs_two_categories: a merge needs the category to merge away and the category to merge it into'
      USING ERRCODE = '22023';
  END IF;
  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'merge_source_is_target: a category cannot be merged into itself'
      USING ERRCODE = '22023';
  END IF;

  -- Lock both rows up front, in id order, so concurrent merges take them the
  -- same way round (and a merge cannot race the deletion of its own target).
  PERFORM 1 FROM public.categories
   WHERE id IN (p_source_id, p_target_id)
     AND (p_user_id IS NULL OR user_id = p_user_id)
   ORDER BY id
   FOR UPDATE;

  SELECT * INTO v_source FROM public.categories
   WHERE id = p_source_id AND (p_user_id IS NULL OR user_id = p_user_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'category_not_found' USING ERRCODE = 'P0002',
      HINT = 'The category being merged away no longer exists, or is not yours.';
  END IF;

  SELECT * INTO v_target FROM public.categories
   WHERE id = p_target_id AND (p_user_id IS NULL OR user_id = p_user_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'category_not_found' USING ERRCODE = 'P0002',
      HINT = 'The category being merged into no longer exists, or is not yours.';
  END IF;

  v_owner := v_source.user_id;
  IF v_target.user_id <> v_owner THEN
    RAISE EXCEPTION 'categories belong to different users' USING ERRCODE = '28000';
  END IF;

  -- ── What may not be merged AWAY ──────────────────────────────────────────
  IF v_source.level = 'type' THEN
    RAISE EXCEPTION 'merge_source_is_type_root: "%" is a top-level heading, not a category things are filed under', v_source.name
      USING ERRCODE = 'P0001';
  END IF;
  IF v_source.is_transfer_category IS TRUE THEN
    RAISE EXCEPTION 'merge_source_is_transfer_category: transfer categories are managed automatically from their account — close the account instead'
      USING ERRCODE = 'P0001';
  END IF;
  -- Revaluation leaves and anything else the app files under by itself: the
  -- code resolves these by flag, so merging one away would break a write path,
  -- not just a report.
  IF v_source.is_revaluation_category IS TRUE OR v_source.is_system IS TRUE THEN
    RAISE EXCEPTION 'merge_source_is_system_category: "%" is a built-in category the app files transactions under automatically, so it cannot be merged away', v_source.name
      USING ERRCODE = 'P0001';
  END IF;
  -- The import's Unassigned bucket means "NOT categorised" (20260724100000).
  -- Merging it into a real category would file every unreviewed row as
  -- something the user never chose — the exact guess that flag exists to stop.
  IF v_source.is_unassigned_bucket IS TRUE THEN
    RAISE EXCEPTION 'merge_source_is_unassigned_bucket: rows in "%" are not categorised at all — file them from the review band rather than merging the whole bucket into a real category', v_source.name
      USING ERRCODE = 'P0001';
  END IF;
  -- v1 is leaf-to-leaf. A category with children is a GROUP, and merging one
  -- means re-parenting its children as well — a different operation, with its
  -- own consequences to explain. Refused loudly rather than half-done.
  IF EXISTS (SELECT 1 FROM public.categories WHERE parent_id = p_source_id) THEN
    RAISE EXCEPTION 'merge_source_has_children: "%" has categories under it — merging a whole group is not supported yet; merge its detail categories one at a time, or move them first', v_source.name
      USING ERRCODE = 'P0001';
  END IF;

  -- ── What may not be merged INTO ──────────────────────────────────────────
  IF v_target.level = 'type' THEN
    RAISE EXCEPTION 'merge_target_is_type_root: "%" is a top-level heading — nothing is filed against one', v_target.name
      USING ERRCODE = 'P0001';
  END IF;
  IF v_target.is_transfer_category IS TRUE THEN
    RAISE EXCEPTION 'merge_target_is_transfer_category: "%" belongs to an account''s transfer bookkeeping — filing ordinary transactions there would invent transfers that never happened', v_target.name
      USING ERRCODE = 'P0001';
  END IF;
  IF v_target.is_unassigned_bucket IS TRUE THEN
    RAISE EXCEPTION 'merge_target_is_unassigned_bucket: "%" means "not categorised" — merging into it would un-file transactions that are already filed', v_target.name
      USING ERRCODE = 'P0001';
  END IF;
  IF v_target.is_active IS FALSE THEN
    RAISE EXCEPTION 'merge_target_inactive: "%" is hidden, so nothing can be filed under it — pick a category that is in use', v_target.name
      USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.categories WHERE parent_id = p_target_id) THEN
    RAISE EXCEPTION 'merge_target_is_group: "%" is a group, and transactions belong to a category inside it — pick one of its detail categories', v_target.name
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Direction ────────────────────────────────────────────────────────────
  -- income → income, expense → expense. A 'both' target (a revaluation leaf,
  -- an unparented "other" category) takes either, because it carries no
  -- direction of its own; a 'both' SOURCE cannot go to a directional target,
  -- since its rows may point both ways and half of them would land on the
  -- wrong side of every report.
  IF v_target.type <> 'both' AND v_target.type <> v_source.type THEN
    RAISE EXCEPTION 'merge_direction_mismatch: "%" is an % category and "%" is an % one — merging across the two would file money on the wrong side of every report',
      v_source.name, v_source.type, v_target.name, v_target.type
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 1. Whole transactions ────────────────────────────────────────────────
  -- Both reference columns move together. The CASE on `category` matters for a
  -- SPLIT parent reached through the uuid column: its category is blank BY
  -- DESIGN, and protect_split_transaction_fields (20260713100000) rejects any
  -- update that gives a split parent a category — leaving the blank alone is
  -- what lets that row's category_id move without tripping the guard.
  FOR v_old_txn IN
    SELECT * FROM public.transactions
     WHERE user_id = v_owner
       AND (category = p_source_id::text OR category_id = p_source_id)
     ORDER BY id     -- concurrent calls walk the rows the same way
     FOR UPDATE
  LOOP
    UPDATE public.transactions
       SET category    = CASE WHEN category = p_source_id::text
                              THEN p_target_id::text ELSE category END,
           category_id = CASE WHEN category_id = p_source_id
                              THEN p_target_id ELSE category_id END,
           updated_at  = now()
     WHERE id = v_old_txn.id
    RETURNING * INTO v_new_txn;

    PERFORM public.write_financial_audit(
      v_owner, 'transaction', v_new_txn.id, 'update',
      to_jsonb(v_old_txn), to_jsonb(v_new_txn)
    );

    v_transactions := v_transactions + 1;
  END LOOP;

  -- ── 2. Split lines, audited on their parent ──────────────────────────────
  -- The parent is locked (not just read) so a concurrent set_transaction_splits
  -- cannot rewrite the line set between the two snapshots. Amounts are
  -- untouched, so the sum invariant the splits schema enforces still holds and
  -- no balance moves. Two lines of the same parent landing on the SAME target
  -- category is left as two lines: their memos and their history are the
  -- user's, and silently adding them together would destroy both.
  FOR v_parent IN
    SELECT t.* FROM public.transactions t
     WHERE t.user_id = v_owner
       AND t.id IN (
         SELECT s.transaction_id FROM public.transaction_splits s
          WHERE s.user_id = v_owner AND s.category = p_source_id::text
       )
     ORDER BY t.id
     FOR UPDATE
  LOOP
    SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb)
      INTO v_before_splits
      FROM public.transaction_splits s
     WHERE s.transaction_id = v_parent.id;

    UPDATE public.transaction_splits
       SET category = p_target_id::text,
           updated_at = now()
     WHERE transaction_id = v_parent.id
       AND category = p_source_id::text;
    GET DIAGNOSTICS v_lines_moved = ROW_COUNT;

    -- A parent whose lines moved on under us between the lookup and the lock
    -- gets no write and no audit entry — the same "no write, no audit noise"
    -- rule clear_transfer_links follows, and it keeps the returned counts true.
    IF v_lines_moved > 0 THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb)
        INTO v_after_splits
        FROM public.transaction_splits s
       WHERE s.transaction_id = v_parent.id;

      PERFORM public.write_financial_audit(
        v_owner, 'transaction', v_parent.id, 'update',
        to_jsonb(v_parent) || jsonb_build_object('splits', v_before_splits),
        to_jsonb(v_parent) || jsonb_build_object('splits', v_after_splits)
      );

      v_split_lines   := v_split_lines + v_lines_moved;
      v_split_parents := v_split_parents + 1;
    END IF;
  END LOOP;

  -- ── 3. Budgets ───────────────────────────────────────────────────────────
  -- The surface the delete-and-reassign dialog never moved. Audited like the
  -- rest: budgets have no other audited write path today, and this one is not
  -- going to be the first silent change to what a budget measures.
  FOR v_old_budget IN
    SELECT * FROM public.budgets
     WHERE user_id = v_owner
       AND (category = p_source_id::text OR category_id = p_source_id)
     ORDER BY id
     FOR UPDATE
  LOOP
    UPDATE public.budgets
       SET category    = CASE WHEN category = p_source_id::text
                              THEN p_target_id::text ELSE category END,
           category_id = CASE WHEN category_id = p_source_id
                              THEN p_target_id ELSE category_id END,
           updated_at  = now()
     WHERE id = v_old_budget.id
    RETURNING * INTO v_new_budget;

    PERFORM public.write_financial_audit(
      v_owner, 'budget', v_new_budget.id, 'update',
      to_jsonb(v_old_budget), to_jsonb(v_new_budget)
    );

    v_budgets := v_budgets + 1;
  END LOOP;

  -- ── 4. Recurring templates ───────────────────────────────────────────────
  -- recurring_transactions.user_id is the CLERK id (text), not the uuid every
  -- other table here uses, so these rows cannot be scoped by v_owner. They do
  -- not need to be: a category id is a globally unique uuid, so matching on it
  -- can only reach this owner's templates — the same reasoning
  -- delete_unused_categories (20260708160000) relies on. RLS
  -- (requesting_clerk_id) is the second lock.
  FOR v_old_recurring IN
    SELECT * FROM public.recurring_transactions
     WHERE category = p_source_id::text
     ORDER BY id
     FOR UPDATE
  LOOP
    UPDATE public.recurring_transactions
       SET category = p_target_id::text,
           updated_at = now()
     WHERE id = v_old_recurring.id
    RETURNING * INTO v_new_recurring;

    PERFORM public.write_financial_audit(
      v_owner, 'recurring_transaction', v_new_recurring.id, 'update',
      to_jsonb(v_old_recurring), to_jsonb(v_new_recurring)
    );

    v_recurring := v_recurring + 1;
  END LOOP;

  -- ── 5. Nothing may still point at the source ─────────────────────────────
  -- The invariant that makes the delete safe, checked rather than assumed: if
  -- a reference surface is ever added and this function is not taught about
  -- it, the merge fails loudly here instead of orphaning that reference
  -- silently. The raise aborts the whole call, so "nothing has changed" is
  -- literally true — every move above rolls back with it.
  IF EXISTS (
       SELECT 1 FROM public.transactions
        WHERE user_id = v_owner
          AND (category = p_source_id::text OR category_id = p_source_id))
     OR EXISTS (
       SELECT 1 FROM public.transaction_splits
        WHERE user_id = v_owner AND category = p_source_id::text)
     OR EXISTS (
       SELECT 1 FROM public.budgets
        WHERE user_id = v_owner
          AND (category = p_source_id::text OR category_id = p_source_id))
     OR EXISTS (
       SELECT 1 FROM public.recurring_transactions
        WHERE category = p_source_id::text)
     OR EXISTS (
       SELECT 1 FROM public.categories WHERE parent_id = p_source_id)
  THEN
    RAISE EXCEPTION 'merge_left_references: something still refers to "%" after the move, so nothing has been changed', v_source.name
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 6. The source goes ───────────────────────────────────────────────────
  -- A hard delete, because that is what deleting a category already does
  -- (PlanningService.deleteCategory). is_active is NOT the convention here: it
  -- is the account lifecycle's way of hiding a closed account's transfer
  -- category, and a deactivated leftover would sit in this user's tree for ever
  -- meaning nothing.
  DELETE FROM public.categories
   WHERE id = p_source_id AND user_id = v_owner;

  PERFORM public.write_financial_audit(
    v_owner, 'category', v_source.id, 'delete', to_jsonb(v_source), NULL
  );

  RETURN jsonb_build_object(
    'source_id',          p_source_id,
    'target_id',          p_target_id,
    'transactions',       v_transactions,
    'split_lines',        v_split_lines,
    'split_transactions', v_split_parents,
    'budgets',            v_budgets,
    'recurring',          v_recurring
  );
END;
$$;

COMMENT ON FUNCTION public.merge_categories(uuid, uuid, uuid) IS
  'Joins two categories in ONE transaction: moves every reference (transactions.category/category_id, transaction_splits.category, budgets.category/category_id, recurring_transactions.category) from source to target, verifies nothing still points at the source, then deletes it. Balance-neutral. One financial_audit_log entry per row moved (splits audited on their parent, as set_transaction_splits does), plus a category delete entry. Refuses groups, type roots, transfer/system/unassigned categories and cross-direction merges.';

-- ── Grants ──────────────────────────────────────────────────────────────────
-- FROM PUBLIC, anon — naming anon explicitly, because REVOKE ... FROM PUBLIC
-- alone does NOT remove Supabase's named default grant to anon (the trap
-- documented at length in 20260725120000). Re-running these is a no-op.
REVOKE ALL ON FUNCTION public.merge_categories(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_categories(uuid, uuid, uuid) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- Expected: one row, showing `authenticated, service_role` and neither PUBLIC
-- nor anon.
SELECT
  format('%I.%I(%s)', n.nspname, p.proname,
         pg_get_function_identity_arguments(p.oid)) AS routine,
  COALESCE(
    (SELECT string_agg(DISTINCT COALESCE(g.rolname, 'PUBLIC'), ', ')
       FROM aclexplode(p.proacl) a
       LEFT JOIN pg_roles g ON g.oid = a.grantee
      WHERE a.privilege_type = 'EXECUTE'
        AND COALESCE(g.rolname, 'PUBLIC') IN ('PUBLIC', 'anon', 'authenticated', 'service_role')),
    '—'
  ) AS execute_granted_to
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'merge_categories'
ORDER BY 1;
