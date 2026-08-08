-- ============================================================================
-- import_transactions_atomic keeps the receipt — a re-posted chunk stops being
-- a second copy of the money
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). One existing function is redefined. No new
-- column, no new index, no backfill, no grant change, and not one existing row
-- is read or written by applying this.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- 20260722170000_transaction_import_provenance.sql added the two columns that
-- make an import idempotent —
--
--     import_source, import_source_id
--     UNIQUE (user_id, import_source, import_source_id)
--
-- — and the MS Money importer uses them properly: it writes a stable
-- `mny-txn-<htrn>` per row and asks Postgres to skip conflicts, so re-running
-- that import cannot duplicate anything.
--
-- `import_transactions_atomic` — the RPC behind EVERY file import the app
-- offers (the OFX modal, the QIF modal, the CSV wizard, via
-- /api/data/import-transactions) — never wrote either column. Every row it has
-- ever inserted carries NULL provenance, and Postgres treats NULLs as distinct,
-- so that unique index has been inert on this path since the day it was
-- created: present, indexed, and incapable of refusing anything.
--
-- The consequence is specific, and it is the worst kind this application has.
-- One call = one database transaction = one balance movement. If the request
-- COMMITS and the response is then lost — a Vercel gateway timeout, a dropped
-- connection, a phone changing network — the browser cannot tell that from a
-- request that never arrived. Post it again and the same thousand rows insert a
-- second time and `balance = balance + v_sum` runs a second time. Nothing
-- anywhere would object. Silent, permanent double-counting of real money, in
-- the register AND in the balance.
--
-- The client's answer so far was to never retry at all (ATTEMPTS_PER_CHUNK = 1
-- in src/services/transactionImportService.ts), which is correct while the
-- database cannot defend itself and costs a failed import on every transient
-- blip. This migration is what lets that be reconsidered: once a repeat insert
-- is refused BY POSTGRES, re-posting a chunk is safe by construction rather
-- than by hope.
--
-- ── WHAT `import_source_id` IS ON THIS PATH ─────────────────────────────────
-- The RPC does NOT invent the id. It writes what the row states, and the client
-- states it, because the client is the only party that can. This function sees
-- ONE CHUNK of at most 2,000 rows; it cannot distinguish "the second identical
-- coffee in this statement, which is in the next chunk" from "the same row
-- re-posted", and a server-side guess would silently drop one of the two. The
-- shapes the client sends (src/services/transactionImportService.ts):
--
--   fitid:<account_id>:<FITID>   OFX only. FITID is the bank's own identifier
--                                for that transaction, unique within the
--                                account by the OFX specification — a genuine
--                                identity, not a guess about one. Scoped by
--                                account because the unique index is scoped by
--                                USER, and two banks may both hand out FITID
--                                "1"; without the account in the key, one
--                                account's statement would suppress another's.
--
--   post:<run_id>:<row_index>    Everything else (QIF, CSV, and any OFX row
--                                whose FITID is unreadable). A per-import-run
--                                uuid and the row's index in the WHOLE file,
--                                fixed before the file is chunked.
--
-- Why the second shape is an index and not a content hash: a statement may
-- legally contain two rows with the same date, the same amount and the same
-- description (two £4.25 coffees on Tuesday), and they are two payments. Keying
-- on content would make the database delete the second one. `post:` keys are
-- unique per row by construction, so the ONLY collision they can ever produce
-- is the one this migration exists to catch: the same POST arriving twice.
-- What they deliberately do NOT give is cross-run dedupe — importing the same
-- QIF twice still offers the same rows twice, exactly as today, and that
-- remains the browser-side duplicate check's job, where the user can see the
-- matches and overrule them.
--
-- ── WHAT DOES NOT CHANGE ────────────────────────────────────────────────────
-- Every row already in the table: this migration writes no data. Rows imported
-- before it keep NULL provenance and are never matched by anything below — the
-- protection starts with the next import, which is where the risk is.
--
-- A row that arrives with NO provenance (any caller that has not deployed the
-- matching client yet) behaves EXACTLY as it does today: NULLs never conflict,
-- so it inserts, and `idempotent: false` comes back saying so out loud. That is
-- what makes this safe to apply in either order relative to the app deploy.
--
-- Also unchanged: the signature, SECURITY INVOKER, the pinned search_path, the
-- per-row audit write, the account ownership+lock check that is this function's
-- security boundary, the columns it inserts (statement_sequence from
-- 20260808090000 and category_confirmed from 20260808100000 are carried through
-- byte-for-byte), and the grants — service_role only.
--
-- ── BALANCE REASONING ───────────────────────────────────────────────────────
-- The balance statement itself is untouched: still ONE
-- `balance = balance + v_sum` for the whole batch, still inside the same
-- database transaction as the inserts and the audit rows, still guarded by
-- `IF v_inserted > 0`.
--
-- What changes is what v_sum SUMS. A row that Postgres refuses as a duplicate
-- returns no row from `RETURNING`, so it is counted as skipped and CONTINUEs
-- before reaching `v_sum := v_sum + v_tx.amount`. A chunk that is entirely a
-- re-post therefore inserts nothing, sums to zero, and — because v_inserted is
-- 0 — does not run the UPDATE at all. The ledger invariant
-- `balance = initial_balance + Σ(amount)` is preserved in both directions: the
-- rows that land move the balance, the rows that are refused never existed to
-- move it. That is the entire headline of this migration, and verification 6
-- checks it rather than asserting it.
--
-- The audit write moves with the row, not the request: a refused row inserts
-- nothing, so it writes no 'create' entry. The audit log therefore keeps saying
-- exactly what the table holds.
--
-- ── WHY ON CONFLICT DO NOTHING, NOT A RAISED VIOLATION ──────────────────────
-- Letting the unique violation abort the whole call would be the cruder answer:
-- the chunk is atomic, so ONE duplicate row would throw away 999 good ones and
-- leave the caller to work out which. DO NOTHING is per-row and exact, it is
-- what `import_bank_transactions_atomic` already does for the feed's own
-- duplicates on this same table, and it lets the function return a truthful
-- `skipped` count so the app can tell the user "these were already here"
-- instead of "something went wrong".
--
-- The danger of DO NOTHING is that a bad key silently discards good rows, so it
-- is guarded rather than trusted: a request that repeats a (source, id) pair
-- WITHIN ITSELF is refused loudly before a single row is written, because that
-- can only be a client bug and DO NOTHING would turn it into missing money.
--
-- ── WHY NOT external_transaction_id ─────────────────────────────────────────
-- Unchanged from 20260722170000, and worth restating because a FITID feels like
-- it belongs there: that column is the BANK FEED's provenance, and
-- import_bank_transactions_atomic keys both its dedupe AND its
-- backfill-vs-incremental balance decision off "does this account hold any
-- transaction with a non-null external_transaction_id?". Writing OFX file ids
-- into it would make an imported statement masquerade as a bank-fed account and
-- suppress the first real sync's initial_balance rebase. File imports keep
-- their own columns.
-- ============================================================================

BEGIN;

-- ── Guards: refuse anything but the exact state this body was derived from ──
-- This function has been redefined three times in three days (20260709120000,
-- 20260808090000, 20260808100000). A full CREATE OR REPLACE that is one release
-- out of date silently DELETES a column from the insert list, and the failure
-- is invisible until someone notices a register that has stopped recording
-- something. So the state is checked, by name, before anything is replaced.
DO $$
DECLARE
  v_src text;
  v_indexdef text;
  v_unique boolean;
  v_partial boolean;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_src
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'import_transactions_atomic';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'file_importer_missing: expected import_transactions_atomic to exist before changing what it writes'
      USING ERRCODE = 'P0002';
  END IF;

  -- Fingerprint 1: the bank's own within-day order (20260808090000). Absent
  -- means that migration has not run, and the body below would be writing a
  -- column this database does not have — a runtime failure on every import,
  -- since a plpgsql body is not parsed until it is called.
  IF position('statement_sequence' IN v_src) = 0 THEN
    RAISE EXCEPTION 'file_importer_missing_statement_sequence: import_transactions_atomic does not carry statement_sequence — apply 20260808090000_transaction_statement_sequence.sql first. Applying this body now would either fail at import time or silently stop recording the statement order.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Fingerprint 2: the suggested-category flag (20260808100000). Same reasoning
  -- exactly, and the failure would be worse: the register would go back to
  -- being unable to tell a category the app guessed from one the user chose.
  IF position('category_confirmed' IN v_src) = 0 THEN
    RAISE EXCEPTION 'file_importer_missing_category_confirmed: import_transactions_atomic does not carry category_confirmed — apply 20260808100000_category_provenance.sql first. Applying this body now would drop the flag that tells a guessed category from a chosen one.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Fingerprint 3: not already done. Reaching here on a re-run means the live
  -- function already writes provenance, so there is nothing to do and pressing
  -- on could only overwrite something newer with this.
  IF position('import_source_id' IN v_src) > 0 THEN
    RAISE EXCEPTION 'file_importer_provenance_already_present: import_transactions_atomic already writes import_source_id — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Fingerprint 4: THE index. `ON CONFLICT (user_id, import_source,
  -- import_source_id)` is inferred from it at run time, so without it — or with
  -- it made partial, or over different columns — every file import in the app
  -- would fail with 42P10 instead of importing. Checked here, where the failure
  -- costs a rolled-back migration instead of a broken import screen.
  SELECT pg_get_indexdef(i.indexrelid), i.indisunique, i.indpred IS NOT NULL
    INTO v_indexdef, v_unique, v_partial
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'transactions_import_source_unique';

  IF v_indexdef IS NULL THEN
    RAISE EXCEPTION 'import_provenance_index_missing: transactions_import_source_unique does not exist — apply 20260722170000_transaction_import_provenance.sql first. Without it the ON CONFLICT below cannot be inferred and every file import would fail.'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_unique OR v_partial
     OR position('(user_id, import_source, import_source_id)' IN v_indexdef) = 0 THEN
    RAISE EXCEPTION 'import_provenance_index_unexpected: transactions_import_source_unique is not a plain UNIQUE index over (user_id, import_source, import_source_id) — it is: %. ON CONFLICT infers that exact index; review by hand.', v_indexdef
      USING ERRCODE = 'P0001';
  END IF;

  -- Fingerprint 5: both-or-neither. The function refuses a half-stated pair
  -- itself (a clearer message than a constraint name), but the constraint is
  -- what guarantees no other writer can leave an unattributable id behind.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.transactions'::regclass
       AND conname = 'transactions_import_provenance_complete'
  ) THEN
    RAISE EXCEPTION 'import_provenance_constraint_missing: transactions_import_provenance_complete is gone — the both-or-neither guarantee this function relies on is not in place. Review by hand.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ── import_transactions_atomic: write the receipt, refuse the second copy ───
-- Byte-for-byte 20260808100000_category_provenance.sql except for: the
-- provenance validation block, the two extra INSERT columns, the ON CONFLICT
-- clause, the skipped counter, and the two extra keys in the returned object.
-- The lock, the ownership check, the audit writes and the balance statement are
-- untouched.
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
      category_confirmed, import_source, import_source_id
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
  'Bulk file import (OFX/QIF/CSV) for ONE account, in one database transaction: the rows, their audit entries and a single balance movement commit together or not at all. Idempotent per row when the caller states import_source/import_source_id — a repeat of a key this user already holds is skipped rather than inserted, so a re-posted chunk cannot move the balance twice. Returns {inserted, skipped, idempotent}, where idempotent means every row of THAT request was keyed and the request is therefore safe to re-post.';

-- Grants restated rather than assumed: this function reads and writes another
-- user's data if it is ever handed the wrong p_user_id, and p_user_id is only
-- trustworthy because the sole caller is the server-side API route.
REVOKE ALL ON FUNCTION public.import_transactions_atomic(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_transactions_atomic(uuid, uuid, jsonb) TO service_role;

COMMIT;

-- ============================================================================
-- Verification — run after applying. NOTE: unapplied at the time of writing;
-- these are what to read, and what to expect, when it is.
-- ============================================================================

-- 1. The function writes provenance, refuses the repeat, and still carries
--    everything the two migrations before it added.
-- Expected: all four true
SELECT position('import_source_id' IN pg_get_functiondef(p.oid)) > 0            AS writes_provenance,
       position('ON CONFLICT (user_id, import_source, import_source_id) DO NOTHING'
                IN pg_get_functiondef(p.oid)) > 0                               AS skips_repeats,
       position('statement_sequence' IN pg_get_functiondef(p.oid)) > 0          AS keeps_statement_order,
       position('category_confirmed' IN pg_get_functiondef(p.oid)) > 0          AS keeps_category_provenance
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'import_transactions_atomic';

-- 2. Security posture unchanged by the rewrite.
-- Expected: one row, prosecdef = false, proconfig = {search_path=public}
SELECT p.proname, p.prosecdef, p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'import_transactions_atomic';

-- 3. Grants unchanged: service_role, plus the owner role every function here
--    already carries. Never anon, never authenticated, never PUBLIC ('-') —
--    p_user_id is this function's only boundary and the API route is the only
--    thing that decides it.
-- Expected: service_role and postgres (the owner), nothing else
SELECT a.grantee::regrole::text AS grantee, a.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 CROSS JOIN LATERAL aclexplode(p.proacl) AS a
 WHERE n.nspname = 'public' AND p.proname = 'import_transactions_atomic'
 ORDER BY grantee;

-- 4. The index the ON CONFLICT infers is still exactly what it must be:
--    UNIQUE, non-partial, those three columns in that order.
-- Expected: one row, is_unique = true, is_partial = false
SELECT pg_get_indexdef(i.indexrelid) AS indexdef,
       i.indisunique                 AS is_unique,
       i.indpred IS NOT NULL         AS is_partial
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname = 'transactions_import_source_unique';

-- 5. No user holds two rows under one import id. True before this migration by
--    accident (the index was inert but nothing wrote to it except the Money
--    importer, which asks for conflicts to be skipped) and true after it by
--    enforcement.
-- Expected: zero rows
SELECT user_id, import_source, import_source_id, count(*)
  FROM public.transactions
 WHERE import_source_id IS NOT NULL
 GROUP BY user_id, import_source, import_source_id
HAVING count(*) > 1;

-- 6. The balance invariant still holds for every account: balance must equal
--    initial_balance + Σ(amount). This migration writes no data, so it cannot
--    have moved one — this is the check that proves it rather than asserting
--    it, and it is the same figure that a double-posted chunk would break.
-- Expected: zero rows
SELECT a.id, a.name, a.balance, a.initial_balance + COALESCE(t.total, 0) AS expected
  FROM public.accounts a
  LEFT JOIN (
    SELECT account_id, sum(amount) AS total
      FROM public.transactions
     GROUP BY account_id
  ) t ON t.account_id = a.id
 WHERE a.balance IS DISTINCT FROM a.initial_balance + COALESCE(t.total, 0);

-- 7. What the file-import path has recorded so far. Expected immediately after
--    applying: only 'ms-money' rows (the importer that already did this), and
--    zero for the file-import sources. They climb from the next OFX/QIF/CSV
--    import onward, which is how you know the client half is deployed.
SELECT COALESCE(import_source, '(none — hand-entered, bank feed, or imported before this migration)') AS import_source,
       count(*) AS rows
  FROM public.transactions
 GROUP BY 1
 ORDER BY 2 DESC;
