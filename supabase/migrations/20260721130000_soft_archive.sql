-- ============================================================================
-- Soft archive — hide old, reconciled transactions from the live register
-- without deleting anything or touching balances.
--
-- The Microsoft Money lesson: Money HARD-DELETED archived rows and then
-- adjusted each account's opening balance to compensate — a fragile,
-- unrecoverable operation people were warned off. We do neither.
--
-- Model:
--   * A transaction is "archived" purely as a VIEW flag. It stays in the
--     table, stays counted in the account balance, and stays available to
--     reports. Only the live register hides it.
--   * accounts.archive_through_date records how far back the account is
--     archived (NULL = nothing archived). "Keep all" = NULL.
--   * archive: flag reconciled (is_cleared) transactions on/before the cutoff.
--     Unreconciled ones deliberately stay live (a nudge to reconcile them).
--   * reconcile-sweep: when a transaction on/before the account's cutoff
--     becomes reconciled, it is archived automatically — so it "drops off the
--     live list cleanly" (a trigger, so every reconcile path is covered).
--   * unarchive: clears the flag and the cutoff for an account. One click,
--     because nothing ever left.
--
-- Balances are NEVER mutated here: balance = initial_balance + Σ(ALL txns)
-- holds regardless of the flag, so every displayed balance and every report
-- stays exact. The live register seeds its running balance from the sum of the
-- hidden (archived) rows — computed client-side.
-- ============================================================================

BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS archive_through_date date;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- The live register reads WHERE archived = false; a partial index keeps that
-- fast and small even with a long archived tail.
CREATE INDEX IF NOT EXISTS idx_transactions_live
  ON public.transactions (user_id, account_id, date)
  WHERE archived = false;

-- ── Archive an account's history before a cutoff ────────────────────────────
-- Flags reconciled, not-yet-archived transactions dated on/before the cutoff
-- and records the cutoff on the account. Investment accounts are excluded in
-- v1 (their transfers/cost-basis want special handling). Balance-neutral.
CREATE OR REPLACE FUNCTION public.archive_transactions_before(
  p_user_id uuid,
  p_account_id uuid,
  p_cutoff date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_acct public.accounts;
  v_count integer;
BEGIN
  SELECT * INTO v_acct
    FROM public.accounts
   WHERE id = p_account_id AND user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_acct.type = 'investment' THEN
    RAISE EXCEPTION 'investment accounts cannot be archived yet' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.transactions
     SET archived = true, updated_at = now()
   WHERE user_id = p_user_id
     AND account_id = p_account_id
     AND is_cleared = true
     AND archived = false
     AND date <= p_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.accounts
     SET archive_through_date = p_cutoff, updated_at = now()
   WHERE id = p_account_id AND user_id = p_user_id;

  RETURN jsonb_build_object('archived', v_count, 'cutoff', p_cutoff);
END;
$$;

REVOKE ALL ON FUNCTION public.archive_transactions_before(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_transactions_before(uuid, uuid, date) TO authenticated, service_role;

-- ── Unarchive an account (bring all its history back) ───────────────────────
CREATE OR REPLACE FUNCTION public.unarchive_account(
  p_user_id uuid,
  p_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.transactions
     SET archived = false, updated_at = now()
   WHERE user_id = p_user_id AND account_id = p_account_id AND archived = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.accounts
     SET archive_through_date = NULL, updated_at = now()
   WHERE id = p_account_id AND user_id = p_user_id;

  RETURN jsonb_build_object('unarchived', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.unarchive_account(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unarchive_account(uuid, uuid) TO authenticated, service_role;

-- ── Reconcile-sweep trigger ─────────────────────────────────────────────────
-- When a transaction on/before its account's cutoff becomes reconciled, it is
-- archived automatically, so reconciling old items keeps them from lingering
-- in the live register. Never un-archives (unarchive is an explicit action).
CREATE OR REPLACE FUNCTION public.sweep_reconciled_into_archive()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cutoff date;
BEGIN
  IF NEW.is_cleared IS TRUE
     AND (OLD.is_cleared IS DISTINCT FROM NEW.is_cleared)
     AND NEW.archived = false THEN
    SELECT archive_through_date INTO v_cutoff
      FROM public.accounts WHERE id = NEW.account_id;
    IF v_cutoff IS NOT NULL AND NEW.date <= v_cutoff THEN
      NEW.archived := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sweep_reconciled_into_archive ON public.transactions;
CREATE TRIGGER trg_sweep_reconciled_into_archive
  BEFORE UPDATE OF is_cleared ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sweep_reconciled_into_archive();

COMMIT;
