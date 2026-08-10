-- ============================================================================
-- needs_review — an imported transaction is NEW until somebody saves it
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). One new column with a constant default, and
-- four existing functions redefined to carry it. No row is rewritten, no grant
-- widens, and no balance is touched.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Microsoft Money printed a freshly downloaded transaction in bold and kept it
-- bold until you did something about it. That one convention answered the only
-- question worth asking after an import — which of these have I dealt with? —
-- inside the register, in the place the row already sat, with no wizard, no
-- queue and no second screen. The owner asked for it back, plus a counter next
-- to the register's View menu that states the size of the job and filters the
-- list down to it, and a column on the Accounts list so the job can be seen
-- from outside the account.
--
-- 20260808100000_category_provenance.sql answered a NARROWER version of the
-- same question — "did a human vouch for this CATEGORY?" — and it is not
-- enough on its own. A statement row can arrive carrying a category the FILE
-- itself stated, which is the user's own data and therefore confirmed, and
-- still be a transaction nobody has laid eyes on: wrong amount, wrong date,
-- wrong account, a duplicate, a payment they do not recognise. Provenance is
-- about one field; this is about the row.
--
-- ── WHY A BOOLEAN AND NOT reviewed_at ───────────────────────────────────────
-- The obvious alternative is `reviewed_at timestamptz`, NULL meaning "not yet".
-- Rejected, for three reasons:
--
--   1. THE BACKFILL. A boolean with a constant DEFAULT false gives every
--      existing row the right answer for free — a constant default is
--      metadata-only in modern Postgres: no table rewrite, no ~51,000 audit
--      entries, no bloat. `reviewed_at` defaults to NULL, which is the WRONG
--      answer for history, so it would need a real UPDATE of every row in the
--      table to say "reviewed", and that UPDATE would fire the audit trigger
--      once per row. Same fact recorded, one of them free.
--   2. IT WOULD BE INVENTED DATA. We do not know when anybody looked at a 2018
--      transaction, and a column whose backfill is `now()` says they all
--      happened at once on the day of the migration. That is a fabricated
--      timestamp, and the moment it exists something will report on it.
--   3. NOTHING CONSUMES A TIME. The register prints a row bold or it does not;
--      the counter counts; the filter filters. No screen asks WHEN, and no
--      screen has ever been asked for. A stored distinction nothing consumes is
--      a distinction that silently goes wrong — the same argument
--      20260808100000 used to reject a category_source enum.
--
-- Every per-row state this table already keeps is a boolean for these same
-- reasons: is_cleared, is_split, archived, is_recurring, category_confirmed.
--
-- ── WHY needs_review AND NOT reviewed ───────────────────────────────────────
-- The direction is chosen so that SILENCE IS SAFE. `NOT NULL DEFAULT false`
-- means any writer that has never heard of this column produces a reviewed row,
-- and every row already in the table reads as reviewed without being touched.
-- `reviewed boolean DEFAULT true` would have the same effect, but the app has
-- to ask the negative question everywhere ("not reviewed"), and the column
-- would then be named for a state the UI never displays. The register's box
-- says "To Review", the column says needs_review, and the predicate in
-- src/utils/transactionReview.ts says `needsReview === true`. One word all the
-- way down.
--
-- ── WHAT DOES NOT CHANGE ────────────────────────────────────────────────────
-- Every row already in the table reads as REVIEWED, and no UPDATE runs to make
-- that so. That backfill is the honest one, and it is the same choice
-- 20260808100000 made and for the same reason:
--
--   * mark history REVIEWED: the screen simply says nothing new about the past.
--     The user loses nothing he had.
--   * mark history NEW: fifty-one thousand rows in bold, a counter reading
--     51,000, and a chore that did not exist yesterday and that he has already
--     done. The feature would be uninstallable in practice.
--
-- The flag starts meaning something from the next import onward, which is where
-- the problem actually is.
--
-- Also unchanged: create_transaction_atomic is DELIBERATELY NOT TOUCHED. A row
-- the user typed into the Quick Add bar or the full editor is born reviewed —
-- they were looking at it as they made it, and there is nothing to go back to.
-- The column default gives that for free, which is why the create path needs no
-- edit at all. The Microsoft Money importer (a direct INSERT from
-- src/services/import/msMoney) is left alone for the same reason in reverse: it
-- is a migration of history the user already worked through in Money, not a
-- statement that just arrived, and lighting up eleven thousand rows of it would
-- be the "mark history NEW" mistake by another route.
--
-- Every function below keeps its signature, its SECURITY INVOKER, its pinned
-- search_path, its audit writes and its grants. A caller that says nothing
-- about needs_review behaves exactly as it does today — which is what makes
-- this safe to apply before or after any application deploy.
--
-- ── BALANCE REASONING ───────────────────────────────────────────────────────
-- Balance-neutral, by construction rather than by inspection. needs_review is
-- one boolean beside the row's state flags; it is not an amount, a sign, an
-- account_id or a date, and nothing reads it to compute anything. Every balance
-- statement inside every function below is byte-for-byte the one already live
-- (import_transactions_atomic: one `balance = balance + v_sum` for the batch;
-- import_bank_transactions_atomic: one per account, backfill-or-incremental;
-- update_transaction_atomic: the same old/new difference arithmetic).
-- confirm_transaction_categories writes two booleans and takes no category and
-- no amount, so it cannot move a balance however it is called. The invariant
-- balance = initial_balance + Σ(amount) is untouched — verification 7 proves it.
--
-- ── WHO CLEARS IT, AND WHO DOES NOT ─────────────────────────────────────────
-- Cleared by update_transaction_atomic ONLY WHEN THE CALLER SAYS SO. There is
-- deliberately no rule of the shape "a row that was updated has been reviewed",
-- and the contrast with category_confirmed is the point:
--
--   * category_confirmed CAN be derived, because changing a category is direct
--     evidence about that category. The middle branch of its CASE below still
--     does exactly that.
--   * needs_review CANNOT be derived, because "something wrote to this row" is
--     not evidence that a human read it. update_transaction_atomic is also how
--     the bulk categorise sweep, the payee rename, the transfer-link repair and
--     the reconcile toggle write, and every one of those touches rows the user
--     has never opened. If a write implied a review, importing a statement and
--     then running one bulk tool over it would silently mark the whole import
--     as dealt with — which is precisely the "somewhere between all of them and
--     none of them" answer this feature exists to end.
--
-- So the register's four save buttons (the row editor's Save and Save & Next,
-- the full editor's Save Changes and Save & Next) send needs_review = false
-- explicitly, and nothing else does.
--
-- Cleared ALSO by confirm_transaction_categories, and that IS defensible rather
-- than convenient. Confirm exists in exactly two places and both are a person
-- looking at a row and answering the question it was asking: the row editor's
-- Confirm button (the row is open in front of them, every field on screen), and
-- the Categorisation page's group confirm (the rows are listed, with a drill
-- into them one click away). Agreeing with a guess is a save-shaped decision
-- about the row — it is the one-click form of the Save that would otherwise
-- have followed — and a register that kept a row bold after the user had
-- explicitly answered it would be nagging about work already done, which is how
-- people learn to ignore the bold everywhere else. It is also, mechanically,
-- the only honest place to put it: the alternative is the row editor firing a
-- second write after the confirm, which is two audit entries, two round trips
-- and a race for one click.
-- ============================================================================

BEGIN;

-- ── The column ──────────────────────────────────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.transactions.needs_review IS
  'Did this row arrive from an import that nobody has looked at yet? true = it came in on a statement file or a bank feed and no save has been made against it since; the register prints it in bold, counts it in the "To Review" box and can filter down to it. false = reviewed, or never needed reviewing (anything a person typed). Defaults false so any writer that does not know about review produces a reviewed row, and so existing history reads as reviewed. Never affects a figure — this records whether a row has been looked at, never what it says.';

-- No index. Nothing filters on this column server-side: the app already holds
-- every transaction in memory after boot and counts the unreviewed ones there,
-- and the writers below find their rows by primary key. An index that no query
-- uses is write cost with no read benefit — the same call 20260808100000 made
-- about category_confirmed, for the same reason.

-- ── Fingerprints: refuse, BY NAME, if the live functions are not what these
--    bodies were derived from ────────────────────────────────────────────────
-- Each body below is a full restatement rather than a text edit, because the
-- change lands in more than one place inside each function (a DECLARE, a column
-- list, a values list, a CASE arm) and chained replace() calls have one
-- independent chance to match nothing per call — the failure being a function
-- left half-changed, which here means imports that go on arriving silently
-- pre-reviewed. Stating the whole intended body once is inspectable in a way
-- three replacements are not.
--
-- What a full restatement gives up is the guarantee that we are editing what is
-- actually live rather than what we remember, so that is bought back here: this
-- block reads each live definition and REFUSES, loudly and by name, unless it
-- is in exactly the state these bodies were derived from. If someone has
-- changed one of them since, nothing here runs and the whole migration rolls
-- back.
DO $$
DECLARE
  v_src text;
BEGIN
  -- ── import_transactions_atomic — derived from
  --    20260808140000_file_import_idempotency.sql ─────────────────────────────
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'import_transactions_atomic';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'file_importer_missing: expected import_transactions_atomic to exist before changing what it writes'
      USING ERRCODE = 'P0002';
  END IF;

  -- The idempotency work (20260808140000) is the newest thing in the body
  -- below. Without it, restating this function would DELETE the ON CONFLICT
  -- clause that stops a re-posted import chunk moving the balance twice — the
  -- single most expensive regression available in this file.
  IF position('ON CONFLICT (user_id, import_source, import_source_id) DO NOTHING' IN v_src) = 0 THEN
    RAISE EXCEPTION 'file_importer_not_idempotent: import_transactions_atomic does not carry the ON CONFLICT clause 20260808140000_file_import_idempotency.sql added — apply that first. Restating this body now would remove the guard that stops a re-posted chunk importing twice.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Category provenance (20260808100000) is carried by the body below and must
  -- already be live, or this would reinstate a column this database lacks (a
  -- plpgsql body is not parsed until it is called, so that failure would appear
  -- at import time, not now).
  IF position('category_confirmed' IN v_src) = 0 THEN
    RAISE EXCEPTION 'file_importer_missing_category_confirmed: import_transactions_atomic does not carry category_confirmed — apply 20260808100000_category_provenance.sql first.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Not already done.
  IF position('needs_review' IN v_src) > 0 THEN
    RAISE EXCEPTION 'file_importer_review_already_present: import_transactions_atomic already writes needs_review — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── import_bank_transactions_atomic — derived from
  --    20260808100000_category_provenance.sql ─────────────────────────────────
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'feed_importer_missing: expected import_bank_transactions_atomic to exist before changing what it writes'
      USING ERRCODE = 'P0002';
  END IF;

  -- Payee memory is still what fills the category here. If it is gone, someone
  -- deliberately removed it and the body below would put it back.
  IF position('payee_memory_category(' IN v_src) = 0 THEN
    RAISE EXCEPTION 'feed_payee_memory_absent: import_bank_transactions_atomic no longer fills categories from payee memory — this migration would put that back. Review by hand.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 20260807180000 is applied, so the body below (which carries is_cleared =
  -- false) matches what is live in that respect.
  IF position('false,  -- is_cleared' IN v_src) = 0 THEN
    RAISE EXCEPTION 'feed_cleared_state_unexpected: import_bank_transactions_atomic does not insert is_cleared the way 20260807180000 left it — restating this body would silently change reconciliation behaviour. Review by hand.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 20260808100000 is applied, so the provenance logic below matches what is
  -- live. Without it the body would write a column this database lacks.
  IF position('v_category_confirmed' IN v_src) = 0 THEN
    RAISE EXCEPTION 'feed_provenance_absent: import_bank_transactions_atomic does not carry category provenance — apply 20260808100000_category_provenance.sql first.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Not already done.
  IF position('needs_review' IN v_src) > 0 THEN
    RAISE EXCEPTION 'feed_review_already_present: import_bank_transactions_atomic already writes needs_review — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── update_transaction_atomic — derived from
  --    20260808100000_category_provenance.sql ─────────────────────────────────
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'update_transaction_atomic';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'updater_missing: expected update_transaction_atomic to exist before changing what it writes'
      USING ERRCODE = 'P0002';
  END IF;

  -- The three-way category_confirmed CASE is restated verbatim below. If it is
  -- not there, the live function is not the one this body was derived from and
  -- restating it would either add provenance to a database that has none or
  -- overwrite a newer rule.
  IF position('category_confirmed  = CASE' IN v_src) = 0 THEN
    RAISE EXCEPTION 'updater_provenance_unexpected: update_transaction_atomic does not carry the category_confirmed CASE that 20260808100000_category_provenance.sql left — review by hand rather than letting this restate it.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Not already done.
  IF position('needs_review' IN v_src) > 0 THEN
    RAISE EXCEPTION 'updater_review_already_present: update_transaction_atomic already honours needs_review — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── confirm_transaction_categories — derived from
  --    20260808100000_category_provenance.sql ─────────────────────────────────
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'confirm_transaction_categories';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'confirmer_missing: expected confirm_transaction_categories to exist before changing what it writes — apply 20260808100000_category_provenance.sql first.'
      USING ERRCODE = 'P0002';
  END IF;

  -- It must still be the function that takes no category. The body below
  -- restates that property, and it is the property that makes this function
  -- safe to widen: it cannot move a category or an amount whatever it is
  -- handed.
  IF position('p_category' IN v_src) > 0 THEN
    RAISE EXCEPTION 'confirmer_takes_a_category: confirm_transaction_categories has gained a category argument — the body below deliberately has none, so restating it would silently remove a capability. Review by hand.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Not already done.
  IF position('needs_review' IN v_src) > 0 THEN
    RAISE EXCEPTION 'confirmer_review_already_present: confirm_transaction_categories already clears needs_review — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ── import_transactions_atomic: a file's rows arrive NEW ────────────────────
-- Byte-for-byte 20260808140000_file_import_idempotency.sql except for the
-- needs_review column and its literal `true`.
--
-- A LITERAL, not a value read off the row. Every row that reaches this function
-- came out of a statement file the user has just handed the app; there is no
-- such thing as a file import that is already reviewed, and the alternative — a
-- per-row key the client sends — has exactly one realistic failure mode, which
-- is a client that forgets it. That failure is silent (rows import, nothing
-- lights up, the counter stays at zero) and indistinguishable from the feature
-- not working. A literal cannot be forgotten. It also means the API route
-- (api/data/import-transactions.ts) needs no new field, so there is no new way
-- for the wire format and the database to disagree.
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
  -- Rows Postgres refused as a repeat of a row this user already has under the
  -- same import id. Returned, never swallowed: to the caller these rows ARE in
  -- the account, and a count of them is the difference between "already landed"
  -- and "lost".
  v_skipped integer := 0;
  v_before public.accounts;
  v_after public.accounts;
  -- Provenance shape, measured over the whole request before anything is
  -- written.
  v_rows integer := 0;
  v_keyed integer := 0;
  v_half_keyed integer := 0;
  v_distinct_keys integer := 0;
  v_longest_id integer := 0;
  v_longest_source integer := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a jsonb array' USING ERRCODE = '22023';
  END IF;

  -- ── Provenance validation ────────────────────────────────────────────────
  -- All of it BEFORE the first insert, so a malformed request is refused whole
  -- rather than half-written. `btrim`+`NULLIF` so a blank string means "not
  -- stated" rather than becoming a key that collides with every other blank.
  SELECT count(*),
         count(*) FILTER (WHERE s IS NOT NULL AND i IS NOT NULL),
         count(*) FILTER (WHERE (s IS NULL) <> (i IS NULL)),
         count(DISTINCT (s, i)) FILTER (WHERE s IS NOT NULL AND i IS NOT NULL),
         COALESCE(max(length(i)), 0),
         COALESCE(max(length(s)), 0)
    INTO v_rows, v_keyed, v_half_keyed, v_distinct_keys, v_longest_id, v_longest_source
    FROM (
      SELECT NULLIF(btrim(e.value->>'import_source'), '')    AS s,
             NULLIF(btrim(e.value->>'import_source_id'), '') AS i
        FROM jsonb_array_elements(p_rows) AS e
    ) keys;

  -- A source with no id cannot be deduped and an id with no source cannot be
  -- attributed; the table's own CHECK says the same thing, less legibly.
  IF v_half_keyed > 0 THEN
    RAISE EXCEPTION 'import_provenance_incomplete: % row(s) state one of import_source / import_source_id without the other. Send both or neither.', v_half_keyed
      USING ERRCODE = '22023';
  END IF;

  -- The one failure mode ON CONFLICT DO NOTHING could turn into missing money:
  -- if a caller gave two different rows the same id, the second would be
  -- discarded as a duplicate of the first and counted as "already landed". That
  -- is a client bug, it is not recoverable here, and it must never be quiet.
  IF v_keyed > 0 AND v_distinct_keys <> v_keyed THEN
    RAISE EXCEPTION 'import_provenance_duplicate_in_request: % keyed row(s) carry only % distinct (import_source, import_source_id) pair(s). Two different rows sharing an id would be silently dropped as duplicates.', v_keyed, v_distinct_keys
      USING ERRCODE = '22023';
  END IF;

  -- The index is a btree: an oversized key fails with an internal-sounding
  -- error deep inside the insert loop. Refuse it here, by name. These bounds
  -- are far above every shape the app sends (an OFX FITID key runs to roughly
  -- 60 characters, a post: key to about 50).
  IF v_longest_id > 200 OR v_longest_source > 60 THEN
    RAISE EXCEPTION 'import_provenance_too_long: import_source_id may be at most 200 characters (longest here: %) and import_source at most 60 (longest here: %).', v_longest_id, v_longest_source
      USING ERRCODE = '22023';
  END IF;

  -- Lock + ownership check up front (service role bypasses RLS, so this is the
  -- security boundary). Reused as the "before" snapshot for the balance audit.
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
    -- Cleared every iteration: RETURNING writes nothing when the row is
    -- refused, and a stale v_tx would then be counted and audited as an insert
    -- that never happened. Same pattern as import_bank_transactions_atomic.
    v_tx := NULL;

    INSERT INTO public.transactions (
      user_id, account_id, description, amount, type, date,
      category, notes, tags, is_recurring, is_cleared, statement_sequence,
      category_confirmed, needs_review, import_source, import_source_id
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
      COALESCE((r->>'category_confirmed')::boolean, true),
      true,  -- needs_review: a file's rows are new until somebody saves one
      NULLIF(btrim(r->>'import_source'), ''),
      NULLIF(btrim(r->>'import_source_id'), '')
    )
    -- The whole point. Inferred from transactions_import_source_unique, which
    -- the guard above proved is present, unique and non-partial. A row with no
    -- provenance has NULLs here, NULLs never conflict, and it inserts exactly
    -- as it did before this migration existed.
    ON CONFLICT (user_id, import_source, import_source_id) DO NOTHING
    RETURNING * INTO v_tx;

    IF v_tx.id IS NULL THEN
      -- This user already holds this exact source row. It is in the account,
      -- it has already moved the balance once, and it must not do so again.
      -- Nor must it be marked new a second time: a re-posted chunk skips the
      -- row entirely, so a transaction the user has already reviewed cannot be
      -- put back in the "To Review" list by importing the same file again.
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    PERFORM public.write_financial_audit(
      p_user_id, 'transaction', v_tx.id, 'create', NULL, to_jsonb(v_tx)
    );

    v_sum := v_sum + v_tx.amount;
    v_inserted := v_inserted + 1;
  END LOOP;

  -- One balance effect for the whole batch, over the rows that actually landed,
  -- keeping the ledger invariant (balance = initial_balance + Σ amount).
  -- Audited like every other balance move.
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

  -- `idempotent` answers ONE question, for the caller that is about to decide
  -- whether re-posting this request would be safe: did EVERY row of it carry an
  -- id that this database would refuse a second time? It is deliberately a
  -- statement about THIS REQUEST and not about this function's capabilities —
  -- a client that sends no provenance gets `false` and must not retry, even
  -- though the function it just called supports it. An empty request is false
  -- for the same reason: nothing was keyed.
  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'skipped', v_skipped,
    'idempotent', v_rows > 0 AND v_keyed = v_rows
  );
END;
$$;

COMMENT ON FUNCTION public.import_transactions_atomic(uuid, uuid, jsonb) IS
  'Bulk file import (OFX/QIF/CSV) for ONE account, in one database transaction: the rows, their audit entries and a single balance movement commit together or not at all. Every row it writes arrives needs_review = true — a file the user has just handed the app is new work until somebody saves it. Idempotent per row when the caller states import_source/import_source_id — a repeat of a key this user already holds is skipped rather than inserted, so a re-posted chunk cannot move the balance twice nor re-open a row the user has already reviewed. Returns {inserted, skipped, idempotent}, where idempotent means every row of THAT request was keyed and the request is therefore safe to re-post.';

-- Grants restated rather than assumed: this function reads and writes another
-- user's data if it is ever handed the wrong p_user_id, and p_user_id is only
-- trustworthy because the sole caller is the server-side API route.
REVOKE ALL ON FUNCTION public.import_transactions_atomic(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_transactions_atomic(uuid, uuid, jsonb) TO service_role;

-- ── import_bank_transactions_atomic: a feed's rows arrive NEW too ───────────
-- Byte-for-byte 20260808100000_category_provenance.sql except for the
-- needs_review column and its literal `true`, for the same reason as above: a
-- transaction the bank has just told us about is the definition of new work.
--
-- Note it is unconditional, where category_confirmed on this same insert is
-- conditional. That difference is real: a feed row may arrive with a category
-- the PROVIDER stated (nobody guessed it, so it is confirmed), but no feed row
-- has ever been looked at by the account's owner, because it did not exist
-- until this call.
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
      is_cleared, category, category_confirmed, needs_review
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

-- ── update_transaction_atomic: a save can END a review, never START one ─────
-- Byte-for-byte 20260808100000_category_provenance.sql except for the
-- needs_review line.
--
-- ONE branch, not three. Compare the category_confirmed CASE immediately below
-- it, which has a middle arm that DERIVES confirmation from a changed category:
-- that derivation is legitimate because choosing a category is direct evidence
-- about that category. There is no equivalent evidence here. "This row was
-- updated" does not mean "a human read this row" — the bulk categorise sweep,
-- the payee rename, the transfer-link repair and the reconcile toggle all come
-- through this same function, and every one of them writes rows nobody has
-- opened. A derived rule would let one run of one bulk tool mark a whole
-- imported statement as dealt with, silently, which is the exact confusion this
-- column exists to end.
--
-- So: stated, or untouched. The four save buttons state it; nothing else does.
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
    needs_review        = CASE
                            WHEN p ? 'needs_review'
                              THEN COALESCE((p->>'needs_review')::boolean, needs_review)
                            ELSE needs_review
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

-- ── confirm_transaction_categories: agreeing IS reviewing ───────────────────
-- Byte-for-byte 20260808100000_category_provenance.sql except for the
-- needs_review assignment.
--
-- The reasoning is written out at length in the header ("WHO CLEARS IT"). In
-- short: both surfaces that call this are a person looking at a row and
-- answering the question it was asking, and the one-click answer is still an
-- answer. Doing it in here rather than in the row editor is also the only
-- honest mechanism — the alternative is a second write after every confirm,
-- which is two audit entries, two round trips and a race for one click.
--
-- It stays incapable of changing a category or an amount: it still takes no
-- category argument, and it still touches only rows that are genuinely
-- suggested, so the returned count is still the number of decisions actually
-- recorded and re-confirming is still free.
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
           -- Answering the question the row was asking is reviewing the row.
           -- Unconditional rather than guarded on needs_review, because setting
           -- false where it is already false changes nothing and one extra
           -- assignment is cheaper than a second predicate to keep in step.
           needs_review = false,
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
  'Record that the user agrees with the app''s suggested category on these rows. Flips category_confirmed and clears needs_review — answering the question a row was asking is reviewing that row — and nothing else. Takes no category and touches no amount, so it is balance-neutral and category-neutral by construction. Returns the number of rows actually confirmed.';

REVOKE ALL ON FUNCTION public.confirm_transaction_categories(uuid[], uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_transaction_categories(uuid[], uuid) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- Verification — run after applying. NOTE: unapplied at the time of writing;
-- these are what to read, and what to expect, when it is.
-- ============================================================================

-- 1. The column exists, is NOT NULL, and defaults to reviewed.
-- Expected: one row, data_type = boolean, is_nullable = NO,
--           column_default = false
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'transactions'
   AND column_name = 'needs_review';

-- 2. History reads as reviewed — nothing was backfilled to "new".
-- Expected immediately after applying: awaiting_review = 0. It rises only as
-- new imports and feed syncs land, which is the entire point.
SELECT count(*) FILTER (WHERE needs_review)     AS awaiting_review,
       count(*) FILTER (WHERE NOT needs_review) AS reviewed
  FROM public.transactions;

-- 3. Both importers mark their rows new, and neither lost anything they were
--    already doing.
-- Expected: all six true
SELECT position('true,  -- needs_review' IN pg_get_functiondef(p.oid)) > 0                     AS file_marks_new,
       position('ON CONFLICT (user_id, import_source, import_source_id) DO NOTHING'
                IN pg_get_functiondef(p.oid)) > 0                                              AS file_still_idempotent,
       position('category_confirmed' IN pg_get_functiondef(p.oid)) > 0                         AS file_keeps_provenance
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'import_transactions_atomic';

SELECT position('true    -- needs_review' IN pg_get_functiondef(p.oid)) > 0    AS feed_marks_new,
       position('payee_memory_category(' IN pg_get_functiondef(p.oid)) > 0     AS feed_keeps_payee_memory,
       position('false,  -- is_cleared' IN pg_get_functiondef(p.oid)) > 0      AS feed_still_arrives_unreconciled
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic';

-- 4. The updater honours needs_review only when it is STATED, and has not
--    grown a rule that derives it. The column may appear FIVE times in the
--    whole body and no more — the SET target, the `p ? 'needs_review'` test,
--    the `p->>'needs_review'` read, the COALESCE fallback and the ELSE. A sixth
--    means an arm was added, and the only arm that could be added is a derived
--    one, which is the thing this migration's header refuses.
-- Expected: honours_stated = true, stated_only = true
SELECT position('WHEN p ? ''needs_review''' IN pg_get_functiondef(p.oid)) > 0 AS honours_stated,
       (length(pg_get_functiondef(p.oid))
        - length(replace(pg_get_functiondef(p.oid), 'needs_review', ''))) / length('needs_review') = 5
         AS stated_only
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'update_transaction_atomic';

-- 5. Confirming clears review, and the confirmer still cannot move a category.
-- Expected: clears_review = true, takes_no_category = true
SELECT position('needs_review = false' IN pg_get_functiondef(p.oid)) > 0 AS clears_review,
       position('p_category' IN pg_get_functiondef(p.oid)) = 0           AS takes_no_category
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'confirm_transaction_categories';

-- 6. Every redefined function kept its security posture — a rewrite must not
--    quietly change SECURITY INVOKER or unpin search_path — and its grants.
-- Expected: four rows, prosecdef = false, proconfig = {search_path=public}
SELECT p.proname, p.prosecdef, p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('import_transactions_atomic', 'import_bank_transactions_atomic',
                     'update_transaction_atomic', 'confirm_transaction_categories')
 ORDER BY p.proname;

-- Expected: import_transactions_atomic and import_bank_transactions_atomic
--           service_role ONLY; the other two authenticated + service_role;
--           never anon, never PUBLIC ('-').
SELECT p.proname, a.grantee::regrole::text AS grantee, a.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 CROSS JOIN LATERAL aclexplode(p.proacl) AS a
 WHERE n.nspname = 'public'
   AND p.proname IN ('import_transactions_atomic', 'import_bank_transactions_atomic',
                     'update_transaction_atomic', 'confirm_transaction_categories')
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
