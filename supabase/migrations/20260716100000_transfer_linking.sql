-- Transfer linking (the Microsoft Money model) — schema + atomic RPCs.
--
-- IMPORTANT: Run this SQL in the Supabase SQL Editor to apply to production DB.
-- Safe to apply before the matching client deploys: the new column is
-- nullable and nothing reads it until the transfer-match UI ships.
--
-- Filing a transaction under a "To/From B" category should make it a REAL
-- transfer: typed 'transfer', linked to its opposite side in account B, with
-- each side carrying the other account's To/From category. Two write paths:
--
--   - link_transfer_pair: BOTH sides already exist (typical when both
--     accounts import from banks) — join them. Balance-neutral by
--     construction: amounts are validated as exact opposites and unchanged.
--   - create_transfer_counterpart: only one side exists (old/incomplete
--     data) — create the opposite row in the target account, Money-style,
--     adjusting that account's balance atomically.
--
-- Both are SECURITY INVOKER (RLS scopes rows) with the usual p_user_id
-- defence-in-depth guard, and audit every row they touch. Split parents are
-- excluded (a split cannot be a transfer; enforced here AND by the split
-- guard trigger).

BEGIN;

-- ── Schema ───────────────────────────────────────────────────────────────────

-- The other side of a linked transfer pair. ON DELETE SET NULL: deleting one
-- side never leaves the survivor pointing at a ghost (it simply becomes an
-- unlinked transfer again, eligible for re-linking).
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS linked_transfer_id uuid
    REFERENCES public.transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_linked_transfer
  ON public.transactions (linked_transfer_id)
  WHERE linked_transfer_id IS NOT NULL;

-- ── Helper: the To/From category id for an account ──────────────────────────
-- Falls back to the legacy 'transfer-out'/'transfer-in' sentinels when the
-- account has no transfer category (should not happen — the lifecycle
-- triggers maintain them — but a missing category must not block a link).

CREATE OR REPLACE FUNCTION public.transfer_category_for(
  p_user_id uuid,
  p_account_id uuid,
  p_amount numeric
)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT c.id::text
       FROM public.categories c
      WHERE c.user_id = p_user_id
        AND c.is_transfer_category
        AND c.account_id = p_account_id
      LIMIT 1),
    CASE WHEN p_amount < 0 THEN 'transfer-out' ELSE 'transfer-in' END
  );
$$;

-- ── link_transfer_pair: join two existing rows into a transfer ───────────────

CREATE OR REPLACE FUNCTION public.link_transfer_pair(
  p_id_a uuid,
  p_id_b uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_a public.transactions;
  v_b public.transactions;
  v_a_new public.transactions;
  v_b_new public.transactions;
BEGIN
  IF p_id_a = p_id_b THEN
    RAISE EXCEPTION 'a transaction cannot be linked to itself' USING ERRCODE = '22023';
  END IF;

  -- Deterministic lock order prevents deadlocks between concurrent links.
  PERFORM 1 FROM public.transactions
   WHERE id IN (p_id_a, p_id_b)
     AND (p_user_id IS NULL OR user_id = p_user_id)
   ORDER BY id
   FOR UPDATE;

  SELECT * INTO v_a FROM public.transactions
   WHERE id = p_id_a AND (p_user_id IS NULL OR user_id = p_user_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_b FROM public.transactions
   WHERE id = p_id_b AND (p_user_id IS NULL OR user_id = p_user_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_a.user_id <> v_b.user_id THEN
    RAISE EXCEPTION 'transactions belong to different users' USING ERRCODE = '28000';
  END IF;
  IF v_a.account_id = v_b.account_id THEN
    RAISE EXCEPTION 'a transfer needs two different accounts' USING ERRCODE = 'P0001';
  END IF;
  IF v_a.amount = 0 OR v_a.amount <> -v_b.amount THEN
    RAISE EXCEPTION 'transfer sides must have exactly opposite non-zero amounts (% vs %)',
      v_a.amount, v_b.amount USING ERRCODE = 'P0001';
  END IF;
  IF v_a.is_split OR v_b.is_split THEN
    RAISE EXCEPTION 'a split transaction cannot become a transfer — remove the split first'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_a.linked_transfer_id IS NOT NULL OR v_b.linked_transfer_id IS NOT NULL THEN
    RAISE EXCEPTION 'transaction is already part of a linked transfer' USING ERRCODE = 'P0001';
  END IF;

  -- Each side files under the OTHER account's To/From category.
  UPDATE public.transactions
     SET type = 'transfer',
         category = public.transfer_category_for(v_a.user_id, v_b.account_id, v_a.amount),
         transfer_account_id = v_b.account_id,
         linked_transfer_id = v_b.id,
         updated_at = now()
   WHERE id = v_a.id
  RETURNING * INTO v_a_new;

  UPDATE public.transactions
     SET type = 'transfer',
         category = public.transfer_category_for(v_b.user_id, v_a.account_id, v_b.amount),
         transfer_account_id = v_a.account_id,
         linked_transfer_id = v_a.id,
         updated_at = now()
   WHERE id = v_b.id
  RETURNING * INTO v_b_new;

  -- Amounts are untouched, so this is balance-neutral by construction.
  PERFORM public.write_financial_audit(
    v_a_new.user_id, 'transaction', v_a_new.id, 'update', to_jsonb(v_a), to_jsonb(v_a_new));
  PERFORM public.write_financial_audit(
    v_b_new.user_id, 'transaction', v_b_new.id, 'update', to_jsonb(v_b), to_jsonb(v_b_new));

  RETURN jsonb_build_object('a', to_jsonb(v_a_new), 'b', to_jsonb(v_b_new));
END;
$$;

-- ── create_transfer_counterpart: Money-style "make the other side" ───────────

CREATE OR REPLACE FUNCTION public.create_transfer_counterpart(
  p_id uuid,
  p_target_account_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_src public.transactions;
  v_src_new public.transactions;
  v_new public.transactions;
  v_acct_before public.accounts;
  v_acct_after public.accounts;
BEGIN
  SELECT * INTO v_src FROM public.transactions
   WHERE id = p_id AND (p_user_id IS NULL OR user_id = p_user_id)
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_src.amount = 0 THEN
    RAISE EXCEPTION 'a zero-amount transaction cannot become a transfer' USING ERRCODE = 'P0001';
  END IF;
  IF v_src.is_split THEN
    RAISE EXCEPTION 'a split transaction cannot become a transfer — remove the split first'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_src.linked_transfer_id IS NOT NULL THEN
    RAISE EXCEPTION 'transaction is already part of a linked transfer' USING ERRCODE = 'P0001';
  END IF;
  IF v_src.account_id = p_target_account_id THEN
    RAISE EXCEPTION 'a transfer needs two different accounts' USING ERRCODE = 'P0001';
  END IF;

  -- Lock and validate the target account up front (owned by the same user).
  SELECT * INTO v_acct_before FROM public.accounts
   WHERE id = p_target_account_id AND user_id = v_src.user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.transactions
    (user_id, account_id, description, amount, type, date, category,
     notes, transfer_account_id, linked_transfer_id, is_cleared)
  VALUES
    (v_src.user_id, p_target_account_id, v_src.description, -v_src.amount,
     'transfer', v_src.date,
     public.transfer_category_for(v_src.user_id, v_src.account_id, -v_src.amount),
     v_src.notes, v_src.account_id, v_src.id, false)
  RETURNING * INTO v_new;

  UPDATE public.transactions
     SET type = 'transfer',
         category = public.transfer_category_for(v_src.user_id, p_target_account_id, v_src.amount),
         transfer_account_id = p_target_account_id,
         linked_transfer_id = v_new.id,
         updated_at = now()
   WHERE id = v_src.id
  RETURNING * INTO v_src_new;

  -- The new row moves the target account's ledger balance.
  UPDATE public.accounts
     SET balance = balance + v_new.amount,
         updated_at = now()
   WHERE id = p_target_account_id AND user_id = v_src.user_id
  RETURNING * INTO v_acct_after;

  PERFORM public.write_financial_audit(
    v_new.user_id, 'transaction', v_new.id, 'create', NULL, to_jsonb(v_new));
  PERFORM public.write_financial_audit(
    v_src_new.user_id, 'transaction', v_src_new.id, 'update', to_jsonb(v_src), to_jsonb(v_src_new));
  PERFORM public.write_financial_audit(
    v_src.user_id, 'account', v_acct_after.id, 'update',
    to_jsonb(v_acct_before), to_jsonb(v_acct_after));

  RETURN jsonb_build_object('source', to_jsonb(v_src_new), 'counterpart', to_jsonb(v_new));
END;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.transfer_category_for(uuid, uuid, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.transfer_category_for(uuid, uuid, numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.link_transfer_pair(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.link_transfer_pair(uuid, uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_transfer_counterpart(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_transfer_counterpart(uuid, uuid, uuid) TO authenticated, service_role;

COMMIT;
