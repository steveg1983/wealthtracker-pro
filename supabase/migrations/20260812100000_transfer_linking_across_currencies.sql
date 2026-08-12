-- ============================================================================
-- link_transfer_pair — refusal 5 becomes currency-aware
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). One function is replaced. No column is added,
-- no row is rewritten by the migration itself, no grant changes, and every
-- same-currency call behaves exactly as it did before.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- 20260716100000:108-110 guards the join with one unconditional rule:
--
--     IF v_a.amount = 0 OR v_a.amount <> -v_b.amount THEN
--       RAISE EXCEPTION 'transfer sides must have exactly opposite non-zero
--                        amounts (% vs %)', v_a.amount, v_b.amount;
--
-- Two amounts sum to zero only when they are in the same currency, or when the
-- rate between two currencies is exactly 1. So applied across a currency
-- boundary that rule is not strict — it refuses EVERY legitimate pair. A
-- conversion that nets to zero is not a conversion.
--
-- That was invisible for a year because the thing it refuses is not a thing
-- anybody could construct by hand to test, and because the sibling verb's
-- doc-comment (and this verb's own port) recorded "two accounts in different
-- currencies -> linked", which was true of the CURRENCY check — there has never
-- been one here — while refusal 5 quietly refused them all on the amounts.
--
-- The data settled it. This ledger already contains 70 legal cross-currency
-- transfer pairs, every one of them written by the MS Money importer, which
-- INSERTs rows directly and calls no RPC. Not one of them could have been made
-- through a runtime verb, and after an unlink not one of them could have been
-- put back. The engines were stricter than the data they were guarding, which
-- is not an invariant being enforced — it is an invariant that was never true.
--
-- ── THE RULE, IDENTICAL IN ALL THREE ENGINES ────────────────────────────────
-- This RPC, crates/wealth-core/src/verbs/link_transfer_pair.rs, and the demo
-- mirror in src/services/api/dataService.ts:
--
--   * accounts share a currency  -> UNCHANGED. Exactly opposite, non-zero.
--                                   Not weakened by a penny.
--   * currencies differ          -> both non-zero and OPPOSITE IN SIGN.
--                                   No constraint on magnitude.
--
-- No magnitude rule across the boundary, deliberately and permanently: the
-- ratio between the two magnitudes IS the achieved rate, spread and fees
-- included. The engine cannot know what the rate should have been, and a
-- tolerance band would refuse a real bank's real conversion on a volatile day.
-- What the rate WAS gets recorded by the client in metadata.fx, where a figure
-- can be accounted for; it is not something to re-derive and second-guess here.
--
-- Direction survives, because direction is the part that was ever about money:
-- one account down, one account up. Two sides that both fall are not one
-- movement seen twice, whatever the currencies.
--
-- A NULL or unreadable currency falls to the STRICT branch — the guard fires
-- only when BOTH currencies are set and differ, the same rule
-- 20260721090000:63-74 already uses. That is the safe direction: a currency
-- nobody can establish is not evidence that a conversion happened, so such a
-- pair must still sum to zero.
--
-- ── WHAT IS DELIBERATELY NOT TOUCHED ────────────────────────────────────────
-- create_transfer_counterpart keeps its flat cross-currency refusal
-- (20260721090000) and always will. That verb COPIES a number into the other
-- ledger; copying across a currency boundary is wrong at any rate, and no
-- dialog changes that. Joining two rows that already exist copies nothing — it
-- only says two movements that both really happened are one movement. That
-- distinction is the whole of this migration and it always was the whole of it.
--
-- repair_claimed_transfer (20260805145035) and link_split_line_transfer
-- (20260806094058) still carry the unconditional copy of refusal 5. Both are
-- join-shaped and the same argument probably reaches them, but "probably" is
-- not the standard this schema is held to: each needs its own measurement
-- against the reference cluster and its own specs. Out of scope here, recorded
-- rather than silently swept in.

BEGIN;

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
  v_a_currency text;
  v_b_currency text;
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

  -- Refusal 5, in two versions. Which one applies turns on the two ACCOUNTS,
  -- so they are read HERE and not sooner: every earlier refusal must still
  -- fire first, and the check just above has guaranteed the two ids differ.
  -- No FOR UPDATE — this verb is balance-neutral and writes no account row, so
  -- it has no reason to hold either one against a concurrent writer.
  SELECT currency INTO v_a_currency FROM public.accounts
   WHERE id = v_a.account_id AND user_id = v_a.user_id;
  SELECT currency INTO v_b_currency FROM public.accounts
   WHERE id = v_b.account_id AND user_id = v_b.user_id;

  IF v_a_currency IS NOT NULL AND v_b_currency IS NOT NULL
     AND v_a_currency <> v_b_currency THEN
    -- Across the boundary: direction, and nothing else. Both zero tests are
    -- spelled out — unlike the same-currency rule below, there is no negation
    -- here for a zero second side to fall foul of.
    IF v_a.amount = 0 OR v_b.amount = 0 OR sign(v_a.amount) = sign(v_b.amount) THEN
      RAISE EXCEPTION 'transfer sides in different currencies must be opposite in sign and non-zero (% % vs % %)',
        v_a_currency, v_a.amount, v_b_currency, v_b.amount USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_a.amount = 0 OR v_a.amount <> -v_b.amount THEN
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

  -- Amounts are untouched, so this is balance-neutral by construction — and
  -- that is exactly why a cross-currency join needs no conversion. Each side
  -- already counts against its own account in its own currency; the link only
  -- says the two are one movement.
  PERFORM public.write_financial_audit(
    v_a_new.user_id, 'transaction', v_a_new.id, 'update', to_jsonb(v_a), to_jsonb(v_a_new));
  PERFORM public.write_financial_audit(
    v_b_new.user_id, 'transaction', v_b_new.id, 'update', to_jsonb(v_b), to_jsonb(v_b_new));

  RETURN jsonb_build_object('a', to_jsonb(v_a_new), 'b', to_jsonb(v_b_new));
END;
$$;

-- Restated rather than assumed: CREATE OR REPLACE keeps the existing ACL, and
-- this says out loud that the surface is unchanged from 20260716100000:239-240.
REVOKE ALL ON FUNCTION public.link_transfer_pair(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.link_transfer_pair(uuid, uuid, uuid) TO authenticated, service_role;

COMMIT;
