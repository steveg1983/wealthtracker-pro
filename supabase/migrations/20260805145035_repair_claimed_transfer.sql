-- ============================================================================
-- STRANDED-TRANSFER REPAIR — the re-pair becomes ONE transaction, and the last
-- two client write paths that skipped the audit trail join it.
-- ============================================================================
-- IMPORTANT: Run this SQL in the Supabase SQL Editor to apply to production DB.
-- Safe to apply before the matching client deploys: everything here is a NEW
-- function, nothing existing is redefined, and no column changes. A database
-- with this applied and the old client running behaves exactly as it does now.
--
-- ── WHY: the re-pair is three changes that must all happen, or none ─────────
--
-- The stranded-transfer sweep offers a correction for the commonest wrong link
-- in real data: a counterpart is linked to the wrong row, while the row that
-- genuinely matches it sits stranded a few days away. Putting that right is:
--
--   1. break the wrong pairing — BOTH sides, because a half-broken pair IS a
--      one-sided transfer, the exact thing this whole feature exists to
--      prevent;
--   2. file the row that pairing displaces as Account Adjustment (a
--      revaluation: neither income nor spending), so the correction cannot
--      strand a row in its turn;
--   3. link the counterpart to the row that really matches it.
--
-- The client did this in three round trips with a hand-written compensation
-- (re-link the original pair if step 2 or 3 failed). That is a saga, not a
-- transaction. A browser closed between calls, a token that expires mid-way,
-- or a compensation that fails in ITS turn, all leave the ledger in a state no
-- single write intended — and the last of those cases could only be reported
-- to the user as prose telling them which rows to go and fix by hand.
--
-- repair_claimed_transfer below does all three in one database transaction.
-- Either the user's history is corrected or it is untouched; there is no third
-- outcome, and therefore no compensation to get wrong.
--
-- Balance-neutral by construction: no amount, sign or account_id is written by
-- any statement here, so no account balance arithmetic appears — the same
-- property (and the same reasoning) as link_transfer_pair.
--
-- ── AND WHY THE TWO SMALL RPCs ─────────────────────────────────────────────
--
-- Steps 1 and 3 above were reached from the client through two direct table
-- UPDATEs (TransactionService.clearTransferLinks / setTransactionArchived),
-- because no RPC carried their columns: update_transaction_atomic handles
-- neither linked_transfer_id nor archived. So there were two ways to change a
-- transaction — one of them audited, one of them silent. For a financial
-- ledger that is not a style problem, it is a hole in the compliance artifact:
-- financial_audit_log is supposed to be able to answer "what happened to this
-- row, and who did it", and for an unlink or an archive it could not.
--
-- Design choice, and the reason it is not "widen update_transaction_atomic":
--
--   * linked_transfer_id is not an ordinary column. It is one half of a MUTUAL
--     pointer. A generic per-row partial update that could set it would let a
--     caller point A at B without B pointing back — the API meant to protect
--     the invariant would become the easiest way to break it. Every path that
--     writes the column today (link_transfer_pair, create_transfer_counterpart,
--     and repair_claimed_transfer below) writes BOTH sides in one transaction,
--     and clear_transfer_links keeps that shape by taking a LIST of ids rather
--     than one.
--   * Both operations are set-shaped, not row-shaped. "Unlink this pair" is
--     two rows that must move together; update_transaction_atomic is single-row
--     by signature, so expressing it there means two calls — which is the very
--     problem being fixed.
--   * The schema already has exactly this pattern and it works:
--     set_transactions_cleared(p_ids, p_cleared, p_user_id) — a list, a value,
--     an owner guard, one audit entry per REAL change, a count returned.
--     archived and linked_transfer_id are the same shape as is_cleared.
--   * update_transaction_atomic is the busiest RPC in the schema. Widening it
--     for two columns no ordinary edit ever sets buys a bigger blast radius
--     for no gain.
--
-- All three functions are SECURITY INVOKER (RLS scopes the rows) with the usual
-- p_user_id defence-in-depth guard, matching link_transfer_pair exactly.
-- ============================================================================

BEGIN;

-- ── clear_transfer_links: the audited un-doing of link_transfer_pair ────────
--
-- Shaped on set_transactions_cleared (20260707120000). Guarantees, in order:
--
--   * every named id must resolve to a row this owner has, or the whole call
--     raises transaction_not_found — the client used to have to inspect a
--     returned count to notice that; a caller naming a row that is not there
--     has a stale picture and should be told, not quietly given a smaller
--     number;
--   * a row whose link lives on a split LINE (linked_transfer_split_id) is
--     SKIPPED, never unlinked here: that structure is unpicked by editing the
--     split, and clearing only the transaction side would leave the split line
--     pointing at a row that no longer points back;
--   * a row that is already unlinked is skipped — no write, no audit noise;
--   * every real change gets its own financial_audit_log entry.
--
-- Only the named rows are touched. It does NOT chase reciprocals: the caller
-- names every row it means to unlink (the repair below names both sides of the
-- pair it breaks), and silently editing rows the caller did not name would
-- make the returned count a fiction and the client's local state wrong.
--
-- Balance-neutral: no amount, sign or account is touched. Returns the number of
-- rows actually unlinked.
CREATE OR REPLACE FUNCTION public.clear_transfer_links(
  p_ids uuid[],
  p_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_named integer;
  v_seen  integer;
  v_old public.transactions;
  v_new public.transactions;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  SELECT count(DISTINCT x) INTO v_named FROM unnest(p_ids) AS x;
  SELECT count(*) INTO v_seen
    FROM public.transactions
   WHERE id = ANY(p_ids)
     AND (p_user_id IS NULL OR user_id = p_user_id);
  IF v_seen <> v_named THEN
    RAISE EXCEPTION 'transaction_not_found'
      USING ERRCODE = 'P0002',
            HINT = 'One of the transactions named for unlinking no longer exists, or is not yours.';
  END IF;

  FOR v_old IN
    SELECT * FROM public.transactions
     WHERE id = ANY(p_ids)
       AND (p_user_id IS NULL OR user_id = p_user_id)
       AND linked_transfer_id IS NOT NULL
       AND linked_transfer_split_id IS NULL
     ORDER BY id     -- concurrent calls walk the rows the same way
     FOR UPDATE
  LOOP
    UPDATE public.transactions
       SET linked_transfer_id = NULL,
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

COMMENT ON FUNCTION public.clear_transfer_links(uuid[], uuid) IS
  'Audited un-doing of link_transfer_pair: clears linked_transfer_id on the named rows (skipping split-line legs and rows already unlinked), one financial_audit_log entry per real change. Balance-neutral. Raises transaction_not_found if any named id is not an owned row.';

-- ── set_transactions_archived: the audited per-row soft archive ─────────────
--
-- The per-row counterpart of archive_transactions_before (20260721130000),
-- which only works by account and cutoff. Never a delete: the row stays in the
-- table, stays counted in the account balance and in every report, and is
-- hidden only from the live register — so this is balance-neutral too.
--
-- Same contract as clear_transfer_links: unknown/unowned ids raise, rows
-- already in the requested state are skipped, each real change is audited.
-- (The skip matters for the client: an "archive this" that runs twice is a
-- no-op, not an error, and the raise above is what still distinguishes "the
-- row was already archived" from "the row is not there".)
CREATE OR REPLACE FUNCTION public.set_transactions_archived(
  p_ids uuid[],
  p_archived boolean,
  p_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_named integer;
  v_seen  integer;
  v_old public.transactions;
  v_new public.transactions;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;
  IF p_archived IS NULL THEN
    RAISE EXCEPTION 'p_archived must be true or false' USING ERRCODE = '22023';
  END IF;

  SELECT count(DISTINCT x) INTO v_named FROM unnest(p_ids) AS x;
  SELECT count(*) INTO v_seen
    FROM public.transactions
   WHERE id = ANY(p_ids)
     AND (p_user_id IS NULL OR user_id = p_user_id);
  IF v_seen <> v_named THEN
    RAISE EXCEPTION 'transaction_not_found'
      USING ERRCODE = 'P0002',
            HINT = 'One of the transactions named for archiving no longer exists, or is not yours.';
  END IF;

  FOR v_old IN
    SELECT * FROM public.transactions
     WHERE id = ANY(p_ids)
       AND (p_user_id IS NULL OR user_id = p_user_id)
       AND archived IS DISTINCT FROM p_archived
     ORDER BY id     -- concurrent calls walk the rows the same way
     FOR UPDATE
  LOOP
    UPDATE public.transactions
       SET archived = p_archived,
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

COMMENT ON FUNCTION public.set_transactions_archived(uuid[], boolean, uuid) IS
  'Per-row soft archive/restore, audited. Never deletes: the row stays counted in every balance and report and is hidden only from the live register. Raises transaction_not_found if any named id is not an owned row.';

-- ── repair_claimed_transfer: the whole re-pair, atomically ──────────────────
--
--   p_stranded_id            the uncategorised, unlinked row that really
--                            matches the counterpart;
--   p_counterpart_id         the row currently linked to the WRONG partner;
--   p_partner_id             that wrong partner — the row this repair displaces
--                            and files as an adjustment;
--   p_adjustment_category_id the user's OWN 'Account Adjustment' category id
--                            (resolved client-side from their category tree;
--                            never created, never assumed, validated here);
--   p_user_id                the usual defence-in-depth owner guard.
--
-- Every one of the three rows is written EXACTLY ONCE, so each row's audit
-- entry — before = what the user was looking at, after = the finished state —
-- is the whole story of what this repair did to it. That is the reason the link
-- step is spelled out here instead of calling link_transfer_pair: a nested call
-- would record its own audit entries with `before` set to the intermediate,
-- half-repaired state, and the log would no longer show what the rows looked
-- like when the user pressed the button. The invariants below are copied
-- VERBATIM from link_transfer_pair (20260716100000) and must be kept in step
-- with it; the category each side lands on comes from the same shared helper,
-- transfer_category_for, so there is only one definition of that rule.
--
-- Returns {stranded, counterpart, partner} as jsonb — the finished rows, so the
-- client updates its state from what the database actually wrote rather than
-- from what it hoped for.
CREATE OR REPLACE FUNCTION public.repair_claimed_transfer(
  p_stranded_id uuid,
  p_counterpart_id uuid,
  p_partner_id uuid,
  p_adjustment_category_id text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_stranded        public.transactions;
  v_counterpart     public.transactions;
  v_partner         public.transactions;
  v_stranded_new    public.transactions;
  v_counterpart_new public.transactions;
  v_partner_new     public.transactions;
  v_owner uuid;
BEGIN
  -- Message style follows split_amount_locked (20260713100000): a machine-
  -- readable code, then the sentence the user actually needs. The client
  -- surfaces error.message verbatim, so a bare code would reach a human toast.
  IF p_stranded_id = p_counterpart_id
     OR p_stranded_id = p_partner_id
     OR p_counterpart_id = p_partner_id THEN
    RAISE EXCEPTION 'repair_needs_three_distinct_rows: the stranded row, its other side, and the row that side is linked to today must be three different transactions'
      USING ERRCODE = '22023';
  END IF;

  -- Lock all three up front, in id order, so concurrent repairs take them the
  -- same way round — the same statement link_transfer_pair uses.
  PERFORM 1 FROM public.transactions
   WHERE id IN (p_stranded_id, p_counterpart_id, p_partner_id)
     AND (p_user_id IS NULL OR user_id = p_user_id)
   ORDER BY id
   FOR UPDATE;

  SELECT * INTO v_stranded FROM public.transactions
   WHERE id = p_stranded_id AND (p_user_id IS NULL OR user_id = p_user_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002',
      HINT = 'The stranded transaction no longer exists, or is not yours.';
  END IF;

  SELECT * INTO v_counterpart FROM public.transactions
   WHERE id = p_counterpart_id AND (p_user_id IS NULL OR user_id = p_user_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002',
      HINT = 'The counterpart transaction no longer exists, or is not yours.';
  END IF;

  SELECT * INTO v_partner FROM public.transactions
   WHERE id = p_partner_id AND (p_user_id IS NULL OR user_id = p_user_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002',
      HINT = 'The transaction being displaced no longer exists, or is not yours.';
  END IF;

  v_owner := v_stranded.user_id;
  IF v_counterpart.user_id <> v_owner OR v_partner.user_id <> v_owner THEN
    RAISE EXCEPTION 'transactions belong to different users' USING ERRCODE = '28000';
  END IF;

  -- ── The pairing being broken must still be the one the caller saw ────────
  -- Mutual, both ways round: a stale browser tab must not be able to unlink a
  -- pair that somebody (or some other device) has already re-arranged.
  IF v_counterpart.linked_transfer_id IS DISTINCT FROM v_partner.id
     OR v_partner.linked_transfer_id IS DISTINCT FROM v_counterpart.id THEN
    RAISE EXCEPTION 'transfer_pair_not_linked: those two rows are not linked to each other any more — reload and look again'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Structures this repair must not touch ────────────────────────────────
  IF v_stranded.is_split OR v_counterpart.is_split OR v_partner.is_split THEN
    RAISE EXCEPTION 'a split transaction cannot become a transfer — remove the split first'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_stranded.linked_transfer_split_id IS NOT NULL
     OR v_counterpart.linked_transfer_split_id IS NOT NULL
     OR v_partner.linked_transfer_split_id IS NOT NULL THEN
    RAISE EXCEPTION 'transfer_leg_locked_by_split_line: one of these legs is the opposite side of a split line — edit the split to unpick it first'
      USING ERRCODE = 'P0001';
  END IF;
  -- Archived rows are out of the live register: repairing one would change
  -- something the user cannot see.
  IF v_stranded.archived OR v_counterpart.archived OR v_partner.archived THEN
    RAISE EXCEPTION 'archived_row_not_repairable: one of these rows is archived — bring it back into the register before re-pairing it'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── The stranded row must genuinely be free ──────────────────────────────
  IF v_stranded.linked_transfer_id IS NOT NULL THEN
    RAISE EXCEPTION 'stranded_row_already_linked: that row has been linked to something else since this list was built — reload and look again'
      USING ERRCODE = 'P0001';
  END IF;
  -- "Uncategorised" means what the sweep means by it: no category, or one that
  -- does not resolve to a category this user actually has (legacy sentinels
  -- such as 'transfer-out' resolve to nothing and do not count as a filing).
  IF btrim(COALESCE(v_stranded.category, '')) <> ''
     AND EXISTS (
       SELECT 1 FROM public.categories c
        WHERE c.id::text = v_stranded.category
          AND c.user_id = v_owner
     ) THEN
    RAISE EXCEPTION 'stranded_row_already_categorised: that row has been filed under a category since this list was built — reload and look again'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Link invariants, copied verbatim from link_transfer_pair ─────────────
  IF v_counterpart.account_id = v_stranded.account_id THEN
    RAISE EXCEPTION 'a transfer needs two different accounts' USING ERRCODE = 'P0001';
  END IF;
  IF v_counterpart.amount = 0 OR v_counterpart.amount <> -v_stranded.amount THEN
    RAISE EXCEPTION 'transfer sides must have exactly opposite non-zero amounts (% vs %)',
      v_counterpart.amount, v_stranded.amount USING ERRCODE = 'P0001';
  END IF;

  -- ── The adjustment category must be the user's own, and fileable ─────────
  -- Mirrors the client's resolveAdjustmentCategory: a real category of this
  -- user's, active, not a To/From transfer category, and not a bare type root
  -- (nothing is filed against a root). The revaluation FLAG is deliberately not
  -- required — a category tree that predates it can still hold a legitimate
  -- 'Account Adjustment' leaf, and the client resolves that same fallback.
  IF NOT EXISTS (
    SELECT 1 FROM public.categories c
     WHERE c.id::text = p_adjustment_category_id
       AND c.user_id = v_owner
       AND c.is_transfer_category IS NOT TRUE
       AND c.is_active IS NOT FALSE
       AND c.level <> 'type'
  ) THEN
    RAISE EXCEPTION 'unknown or transfer category: %', p_adjustment_category_id
      USING ERRCODE = '22023',
            HINT = 'The row this repair frees up is filed under your own Account Adjustment category, and that category could not be found.';
  END IF;

  -- ── 1 + 2. The displaced partner: unlinked and filed, in one write ───────
  -- It stops being half of a transfer, so the transfer scaffolding goes with
  -- the link: type by the money's own direction, no target account, filed
  -- under the adjustment (a revaluation — neither income nor spending).
  UPDATE public.transactions
     SET linked_transfer_id = NULL,
         transfer_account_id = NULL,
         category = p_adjustment_category_id,
         type = CASE WHEN amount < 0 THEN 'expense' ELSE 'income' END,
         updated_at = now()
   WHERE id = v_partner.id
  RETURNING * INTO v_partner_new;

  -- ── 3. The counterpart is re-pointed at the row that really matches it ───
  -- Each side files under the OTHER account's To/From category, exactly as
  -- link_transfer_pair does.
  UPDATE public.transactions
     SET type = 'transfer',
         category = public.transfer_category_for(v_owner, v_stranded.account_id, v_counterpart.amount),
         transfer_account_id = v_stranded.account_id,
         linked_transfer_id = v_stranded.id,
         updated_at = now()
   WHERE id = v_counterpart.id
  RETURNING * INTO v_counterpart_new;

  UPDATE public.transactions
     SET type = 'transfer',
         category = public.transfer_category_for(v_owner, v_counterpart.account_id, v_stranded.amount),
         transfer_account_id = v_counterpart.account_id,
         linked_transfer_id = v_counterpart.id,
         updated_at = now()
   WHERE id = v_stranded.id
  RETURNING * INTO v_stranded_new;

  -- ── Audit: one entry per row touched, before = what the user saw ─────────
  -- Amounts, signs and accounts are untouched throughout, so this is
  -- balance-neutral by construction and no account row changes.
  PERFORM public.write_financial_audit(
    v_owner, 'transaction', v_partner_new.id, 'update',
    to_jsonb(v_partner), to_jsonb(v_partner_new));
  PERFORM public.write_financial_audit(
    v_owner, 'transaction', v_counterpart_new.id, 'update',
    to_jsonb(v_counterpart), to_jsonb(v_counterpart_new));
  PERFORM public.write_financial_audit(
    v_owner, 'transaction', v_stranded_new.id, 'update',
    to_jsonb(v_stranded), to_jsonb(v_stranded_new));

  RETURN jsonb_build_object(
    'stranded',    to_jsonb(v_stranded_new),
    'counterpart', to_jsonb(v_counterpart_new),
    'partner',     to_jsonb(v_partner_new)
  );
END;
$$;

COMMENT ON FUNCTION public.repair_claimed_transfer(uuid, uuid, uuid, text, uuid) IS
  'Re-pairs a counterpart onto the row that really matches it in ONE transaction: breaks the wrong pairing, files the displaced row under the caller''s own Account Adjustment category, and links the right pair. Balance-neutral; every row touched is written once and audited once. Replaces a three-call client sequence that needed compensation.';

-- ── Grants ──────────────────────────────────────────────────────────────────
-- FROM PUBLIC, anon — naming anon explicitly, because REVOKE ... FROM PUBLIC
-- alone does NOT remove Supabase's named default grant to anon (the trap
-- documented at length in 20260725120000). Re-running these is a no-op.
REVOKE ALL ON FUNCTION public.clear_transfer_links(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_transfer_links(uuid[], uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_transactions_archived(uuid[], boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_transactions_archived(uuid[], boolean, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.repair_claimed_transfer(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_claimed_transfer(uuid, uuid, uuid, text, uuid) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- Expected: exactly three rows, each showing `authenticated, service_role` and
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
  AND p.proname IN ('clear_transfer_links', 'set_transactions_archived', 'repair_claimed_transfer')
ORDER BY 1;
