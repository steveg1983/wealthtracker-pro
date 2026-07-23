-- ── Revaluations: a third kind of money movement ─────────────────────────────
--
-- An investment portfolio's value changes without a single pound moving in or
-- out. That is not income, not an expense, and not a transfer — it is an
-- increase or decrease to net worth, full stop. Microsoft Money had this
-- concept; this app did not, and the measured cost of the gap was hundreds of
-- valuation rows sitting permanently in the uncategorised review band (some
-- filed as groceries by users given no correct answer to choose).
--
-- The mechanism deliberately mirrors is_transfer_category: a flag on the
-- category, so the classifier (utils/incomeExpense.ts) can rule the row out of
-- income and expense by CATEGORY SEMANTICS, the way it already rules transfers
-- out. Revaluation rows keep their amounts — the account balances already
-- include them, which is the whole point — they are simply reported as their
-- own line instead of polluting spending.
--
-- Seeded per user: a "Revaluation" root with one detail category, mirroring
-- the Transfer tree's shape so every category picker shows it with no special
-- cases. Users add finer-grained children themselves if they want them.

BEGIN;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_revaluation_category boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.categories.is_revaluation_category IS
  'Rows filed here are changes in VALUE (portfolio revaluations), not income, expenses or transfers — excluded from spending totals, reported as their own line.';

-- One root + one detail per existing user, idempotently: a user who already
-- has a revaluation root (any category flagged at level ''type'') is skipped.
INSERT INTO public.categories (user_id, name, type, level, parent_id, is_system, is_revaluation_category)
SELECT u.id, 'Revaluation', 'both', 'type', NULL, true, true
  FROM public.users u
 WHERE NOT EXISTS (
   SELECT 1 FROM public.categories c
    WHERE c.user_id = u.id AND c.is_revaluation_category AND c.level = 'type'
 );

INSERT INTO public.categories (user_id, name, type, level, parent_id, is_system, is_revaluation_category)
SELECT root.user_id, 'Market Value Change', 'both', 'detail', root.id, true, true
  FROM public.categories root
 WHERE root.is_revaluation_category AND root.level = 'type'
   AND NOT EXISTS (
     SELECT 1 FROM public.categories c
      WHERE c.user_id = root.user_id AND c.is_revaluation_category AND c.level = 'detail'
   );

-- The localStorage→cloud migration must carry the flag, or a local user's
-- revaluation categories would silently lose their meaning on sign-up. This is
-- the SAME function as 20260611100000 — every line identical (return type,
-- idempotency guard, error codes, the transactions/budgets remap, GRANT/REVOKE)
-- — with the single addition of the is_revaluation_category column and its
-- isRevaluationCategory payload key in the pass-2 insert.
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
      color, icon, is_system, is_transfer_category, is_revaluation_category,
      account_id, is_active
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
      COALESCE((v_item->>'isRevaluationCategory')::boolean, false),
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
