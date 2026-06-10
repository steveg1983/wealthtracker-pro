-- ============================================================================
-- CATEGORIES CLOUD SYNC — atomic id-migration RPC
-- ============================================================================
-- Until now categories lived ONLY in localStorage. The default set uses
-- non-UUID ids ('type-income', 'sub-groceries', …) that the uuid-PK
-- categories table cannot store — and transactions/budgets reference
-- categories through their TEXT `category` columns using those ids, so the
-- id translation and the reference remap MUST happen in one transaction or
-- transaction categorisation is orphaned.
--
-- migrate_categories_atomic() does the whole move per user:
--   1. generates a fresh uuid for every incoming category id
--   2. inserts the categories (parent links rewired through the same map;
--      two-phase so client ordering doesn't matter)
--   3. remaps transactions.category and budgets.category text references
--   4. returns the inserted rows
-- The same RPC seeds brand-new users (their default set goes through the
-- same path; the remap step simply matches nothing).
--
-- Also tightens the categories SELECT policy: the `OR is_system = true`
-- escape hatch made sense when system categories were imagined as shared
-- rows, but defaults are per-user copies — the old policy would have leaked
-- every user's default set to every other user.
-- ============================================================================

BEGIN;

-- ── Per-user-only SELECT (replaces the is_system leak) ──────────────────────
DROP POLICY IF EXISTS categories_select_own_or_system ON public.categories;
DROP POLICY IF EXISTS categories_select_own ON public.categories;
CREATE POLICY categories_select_own ON public.categories
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());

-- ── The atomic migration/seed RPC ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.migrate_categories_atomic(
  p_user_id uuid,
  p_categories jsonb
)
RETURNS SETOF public.categories
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_map jsonb := '{}'::jsonb;
  v_item jsonb;
  v_old_id text;
BEGIN
  -- Idempotency guard: a user who already has cloud categories must never be
  -- double-seeded (re-running would duplicate the tree and re-remap nothing).
  IF EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'categories_already_migrated' USING ERRCODE = 'P0003';
  END IF;

  IF p_categories IS NULL OR jsonb_typeof(p_categories) <> 'array'
     OR jsonb_array_length(p_categories) = 0 THEN
    RAISE EXCEPTION 'categories_payload_empty' USING ERRCODE = 'P0004';
  END IF;

  -- Pass 1: old id → fresh uuid for every category.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_categories) LOOP
    v_old_id := v_item->>'id';
    IF v_old_id IS NULL OR v_old_id = '' THEN
      RAISE EXCEPTION 'category_missing_id' USING ERRCODE = 'P0004';
    END IF;
    v_map := v_map || jsonb_build_object(v_old_id, gen_random_uuid()::text);
  END LOOP;

  -- Pass 2: insert rows (parent links deferred to pass 3 so the client does
  -- not need to send parents before children).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_categories) LOOP
    INSERT INTO public.categories (
      id, user_id, name, type, level, parent_id,
      color, icon, is_system, is_transfer_category, account_id, is_active
    ) VALUES (
      (v_map->>(v_item->>'id'))::uuid,
      p_user_id,
      v_item->>'name',
      v_item->>'type',
      v_item->>'level',
      NULL,
      v_item->>'color',
      v_item->>'icon',
      COALESCE((v_item->>'isSystem')::boolean, false),
      COALESCE((v_item->>'isTransferCategory')::boolean, false),
      NULLIF(v_item->>'accountId', '')::uuid,
      COALESCE((v_item->>'isActive')::boolean, true)
    );
  END LOOP;

  -- Pass 3: wire parent links through the map.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_categories) LOOP
    IF v_item->>'parentId' IS NOT NULL AND v_map ? (v_item->>'parentId') THEN
      UPDATE public.categories
         SET parent_id = (v_map->>(v_item->>'parentId'))::uuid
       WHERE id = (v_map->>(v_item->>'id'))::uuid
         AND user_id = p_user_id;
    END IF;
  END LOOP;

  -- Pass 4: remap the TEXT category references on this user's transactions
  -- and budgets — same transaction, so a failure rolls everything back and
  -- no reference is ever orphaned.
  UPDATE public.transactions t
     SET category = v_map->>t.category
   WHERE t.user_id = p_user_id
     AND t.category IS NOT NULL
     AND v_map ? t.category;

  UPDATE public.budgets b
     SET category = v_map->>b.category
   WHERE b.user_id = p_user_id
     AND b.category IS NOT NULL
     AND v_map ? b.category;

  RETURN QUERY
    SELECT * FROM public.categories
     WHERE user_id = p_user_id
     ORDER BY level, name;
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_categories_atomic(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.migrate_categories_atomic(uuid, jsonb) TO authenticated, service_role;

COMMIT;
