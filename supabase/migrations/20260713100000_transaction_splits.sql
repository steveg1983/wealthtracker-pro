-- Split transactions — phase 1: schema + server-side integrity.
--
-- IMPORTANT: Run this SQL in the Supabase SQL Editor to apply to production DB.
-- Safe to apply before the matching client deploys: nothing reads
-- transaction_splits or is_split until the split editor ships, and the two
-- recreated RPCs only gain guards (split parents cannot exist before this
-- migration, so the added conditions match zero rows today).
--
-- Model (the Microsoft Money one): a split transaction stays ONE ledger row —
-- one date, one payee, one signed amount, one balance effect — while its
-- categorisation moves into transaction_splits lines that MUST sum exactly to
-- the transaction amount. The parent's category is blank while split; split
-- lines carry signed amounts (a negative line models e.g. cashback inside a
-- shop, exactly like Money).
--
-- Integrity is enforced server-side, not just in the editor:
--   - set_transaction_splits is the ONLY path that can change a split
--     parent's amount, category, type, or is_split — a BEFORE UPDATE trigger
--     rejects everything else (quick edits, bulk tools, stale clients).
--   - The RPC validates sum(splits) = amount, syncs the amount and account
--     balance atomically when an edit changes it, and audits every change.
--   - apply_category_to_uncategorized (payee-memory fan-out) skips split
--     parents: their blank category means "split", not "uncategorised".
--   - delete_unused_categories refuses to delete a category any split uses.

BEGIN;

-- ── Schema ───────────────────────────────────────────────────────────────────

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_split boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.transaction_splits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL,
  category       text NOT NULL,                -- category id as text (matches transactions.category)
  amount         numeric(20,2) NOT NULL,       -- signed, same convention as transactions.amount
  memo           text,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transaction_splits_category_not_blank CHECK (btrim(category) <> ''),
  CONSTRAINT transaction_splits_amount_nonzero CHECK (amount <> 0)
);

CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction
  ON public.transaction_splits (transaction_id, sort_order);
-- Phase 3 (split-aware reporting) will aggregate by category per user.
CREATE INDEX IF NOT EXISTS idx_transaction_splits_user_category
  ON public.transaction_splits (user_id, category);

ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transaction_splits_all_own ON public.transaction_splits;
CREATE POLICY transaction_splits_all_own ON public.transaction_splits
  FOR ALL TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

-- ── Guard: split parents are read-only outside set_transaction_splits ───────
-- The RPC marks its own writes with a transaction-local flag; every other
-- UPDATE that would break the sum invariant (amount), re-categorise a split
-- parent (category), flip its sign convention (type), or forge the flag
-- (is_split) is rejected.

CREATE OR REPLACE FUNCTION public.protect_split_transaction_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.split_rpc', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_split IS DISTINCT FROM OLD.is_split THEN
    RAISE EXCEPTION 'is_split can only change through set_transaction_splits'
      USING ERRCODE = 'P0001';
  END IF;

  IF OLD.is_split THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
      RAISE EXCEPTION 'split_amount_locked: this transaction is split — its amount is the sum of its splits; edit the splits instead'
        USING ERRCODE = 'P0001';
    END IF;
    IF NEW.type IS DISTINCT FROM OLD.type THEN
      RAISE EXCEPTION 'split_type_locked: remove the split before changing the transaction type'
        USING ERRCODE = 'P0001';
    END IF;
    IF btrim(COALESCE(NEW.category, '')) <> '' THEN
      RAISE EXCEPTION 'split_category_locked: this transaction is split — its categorisation lives in its split lines'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_split_transaction_fields ON public.transactions;
CREATE TRIGGER trg_protect_split_transaction_fields
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_split_transaction_fields();

-- ── set_transaction_splits: the one write path ───────────────────────────────
-- Replace-all semantics. An empty/NULL p_splits un-splits the transaction
-- (the caller re-categorises through the normal update path afterwards).
-- p_expected_amount is the client's amount field: when supplied, a split set
-- that does not sum to it is REJECTED (the user-facing "totals must match"
-- rule, enforced server-side). When the sum differs from the stored amount
-- (the same edit changed the amount), the amount and account balance are
-- synced atomically, mirroring update_transaction_atomic.

CREATE OR REPLACE FUNCTION public.set_transaction_splits(
  p_transaction_id uuid,
  p_splits jsonb,
  p_expected_amount numeric DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_old public.transactions;
  v_new public.transactions;
  v_split jsonb;
  v_category text;
  v_amount numeric(20,2);
  v_sum numeric(20,2) := 0;
  v_count integer := 0;
  v_ord integer := 0;
  v_old_splits jsonb;
  v_new_splits jsonb;
  v_acct_before public.accounts;
  v_acct_after public.accounts;
BEGIN
  IF p_splits IS NOT NULL AND jsonb_typeof(p_splits) <> 'array' THEN
    RAISE EXCEPTION 'p_splits must be a jsonb array' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old
    FROM public.transactions
   WHERE id = p_transaction_id
     AND (p_user_id IS NULL OR user_id = p_user_id)
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_old.type = 'transfer' THEN
    RAISE EXCEPTION 'transfers cannot be split' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb)
    INTO v_old_splits
    FROM public.transaction_splits s
   WHERE s.transaction_id = p_transaction_id;

  -- Let this function's own writes through the split guard (transaction-local).
  PERFORM set_config('app.split_rpc', '1', true);

  DELETE FROM public.transaction_splits WHERE transaction_id = p_transaction_id;

  -- ── Un-split ──────────────────────────────────────────────────────────────
  IF p_splits IS NULL OR jsonb_array_length(p_splits) = 0 THEN
    IF v_old.is_split THEN
      UPDATE public.transactions
         SET is_split = false, updated_at = now()
       WHERE id = p_transaction_id
      RETURNING * INTO v_new;

      PERFORM public.write_financial_audit(
        v_new.user_id, 'transaction', v_new.id, 'update',
        to_jsonb(v_old) || jsonb_build_object('splits', v_old_splits),
        to_jsonb(v_new) || jsonb_build_object('splits', '[]'::jsonb)
      );
    END IF;
    RETURN jsonb_build_object('is_split', false, 'split_count', 0, 'amount', v_old.amount);
  END IF;

  -- ── Split ─────────────────────────────────────────────────────────────────
  IF jsonb_array_length(p_splits) < 2 THEN
    RAISE EXCEPTION 'a split needs at least 2 lines' USING ERRCODE = '22023';
  END IF;

  FOR v_split IN SELECT value FROM jsonb_array_elements(p_splits) LOOP
    v_category := btrim(COALESCE(v_split->>'category', ''));
    IF v_category = '' THEN
      RAISE EXCEPTION 'every split line needs a category' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.categories c
       WHERE c.id::text = v_category
         AND c.user_id = v_old.user_id
         AND c.is_transfer_category IS NOT TRUE
    ) THEN
      RAISE EXCEPTION 'unknown or transfer category: %', v_category USING ERRCODE = '22023';
    END IF;

    v_amount := (v_split->>'amount')::numeric(20,2);
    IF v_amount IS NULL OR v_amount = 0 THEN
      RAISE EXCEPTION 'every split line needs a non-zero amount' USING ERRCODE = '22023';
    END IF;

    v_ord := v_ord + 1;
    INSERT INTO public.transaction_splits
      (transaction_id, user_id, category, amount, memo, sort_order)
    VALUES
      (p_transaction_id, v_old.user_id, v_category, v_amount,
       NULLIF(btrim(COALESCE(v_split->>'memo', '')), ''), v_ord);

    v_sum := v_sum + v_amount;
    v_count := v_count + 1;
  END LOOP;

  IF p_expected_amount IS NOT NULL AND v_sum <> p_expected_amount THEN
    RAISE EXCEPTION 'split_total_mismatch: split lines sum to % but the transaction amount is %',
      v_sum, p_expected_amount USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.transactions
     SET is_split = true,
         category = '',            -- categorisation lives in the split lines
         amount = v_sum,
         updated_at = now()
   WHERE id = p_transaction_id
  RETURNING * INTO v_new;

  IF v_new.amount <> v_old.amount THEN
    SELECT * INTO v_acct_before
      FROM public.accounts
     WHERE id = v_new.account_id AND user_id = v_new.user_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.accounts
       SET balance = balance + (v_new.amount - v_old.amount),
           updated_at = now()
     WHERE id = v_new.account_id AND user_id = v_new.user_id
    RETURNING * INTO v_acct_after;

    PERFORM public.write_financial_audit(
      v_new.user_id, 'account', v_acct_after.id, 'update',
      to_jsonb(v_acct_before), to_jsonb(v_acct_after)
    );
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb)
    INTO v_new_splits
    FROM public.transaction_splits s
   WHERE s.transaction_id = p_transaction_id;

  PERFORM public.write_financial_audit(
    v_new.user_id, 'transaction', v_new.id, 'update',
    to_jsonb(v_old) || jsonb_build_object('splits', v_old_splits),
    to_jsonb(v_new) || jsonb_build_object('splits', v_new_splits)
  );

  RETURN jsonb_build_object('is_split', true, 'split_count', v_count, 'amount', v_sum);
END;
$$;

-- ── Payee-memory fan-out must skip split parents ─────────────────────────────
-- A split parent's category is blank BY DESIGN — without this guard the
-- fan-out would treat it as uncategorised and stamp a single category onto
-- it (the trigger above would reject the write mid-loop and fail the whole
-- propagation). Recreated from 20260708100000; the only change is the
-- `AND NOT is_split` condition.

CREATE OR REPLACE FUNCTION public.apply_category_to_uncategorized(
  p_ids uuid[],
  p_category text,
  p_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_old public.transactions;
  v_new public.transactions;
BEGIN
  FOR v_old IN
    SELECT * FROM public.transactions
     WHERE id = ANY(p_ids)
       AND (p_user_id IS NULL OR user_id = p_user_id)
       AND (category IS NULL OR btrim(category) = '')
       AND NOT is_split
     FOR UPDATE
  LOOP
    UPDATE public.transactions
       SET category = p_category,
           updated_at = now()
     WHERE id = v_old.id
    RETURNING * INTO v_new;

    PERFORM public.write_financial_audit(
      v_new.user_id, 'transaction', v_new.id, 'update', to_jsonb(v_old), to_jsonb(v_new)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── Category pruning must respect split usage ────────────────────────────────
-- Recreated from 20260708160000; the only change is the transaction_splits
-- NOT EXISTS (transaction_splits.category is TEXT with no FK, same as
-- transactions.category — deleting a category a split references would
-- orphan that split line's categorisation permanently).

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
       SELECT 1 FROM public.transaction_splits s
        WHERE s.user_id = c.user_id AND s.category = c.id::text
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

-- ── Grants ───────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.set_transaction_splits(uuid, jsonb, numeric, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_transaction_splits(uuid, jsonb, numeric, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.apply_category_to_uncategorized(uuid[], text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_category_to_uncategorized(uuid[], text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.delete_unused_categories(uuid[], uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_unused_categories(uuid[], uuid) TO authenticated, service_role;

COMMIT;
