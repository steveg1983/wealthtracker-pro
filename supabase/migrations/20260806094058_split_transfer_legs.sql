-- ============================================================================
-- SPLIT TRANSFER LEGS — a leg you can create by hand, and a guard that stops
-- punishing the lines it was never about
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). Safe to apply before the matching client
-- deploys: everything here is a NEW function, nothing existing is redefined,
-- and no column changes. A database with this applied and the old client
-- running behaves exactly as it does now.
--
-- ── THE MODEL (unchanged, from 20260720120000) ──────────────────────────────
--
-- One LINE of a split can itself be a transfer leg:
--
--   transaction_splits.transfer_account_id  → the account on the other side
--   transaction_splits.linked_transfer_id   → the counterpart transaction
--   transactions.linked_transfer_split_id   → the exact line that is the
--                                             opposite leg (its
--                                             linked_transfer_id then points
--                                             at the split PARENT)
--
-- Amounts are exactly opposite between the LINE and the counterpart — never
-- between the counterpart and the PARENT, whose total legitimately differs.
-- That difference is the whole point: £35,000 arrives, £30,000 of it settles a
-- loan (a transfer line) and £5,000 is interest (an income line).
--
-- ── WHY THIS MIGRATION: TWO PROBLEMS, ONE WRITE PATH ───────────────────────
--
-- 1. Nobody could CREATE one. 86 of the owner's 364 split lines are transfer
--    legs and every one was made by the MS Money importer, because
--    set_transaction_splits refuses a To/From category outright ('unknown or
--    transfer category') and there is no other way in. The Money answer — "one
--    line of this split is money moving to another account" — simply could not
--    be said in this app.
--
-- 2. The guard that protects legs was too COARSE, and that is the part the
--    owner hit. set_transaction_splits REPLACES the whole line set (delete-all
--    then insert-all), so it cannot tell "line 2 was re-categorised" from
--    "line 1, which was a leg, was deleted". Unable to tell the difference, it
--    refused everything: 78 split parents in production contain a linked leg,
--    and 33 of them still carry a line that needs a category — filing work the
--    UI made impossible, because touching ANY line meant touching them all.
--
-- Both have the same root cause and therefore the same fix: a writer that
-- matches incoming lines to stored ones BY IDENTITY instead of replacing the
-- set. Once a line has an id, "changed", "added" and "removed" are three
-- different things, and the guard can be about the only one that hurts.
--
-- ── THE RULE, PRECISELY ────────────────────────────────────────────────────
--
-- A linked leg line is IMMUTABLE except for where it sits (sort_order) and its
-- memo. An edit is refused only when it would:
--
--   * remove a linked leg      → its counterpart would point at a line that no
--                                longer exists (a half-broken pair IS the
--                                one-sided transfer this whole feature exists
--                                to prevent);
--   * change a leg's amount    → the LINE↔counterpart opposite-amounts
--                                invariant would be false, i.e. the ledger
--                                would claim two different sizes for one
--                                movement of money;
--   * change a leg's target or its category — the filing that names the
--                                account on the other side.
--
-- Everything else in the same split — categories, amounts, memos, added lines,
-- removed ordinary lines — is free. The existing "lines sum to the parent"
-- rule is unchanged and applies to leg lines exactly like any other, so an
-- edit that would need a leg to change size fails the SUM check with a hint
-- saying why, rather than silently rewriting the other side of a transfer.
--
-- set_transaction_splits itself is DELIBERATELY LEFT ALONE, blanket guard and
-- all. It stays the strict path: a client that does not know about legs (a
-- stale browser tab, or the un-split path, which has no line ids to match and
-- would strand every leg it dropped) still gets the old blunt refusal, which
-- fails safe. The new writer below is reached only when the caller explicitly
-- names a transfer target on a line, i.e. when it demonstrably knows what a
-- leg is.
--
-- ── BALANCE REASONING ──────────────────────────────────────────────────────
--
-- Not balance-neutral, and cannot be: creating a leg's counterpart puts a real
-- row in another account's register, so that account's balance moves by
-- exactly the counterpart amount — the same arithmetic (and the same audit
-- shape) as create_transfer_counterpart. The parent's own account moves only
-- if the line total changed it, exactly as set_transaction_splits does today.
-- Net worth is unaffected by the leg itself: the £30,000 leaving the loan
-- account is the same £30,000 arriving in the current account.
--
-- Both functions are SECURITY INVOKER (RLS scopes the rows) with the usual
-- p_user_id defence-in-depth guard, and audit every row they touch.
-- ============================================================================

BEGIN;

-- ── set_transaction_splits_with_legs ────────────────────────────────────────
--
--   p_transaction_id   the split parent;
--   p_splits           the WHOLE line set, in display order. Each element:
--                        id                   text, optional — the stored line
--                                             this replaces. Absent = a new
--                                             line. A stored line whose id is
--                                             not named is deleted.
--                        category             text, required — a category id
--                        amount               numeric, required, non-zero,
--                                             signed like transactions.amount
--                        memo                 text, optional
--                        transfer_account_id  text, optional — makes this line
--                                             one leg of a transfer with that
--                                             account
--   p_expected_amount  the client's amount field; the lines must sum to it
--   p_user_id          the usual owner guard.
--
-- Never un-splits: an empty set has no leg to preserve and no line to match,
-- so that path stays with set_transaction_splits (which refuses while a leg is
-- present — correctly, since un-splitting deletes every line).
--
-- Returns {is_split, split_count, amount, counterparts}, the counterparts being
-- the full transaction rows created for new legs, so the client updates its
-- state (and the target accounts' balances) from what the database actually
-- wrote rather than from what it hoped for.
CREATE OR REPLACE FUNCTION public.set_transaction_splits_with_legs(
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
  v_old            public.transactions;
  v_new            public.transactions;
  v_counterpart    public.transactions;
  v_old_line       public.transaction_splits;
  v_new_line       public.transaction_splits;
  v_leg            public.transaction_splits;
  v_cat            public.categories;
  v_acct           public.accounts;
  v_acct_after     public.accounts;
  v_src_acct       public.accounts;
  v_split          jsonb;
  v_in_id          text;
  v_target_text    text;
  v_target         uuid;
  v_prev_target    uuid;
  v_prev_link      uuid;
  v_category       text;
  v_memo           text;
  v_amount         numeric(20,2);
  v_sum            numeric(20,2) := 0;
  v_count          integer := 0;
  v_ord            integer := 0;
  v_incoming_ids   text[];
  v_stored_count   integer;
  v_stored_sum     numeric(20,2);
  v_old_splits     jsonb;
  v_new_splits     jsonb;
  v_counterparts   jsonb := '[]'::jsonb;
BEGIN
  IF p_splits IS NULL OR jsonb_typeof(p_splits) <> 'array' THEN
    RAISE EXCEPTION 'p_splits must be a jsonb array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_splits) < 2 THEN
    RAISE EXCEPTION 'a split needs at least 2 lines' USING ERRCODE = '22023';
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

  -- ── Which stored lines this edit keeps ────────────────────────────────────
  -- Ids are compared AS TEXT throughout (the same shape categories use), so a
  -- malformed id from a confused caller resolves to no row and gets a sentence
  -- rather than a raw 22P02 cast error.
  SELECT COALESCE(array_agg(x), '{}'::text[]) INTO v_incoming_ids
    FROM (
      SELECT NULLIF(btrim(COALESCE(e.value->>'id', '')), '') AS x
        FROM jsonb_array_elements(p_splits) e
    ) ids
   WHERE x IS NOT NULL;

  IF (SELECT count(*) FROM unnest(v_incoming_ids) x)
     <> (SELECT count(DISTINCT x) FROM unnest(v_incoming_ids) x) THEN
    RAISE EXCEPTION 'split_line_id_repeated: two of these lines claim to be the same stored line — reload and look again'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb)
    INTO v_old_splits
    FROM public.transaction_splits s
   WHERE s.transaction_id = p_transaction_id;

  -- ── The one thing that is still refused: dropping a linked leg ────────────
  -- Named before anything is written, so the refusal costs nothing.
  FOR v_leg IN
    SELECT * FROM public.transaction_splits s
     WHERE s.transaction_id = p_transaction_id
       AND s.linked_transfer_id IS NOT NULL
       AND NOT (s.id::text = ANY(v_incoming_ids))
  LOOP
    RAISE EXCEPTION 'split_leg_line_removed: the line transferring to "%" is one half of a transfer — the transaction on the other side would be left pointing at a line that no longer exists. Delete that transfer first, then edit the split.',
      COALESCE(
        (SELECT a.name FROM public.accounts a WHERE a.id = v_leg.transfer_account_id),
        'another account')
      USING ERRCODE = 'P0001';
  END LOOP;

  -- ── Lock every account this write can move, in id order ───────────────────
  -- One statement, deterministic order: concurrent split saves that touch the
  -- same accounts take them the same way round and cannot deadlock. The
  -- per-line lookups below therefore need no lock of their own.
  PERFORM 1 FROM public.accounts a
   WHERE a.user_id = v_old.user_id
     AND (
       a.id = v_old.account_id
       OR a.id::text IN (
         SELECT NULLIF(btrim(COALESCE(e.value->>'transfer_account_id', '')), '')
           FROM jsonb_array_elements(p_splits) e
       )
     )
   ORDER BY a.id
   FOR UPDATE;

  -- Let this function's own writes through the split guard (transaction-local).
  PERFORM set_config('app.split_rpc', '1', true);

  -- The lines this edit drops. Every leg is protected above, so nothing
  -- deleted here can be one.
  DELETE FROM public.transaction_splits
   WHERE transaction_id = p_transaction_id
     AND NOT (id::text = ANY(v_incoming_ids));

  FOR v_split IN SELECT value FROM jsonb_array_elements(p_splits) LOOP
    v_ord := v_ord + 1;
    v_in_id := NULLIF(btrim(COALESCE(v_split->>'id', '')), '');
    v_prev_target := NULL;
    v_prev_link := NULL;

    v_category := btrim(COALESCE(v_split->>'category', ''));
    IF v_category = '' THEN
      RAISE EXCEPTION 'every split line needs a category' USING ERRCODE = '22023';
    END IF;

    v_amount := (v_split->>'amount')::numeric(20,2);
    IF v_amount IS NULL OR v_amount = 0 THEN
      RAISE EXCEPTION 'every split line needs a non-zero amount' USING ERRCODE = '22023';
    END IF;

    v_memo := NULLIF(btrim(COALESCE(v_split->>'memo', '')), '');

    -- ── The account on the other side, when this line is a leg ──────────────
    v_target_text := NULLIF(btrim(COALESCE(v_split->>'transfer_account_id', '')), '');
    v_target := NULL;
    IF v_target_text IS NOT NULL THEN
      SELECT * INTO v_acct FROM public.accounts
       WHERE id::text = v_target_text AND user_id = v_old.user_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001',
          HINT = 'A transfer line names an account that is not yours, or no longer exists.';
      END IF;
      IF v_acct.id = v_old.account_id THEN
        RAISE EXCEPTION 'a transfer needs two different accounts' USING ERRCODE = 'P0001',
          HINT = 'That line points back at the account this transaction is already in.';
      END IF;
      v_target := v_acct.id;
    END IF;

    -- ── The category must be one of this user's ─────────────────────────────
    SELECT * INTO v_cat FROM public.categories c
     WHERE c.id::text = v_category AND c.user_id = v_old.user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'unknown category: %', v_category USING ERRCODE = '22023';
    END IF;
    -- A To/From category IS the sentence "this line is a transfer": it must
    -- name the same account the line does, and it may not be used without one
    -- (a transfer to nowhere has no other side to make).
    IF v_cat.is_transfer_category IS TRUE THEN
      IF v_target IS NULL THEN
        RAISE EXCEPTION 'split_leg_not_declared: that line is filed under a To/From account category but does not say which account is on the other side'
          USING ERRCODE = '22023';
      END IF;
      IF v_cat.account_id IS DISTINCT FROM v_target THEN
        RAISE EXCEPTION 'split_leg_category_mismatch: that line is filed under one account''s To/From category but transfers to a different account'
          USING ERRCODE = '22023';
      END IF;
    END IF;
    -- The converse is NOT required: the MS Money importer files a leg under
    -- the "Unassigned" bucket where the To/From category was missing, so a
    -- leg's category is how it is FILED, while the leg itself lives in
    -- transfer_account_id. Demanding a To/From category here would make those
    -- imported splits uneditable, which is the bug this migration exists to fix.

    IF v_in_id IS NOT NULL THEN
      SELECT * INTO v_old_line FROM public.transaction_splits
       WHERE id::text = v_in_id AND transaction_id = p_transaction_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'split_line_not_found: one of these lines is not part of this split any more — reload and look again'
          USING ERRCODE = 'P0002';
      END IF;
      v_prev_target := v_old_line.transfer_account_id;
      v_prev_link := v_old_line.linked_transfer_id;
    END IF;

    IF v_prev_link IS NOT NULL THEN
      -- ── A linked leg: pinned by the row on the other side ─────────────────
      IF v_amount <> v_old_line.amount THEN
        RAISE EXCEPTION 'split_leg_amount_locked: the line transferring to "%" has to stay %, because the transaction on the other side is for exactly that much — change the other lines, or delete that transfer first.',
          COALESCE((SELECT a.name FROM public.accounts a WHERE a.id = v_prev_target), 'another account'),
          to_char(v_old_line.amount, 'FM999999999990.00')
          USING ERRCODE = 'P0001';
      END IF;
      IF v_target IS DISTINCT FROM v_prev_target THEN
        RAISE EXCEPTION 'split_leg_target_locked: that line is already linked to a transaction in "%" — moving it would strand that row. Delete that transfer first, then edit the split.',
          COALESCE((SELECT a.name FROM public.accounts a WHERE a.id = v_prev_target), 'another account')
          USING ERRCODE = 'P0001';
      END IF;
      IF v_category <> v_old_line.category THEN
        RAISE EXCEPTION 'split_leg_category_locked: that line is one half of a transfer — its category names the account on the other side. Delete that transfer first, then re-file it.'
          USING ERRCODE = 'P0001';
      END IF;

      -- Position and memo are not structural, so they may move.
      UPDATE public.transaction_splits
         SET memo = v_memo, sort_order = v_ord, updated_at = now()
       WHERE id = v_old_line.id
      RETURNING * INTO v_new_line;

    ELSIF v_in_id IS NOT NULL THEN
      -- ── An ordinary stored line: free to change ───────────────────────────
      UPDATE public.transaction_splits
         SET category = v_category,
             amount = v_amount,
             memo = v_memo,
             sort_order = v_ord,
             transfer_account_id = v_target,
             updated_at = now()
       WHERE id = v_old_line.id
      RETURNING * INTO v_new_line;

    ELSE
      -- ── A new line ────────────────────────────────────────────────────────
      INSERT INTO public.transaction_splits
        (transaction_id, user_id, category, amount, memo, sort_order, transfer_account_id)
      VALUES
        (p_transaction_id, v_old.user_id, v_category, v_amount, v_memo, v_ord, v_target)
      RETURNING * INTO v_new_line;
    END IF;

    -- ── A line that BECOMES a leg gets its other side made, here and now ────
    -- Only when it did not already point at that account: a line whose target
    -- is unchanged keeps whatever link state it has, so a re-save can never
    -- mint a second counterpart for money that already has one. (An unlinked
    -- line that still carries a target is a leg whose counterpart was deleted
    -- — the matching sweep re-pairs those; inventing a new row here would
    -- duplicate the movement.)
    IF v_target IS NOT NULL AND v_new_line.linked_transfer_id IS NULL
       AND v_prev_target IS DISTINCT FROM v_target THEN

      -- The counterpart is -amount with no conversion, so both accounts must
      -- share a currency — the same guard, and the same reasoning, as
      -- create_transfer_counterpart (20260721090000). NULL currencies are
      -- unspecified and never block.
      SELECT * INTO v_src_acct FROM public.accounts
       WHERE id = v_old.account_id AND user_id = v_old.user_id;
      IF FOUND
         AND v_src_acct.currency IS NOT NULL
         AND v_acct.currency IS NOT NULL
         AND v_src_acct.currency <> v_acct.currency THEN
        RAISE EXCEPTION 'Transfers between accounts in different currencies are not supported yet (% and %)',
          v_src_acct.currency, v_acct.currency
          USING ERRCODE = 'P0001';
      END IF;

      -- Opposite of the LINE, never of the parent — the parent's total
      -- includes the other lines, and that is the entire point of a mixed
      -- split. The counterpart points back at BOTH the parent and the exact
      -- line, which is what makes the pair navigable from either end.
      INSERT INTO public.transactions
        (user_id, account_id, description, amount, type, date, category,
         notes, transfer_account_id, linked_transfer_id, linked_transfer_split_id, is_cleared)
      VALUES
        (v_old.user_id, v_target, v_old.description, -v_new_line.amount,
         'transfer', v_old.date,
         public.transfer_category_for(v_old.user_id, v_old.account_id, -v_new_line.amount),
         COALESCE(v_new_line.memo, v_old.notes),
         v_old.account_id, p_transaction_id, v_new_line.id, false)
      RETURNING * INTO v_counterpart;

      UPDATE public.transaction_splits
         SET linked_transfer_id = v_counterpart.id, updated_at = now()
       WHERE id = v_new_line.id
      RETURNING * INTO v_new_line;

      -- The new row moves the target account's ledger balance.
      UPDATE public.accounts
         SET balance = balance + v_counterpart.amount,
             updated_at = now()
       WHERE id = v_target AND user_id = v_old.user_id
      RETURNING * INTO v_acct_after;

      PERFORM public.write_financial_audit(
        v_old.user_id, 'transaction', v_counterpart.id, 'create', NULL, to_jsonb(v_counterpart));
      PERFORM public.write_financial_audit(
        v_old.user_id, 'account', v_acct_after.id, 'update',
        to_jsonb(v_acct), to_jsonb(v_acct_after));

      v_counterparts := v_counterparts || jsonb_build_array(to_jsonb(v_counterpart));
    END IF;

    v_sum := v_sum + v_amount;
    v_count := v_count + 1;
  END LOOP;

  IF p_expected_amount IS NOT NULL AND v_sum <> p_expected_amount THEN
    RAISE EXCEPTION 'split_total_mismatch: split lines sum to % but the transaction amount is %',
      v_sum, p_expected_amount
      USING ERRCODE = 'P0001',
            HINT = 'A transfer line''s amount is pinned by the transaction on its other side, so the remaining lines have to absorb the difference.';
  END IF;

  -- Verification, inside the transaction that would have to be rolled back:
  -- the stored lines ARE what this call thinks it wrote. A mismatch means a
  -- repeated id or a concurrent writer slipped past the guards above, and the
  -- parent amount below would then be a number no line set supports.
  SELECT count(*), COALESCE(sum(amount), 0)
    INTO v_stored_count, v_stored_sum
    FROM public.transaction_splits
   WHERE transaction_id = p_transaction_id;
  IF v_stored_count <> v_count OR v_stored_sum <> v_sum THEN
    RAISE EXCEPTION 'split_write_inconsistent: the split now holds % line(s) totalling %, but this edit described % line(s) totalling % — nothing has been saved',
      v_stored_count, v_stored_sum, v_count, v_sum
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.transactions
     SET is_split = true,
         category = '',            -- categorisation lives in the split lines
         amount = v_sum,
         updated_at = now()
   WHERE id = p_transaction_id
  RETURNING * INTO v_new;

  IF v_new.amount <> v_old.amount THEN
    SELECT * INTO v_acct
      FROM public.accounts
     WHERE id = v_new.account_id AND user_id = v_new.user_id;
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
      to_jsonb(v_acct), to_jsonb(v_acct_after));
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb)
    INTO v_new_splits
    FROM public.transaction_splits s
   WHERE s.transaction_id = p_transaction_id;

  -- A split is audited at its PARENT, with the whole line set embedded in
  -- before/after — the house pattern set_transaction_splits established.
  PERFORM public.write_financial_audit(
    v_new.user_id, 'transaction', v_new.id, 'update',
    to_jsonb(v_old) || jsonb_build_object('splits', v_old_splits),
    to_jsonb(v_new) || jsonb_build_object('splits', v_new_splits)
  );

  RETURN jsonb_build_object(
    'is_split', true,
    'split_count', v_count,
    'amount', v_sum,
    'counterparts', v_counterparts
  );
END;
$$;

COMMENT ON FUNCTION public.set_transaction_splits_with_legs(uuid, jsonb, numeric, uuid) IS
  'Writes a split whose lines may include TRANSFER LEGS, matching incoming lines to stored ones by id instead of replacing the set. Creates and links the counterpart for each line that becomes a leg (opposite of the LINE, not the parent), moving that account''s balance. A linked leg may change only its position and memo: removing one, or changing its amount, target or category, is refused by name. Everything else in the split is freely editable — which set_transaction_splits, replacing the whole set, could not allow. One financial_audit_log entry per row touched.';

-- ── link_split_line_transfer: pair an existing line with an existing row ────
--
-- The split-line counterpart of link_transfer_pair (20260716100000), and the
-- primitive the transfer-matching sweep needs: a split line carrying a
-- transfer_account_id with a NULL linked_transfer_id is an UNMATCHED leg — the
-- other side is sitting somewhere in that account, already imported by its own
-- bank, waiting to be recognised rather than duplicated.
--
-- Balance-neutral by construction: no amount, sign or account_id is written by
-- any statement here, so no balance arithmetic appears — the same property
-- (and the same reasoning) as link_transfer_pair. The invariants below are
-- copied from it, with the amounts compared against the LINE:
CREATE OR REPLACE FUNCTION public.link_split_line_transfer(
  p_split_id uuid,
  p_transaction_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_line        public.transaction_splits;
  v_line_new    public.transaction_splits;
  v_parent      public.transactions;
  v_txn         public.transactions;
  v_txn_new     public.transactions;
  v_old_splits  jsonb;
  v_new_splits  jsonb;
BEGIN
  SELECT * INTO v_line FROM public.transaction_splits
   WHERE id = p_split_id AND (p_user_id IS NULL OR user_id = p_user_id)
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'split_line_not_found: that split line no longer exists, or is not yours'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_parent FROM public.transactions
   WHERE id = v_line.transaction_id AND (p_user_id IS NULL OR user_id = p_user_id)
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002',
      HINT = 'The split that line belongs to no longer exists, or is not yours.';
  END IF;

  SELECT * INTO v_txn FROM public.transactions
   WHERE id = p_transaction_id AND (p_user_id IS NULL OR user_id = p_user_id)
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002',
      HINT = 'The transaction being paired with that line no longer exists, or is not yours.';
  END IF;

  IF v_txn.id = v_parent.id THEN
    RAISE EXCEPTION 'a transaction cannot be linked to itself' USING ERRCODE = '22023';
  END IF;
  IF v_line.linked_transfer_id IS NOT NULL THEN
    RAISE EXCEPTION 'split_line_already_linked: that line is already one half of a transfer — reload and look again'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_txn.linked_transfer_id IS NOT NULL OR v_txn.linked_transfer_split_id IS NOT NULL THEN
    RAISE EXCEPTION 'transaction is already part of a linked transfer' USING ERRCODE = 'P0001';
  END IF;
  IF v_txn.is_split THEN
    RAISE EXCEPTION 'a split transaction cannot become a transfer — remove the split first'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_txn.archived THEN
    RAISE EXCEPTION 'archived_row_not_repairable: that row is archived — bring it back into the register before pairing it'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_txn.account_id = v_parent.account_id THEN
    RAISE EXCEPTION 'a transfer needs two different accounts' USING ERRCODE = 'P0001';
  END IF;
  IF v_line.transfer_account_id IS NOT NULL
     AND v_line.transfer_account_id IS DISTINCT FROM v_txn.account_id THEN
    RAISE EXCEPTION 'split_line_target_mismatch: that line transfers to a different account from the one that row sits in'
      USING ERRCODE = 'P0001';
  END IF;
  -- Against the LINE, never the parent: the parent's total includes the other
  -- lines and is SUPPOSED to differ.
  IF v_line.amount = 0 OR v_txn.amount <> -v_line.amount THEN
    RAISE EXCEPTION 'transfer sides must have exactly opposite non-zero amounts (% vs %)',
      v_txn.amount, v_line.amount USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb)
    INTO v_old_splits
    FROM public.transaction_splits s
   WHERE s.transaction_id = v_parent.id;

  UPDATE public.transaction_splits
     SET transfer_account_id = v_txn.account_id,
         linked_transfer_id = v_txn.id,
         updated_at = now()
   WHERE id = v_line.id
  RETURNING * INTO v_line_new;

  -- The row over there files under the To/From category of the account the
  -- SPLIT sits in, and points back at both the parent and the exact line.
  UPDATE public.transactions
     SET type = 'transfer',
         category = public.transfer_category_for(v_parent.user_id, v_parent.account_id, v_txn.amount),
         transfer_account_id = v_parent.account_id,
         linked_transfer_id = v_parent.id,
         linked_transfer_split_id = v_line.id,
         updated_at = now()
   WHERE id = v_txn.id
  RETURNING * INTO v_txn_new;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb)
    INTO v_new_splits
    FROM public.transaction_splits s
   WHERE s.transaction_id = v_parent.id;

  PERFORM public.write_financial_audit(
    v_txn_new.user_id, 'transaction', v_txn_new.id, 'update',
    to_jsonb(v_txn), to_jsonb(v_txn_new));
  PERFORM public.write_financial_audit(
    v_parent.user_id, 'transaction', v_parent.id, 'update',
    to_jsonb(v_parent) || jsonb_build_object('splits', v_old_splits),
    to_jsonb(v_parent) || jsonb_build_object('splits', v_new_splits));

  RETURN jsonb_build_object('split', to_jsonb(v_line_new), 'transaction', to_jsonb(v_txn_new));
END;
$$;

COMMENT ON FUNCTION public.link_split_line_transfer(uuid, uuid, uuid) IS
  'Links an existing split LINE to an existing transaction as the two halves of a transfer: the line takes transfer_account_id + linked_transfer_id, the row takes type/category/transfer_account_id/linked_transfer_id (the split parent) and linked_transfer_split_id (the exact line). Amounts must be exactly opposite between the LINE and the row — never the parent, whose total legitimately differs. Balance-neutral; audited on the row and on the split parent.';

-- ── Grants ──────────────────────────────────────────────────────────────────
-- FROM PUBLIC, anon — naming anon explicitly, because REVOKE ... FROM PUBLIC
-- alone does NOT remove Supabase's named default grant to anon (the trap
-- documented at length in 20260725120000). Re-running these is a no-op.
REVOKE ALL ON FUNCTION public.set_transaction_splits_with_legs(uuid, jsonb, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_transaction_splits_with_legs(uuid, jsonb, numeric, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.link_split_line_transfer(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_split_line_transfer(uuid, uuid, uuid) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- Expected: exactly two rows, each showing `authenticated, service_role` and
-- neither PUBLIC nor anon.
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
  AND p.proname IN ('set_transaction_splits_with_legs', 'link_split_line_transfer')
ORDER BY 1;

-- The backlog this unblocks: split parents that contain a linked leg AND still
-- carry a line filed in the "Unassigned" bucket. Before this migration every
-- one of them was impossible to file through the UI, because touching any line
-- meant touching them all. Expected to fall as the owner works through them.
SELECT count(*) AS splits_with_a_leg_and_an_unfiled_line
  FROM (
    SELECT s.transaction_id
      FROM public.transaction_splits s
      JOIN public.categories c
        ON c.id::text = s.category AND c.user_id = s.user_id
     WHERE c.is_unassigned_bucket IS TRUE
       AND EXISTS (
             SELECT 1 FROM public.transaction_splits leg
              WHERE leg.transaction_id = s.transaction_id
                AND leg.linked_transfer_id IS NOT NULL)
     GROUP BY s.transaction_id
  ) backlog;
