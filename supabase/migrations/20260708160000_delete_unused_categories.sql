-- Safe category pruning for the "switch to the Money set" import.
--
-- IMPORTANT: Run this SQL in the Supabase SQL Editor to apply to production DB.
-- Must be applied BEFORE the matching client deploys (the client fails closed
-- if the function is missing — the import succeeds but the prune reports an
-- error instead of falling back to an unguarded delete).
--
-- Why: the client plans which categories to remove from its in-memory
-- snapshot, but that snapshot can be silently incomplete (a cloud read that
-- fell back to an empty local cache). Deleting a category a transaction still
-- references orphans that transaction's categorization permanently —
-- transactions.category is TEXT with no FK. This RPC re-checks EVERYTHING
-- server-side, so a stale client can never destroy referenced data:
--   - never deletes type-level or transfer categories
--   - never deletes a category referenced by a transaction, budget, or
--     recurring transaction (by category text id, or budgets.category_id)
--   - never deletes a category that still has a child OUTSIDE the batch
--     (blocks the parent_id ON DELETE CASCADE from killing unseen children)
-- Rows failing any check are silently skipped; the count of actual deletions
-- is returned.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_unused_categories(
  p_ids uuid[],
  p_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.categories c
   WHERE c.id = ANY(p_ids)
     AND (p_user_id IS NULL OR c.user_id = p_user_id)
     AND c.level <> 'type'
     AND c.is_transfer_category IS NOT TRUE
     AND NOT EXISTS (
       SELECT 1 FROM public.transactions t
        WHERE t.user_id = c.user_id AND t.category = c.id::text
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.budgets b
        WHERE b.user_id = c.user_id
          AND (b.category = c.id::text OR b.category_id = c.id)
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.recurring_transactions r
        WHERE r.category = c.id::text
     )
     AND NOT EXISTS (
       -- A child that is NOT part of this batch keeps its parent alive.
       SELECT 1 FROM public.categories ch
        WHERE ch.parent_id = c.id
          AND NOT (ch.id = ANY(p_ids))
     );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_unused_categories(uuid[], uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_unused_categories(uuid[], uuid) TO authenticated, service_role;

COMMIT;
