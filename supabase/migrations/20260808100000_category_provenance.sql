-- ============================================================================
-- category_confirmed — say out loud which categories the app guessed
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). One new column with a constant default, five
-- existing functions redefined to carry it, and one new function. No row is
-- rewritten, no grant widens, and no balance is touched.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- The owner, on importing a statement or syncing a feed:
--
--   "The system does not pre-populate the category. I thought it was a good
--    idea [but] you then get a bit confused as to whether you need to check a
--    part of the list or not."
--
-- That is the whole defect, stated exactly. A category the app filled in looked
-- identical to one he had chosen himself, so after an import the register could
-- not answer the only question that matters while working through it: which of
-- these have I actually checked? Not "some", not "none" — there was no way to
-- tell, which is the same as having no answer at all.
--
-- The first instinct was to stop guessing and let imports arrive blank. That
-- trades one problem for a worse one: a good guess saves real work, and 9,000
-- blank rows is a chore nobody does. So the app keeps guessing, and says so:
--
--   "If it is a 'suggested' category, it has a different colour or something
--    and then the user has to somehow do an easy 'confirm or edit' when he
--    clicks on the category, and if he doesn't then it just keeps the suggested
--    category."
--
-- Hence one bit per row: has a human vouched for this category? Suggested rows
-- still carry their category and still count in every report — nothing about
-- the figures changes — but they are visibly provisional and one click settles
-- them.
--
-- ── WHY A BOOLEAN, NOT A SOURCE ENUM ────────────────────────────────────────
-- The obvious alternative is `category_source ('user','file','payee_memory',
-- 'categoriser')`. Rejected, for three reasons:
--
--   1. Every value except 'user' collapses to the same thing at the only place
--      the column is ever read — "not vouched for yet". A stored distinction
--      that nothing consumes is a distinction that silently goes wrong.
--   2. WHERE a row came from is already recorded, and better: is_imported,
--      import_source/import_source_id (MS Money re-import), external_provider
--      and external_transaction_id (the feed). A second, parallel account of
--      the same fact is a second thing to keep in step, and the two would
--      disagree the first time anything moved.
--   3. The backfill below can be truthful about a boolean and could not be
--      about an enum: we know nobody needs to re-check history, and we do NOT
--      know which tool originally filed each of those rows. An enum would force
--      us to invent that answer for every row in the table.
--
-- ── WHAT DOES NOT CHANGE ────────────────────────────────────────────────────
-- Every row already in the table reads as CONFIRMED, and no UPDATE runs to make
-- that so — `NOT NULL DEFAULT true` gives it to existing rows for free (a
-- constant default is metadata-only in modern Postgres: no table rewrite, no
-- 50k audit entries, no bloat).
--
-- That backfill is a deliberate choice, and it is the honest one. Everything in
-- the table today was either typed by hand or filled in by an importer, and
-- nobody recorded which — the column is being added precisely because that
-- distinction was never kept. The two options were therefore:
--
--   * mark history CONFIRMED: some old auto-filled rows are treated as checked
--     when they were not. The user loses nothing he had; the screen simply says
--     nothing new about the past.
--   * mark history SUGGESTED: every category the user ever typed is accused of
--     being a guess, and he is handed tens of thousands of rows to re-confirm —
--     work that did not exist yesterday and that he has already done.
--
-- The second is a much larger lie and an unusable amount of work, so: confirmed.
-- The flag starts meaning something from the next import onward, which is where
-- the problem actually is.
--
-- Also unchanged: every function keeps its signature, its SECURITY INVOKER, its
-- pinned search_path, its audit writes and its grants. A caller that says
-- nothing about category_confirmed behaves exactly as it does today — which is
-- what makes this safe to apply before or after any application deploy.
--
-- ── BALANCE REASONING ───────────────────────────────────────────────────────
-- Balance-neutral, by construction rather than by inspection. category_confirmed
-- is one boolean beside the category; it is not an amount, a sign, an account_id
-- or a date, and nothing reads it to compute anything. Every balance statement
-- inside every function below is byte-for-byte the one already live
-- (create_transaction_atomic: balance = balance + v_tx.amount;
-- import_transactions_atomic and import_bank_transactions_atomic: one
-- balance = balance + v_sum per account; update_transaction_atomic: the same
-- old/new difference arithmetic). The new confirm_transaction_categories
-- deliberately takes no category argument at all, so it cannot move a category
-- let alone a balance, however it is called. The invariant
-- balance = initial_balance + Σ(amount) is untouched — verification 6 proves it.
--
-- ── SPLITS ARE OUT OF SCOPE, ON PURPOSE ─────────────────────────────────────
-- transaction_splits rows carry their own categories and get no flag. Nothing
-- in the app has ever guessed a split line: a split is typed by hand or stated
-- by an imported file, both of which are the user's own. A column that could
-- only ever hold one value would be noise.
-- ============================================================================

BEGIN;

-- ── The column ──────────────────────────────────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS category_confirmed boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.transactions.category_confirmed IS
  'Has a human vouched for `category`? false = the app guessed it (smart categoriser on a file import, payee memory on a bank feed) and nobody has agreed yet; the UI shows it as a suggestion and offers a one-click confirm. true = the user typed, picked or edited it, or their own imported file stated it. Defaults true so any writer that does not know about provenance produces a confirmed row, and so existing history reads as confirmed. Counts in reports identically either way — this records who decided, never what was decided.';

-- No index. Nothing filters on this column server-side: the app already holds
-- every transaction in memory after boot and groups the suggested ones there,
-- and confirm_transaction_categories finds its rows by primary key. An index
-- that no query uses is write cost with no read benefit.

-- ── create_transaction_atomic: carry the flag ───────────────────────────────
-- Identical to 20260808090000_transaction_statement_sequence.sql except for the
-- category_confirmed column and its COALESCE. Default TRUE, so hand entry, the
-- add-transaction form and every caller that says nothing keep behaving exactly
-- as they do today; only an importer that knows it guessed sends false.
CREATE OR REPLACE FUNCTION public.create_transaction_atomic(p jsonb)
RETURNS public.transactions
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tx public.transactions;
BEGIN
  INSERT INTO public.transactions (
    id, user_id, account_id, description, amount, type, date,
    category, notes, tags, is_recurring, transfer_account_id,
    metadata, category_id, merchant_name, location_city,
    location_country, payment_channel, statement_sequence, category_confirmed
  ) VALUES (
    COALESCE(NULLIF(p->>'id', '')::uuid, gen_random_uuid()),
    (p->>'user_id')::uuid,
    (p->>'account_id')::uuid,
    p->>'description',
    (p->>'amount')::numeric,
    p->>'type',
    (p->>'date')::date,
    p->>'category',
    p->>'notes',
    CASE WHEN p ? 'tags' AND jsonb_typeof(p->'tags') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(p->'tags'))
         ELSE NULL END,
    COALESCE((p->>'is_recurring')::boolean, false),
    NULLIF(p->>'transfer_account_id', '')::uuid,
    COALESCE(p->'metadata', '{}'::jsonb),
    NULLIF(p->>'category_id', '')::uuid,
    p->>'merchant_name',
    p->>'location_city',
    p->>'location_country',
    p->>'payment_channel',
    NULLIF(p->>'statement_sequence', '')::integer,
    COALESCE((p->>'category_confirmed')::boolean, true)
  )
  RETURNING * INTO v_tx;

  UPDATE public.accounts
     SET balance = balance + v_tx.amount,
         updated_at = now()
   WHERE id = v_tx.account_id
     AND user_id = v_tx.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found_or_not_owned'
      USING ERRCODE = 'P0001',
            HINT = 'The account does not exist or does not belong to this user.';
  END IF;

  PERFORM public.write_financial_audit(
    v_tx.user_id, 'transaction', v_tx.id, 'create', NULL, to_jsonb(v_tx)
  );

  RETURN v_tx;
END;
$$;

-- ── import_transactions_atomic: carry the flag ──────────────────────────────
-- Identical to 20260808090000 except for the category_confirmed column and its
-- COALESCE. This is the file-import path (OFX/CSV/QIF statements), where the
-- distinction actually bites: a category the FILE stated is the user's own data
-- and arrives true, while one the smart categoriser guessed arrives false.
CREATE OR REPLACE FUNCTION public.import_transactions_atomic(
  p_user_id uuid,
  p_account_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_tx public.transactions;
  v_sum numeric := 0;
  v_inserted integer := 0;
  v_before public.accounts;
  v_after public.accounts;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a jsonb array' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before
    FROM public.accounts
   WHERE id = p_account_id AND user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found_or_not_owned'
      USING ERRCODE = 'P0001',
            HINT = 'The account does not exist or does not belong to this user.';
  END IF;

  FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO public.transactions (
      user_id, account_id, description, amount, type, date,
      category, notes, tags, is_recurring, is_cleared, statement_sequence,
      category_confirmed
    ) VALUES (
      p_user_id,
      p_account_id,
      r->>'description',
      (r->>'amount')::numeric,
      r->>'type',
      (r->>'date')::date,
      NULLIF(r->>'category', ''),
      NULLIF(r->>'notes', ''),
      CASE WHEN r ? 'tags' AND jsonb_typeof(r->'tags') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(r->'tags'))
           ELSE NULL END,
      COALESCE((r->>'is_recurring')::boolean, false),
      COALESCE((r->>'is_cleared')::boolean, false),
      NULLIF(r->>'statement_sequence', '')::integer,
      COALESCE((r->>'category_confirmed')::boolean, true)
    )
    RETURNING * INTO v_tx;

    PERFORM public.write_financial_audit(
      p_user_id, 'transaction', v_tx.id, 'create', NULL, to_jsonb(v_tx)
    );

    v_sum := v_sum + v_tx.amount;
    v_inserted := v_inserted + 1;
  END LOOP;

  IF v_inserted > 0 THEN
    UPDATE public.accounts
       SET balance = balance + v_sum,
           updated_at = now()
     WHERE id = p_account_id AND user_id = p_user_id
     RETURNING * INTO v_after;

    PERFORM public.write_financial_audit(
      p_user_id, 'account', p_account_id, 'update',
      to_jsonb(v_before), to_jsonb(v_after)
    );
  END IF;

  RETURN jsonb_build_object('inserted', v_inserted);
END;
$$;

-- ── update_transaction_atomic: an edit confirms what it writes ──────────────
-- Identical to 20260707120000_reconciliation_cleared_rpcs.sql except for the
-- category_confirmed line.
--
-- The three-way CASE is the important part, and the middle branch is the reason
-- this is done in SQL rather than left to each caller:
--
--   1. The caller states it            -> honour that. The editor sends true
--      explicitly, because "the user looked at the suggestion and let it stand"
--      is a confirmation that no rule about changed values can detect.
--   2. The caller changes the category -> true. Choosing a category IS vouching
--      for it. Any editor that forgets to say so still gets this right, and an
--      editor that forgets would otherwise leave the user's own choice sitting
--      on screen accused of being a machine guess.
--   3. Neither                         -> leave it alone. Renaming a payee or
--      fixing a date says nothing about whether the category was checked.
--
-- Note the bare `category` on the right-hand side is the OLD value, per the SQL
-- standard for UPDATE ... SET, which is exactly what branch 2 needs.
CREATE OR REPLACE FUNCTION public.update_transaction_atomic(
  p_id uuid,
  p jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_old public.transactions;
  v_new public.transactions;
BEGIN
  SELECT * INTO v_old
    FROM public.transactions
   WHERE id = p_id
     AND (p_user_id IS NULL OR user_id = p_user_id)
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.transactions SET
    description         = COALESCE(p->>'description', description),
    amount              = COALESCE((p->>'amount')::numeric, amount),
    type                = COALESCE(p->>'type', type),
    date                = COALESCE((p->>'date')::date, date),
    account_id          = COALESCE(NULLIF(p->>'account_id', '')::uuid, account_id),
    category            = CASE WHEN p ? 'category' THEN p->>'category' ELSE category END,
    category_confirmed  = CASE
                            WHEN p ? 'category_confirmed'
                              THEN COALESCE((p->>'category_confirmed')::boolean, category_confirmed)
                            WHEN p ? 'category'
                                 AND (p->>'category') IS DISTINCT FROM category
                              THEN true
                            ELSE category_confirmed
                          END,
    notes               = CASE WHEN p ? 'notes' THEN p->>'notes' ELSE notes END,
    tags                = CASE WHEN p ? 'tags' AND jsonb_typeof(p->'tags') = 'array'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p->'tags'))
                               ELSE tags END,
    is_recurring        = COALESCE((p->>'is_recurring')::boolean, is_recurring),
    is_cleared          = COALESCE((p->>'is_cleared')::boolean, is_cleared),
    transfer_account_id = CASE WHEN p ? 'transfer_account_id'
                               THEN NULLIF(p->>'transfer_account_id', '')::uuid
                               ELSE transfer_account_id END,
    metadata            = CASE WHEN p ? 'metadata' THEN p->'metadata' ELSE metadata END,
    category_id         = CASE WHEN p ? 'category_id'
                               THEN NULLIF(p->>'category_id', '')::uuid
                               ELSE category_id END,
    merchant_name       = CASE WHEN p ? 'merchant_name' THEN p->>'merchant_name' ELSE merchant_name END,
    updated_at          = now()
  WHERE id = p_id
  RETURNING * INTO v_new;

  IF v_old.account_id = v_new.account_id THEN
    IF v_new.amount <> v_old.amount THEN
      UPDATE public.accounts
         SET balance = balance + (v_new.amount - v_old.amount),
             updated_at = now()
       WHERE id = v_new.account_id
         AND user_id = v_new.user_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  ELSE
    UPDATE public.accounts
       SET balance = balance - v_old.amount,
           updated_at = now()
     WHERE id = v_old.account_id
       AND user_id = v_old.user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.accounts
       SET balance = balance + v_new.amount,
           updated_at = now()
     WHERE id = v_new.account_id
       AND user_id = v_new.user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM public.write_financial_audit(
    v_new.user_id, 'transaction', v_new.id, 'update', to_jsonb(v_old), to_jsonb(v_new)
  );

  RETURN v_new;
END;
$$;

-- ── apply_category_to_uncategorized: filing a payee is a decision ───────────
-- Identical to 20260708100000_payee_memory_autocategorize.sql except that the
-- rows it fills are marked CONFIRMED.
--
-- Every caller of this is the user filing a payee they have just chosen a
-- category for, and payee memory spreading that choice to the identical rows IS
-- the choice — that is what "categorise this whole merchant" means. Marking
-- those rows as suggestions would hand back, as a list to re-check, the exact
-- rows he asked to be dealt with, making the bulk tool slower than doing it one
-- at a time.
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
     FOR UPDATE
  LOOP
    UPDATE public.transactions
       SET category = p_category,
           category_confirmed = true,
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

-- ── NEW confirm_transaction_categories: "yes, that guess was right" ─────────
-- The bulk half of confirm-or-edit, modelled on set_transactions_cleared for
-- the same reason: N rows of one boolean have no business being N calls to the
-- balance-adjusting update RPC.
--
-- It takes NO category argument. That is a safety property, not an oversight —
-- confirming is agreeing with what is already stored, so this function is
-- incapable of changing a category (let alone an amount) no matter who calls it
-- or what they pass. A user who wants a different category picks one, which is
-- an ordinary edit and confirms it on the way through.
--
-- Only genuinely-suggested rows are touched, so the returned count is the
-- number of decisions actually recorded, and re-confirming is free rather than
-- a second audit entry per row.
CREATE OR REPLACE FUNCTION public.confirm_transaction_categories(
  p_ids uuid[],
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
       AND category_confirmed = false
       -- A blank category has nothing to vouch for. Guarded here as well as in
       -- the app so a stale client list cannot mark empty rows "checked".
       AND category IS NOT NULL AND btrim(category) <> ''
     FOR UPDATE
  LOOP
    UPDATE public.transactions
       SET category_confirmed = true,
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

COMMENT ON FUNCTION public.confirm_transaction_categories(uuid[], uuid) IS
  'Record that the user agrees with the app''s suggested category on these rows. Flips category_confirmed only — takes no category and touches no amount, so it is balance-neutral and category-neutral by construction. Returns the number of rows actually confirmed.';

REVOKE ALL ON FUNCTION public.confirm_transaction_categories(uuid[], uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_transaction_categories(uuid[], uuid) TO authenticated, service_role;

-- ── import_bank_transactions_atomic: the feed marks its own guesses ─────────
--
-- WHY A FULL REPLACE RATHER THAN A GUARDED LITERAL SWAP.
-- 20260807180000_feed_rows_arrive_unreconciled.sql rewrote this function by
-- pulling its live definition with pg_get_functiondef and replacing one literal.
-- That was right there: one value, in one place. Here the change lands in THREE
-- separate places in the body (a new DECLARE, a new assignment beside the payee
-- lookup, and two more entries in the INSERT), and three chained text
-- replacements have three independent chances to match nothing and leave the
-- function half-changed — the failure mode being that the feed goes on writing
-- guesses that claim to be confirmed, which is silent and is exactly the bug.
-- Stating the whole intended body once is inspectable in a way that three
-- replace() calls are not.
--
-- What a full replace gives up is the guarantee that we are editing what is
-- actually live rather than what we remember, so that is bought back explicitly
-- below: the DO block reads the live definition and REFUSES, loudly and by
-- name, unless it is in exactly the state this body was derived from. If
-- someone has changed this function since, nothing here runs and the whole
-- migration rolls back.
--
-- The body below is 20260722140000_payee_memory_most_common.sql, plus the
-- is_cleared value from 20260807180000, plus the provenance flag. Payee memory
-- itself is UNCHANGED and stays switched on: the feed should keep guessing, it
-- just has to admit that it is guessing.
DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_src
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'import_bank_transactions_atomic';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'feed_importer_missing: expected import_bank_transactions_atomic to exist before changing what it writes'
      USING ERRCODE = 'P0002';
  END IF;

  -- Fingerprint 1: payee memory is still what fills the category here. If this
  -- is gone, the premise of this change (the feed guesses) is false and the
  -- body below would REINSTATE a behaviour someone deliberately removed.
  IF position('payee_memory_category(' IN v_src) = 0 THEN
    RAISE EXCEPTION 'feed_payee_memory_absent: import_bank_transactions_atomic no longer fills categories from payee memory — this migration would put that back. Review by hand.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Fingerprint 2: 20260807180000 is applied, so the body below (which carries
  -- is_cleared = false) matches what is live in every respect but the flag.
  IF position('false,  -- is_cleared' IN v_src) = 0 THEN
    RAISE EXCEPTION 'feed_cleared_state_unexpected: import_bank_transactions_atomic does not insert is_cleared the way 20260807180000 left it — applying this body would silently change reconciliation behaviour. Review by hand.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Fingerprint 3: not already done. Reaching here on a re-run means the live
  -- function already carries provenance, so there is nothing to do and pressing
  -- on could only overwrite something newer.
  IF position('category_confirmed' IN v_src) > 0 THEN
    RAISE EXCEPTION 'feed_provenance_already_present: import_bank_transactions_atomic already writes category_confirmed — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

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
      is_cleared, category, category_confirmed
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
      v_category_confirmed
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

COMMIT;

-- ============================================================================
-- Verification — run after applying. NOTE: unapplied at the time of writing;
-- these are what to read, and what to expect, when it is.
-- ============================================================================

-- 1. The column exists, is NOT NULL, and defaults to confirmed.
-- Expected: one row, data_type = boolean, is_nullable = NO,
--           column_default = true
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'transactions'
   AND column_name = 'category_confirmed';

-- 2. History reads as confirmed — nothing was backfilled to "suggested".
-- Expected immediately after applying: suggested = 0. It rises only as new
-- imports and feed syncs land, which is the entire point.
SELECT count(*) FILTER (WHERE NOT category_confirmed) AS suggested,
       count(*) FILTER (WHERE category_confirmed)     AS confirmed
  FROM public.transactions;

-- 3. No row claims to be a suggestion with nothing suggested in it. A blank
--    category is uncategorised, which is a different chore with its own screen.
-- Expected: zero rows, now and forever (every writer above guards this).
SELECT id, account_id, date, description
  FROM public.transactions
 WHERE NOT category_confirmed
   AND (category IS NULL OR btrim(category) = '');

-- 4. The feed writes provenance, still fills from payee memory, and still
--    leaves reconciliation to the user.
-- Expected: all three true
SELECT position('category_confirmed' IN pg_get_functiondef(p.oid)) > 0 AS writes_provenance,
       position('payee_memory_category(' IN pg_get_functiondef(p.oid)) > 0 AS still_uses_payee_memory,
       position('false,  -- is_cleared' IN pg_get_functiondef(p.oid)) > 0 AS still_arrives_unreconciled
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic';

-- 5. Every redefined function kept its security posture — a rewrite must not
--    quietly change SECURITY INVOKER or unpin search_path.
-- Expected: six rows, prosecdef = false, proconfig = {search_path=public}
SELECT p.proname, p.prosecdef, p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('create_transaction_atomic', 'import_transactions_atomic',
                     'update_transaction_atomic', 'apply_category_to_uncategorized',
                     'confirm_transaction_categories', 'import_bank_transactions_atomic')
 ORDER BY p.proname;

-- 6. Grants unchanged and the new function no wider than its neighbours:
--    authenticated + service_role, never anon, never PUBLIC ('-').
--    import_bank_transactions_atomic stays service_role ONLY.
SELECT p.proname, a.grantee::regrole::text AS grantee, a.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 CROSS JOIN LATERAL aclexplode(p.proacl) AS a
 WHERE n.nspname = 'public'
   AND p.proname IN ('create_transaction_atomic', 'import_transactions_atomic',
                     'update_transaction_atomic', 'apply_category_to_uncategorized',
                     'confirm_transaction_categories', 'import_bank_transactions_atomic')
 ORDER BY p.proname, grantee;

-- 7. The balance invariant still holds for every account. This migration cannot
--    have moved a balance — no statement in it touches an amount — and this is
--    the check that proves it rather than asserting it.
-- Expected: zero rows
SELECT a.id, a.name, a.balance, a.initial_balance + COALESCE(t.total, 0) AS expected
  FROM public.accounts a
  LEFT JOIN (
    SELECT account_id, sum(amount) AS total
      FROM public.transactions
     GROUP BY account_id
  ) t ON t.account_id = a.id
 WHERE a.balance IS DISTINCT FROM a.initial_balance + COALESCE(t.total, 0);
