-- ============================================================================
-- repoint_transfer — a linked transfer can be pointed at a different account
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). One new function. No column is added, no row
-- is rewritten by the migration itself, and no grant widens beyond the pattern
-- every other transfer RPC already uses (authenticated + service_role).
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Until now a linked transfer's target was structural. The editor said so:
--
--   "This transfer is linked to its opposite transaction. To move it, delete
--    the transfer and recreate it."
--
-- and it was not even true, because deleting the counterpart did not visibly
-- release the survivor either. The only exit anybody found was to delete a row
-- — and if the counterpart had come off a bank statement, that exit destroyed
-- imported evidence to fix a typo in a category.
--
-- Microsoft Money did not do this. In Money the transfer's other side is a
-- FIELD of the transaction; changing it moves the other half, and the other
-- half is the app's own bookkeeping. This function is that behaviour, with the
-- one case Money did not have to worry about — a counterpart that is itself a
-- real downloaded transaction — handled explicitly instead of silently.
--
-- ── WHAT IT DOES ────────────────────────────────────────────────────────────
-- Given one half of a linked pair and a target account, it leaves the pair
-- facing that account and filed consistently in BOTH directions:
--
--     source.transfer_account_id      = target
--     source.category                 = To/From <target>
--     counterpart.account_id          = target
--     counterpart.transfer_account_id = source.account_id
--     counterpart.category            = To/From <source.account_id>
--
-- Note the crossover: each row's category names the OTHER side. Both are
-- recomputed from the pairing as it will be, never patched — the source's own
-- account can move in the same save, and then the counterpart's category is
-- stale too. Deriving both makes that unrepresentable. The same rule is written
-- in TypeScript once, in src/utils/transferRepoint.ts, and the browser-storage
-- mirror in DataService reads it from there.
--
-- Amounts, dates, descriptions, notes, tags and is_cleared are never touched.
-- A re-point is a change of address, not of fact.
--
-- ── THE THREE DISPOSITIONS ──────────────────────────────────────────────────
--   'move'    — the counterpart changes address. The ordinary case: it is
--               scaffolding this app inserted for the user ("create the other
--               side"), so nothing is lost by moving it.
--   'release' — the counterpart is a REAL transaction that happens to have been
--               matched to this transfer. It stays exactly where it is and
--               becomes a plain unlinked, uncategorised row again; a fresh
--               counterpart is created in the target.
--   'delete'  — as release, but the displaced row is removed and its account's
--               balance reversed.
--
-- The caller decides which, because the caller is the only one that can ask.
-- src/utils/transferCounterpartOrigin.ts explains how conservatively the app
-- guesses before it asks, and why it can only ever prove "the app made this".
--
-- ── BALANCE REASONING ───────────────────────────────────────────────────────
-- Stated per branch rather than asserted overall, because this is the one
-- transfer operation that is NOT balance-neutral:
--
--   'move'    — the counterpart leaves one account and joins another, so the
--               same amount is subtracted from its old account and added to the
--               new one. Net zero across the pair of accounts; each account's
--               own invariant (balance = initial_balance + Σ amount) is
--               maintained because the row moved with the money. When the
--               target IS already the counterpart's account (a pure re-file —
--               see below) NO balance statement runs at all.
--   'release' — the released row does not move and does not change amount, so
--               its account is untouched. The freshly inserted counterpart adds
--               its amount to the target, exactly as create_transfer_counterpart
--               does.
--   'delete'  — the removed row's amount is subtracted from its account, the
--               new row's amount added to the target. Two independent, audited
--               statements.
--
-- Every UPDATE of accounts.balance is written as `balance = balance + <delta>`
-- — read-modify-write in SQL numeric, never a value computed anywhere else —
-- and every one is audited with a before/after snapshot.
--
-- ── IT IS SAFE TO CALL WITH AN UNCHANGED TARGET ─────────────────────────────
-- Deliberately not an error. If the counterpart already sits in the target, the
-- function re-files both categories and moves no money. That is what makes it
-- the right call after the SOURCE's own account has been changed, where the
-- counterpart is in the right place but is filed under the To/From category of
-- an account this transfer has nothing to do with any more.
-- ============================================================================

BEGIN;

-- ── Refuse, BY NAME, if the ground this stands on is not what it expects ────
-- This function reuses transfer_category_for (20260716100000) and
-- write_financial_audit, and it restates none of them. What it does need is
-- that both exist, and that the schema still carries the mutual link column
-- this whole feature is about.
DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'transfer_category_for';
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'transfer_category_helper_missing: repoint_transfer files both sides through transfer_category_for — apply 20260716100000_transfer_linking.sql first.'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'transactions'
       AND column_name = 'linked_transfer_id'
  ) THEN
    RAISE EXCEPTION 'linked_transfer_column_missing: there is no linked_transfer_id to re-point — apply 20260716100000_transfer_linking.sql first.'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'transactions'
       AND column_name = 'linked_transfer_split_id'
  ) THEN
    RAISE EXCEPTION 'split_leg_column_missing: repoint_transfer refuses split-line legs by name and needs the column to see them — apply 20260720120000_split_leg_transfers.sql first.'
      USING ERRCODE = 'P0002';
  END IF;

  -- A released counterpart becomes an uncategorised row in an account the user
  -- is not looking at. needs_review is the register's own way of saying "there
  -- is work here", and setting it is the difference between a warning that
  -- reaches the user and one that does not.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'transactions'
       AND column_name = 'needs_review'
  ) THEN
    RAISE EXCEPTION 'review_column_missing: releasing a counterpart marks it for review so it is visible in the account it stays in — apply 20260810090000_imported_rows_arrive_new.sql first.'
      USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'repoint_transfer'
  ) THEN
    RAISE EXCEPTION 'repoint_already_present: repoint_transfer already exists — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ── repoint_transfer ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.repoint_transfer(
  p_id uuid,
  p_target_account_id uuid,
  p_disposition text DEFAULT 'move',
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_src public.transactions;
  v_src_new public.transactions;
  v_old public.transactions;          -- the counterpart being displaced
  v_new public.transactions;          -- the counterpart that ends up in the target
  v_released public.transactions;
  v_from_account uuid;                -- where the displaced counterpart lived
  v_acct_before public.accounts;
  v_acct_after public.accounts;
  v_src_currency text;
  v_target_currency text;
  v_displaced jsonb;
BEGIN
  IF p_disposition NOT IN ('move', 'release', 'delete') THEN
    RAISE EXCEPTION 'unknown disposition "%" — expected move, release or delete', p_disposition
      USING ERRCODE = '22023';
  END IF;

  -- Deterministic lock order across the two rows, as link_transfer_pair does:
  -- two concurrent re-points touching the same pair must not deadlock.
  PERFORM 1 FROM public.transactions
   WHERE (id = p_id OR linked_transfer_id = p_id)
     AND (p_user_id IS NULL OR user_id = p_user_id)
   ORDER BY id
   FOR UPDATE;

  SELECT * INTO v_src FROM public.transactions
   WHERE id = p_id AND (p_user_id IS NULL OR user_id = p_user_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_src.linked_transfer_id IS NULL THEN
    RAISE EXCEPTION 'that transaction is not half of a linked transfer' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_old FROM public.transactions
   WHERE id = v_src.linked_transfer_id AND user_id = v_src.user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Mutual, both ways round, so a stale client list cannot re-point a pair that
  -- has moved on underneath it. Same check repair_claimed_transfer makes.
  IF v_old.linked_transfer_id IS DISTINCT FROM v_src.id THEN
    RAISE EXCEPTION 'those two rows are not linked to each other any more — reload and look again'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_src.account_id = p_target_account_id THEN
    RAISE EXCEPTION 'a transfer needs two different accounts' USING ERRCODE = 'P0001';
  END IF;
  IF v_src.is_split OR v_old.is_split THEN
    RAISE EXCEPTION 'a split transaction cannot become a transfer — remove the split first'
      USING ERRCODE = 'P0001';
  END IF;
  -- The opposite half is one LINE of a split. That link also lives on the split
  -- line, so moving the row here would leave the line pointing into another
  -- account with no way to notice.
  IF v_src.linked_transfer_split_id IS NOT NULL OR v_old.linked_transfer_split_id IS NOT NULL THEN
    RAISE EXCEPTION 'the other half of this transfer is one line of a split — edit that split to move it'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_src.archived OR v_old.archived THEN
    RAISE EXCEPTION 'one of these rows is archived — bring it back into the register before moving it'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_src.amount = 0 THEN
    RAISE EXCEPTION 'a zero-amount transaction cannot be a transfer' USING ERRCODE = 'P0001';
  END IF;

  -- Lock and validate the target up front (owned by the same user), and reuse
  -- the snapshot for the balance audit below.
  SELECT * INTO v_acct_before FROM public.accounts
   WHERE id = p_target_account_id AND user_id = v_src.user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
  END IF;

  -- The same cross-currency guard create_transfer_counterpart applies, for the
  -- same reason: the two sides are exact negations with no conversion, so a
  -- pair straddling two currencies would be arithmetic nonsense.
  SELECT currency INTO v_src_currency FROM public.accounts WHERE id = v_src.account_id;
  v_target_currency := v_acct_before.currency;
  IF v_src_currency IS NOT NULL AND v_target_currency IS NOT NULL
     AND v_src_currency <> v_target_currency THEN
    RAISE EXCEPTION 'transfers between accounts in different currencies are not supported yet (% and %)',
      v_src_currency, v_target_currency USING ERRCODE = 'P0001';
  END IF;

  v_from_account := v_old.account_id;

  -- ── The displaced counterpart, and the one that replaces it ───────────────
  IF p_disposition = 'move' THEN
    UPDATE public.transactions
       SET account_id          = p_target_account_id,
           type                = 'transfer',
           category            = public.transfer_category_for(
                                   v_src.user_id, v_src.account_id, v_old.amount),
           transfer_account_id = v_src.account_id,
           updated_at          = now()
     WHERE id = v_old.id
    RETURNING * INTO v_new;

    -- Only when it actually changed address. An unchanged target is a re-file,
    -- and a re-file moves no money.
    IF v_from_account <> p_target_account_id THEN
      SELECT * INTO v_acct_before FROM public.accounts
       WHERE id = v_from_account AND user_id = v_src.user_id
       FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
      END IF;
      UPDATE public.accounts
         SET balance = balance - v_new.amount, updated_at = now()
       WHERE id = v_from_account AND user_id = v_src.user_id
      RETURNING * INTO v_acct_after;
      PERFORM public.write_financial_audit(
        v_src.user_id, 'account', v_from_account, 'update',
        to_jsonb(v_acct_before), to_jsonb(v_acct_after));

      SELECT * INTO v_acct_before FROM public.accounts
       WHERE id = p_target_account_id AND user_id = v_src.user_id
       FOR UPDATE;
      UPDATE public.accounts
         SET balance = balance + v_new.amount, updated_at = now()
       WHERE id = p_target_account_id AND user_id = v_src.user_id
      RETURNING * INTO v_acct_after;
      PERFORM public.write_financial_audit(
        v_src.user_id, 'account', p_target_account_id, 'update',
        to_jsonb(v_acct_before), to_jsonb(v_acct_after));
    END IF;

    PERFORM public.write_financial_audit(
      v_src.user_id, 'transaction', v_new.id, 'update', to_jsonb(v_old), to_jsonb(v_new));

    v_displaced := jsonb_build_object('kind', 'moved', 'from_account_id', v_from_account);
  ELSE
    IF p_disposition = 'release' THEN
      -- Everything that made it half of a transfer comes off, and nothing else
      -- does: same account, same amount, same date, same description. Typed by
      -- the money's own direction and left with no category, because the app
      -- does not know what this payment was — only that it was not this
      -- transfer. needs_review says so where it will be seen: in the register
      -- of the account it stayed in, which is not the one the user is looking
      -- at.
      UPDATE public.transactions
         SET linked_transfer_id  = NULL,
             transfer_account_id = NULL,
             category            = NULL,
             category_confirmed  = true,
             needs_review        = true,
             type                = CASE WHEN amount < 0 THEN 'expense' ELSE 'income' END,
             updated_at          = now()
       WHERE id = v_old.id
      RETURNING * INTO v_released;

      PERFORM public.write_financial_audit(
        v_src.user_id, 'transaction', v_released.id, 'update',
        to_jsonb(v_old), to_jsonb(v_released));

      v_displaced := jsonb_build_object('kind', 'released', 'transaction', to_jsonb(v_released));
    ELSE
      -- Deleting reverses the account it was in. The link on v_src would be
      -- nulled by the ON DELETE SET NULL foreign key; it is overwritten below
      -- in the same statement-set anyway, so both orders end identically.
      SELECT * INTO v_acct_before FROM public.accounts
       WHERE id = v_from_account AND user_id = v_src.user_id
       FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
      END IF;

      DELETE FROM public.transactions WHERE id = v_old.id;

      UPDATE public.accounts
         SET balance = balance - v_old.amount, updated_at = now()
       WHERE id = v_from_account AND user_id = v_src.user_id
      RETURNING * INTO v_acct_after;

      PERFORM public.write_financial_audit(
        v_src.user_id, 'transaction', v_old.id, 'delete', to_jsonb(v_old), NULL);
      PERFORM public.write_financial_audit(
        v_src.user_id, 'account', v_from_account, 'update',
        to_jsonb(v_acct_before), to_jsonb(v_acct_after));

      v_displaced := jsonb_build_object(
        'kind', 'deleted', 'id', v_old.id, 'account_id', v_from_account, 'amount', v_old.amount);
    END IF;

    -- The fresh counterpart, exactly as create_transfer_counterpart makes one:
    -- the source's amount negated, no conversion, uncleared, and new work in an
    -- account the user is not looking at.
    INSERT INTO public.transactions
      (user_id, account_id, description, amount, type, date, category,
       notes, transfer_account_id, linked_transfer_id, is_cleared)
    VALUES
      (v_src.user_id, p_target_account_id, v_src.description, -v_src.amount,
       'transfer', v_src.date,
       public.transfer_category_for(v_src.user_id, v_src.account_id, -v_src.amount),
       v_src.notes, v_src.account_id, v_src.id, false)
    RETURNING * INTO v_new;

    SELECT * INTO v_acct_before FROM public.accounts
     WHERE id = p_target_account_id AND user_id = v_src.user_id
     FOR UPDATE;
    UPDATE public.accounts
       SET balance = balance + v_new.amount, updated_at = now()
     WHERE id = p_target_account_id AND user_id = v_src.user_id
    RETURNING * INTO v_acct_after;

    PERFORM public.write_financial_audit(
      v_src.user_id, 'transaction', v_new.id, 'create', NULL, to_jsonb(v_new));
    PERFORM public.write_financial_audit(
      v_src.user_id, 'account', p_target_account_id, 'update',
      to_jsonb(v_acct_before), to_jsonb(v_acct_after));
  END IF;

  -- ── The edited row, re-filed to face where its other half now is ──────────
  UPDATE public.transactions
     SET type                = 'transfer',
         category            = public.transfer_category_for(
                                 v_src.user_id, p_target_account_id, v_src.amount),
         transfer_account_id = p_target_account_id,
         linked_transfer_id  = v_new.id,
         updated_at          = now()
   WHERE id = v_src.id
  RETURNING * INTO v_src_new;

  PERFORM public.write_financial_audit(
    v_src.user_id, 'transaction', v_src_new.id, 'update',
    to_jsonb(v_src), to_jsonb(v_src_new));

  RETURN jsonb_build_object(
    'source', to_jsonb(v_src_new),
    'counterpart', to_jsonb(v_new),
    'displaced', v_displaced
  );
END;
$$;

COMMENT ON FUNCTION public.repoint_transfer(uuid, uuid, text, uuid) IS
  'Point an existing linked transfer at a different account, in one database transaction. Both sides are re-filed from the new pairing (each row''s To/From category names the OTHER side), amounts and dates are never touched, and the displaced counterpart is moved, released as a plain uncategorised row, or deleted, as the caller says. Balance-preserving overall: a moved counterpart takes its amount from its old account to the new one; a released one does not move at all; a deleted one is reversed out. Safe to call with an unchanged target, where it re-files only and moves no money. Refuses stale pairs, split parents, split-line legs, archived rows and cross-currency pairs.';

REVOKE ALL ON FUNCTION public.repoint_transfer(uuid, uuid, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.repoint_transfer(uuid, uuid, text, uuid) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- Verification — run after applying. NOTE: unapplied at the time of writing;
-- these are what to read, and what to expect, when it is.
-- ============================================================================

-- 1. The function exists with the security posture every other transfer RPC
--    has: SECURITY INVOKER, pinned search_path, never anon.
-- Expected: one row, prosecdef = false, proconfig = {search_path=public}
SELECT p.proname, p.prosecdef, p.proconfig
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'repoint_transfer';

-- Expected: authenticated + service_role only; never anon, never PUBLIC ('-').
SELECT a.grantee::regrole::text AS grantee, a.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 CROSS JOIN LATERAL aclexplode(p.proacl) AS a
 WHERE n.nspname = 'public' AND p.proname = 'repoint_transfer'
 ORDER BY grantee;

-- 2. No row was rewritten by applying this. The function is new; nothing ran.
-- Expected: zero rows — the ledger invariant holds for every account, exactly
--           as it did before.
SELECT a.id, a.name, a.balance, a.initial_balance + COALESCE(t.total, 0) AS expected
  FROM public.accounts a
  LEFT JOIN (
    SELECT account_id, sum(amount) AS total
      FROM public.transactions
     GROUP BY account_id
  ) t ON t.account_id = a.id
 WHERE a.balance IS DISTINCT FROM a.initial_balance + COALESCE(t.total, 0);

-- 3. Every linked pair still names its partner both ways round, and no row
--    points at itself. Re-run this after any real re-point: it is the invariant
--    the function's mutual-link check exists to preserve.
-- Expected: zero rows
SELECT t.id, t.linked_transfer_id
  FROM public.transactions t
  LEFT JOIN public.transactions o ON o.id = t.linked_transfer_id
 WHERE t.linked_transfer_id IS NOT NULL
   AND (o.id IS NULL OR o.linked_transfer_id IS DISTINCT FROM t.id OR o.id = t.id);

-- 4. No linked pair sits in one account (a "transfer" from an account to
--    itself), and no leg is filed under its OWN account's transfer category —
--    the crossover rule, checked from the outside.
-- Expected: zero rows
SELECT t.id, t.account_id, t.category
  FROM public.transactions t
  JOIN public.transactions o ON o.id = t.linked_transfer_id
  LEFT JOIN public.categories c ON c.id::text = t.category
 WHERE t.linked_transfer_id IS NOT NULL
   AND (t.account_id = o.account_id
        OR (c.is_transfer_category AND c.account_id = t.account_id));
