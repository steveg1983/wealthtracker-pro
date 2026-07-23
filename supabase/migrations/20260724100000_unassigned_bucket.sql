-- ── An unassigned bucket is a schema formality, not a category ────────────────
--
-- The MS Money importer splits some transactions across category lines, and the
-- transaction_splits schema requires every split line to carry a NON-BLANK
-- category. So the lines Money itself left uncategorised have to be filed
-- somewhere — the importer parks them under a real category named
-- "Unassigned (MS Money import)". But that category is typed 'both', and the
-- classifier's rule for a real direction-neutral category is "the user filed it
-- deliberately, so the money's direction decides which side it lands on". The
-- importer's filing was NOT the user's decision, so money-in lines under
-- "Unassigned" were counting as INCOME — the exact direction-guess the
-- no-category rule exists to prevent, wearing a category id as a disguise.
-- Steve's ruling: "if it was unassigned, it isn't income."
--
-- is_unassigned_bucket says: rows filed here are NOT classified — they are
-- uncategorised rows that only carry a category id because the schema demands
-- one. The classifier (utils/incomeExpense.ts) treats them exactly like rows
-- with no category: excluded from every total, surfaced in the review band.
--
-- This mirrors is_transfer_category / is_revaluation_category in SHAPE, but its
-- meaning is the OPPOSITE direction: those flags classify a row INTO a kind;
-- this one DECLASSIFIES it back to uncategorised.

BEGIN;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_unassigned_bucket boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.categories.is_unassigned_bucket IS
  'Rows filed here are NOT classified — they are uncategorised rows that carry a category id only because the splits schema forbids a blank category. Excluded from income/expense totals and surfaced in the review band, exactly like rows with no category at all.';

-- Flag every existing importer bucket, for every user, idempotently: this is the
-- ONE category the importer names verbatim, and a fresh import will carry the
-- flag through msMoneyImport.ts. This UPDATE covers rows already sitting in the
-- database from imports that ran before the flag existed.
UPDATE public.categories
   SET is_unassigned_bucket = true
 WHERE name = 'Unassigned (MS Money import)'
   AND is_unassigned_bucket = false;

-- The localStorage→cloud migration must carry the flag, or a local user's
-- unassigned bucket would silently lose its meaning on sign-up — its money-in
-- lines would revert to counting as income. This is the SAME function as
-- 20260723190000 — every line identical (return type, idempotency guard, error
-- codes, the transactions/budgets remap, GRANT/REVOKE) — with the single
-- addition of the is_unassigned_bucket column and its isUnassignedBucket payload
-- key in the pass-2 insert.
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
      is_unassigned_bucket, account_id, is_active
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
      COALESCE((v_item->>'isUnassignedBucket')::boolean, false),
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
