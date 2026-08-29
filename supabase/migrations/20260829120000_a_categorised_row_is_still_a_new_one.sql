-- ============================================================================
-- A CATEGORISED ROW IS STILL A NEW ONE — the bank feed marks its rows for
-- review again, and remembers the payee again
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). UNTIL IT IS APPLIED, EVERY ROW A BANK FEED
-- DELIVERS GOES ON ARRIVING PRE-REVIEWED AND UNCATEGORISED. No application
-- deploy changes that: the behaviour is entirely inside this function.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- The owner, 29 August: his British Airways Amex feed delivered ten new
-- transactions, every one of them uncategorised — and the account's "To Review"
-- column read 0, so the Accounts page offered him "Reconcile 2 accounts"
-- instead of the ten rows that had just landed. Both halves of that report are
-- the same defect, and it is a REGRESSION, not a gap.
--
-- 20260828180000_a_fed_row_can_arrive_categorised.sql patched this function's
-- text rather than retyping it — the right method — but it patched the WRONG
-- ANCESTOR: the 2026-06-13 original, not the definition that was actually
-- live. Three later migrations had changed this function in between, and
-- restating the June body silently reverted all three:
--
--   * 20260707120000 — the explicit `is_cleared = false`. HARMLESS in effect:
--     the column is NOT NULL DEFAULT false (20260310000200), so an omitted
--     value still lands false. Restored below anyway, because a financial
--     function should state what it means rather than inherit it.
--   * 20260708100000 + 20260722140000 + 20260808100000 — payee memory and
--     category provenance. THIS IS THE OWNER'S "all uncategorised": a fed row
--     whose payee he had filed a hundred times before stopped inheriting that
--     category, because the code that looked it up was gone. `category_confirmed`
--     went with it, so nothing could tell a provider's own category from the
--     app's guess.
--   * 20260810090000 — `needs_review = true`. THIS IS THE OWNER'S 0. The
--     column is NOT NULL DEFAULT false and, as src/utils/transactionReview.ts
--     records, only the import paths ever say true. With the write gone, every
--     fed row was born already reviewed.
--
-- Nothing was wrong with the Accounts page. The "To Review" column, its
-- per-account counts, the travelling amber control and the attention ladder's
-- `review` rung (which already outranks `reconcile` — src/utils/attentionLadder)
-- were all correct and all being fed zeroes.
--
-- ── HOW THIS FILE WAS MADE ──────────────────────────────────────────────────
--
-- By PATCHING TEXT, from the right ancestor this time. The body below is
-- 20260810090000's definition byte for byte, with exactly two string
-- substitutions applied programmatically (`tags` added to the column list, and
-- its matching CASE expression added to the values list, both lifted verbatim
-- from 20260828180000). Nothing was retyped from a reading of the file.
--
-- That is not ceremony. This function carries two `write_financial_audit`
-- calls, a `FOR UPDATE` lock, an ownership check, and a backfill branch that
-- shifts `initial_balance` instead of `balance` — invert or drop any of those
-- and balances corrupt. The last attempt to hand-restate it dropped three
-- migrations' worth of behaviour and nobody noticed for a day.
--
-- `tags` is placed BEFORE `needs_review` in both lists deliberately, so the
-- `true    -- needs_review` line stays byte-identical to 20260810090000 and the
-- fingerprint that migration's own verification greps for still matches.
--
-- ── WHY THERE IS NO SEPARATE `category` COLUMN IN THE INSERT ────────────────
--
-- 20260828180000 added `NULLIF(r->>'category', '')` to the column list to carry
-- a rule's answer. Against the June base that was necessary; against the base
-- restored here it is REDUNDANT, and adding it back would be a second writer
-- for one field. The 10 August body already reads the row's category as the
-- FIRST thing it does:
--
--     v_category := NULLIF(btrim(COALESCE(r->>'category', '')), '');
--
-- and only falls through to payee memory when that is empty. So a ruled row —
-- api/banking/sync-transactions.ts runs applyFeedRules over the insert
-- candidates and sends the result in `category` — arrives categorised exactly
-- as 20260828180000 intended, with `category_confirmed = true` because a
-- category the row arrived with is not this function's guess. The rules-on-feeds
-- feature is fully preserved; only its duplicate plumbing is dropped. `tags`
-- has no such equivalent, which is why it is the one thing genuinely added.
--
-- ── THE DESIGN DECISION: A RULE'S ANSWER IS NOT A LOOK ──────────────────────
--
-- Rules now categorise fed rows (20260828180000 + api/banking/sync-transactions
-- + src/services/banking/feedRules), and `needs_review` is deliberately NOT
-- conditional on that. Review asks about the ROW; provenance asks about the
-- CATEGORY. A row a rule filed is still a row nobody has laid eyes on — wrong
-- amount, wrong date, a payment they do not recognise — and
-- src/utils/transactionReview.ts draws exactly that distinction in its header.
-- So every insert here is `true`, ruled or not. Note the contrast with
-- `category_confirmed` on the same INSERT, which IS conditional: a category the
-- row arrived with was not this function's guess, and is marked accordingly.
--
-- ── THE BACKFILL EXEMPTION, CONSIDERED AND REJECTED ─────────────────────────
--
-- The tempting refinement is `needs_review = NOT v_is_backfill`: exempt an
-- account's first-ever sync, so connecting a bank does not print months of
-- history in bold — the harm 20260810090000's header names as the reason
-- history was never backfilled to "new". It was rejected on three measured
-- grounds:
--
--   1. THE SIGNAL IS PER-CALL, AND THE CALLER CHUNKS. `v_backfills` is a local
--      variable, and api/banking/sync-transactions.ts calls this RPC once per
--      200 rows. On a first sync of 300 rows, chunk 1 finds no external rows
--      and is a backfill; chunk 2 finds chunk 1's and is not. The exemption
--      would mark the first 200 reviewed and the next 100 new, split at a
--      boundary no user could see or explain. An arbitrary answer is worse
--      than either consistent one.
--   2. THE FLOOD IS BOUNDED ANYWAY. A first sync asks for at most ninety days
--      (PSD2 — see `syncWindowStart`), not years. Ninety days of rows nobody
--      has seen IN THIS APP is not history the user has already worked
--      through; it is precisely the pile the review flow exists to work down.
--      That is the opposite of the MS Money case 20260810090000 exempted,
--      where the user HAD already dealt with every row, in Money.
--   3. IT WOULD BE A NEW RULE SMUGGLED INTO A REPAIR. Unconditional `true` is
--      what 20260810090000 deliberately chose and argued for. This migration's
--      job is to put that back, not to relitigate it while nobody is looking.
--
-- If the flood is ever measured to be real, the honest fix is a caller that
-- states its intent for the whole sync — not a per-chunk guess. Recorded here
-- so the next person does not have to rediscover the chunking.
--
-- ── THE ROWS ALREADY DAMAGED, AND WHAT IS ACTUALLY WRONG WITH THEM ──────────
--
-- Replacing the function fixes the NEXT sync. It does nothing for the rows that
-- already landed under the broken one — the owner's ten BA Amex transactions
-- among them — so the repair below fixes those too. What is genuinely wrong
-- with them was MEASURED against the schema rather than assumed, and it is less
-- than it first appears:
--
--   * `needs_review` — REAL DAMAGE. Column is NOT NULL DEFAULT false, so an
--     omitted value means "already reviewed". Repaired.
--   * `category` — REAL DAMAGE where payee memory would have had an answer.
--     Repaired, with `category_confirmed = false` on the backfilled guess,
--     which is exactly what the function would have written.
--   * `is_cleared` — NOT DAMAGED, AND NOT THIS MIGRATION'S BUSINESS. Two
--     independent reasons, either of which alone settles it. First, measured:
--     the column is NOT NULL DEFAULT false (20260310000200), so the omitted
--     value still landed false and these rows arrived uncleared exactly as
--     they should have. Second, and decisive: the owner reports the C marks on
--     these rows are HIS, made on the reconcile screen — "I actually marked
--     them as C, so it wasn't the system jumping the gun". A repair that
--     wrote is_cleared would be undoing a person's work on the strength of a
--     guess about how it got there. NOTHING BELOW READS OR WRITES is_cleared.
--   * `category_confirmed` — NOT DAMAGED on its own. Column defaults true, and
--     the function's own rule is that a blank category is confirmed ("a blank
--     has nothing to vouch for"). It only moves where a guess is backfilled.
--
-- ── WHY THE WINDOW IS `created_at >= 2026-08-28` ────────────────────────────
--
-- The broken definition existed from the moment 20260828180000 was applied.
-- Nothing records that instant, so the migration's own date is the closest
-- honest boundary, and it is deliberately WIDE rather than narrow: a fed row
-- created on 28 August BEFORE the bad function went live was written by the
-- GOOD one, so it already carries needs_review = true and a payee-memory
-- category, and every statement below is a no-op against it. Being too early
-- costs nothing; being too late would leave damaged rows unrepaired.
--
-- ── THE TWO HALVES HAVE DIFFERENT SCOPES, ON PURPOSE ────────────────────────
--
-- Reconciliation is the one signal that a person has vouched for a row, and it
-- vouches for THE MONEY — that this amount, on this date, is really what the
-- bank says. It does not vouch for the category. So:
--
--   (a) needs_review = true — SKIPS reconciled rows. Re-opening a row the
--       owner has finalised would be the app arguing with him about work he
--       has completed. Everything else in the window gets it, including rows
--       he has merely marked C: clearing is a step ON THE WAY to that
--       judgement, not the judgement itself.
--   (b) the payee-memory category — applies REGARDLESS of reconciliation. A
--       reconciled row with no category still wants the suggestion, because
--       agreeing the money says nothing about where it should be filed.
--
-- An earlier draft of this repair also required `updated_at = created_at`
-- ("still in machine state"). THAT WOULD HAVE MISSED THE OWNER'S ACTUAL ROWS:
-- marking C is an UPDATE, so the very rows he is complaining about had already
-- left machine state, and the repair would have silently done nothing. Removed.
-- Reconciliation is the line; nothing else is.
--
-- What is never touched:
--
--   * a category the owner has already typed — the backfill only fills
--     `category IS NULL`.
--   * a SPLIT row's category. `protect_split_transaction_fields` raises
--     `split_category_locked` on any non-empty category written to a split
--     parent, so without this exclusion one split fed row would abort the
--     entire migration. It is also right on the merits: a split row's
--     categorisation lives in its split lines, so it does not want a guess.
--     Such a row still gets (a).
--   * `is_cleared`, in any state, for the reasons above.
--
-- The loop is row-by-row rather than one set-based UPDATE for one reason: the
-- function it is imitating lets rows categorised earlier in a batch feed the
-- payee memory of later ones, and a set-based UPDATE would evaluate every guess
-- against the pre-repair state. Ordering by date reproduces that cascade. The
-- window is a day or two of one household's bank feed, so the cost is nothing.
--
-- Each repaired row gets a `write_financial_audit` entry, because there is no
-- audit TRIGGER on this table — verified against the catalog, not assumed — and
-- a corrective write to a financial ledger that leaves no trace is exactly what
-- the audit rule exists to prevent.
--
-- ── BALANCE REASONING ───────────────────────────────────────────────────────
--
-- Balance-neutral by construction. Every balance statement below — the
-- per-account `FOR UPDATE` + ownership check, the backfill branch's
-- `initial_balance = COALESCE(initial_balance, 0) - v_sum`, the incremental
-- branch's `balance = balance + v_sum`, and both `write_financial_audit` calls
-- — is byte-for-byte 20260810090000's, which is byte-for-byte the June
-- original's. The two substitutions touch a text[] column and a boolean. No
-- amount, sign, account_id or date is read or written differently, and the
-- invariant `balance = initial_balance + Σ(amount)` is untouched.
--
-- The data repair is balance-neutral for the stronger reason that it writes
-- only `needs_review`, `category` and `category_confirmed`. It inserts and
-- deletes nothing, so Σ(amount) cannot move; it never writes `amount`,
-- `account_id`, `date` or `type`, so no row changes which account or which
-- direction it belongs to; and it touches no `accounts` row at all.
-- Verification 5 proves all of this rather than asserting it.
--
-- Signature, SECURITY INVOKER, pinned search_path and grants all unchanged.
-- ============================================================================

BEGIN;

-- ── Refuse, BY NAME, unless the live function is one of the two states this
--    body was derived to replace ──────────────────────────────────────────────
-- The failure this guards is the one that caused the bug: replacing a
-- definition that is not the one you think you are replacing. Only two states
-- are acceptable — the regressed 28-Aug body (the expected case), or the
-- 10-Aug body if 28-Aug was never applied (this body is a strict superset of
-- it). Anything else, including this migration already being applied, aborts
-- the whole transaction.
DO $$
DECLARE
  v_src text;
  v_has_review boolean;
  v_has_payee  boolean;
  v_has_tags   boolean;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'feed_importer_missing: import_bank_transactions_atomic does not exist — apply 20260613090000_bank_sync_atomic_import.sql first.'
      USING ERRCODE = 'P0002';
  END IF;

  v_has_review := position('needs_review' IN v_src) > 0;
  v_has_payee  := position('payee_memory_category(' IN v_src) > 0;
  v_has_tags   := position('jsonb_array_elements_text(r->''tags'')' IN v_src) > 0;

  -- Already repaired: all three present. Refuse rather than replace, so a
  -- second run cannot quietly overwrite something newer than this file.
  IF v_has_review AND v_has_payee AND v_has_tags THEN
    RAISE EXCEPTION 'feed_importer_already_repaired: import_bank_transactions_atomic already carries needs_review, payee memory and tags — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001';
  END IF;

  -- State A — the regression this file exists for: 20260828180000 applied.
  -- State B — 20260828180000 never applied; this body is a superset of what is
  -- live, so applying it is still correct and additionally delivers tags.
  IF NOT (
       (v_has_tags AND NOT v_has_review AND NOT v_has_payee)   -- A
    OR (NOT v_has_tags AND v_has_review AND v_has_payee)       -- B
  ) THEN
    RAISE EXCEPTION 'feed_importer_unrecognised: import_bank_transactions_atomic is in a state this migration was not derived from (needs_review=%, payee_memory=%, tags=%). Someone has changed it since 2026-08-28. Review by hand rather than letting this restate it.',
      v_has_review, v_has_payee, v_has_tags
      USING ERRCODE = 'P0001';
  END IF;

  -- The helper the restored body calls. If it is gone, the body below would
  -- reference a function this database lacks — and a plpgsql body is not parsed
  -- until it is CALLED, so that failure would surface during a bank sync
  -- rather than here.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'payee_memory_category'
  ) THEN
    RAISE EXCEPTION 'payee_memory_helper_missing: public.payee_memory_category does not exist — apply 20260722140000_payee_memory_most_common.sql first.'
      USING ERRCODE = 'P0002';
  END IF;

  -- The column the restored body writes.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'transactions'
       AND column_name = 'needs_review'
  ) THEN
    RAISE EXCEPTION 'needs_review_column_missing: transactions.needs_review does not exist — apply 20260810090000_imported_rows_arrive_new.sql first.'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- ── The function ────────────────────────────────────────────────────────────
-- 20260810090000's definition, plus `tags` from 20260828180000. Generated by
-- text substitution; see "HOW THIS FILE WAS MADE" above.
CREATE OR REPLACE FUNCTION public.import_bank_transactions_atomic(
  p_user_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_tx public.transactions;
  v_acct uuid;
  v_acct_key text;
  v_is_backfill boolean;
  v_backfills jsonb := '{}'::jsonb;   -- account_id -> backfill? (decided BEFORE its first insert)
  v_sums jsonb := '{}'::jsonb;        -- account_id -> Σ(inserted amounts)
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_sum numeric;
  v_before public.accounts;
  v_after public.accounts;
  v_category text;
  -- Did the category below come from the ROW (the provider stated it, or the
  -- caller did) or from payee memory (the app guessed it)? Only the second is a
  -- suggestion.
  v_category_confirmed boolean;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a jsonb array' USING ERRCODE = '22023';
  END IF;

  FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF (r->>'user_id')::uuid IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'row user_id does not match p_user_id' USING ERRCODE = '28000';
    END IF;

    v_acct := (r->>'account_id')::uuid;
    v_acct_key := v_acct::text;

    -- Backfill detection MUST precede the account's first insert of this call:
    -- "no previously imported bank transaction exists for this account".
    IF NOT v_backfills ? v_acct_key THEN
      SELECT NOT EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.account_id = v_acct
          AND t.external_transaction_id IS NOT NULL
      ) INTO v_is_backfill;
      v_backfills := v_backfills || jsonb_build_object(v_acct_key, v_is_backfill);
    END IF;

    -- Account-scoped dedupe (handler pre-filters per connection; this also
    -- catches re-imports after a reconnect under a new connection_id).
    IF EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.account_id = v_acct
        AND t.external_transaction_id = r->>'external_transaction_id'
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Payee memory: inherit the category this payee is MOST OFTEN filed
    -- under in this account, for the same direction (an expense never
    -- inherits an income category). Most-recent used to win, which let a
    -- single one-off redirect every future import of that payee.
    -- Transfer rows and the transfer system categories are excluded — a
    -- reclassified standing order must not stamp 'transfer-out' onto next
    -- month's plain import. The handler's 'Bank transaction' fallback for
    -- description-less rows is a sentinel, not a payee — matching on it
    -- would fuse unrelated merchants into one mega-payee, so it never
    -- participates. Rows inserted earlier in this same batch participate,
    -- so a categorized payee cascades through the whole import.
    v_category := NULLIF(btrim(COALESCE(r->>'category', '')), '');
    -- A category the row arrived with is not this function's guess, so it is
    -- not marked as one. A row with NO category at the end of this block is
    -- confirmed too: a blank has nothing to vouch for, and marking blanks
    -- unconfirmed would put rows with no category into the "check these
    -- suggestions" list, where there is nothing to look at.
    v_category_confirmed := true;
    IF v_category IS NULL
       AND upper(btrim(COALESCE(r->>'description', ''))) <> 'BANK TRANSACTION' THEN
      -- Most-USED category for this payee+direction (ties → most recent),
      -- via the shared helper so the server and the in-app bulk tool agree.
      v_category := public.payee_memory_category(
        v_acct, r->>'description', r->>'type'
      );
      -- Only if the guess actually produced something. Payee memory returning
      -- nothing leaves the row blank, and a blank is not a suggestion.
      IF v_category IS NOT NULL THEN
        v_category_confirmed := false;
      END IF;
    END IF;

    v_tx := NULL;
    INSERT INTO public.transactions (
      user_id, account_id, connection_id, external_transaction_id,
      external_provider, description, amount, type, date, metadata,
      is_cleared, category, category_confirmed, tags, needs_review
    )
    VALUES (
      p_user_id,
      v_acct,
      NULLIF(r->>'connection_id', '')::uuid,
      r->>'external_transaction_id',
      r->>'external_provider',
      r->>'description',
      (r->>'amount')::numeric,
      r->>'type',
      (r->>'date')::date,
      COALESCE(r->'metadata', 'null'::jsonb),
      false,  -- is_cleared: the user reconciles, the feed does not
      v_category,
      v_category_confirmed,
      -- Tags a rule attached (20260828180000). Absent means no rule had any
      -- to give, which is the EMPTY ARRAY that migration chose rather than
      -- NULL — kept exactly as it shipped, so a fed row's tags read the same
      -- whether or not a rule touched it.
      CASE WHEN r ? 'tags' AND jsonb_typeof(r->'tags') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(r->'tags'))
           ELSE '{}'::text[]
      END,
      true    -- needs_review: nobody has seen this row; it did not exist until now
    )
    ON CONFLICT (connection_id, external_transaction_id)
      WHERE external_transaction_id IS NOT NULL
      DO NOTHING
    RETURNING * INTO v_tx;

    IF v_tx.id IS NULL THEN
      v_skipped := v_skipped + 1;  -- lost a concurrent race; row already exists
      CONTINUE;
    END IF;

    PERFORM public.write_financial_audit(
      p_user_id, 'transaction', v_tx.id, 'create', NULL, to_jsonb(v_tx)
    );

    v_sums := jsonb_set(
      v_sums,
      ARRAY[v_acct_key],
      to_jsonb(COALESCE((v_sums->>v_acct_key)::numeric, 0) + v_tx.amount)
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  -- Apply the per-account balance effect, audited, inside the same transaction.
  FOR v_acct_key, v_sum IN
    SELECT key, value::numeric FROM jsonb_each_text(v_sums)
  LOOP
    SELECT * INTO v_before
      FROM public.accounts
     WHERE id = v_acct_key::uuid AND user_id = p_user_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
    END IF;

    IF (v_backfills->>v_acct_key)::boolean THEN
      -- Backfill: history already embodied in the snapshot balance.
      UPDATE public.accounts
         SET initial_balance = COALESCE(initial_balance, 0) - v_sum,
             updated_at = now()
       WHERE id = v_acct_key::uuid AND user_id = p_user_id
       RETURNING * INTO v_after;
    ELSE
      -- Incremental: new money movement adjusts the ledger balance.
      UPDATE public.accounts
         SET balance = balance + v_sum,
             updated_at = now()
       WHERE id = v_acct_key::uuid AND user_id = p_user_id
       RETURNING * INTO v_after;
    END IF;

    PERFORM public.write_financial_audit(
      p_user_id, 'account', v_acct_key::uuid, 'update',
      to_jsonb(v_before), to_jsonb(v_after)
    );
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
END;
$$;

-- ── The rows that already landed under the broken function ──────────────────
-- Scope, guards and reasoning are in "THE ROWS ALREADY DAMAGED" above. Writes
-- three non-monetary fields; never re-opens a reconciled row for review; never
-- reads or writes is_cleared; reports what it did.
DO $$
DECLARE
  -- The bad function's window. See "WHY THE WINDOW IS created_at >= 2026-08-28".
  c_window constant timestamptz := '2026-08-28 00:00:00+00';
  v_old public.transactions;
  v_new public.transactions;
  v_guess text;
  v_reconciled boolean;
  v_marked integer := 0;
  v_categorised integer := 0;
  v_left_quiet integer := 0;
BEGIN
  FOR v_old IN
    SELECT * FROM public.transactions t
     WHERE t.external_transaction_id IS NOT NULL
       AND t.connection_id IS NOT NULL
       AND t.created_at >= c_window
       AND (
            -- (a) never reviewed, and not finalised by the owner
            (NOT t.needs_review AND NOT COALESCE(t.is_reconciled, false))
            -- (b) wants a category suggestion, reconciled or not. Split rows
            --     are excluded: their categorisation lives in their split
            --     lines, and protect_split_transaction_fields would abort
            --     this whole migration if we wrote one.
         OR (t.category IS NULL AND NOT t.is_split)
       )
     -- Chronological, so a row categorised here feeds the payee memory of the
     -- next one exactly as it would have inside the import batch.
     ORDER BY t.date, t.created_at, t.id
     FOR UPDATE
  LOOP
    v_reconciled := COALESCE(v_old.is_reconciled, false);

    v_guess := NULL;
    IF v_old.category IS NULL
       AND NOT v_old.is_split
       AND upper(btrim(COALESCE(v_old.description, ''))) <> 'BANK TRANSACTION' THEN
      -- The same helper, the same arguments, the same sentinel exclusion the
      -- function uses. Transfer exclusion lives inside the helper.
      v_guess := public.payee_memory_category(
        v_old.account_id, v_old.description, v_old.type
      );
    END IF;

    -- Unqualified column references on the right-hand side are the OLD values.
    UPDATE public.transactions SET
      needs_review       = CASE WHEN v_reconciled THEN needs_review ELSE true END,
      category           = COALESCE(category, v_guess),
      category_confirmed = CASE
                             WHEN category IS NULL AND v_guess IS NOT NULL THEN false
                             ELSE category_confirmed
                           END
     WHERE id = v_old.id
    RETURNING * INTO v_new;

    PERFORM public.write_financial_audit(
      v_old.user_id, 'transaction', v_old.id, 'update',
      to_jsonb(v_old), to_jsonb(v_new)
    );

    IF v_reconciled THEN
      v_left_quiet := v_left_quiet + 1;
    ELSIF NOT v_old.needs_review THEN
      v_marked := v_marked + 1;
    END IF;
    IF v_guess IS NOT NULL THEN v_categorised := v_categorised + 1; END IF;
  END LOOP;

  RAISE NOTICE 'feed row repair: % row(s) now await review; % row(s) given a payee-memory category; % reconciled row(s) left quiet (category suggested where missing, review not re-opened). is_cleared was neither read nor written.',
    v_marked, v_categorised, v_left_quiet;
END;
$$;

REVOKE ALL ON FUNCTION public.import_bank_transactions_atomic(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_bank_transactions_atomic(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.import_bank_transactions_atomic(uuid, jsonb) IS
  'Atomic bank-feed import. Every row it writes arrives needs_review = true — a transaction the bank has just told us about is new work until somebody saves it, whether or not an import rule filed it, because review is about the row and not the category. Carries category and tags so a ruled row arrives categorised, and falls back to payee memory (marking that guess category_confirmed = false) when no category was stated. Rows, their audit entries and one balance movement per account commit together or not at all.';

COMMIT;

-- ============================================================================
-- Verification — run after applying.
-- ============================================================================

-- 1. The feed writes all four things again, and kept everything it already had.
-- Expected: all six true
SELECT position('true    -- needs_review' IN pg_get_functiondef(p.oid)) > 0        AS feed_marks_new,
       position('payee_memory_category(' IN pg_get_functiondef(p.oid)) > 0         AS feed_keeps_payee_memory,
       position('v_category_confirmed' IN pg_get_functiondef(p.oid)) > 0           AS feed_keeps_provenance,
       position('false,  -- is_cleared' IN pg_get_functiondef(p.oid)) > 0          AS feed_arrives_unreconciled,
       position('jsonb_array_elements_text(r->''tags'')' IN pg_get_functiondef(p.oid)) > 0 AS feed_keeps_tags,
       position('initial_balance = COALESCE(initial_balance, 0) - v_sum'
                IN pg_get_functiondef(p.oid)) > 0                                  AS feed_keeps_backfill_branch
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic';

-- 2. The audit calls and the ownership lock survived the restatement.
-- Expected: audit_writes = 2, locks_account = true, checks_ownership = true
SELECT (length(pg_get_functiondef(p.oid))
        - length(replace(pg_get_functiondef(p.oid), 'write_financial_audit', '')))
       / length('write_financial_audit')                                       AS audit_writes,
       position('FOR UPDATE' IN pg_get_functiondef(p.oid)) > 0                 AS locks_account,
       position('account_not_found_or_not_owned' IN pg_get_functiondef(p.oid)) > 0 AS checks_ownership
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic';

-- 3. Security posture unchanged.
-- Expected: prosecdef = false, proconfig = {search_path=public}
SELECT p.proname, p.prosecdef, p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic';

-- Expected: service_role ONLY. Never anon, never PUBLIC ('-').
SELECT a.grantee::regrole::text AS grantee, a.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 CROSS JOIN LATERAL aclexplode(p.proacl) AS a
 WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic'
 ORDER BY grantee;

-- 4. THE OWNER'S CHECK, after the next sync of a connected account. Rows
--    delivered from now on read as awaiting review; history is untouched.
-- Expected: awaiting_review rises from 0 only as new feed rows land.
SELECT count(*) FILTER (WHERE needs_review)                                AS awaiting_review,
       count(*) FILTER (WHERE needs_review AND external_transaction_id IS NOT NULL) AS awaiting_review_from_feeds
  FROM public.transactions;

-- 4b. THE REPAIR. Fed rows from the broken window, by state.
--     Expected: still_unreviewed = 0 — every unreconciled row now awaits
--     review. reconciled_still_quiet is the count deliberately left alone.
--     `no_category_left` is not expected to be zero: a payee the ledger has
--     never seen, and the 'Bank transaction' sentinel, have nothing to
--     suggest, and split rows are excluded by design.
SELECT count(*) FILTER (WHERE NOT needs_review
                          AND NOT COALESCE(is_reconciled, false))     AS still_unreviewed,
       count(*) FILTER (WHERE needs_review)                           AS awaiting_review,
       count(*) FILTER (WHERE COALESCE(is_reconciled, false))         AS reconciled_still_quiet,
       count(*) FILTER (WHERE category IS NULL AND NOT is_split)      AS no_category_left,
       count(*) FILTER (WHERE category IS NOT NULL
                          AND NOT category_confirmed)                 AS suggested_categories,
       count(*)                                                       AS rows_in_window
  FROM public.transactions
 WHERE external_transaction_id IS NOT NULL
   AND connection_id IS NOT NULL
   AND created_at >= '2026-08-28 00:00:00+00';

-- 4c. The repair left a trail. Expected: one audit row per repaired row.
SELECT count(*) AS repair_audit_entries
  FROM public.financial_audit_log
 WHERE entity = 'transaction'
   AND action = 'update'
   AND created_at >= now() - interval '5 minutes';

-- 5. The balance invariant still holds for every account. This migration
--    cannot have moved a balance — no statement in it touches an amount — and
--    this is the check that proves it rather than asserting it.
-- Expected: zero rows
SELECT a.id, a.name, a.balance, a.initial_balance + COALESCE(t.total, 0) AS expected
  FROM public.accounts a
  LEFT JOIN (
    SELECT account_id, sum(amount) AS total
      FROM public.transactions
     GROUP BY account_id
  ) t ON t.account_id = a.id
 WHERE a.balance IS DISTINCT FROM a.initial_balance + COALESCE(t.total, 0);
