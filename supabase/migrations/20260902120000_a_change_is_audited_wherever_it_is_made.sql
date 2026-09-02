-- ============================================================================
-- 20260902120000_a_change_is_audited_wherever_it_is_made.sql
--
-- THE AUDIT TRAIL STOPS BEING A PROPERTY OF THE APP AND BECOMES A PROPERTY OF
-- THE TABLES — the owner's decision of 2 Sep 2026.
--
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- public.financial_audit_log (20260610150000) has exactly one write path,
-- public.write_financial_audit, and thirty-two RPC migrations call it by hand.
-- That is a good arrangement while every change comes through an RPC, and it
-- has one consequence nobody chose: a change made ANY OTHER WAY leaves no
-- trace at all.
--
-- On the night of 1 Sep 2026 a maintenance UPDATE run in psql put 771
-- transactions back to their real payee after a bad rename. It was the right
-- repair, and the audit log does not know it happened — the only reason the
-- rename itself could be undone is that the RENAME had gone through the app
-- and left before_data behind. The repair did not, so the repair cannot.
--
-- The same gap covers everything that is not an RPC: a PostgREST write that
-- goes straight at a table, a psql session, a future migration's backfill, a
-- support fix. This migration closes it at the level where it cannot be
-- forgotten, which is the same argument 20260828140000 makes for the deletion
-- tombstone: "there are two delete paths today and nothing stops a third being
-- written... the rule belongs to the table."
--
-- It also buys the groundwork for undo-from-history: a history with holes in
-- it can only ever offer to undo some of what happened.
--
-- ── WHAT IS NOT DONE, AND WHY ───────────────────────────────────────────────
--
-- Editing the thirty-two RPC bodies is rejected. They already write the entry
-- that matters, with the intent attached ('this was a bulk filing', 'this was
-- a transfer link'); rewriting them would risk thirty-two wrong-base rebases
-- to gain nothing. FILL THE GAP; NEVER DUPLICATE.
--
-- So the triggers below must be able to tell "the app already logged this"
-- from "nobody logged this", inside one transaction, and the interesting half
-- of this file is how.
--
-- ── HOW: DEFER TO COMMIT, AND KEEP A REGISTRY ───────────────────────────────
--
-- 1. write_financial_audit additionally NOTES what it just logged, in a
--    registry that lives for the transaction and no longer.
--
-- 2. The triggers are CONSTRAINT TRIGGERs, DEFERRABLE INITIALLY DEFERRED, so
--    they fire at COMMIT rather than at statement end. By then every explicit
--    audit call the transaction was going to make has been made, so the
--    registry is complete and the trigger can simply ask it. An ordinary
--    AFTER trigger could not: it runs before the RPC body reaches its own
--    PERFORM write_financial_audit, and would see an empty registry every
--    time.
--
-- 3. A row change with no matching registry entry is written — through the
--    same write_financial_audit, so there is still exactly one INSERT path
--    into the table, and the identity rules of 20260725120000 still apply.
--
-- ── WHY A TEMP TABLE AND NOT set_config(..., true) ──────────────────────────
--
-- Both were measured on scripts/local-db's cluster (PostgreSQL 17.10), at the
-- 800-row size a real bulk filing reaches.
--
-- A transaction-local GUC per audited row LEAKS ACROSS TRANSACTIONS. Not the
-- value — that is reset correctly — but the ENTRY. Measured:
--
--     BEGIN; SELECT set_config('wtaudit.abc','1',true); COMMIT;
--     SELECT current_setting('wtaudit.abc', true) IS NULL;  -->  f
--
-- After the transaction that created it has committed, the key still answers,
-- with an empty string rather than NULL. Two things follow. The obvious one is
-- that "have I registered this?" written as `IS NOT NULL` is permanently true
-- for every key the SESSION has ever used — on a pooled connection that is one
-- user's transaction silencing another's audit rows. The quieter one is that
-- the placeholder is never reclaimed: 800 fresh names per transaction, on a
-- connection that lives for hours, is an unbounded hash of dead keys, and
-- nothing short of DISCARD ALL clears them. Accumulating one key instead is no
-- better: rewriting a growing string 800 times is quadratic, and every
-- intermediate copy is pinned on the transaction's GUC stack until commit.
--
-- A TEMP TABLE ... ON COMMIT DELETE ROWS cannot do either. It is truncated at
-- every commit and discarded at every rollback, so a transaction always starts
-- with an empty registry; measured at 800 rows it costs 2.1 ms to fill and is
-- a primary-key probe to read. Verified here (see the proof file) that a
-- registry filled during the transaction is STILL VISIBLE to the deferred
-- triggers at commit — ON COMMIT DELETE ROWS runs after them, not before.
--
-- ── THE BACKSTOP, AND WHAT IT IS FOR ────────────────────────────────────────
--
-- When the registry has no entry, the trigger asks the log itself: is there
-- already a row for this (entity, entity_id, action) with created_at = now()?
-- created_at defaults to now(), which is the TRANSACTION's start time and is
-- therefore stable across the whole transaction, and (entity, entity_id) is
-- indexed.
--
-- That check exists for one scenario, and it is a scenario this repository has
-- already lived through twice: a future migration rebasing write_financial_audit
-- onto the 20260725120000 body and silently dropping the registry line (see
-- 20260808150000 and 20260808180000, each of which documents losing a line
-- exactly that way). Without the backstop every app write would quietly gain a
-- duplicate audit row. With it, the worst case is one extra index probe.
--
-- ── WHAT COUNTS AS A CHANGE ─────────────────────────────────────────────────
--
-- An UPDATE whose only difference is `updated_at` is not a change, and the
-- literal `OLD IS NOT DISTINCT FROM NEW` cannot see that: all three tables
-- carry a BEFORE UPDATE trigger (update_updated_at_column) that stamps
-- NEW.updated_at = now() unconditionally, so `UPDATE t SET x = x` produces
-- rows that differ. The comparison below therefore ignores that one column —
-- which subsumes OLD IS NOT DISTINCT FROM NEW, since two identical rows stay
-- identical with a column removed.
--
-- ── PAYLOAD ─────────────────────────────────────────────────────────────────
--
-- to_jsonb(OLD) / to_jsonb(NEW), whole rows. That is what every existing call
-- site passes (`to_jsonb(v_old)`, `to_jsonb(v_new)` — the RPCs' locals are
-- table rowtypes), so a reader of financial_audit_log cannot tell a
-- trigger-written row from an RPC-written one by its shape, and undo-from-
-- history needs only one code path.
--
-- No column is withheld. accounts.account_number and accounts.sort_code are
-- the most sensitive things in the three tables and they are ALREADY in this
-- log — thirty-one existing call sites pass whole account rows. There is no
-- credential on any of the three tables (bank tokens live on
-- bank_connections, which this migration does not touch), and the log is
-- RLS select-own, so nothing about who can see what changes here.
--
-- ── ACTOR ───────────────────────────────────────────────────────────────────
--
-- Unchanged, and deliberately so: write_financial_audit derives actor_clerk_id
-- from public.requesting_clerk_id(), the `sub` claim of the verified JWT. A
-- trigger inherits that for free — the same value under a user's session, NULL
-- under the service role and NULL in psql. NULL is the honest answer to "which
-- person did this" when the answer is "not a person in the app", and it is
-- already what every service-role import writes.
--
-- ── BLAST RADIUS ────────────────────────────────────────────────────────────
--
-- * Every RPC path keeps writing exactly the audit rows it wrote before. The
--   registry is what guarantees it, and proof (a) in
--   scripts/local-db/audit-trigger.test.sql measures it.
-- * Paths that were silent now write one row per changed row. The measured
--   ones are: direct PostgREST table writes, psql maintenance, migration
--   backfills, and the two places where the app changes a row WITHOUT
--   auditing it — restore_user_chunk's inserts and the categories a wipe
--   takes by cascade. Those are named in the proof file with their counts.
-- * Deleting a user is unaffected. The cascade into these three tables
--   produces DELETE events whose owner is already gone by commit; the trigger
--   stands aside rather than writing an orphan or, worse, aborting the
--   erasure on the identity check. Proof (h).
-- * Nothing here touches balances, amounts, dates or signs. The ledger
--   invariant `balance = initial_balance + Σ(amount)` is untouched: this
--   migration reads rows and writes to one append-only log.
--
-- ── ON RE-RUNNING THIS FILE ─────────────────────────────────────────────────
--
-- Idempotent by construction: CREATE OR REPLACE for all three functions,
-- DROP TRIGGER IF EXISTS + CREATE for all three triggers. The guard that
-- refuses is about the BASE, not about having run before — the body below
-- keeps 20260725120000's identity check verbatim, and applying it over
-- anything that does not already carry that check would drop it.
-- ============================================================================

BEGIN;

-- ── Guards ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_oid oid;
  v_src text;
  v_missing text;
BEGIN
  -- Guard 1: the log and the three tables exist.
  SELECT string_agg(t, ', ' ORDER BY t) INTO v_missing
    FROM unnest(ARRAY['financial_audit_log', 'transactions', 'accounts', 'categories']) t
   WHERE to_regclass('public.' || t) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'audit_trigger_tables_missing: public.% do(es) not exist — apply the baseline and 20260610150000_financial_audit_log.sql first', v_missing
      USING ERRCODE = 'P0002';
  END IF;

  -- Guard 2: the writer exists, with the signature all thirty-two call sites
  -- pass positionally. Replacing it under a different shape would break them.
  v_oid := to_regprocedure('public.write_financial_audit(uuid, text, uuid, text, jsonb, jsonb)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'audit_writer_missing: expected write_financial_audit(uuid, text, uuid, text, jsonb, jsonb) to exist before extending it — apply 20260610150000_financial_audit_log.sql first'
      USING ERRCODE = 'P0002';
  END IF;
  v_src := pg_get_functiondef(v_oid);

  -- Guard 3: THE RIGHT BASE. The body below is 20260725120000's body plus the
  -- registry note, so the live function must already carry that migration's
  -- fingerprints — the identity check that stopped the log being forgeable,
  -- and the derivation it replaced p_user_id with. Applying this body over an
  -- older one would silently un-fix a security finding.
  IF position('audit_identity_mismatch' IN v_src) = 0
     OR position('requesting_clerk_id' IN v_src) = 0 THEN
    RAISE EXCEPTION 'audit_writer_wrong_base: write_financial_audit does not carry the identity check from 20260725120000_audit_identity_and_function_grants.sql — apply that migration first. Replacing the body without it would make the audit log forgeable again.'
      USING ERRCODE = 'P0001',
            HINT = 'Two migrations in this history have lost a line by rebasing onto a superseded definition (20260808150000, 20260808180000). This guard is what stops the next one.';
  END IF;

  -- Guard 4: the column the deferred triggers compare on. A plpgsql body is
  -- not parsed until it is invoked, so a missing column would surface at the
  -- next write rather than now.
  SELECT string_agg(t, ', ' ORDER BY t) INTO v_missing
    FROM unnest(ARRAY['transactions', 'accounts', 'categories']) t
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'audit_trigger_updated_at_missing: public.% has no updated_at column, which the same-values comparison depends on', v_missing
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ── 1. The writer notes what it logged ─────────────────────────────────────
-- Byte-for-byte 20260725120000_audit_identity_and_function_grants.sql's body
-- (its lines 119-158) with ONE block added after the INSERT. The identity
-- rules, the service-role branch, the error codes and the hints are untouched;
-- read that file for why they say what they say.
CREATE OR REPLACE FUNCTION public.write_financial_audit(
  p_user_id uuid,
  p_entity text,
  p_entity_id uuid,
  p_action text,
  p_before jsonb,
  p_after jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Cheap: a GUC read, no table access. Deliberately resolved before the
  -- users lookup so bulk service-role imports never pay for one.
  v_clerk text := public.requesting_clerk_id();
  v_role  text;
  v_user  uuid;
BEGIN
  IF v_clerk IS NOT NULL THEN
    v_user := public.requesting_user_id();
    IF v_user IS NULL OR p_user_id IS DISTINCT FROM v_user THEN
      RAISE EXCEPTION 'audit_identity_mismatch'
        USING ERRCODE = '42501',
              HINT = 'A financial audit row may only be written for the user in the caller''s own session token.';
    END IF;
  ELSE
    v_role := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      NULLIF(current_setting('role', true), 'none')
    );
    IF v_role IS NOT NULL AND v_role <> 'service_role' THEN
      RAISE EXCEPTION 'audit_identity_required'
        USING ERRCODE = '42501',
              HINT = 'Only an end-user session or the service role may write financial audit rows.';
    END IF;
    v_user := p_user_id;
  END IF;

  INSERT INTO public.financial_audit_log
    (user_id, actor_clerk_id, entity, entity_id, action, before_data, after_data)
  VALUES
    (v_user, v_clerk, p_entity, p_entity_id, p_action, p_before, p_after);

  -- ── The registry (20260902120000) ────────────────────────────────────────
  -- Note what was just logged, so the deferred triggers on transactions,
  -- accounts and categories know not to log it a second time at commit.
  --
  -- ON COMMIT DELETE ROWS is the whole safety argument: the rows cannot
  -- outlive the transaction that wrote them, in the way a transaction-local
  -- GUC's PLACEHOLDER does. Created on demand rather than in this migration
  -- because a temp table belongs to a session, not to a schema.
  --
  -- ON CONFLICT DO NOTHING keeps the registry bounded by the number of
  -- DISTINCT changes rather than the number of audit calls: an RPC that logs
  -- the same row twice registers it once, and the trigger's question is
  -- existential either way.
  --
  -- DO NOT REMOVE THIS BLOCK WITHOUT DROPPING THE THREE TRIGGERS. Without it
  -- every RPC write gains a duplicate audit row at commit — the backstop in
  -- financial_audit_already_written() is what makes that recoverable rather
  -- than a corrupted history.
  IF to_regclass('pg_temp.wt_audit_written') IS NULL THEN
    CREATE TEMP TABLE wt_audit_written (
      entity    text NOT NULL,
      entity_id uuid NOT NULL,
      action    text NOT NULL,
      PRIMARY KEY (entity, entity_id, action)
    ) ON COMMIT DELETE ROWS;
  END IF;

  -- EXECUTE rather than a static reference: the relation is created at
  -- runtime, and a plpgsql plan cached against one incarnation of a temp
  -- table is the classic way to be handed a stale OID after DISCARD TEMP.
  EXECUTE 'INSERT INTO pg_temp.wt_audit_written (entity, entity_id, action)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING'
    USING p_entity, p_entity_id, p_action;
END;
$$;

COMMENT ON FUNCTION public.write_financial_audit(uuid, text, uuid, text, jsonb, jsonb) IS
  'Sole write path into financial_audit_log. The user recorded is derived from the caller''s verified JWT; p_user_id is trusted only for service-role and direct database sessions, which have no end-user identity to derive. An authenticated caller cannot attribute an audit row to anyone but themselves. Since 20260902120000 it also registers what it logged in a transaction-scoped temp table, so the deferred audit triggers on transactions/accounts/categories can tell an RPC''s change from an unlogged one.';

REVOKE ALL ON FUNCTION public.write_financial_audit(uuid, text, uuid, text, jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.write_financial_audit(uuid, text, uuid, text, jsonb, jsonb) TO authenticated, service_role;

-- ── 2. "Has this already been logged in this transaction?" ─────────────────
-- SECURITY DEFINER for a reason that is easy to miss: the registry is a temp
-- table created INSIDE write_financial_audit, which is SECURITY DEFINER, so it
-- belongs to this migration's role and an `authenticated` session cannot read
-- it. Both functions are created here, by the same role, which is what makes
-- the pair work.
--
-- Not granted to anyone. Every caller reaches it from inside
-- audit_unlogged_row_change(), which is SECURITY DEFINER with the same owner,
-- and an owner always has EXECUTE on its own function. There is no reason for
-- a client to be able to ask this question.
CREATE OR REPLACE FUNCTION public.financial_audit_already_written(
  p_entity text,
  p_entity_id uuid,
  p_action text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_found      boolean;
  v_registered boolean;
BEGIN
  -- The registry: empty at the start of every transaction, so a hit means
  -- "logged by THIS transaction" and nothing older.
  IF to_regclass('pg_temp.wt_audit_written') IS NOT NULL THEN
    -- Both questions in one statement: "is this change in the registry?" and
    -- "has the registry been written to at all this transaction?". The second
    -- is what decides whether the backstop below is worth paying for.
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM pg_temp.wt_audit_written
                             WHERE entity = $1 AND entity_id = $2 AND action = $3),
                    EXISTS (SELECT 1 FROM pg_temp.wt_audit_written)'
      INTO v_found, v_registered USING p_entity, p_entity_id, p_action;

    IF v_found THEN
      RETURN true;
    END IF;

    -- The registry has entries and this change is not among them, so the
    -- current write_financial_audit is installed and has already spoken.
    -- Believe it, and skip the index probe below. This is the hot path for
    -- anything bulk — measured on a 5,000-transaction restore chunk, asking
    -- the log as well took it from 496 ms to 1,194 ms for no extra truth
    -- (303 ms is what the same chunk costs with the triggers switched off).
    IF v_registered THEN
      RETURN false;
    END IF;
  END IF;

  -- The backstop, for the day someone rebases write_financial_audit onto an
  -- older body and takes the registry with it — the failure this repository
  -- has already had twice. That writer never registers anything, so the
  -- registry stays absent or empty for the whole session and this probe runs
  -- every time, which is exactly when it is needed. now() is the transaction's
  -- start time and is what created_at defaults to, so this asks "was a row for
  -- this entity logged by THIS transaction"; (entity, entity_id) is indexed.
  RETURN EXISTS (
    SELECT 1 FROM public.financial_audit_log
     WHERE entity = p_entity
       AND entity_id = p_entity_id
       AND action = p_action
       AND created_at = now()
  );
END;
$$;

COMMENT ON FUNCTION public.financial_audit_already_written(text, uuid, text) IS
  'True when this transaction has already written a financial_audit_log row for (entity, entity_id, action) — from the transaction-scoped registry write_financial_audit keeps, falling back to the log itself. Read only by the deferred audit triggers; deliberately granted to nobody.';

REVOKE ALL ON FUNCTION public.financial_audit_already_written(text, uuid, text) FROM public, anon, authenticated, service_role;

-- ── 3. The trigger ─────────────────────────────────────────────────────────
-- One function for all three tables; the entity name is the trigger argument,
-- so the strings written here are the same ones the RPCs write ('transaction',
-- 'account', 'category') rather than table names.
CREATE OR REPLACE FUNCTION public.audit_unlogged_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity text := TG_ARGV[0];
  v_action text;
  v_user   uuid;
  v_id     uuid;
  v_before jsonb;
  v_after  jsonb;
BEGIN
  -- Against recursion. Nothing on financial_audit_log fires a trigger today,
  -- so this cannot bite now; it is here so that adding one later degrades to
  -- "the nested change is not audited" instead of an infinite descent.
  -- Measured: a deferred constraint trigger fires at depth 1, so this does not
  -- suppress the ordinary case.
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  IF v_entity IS NULL THEN
    RAISE EXCEPTION 'audit_trigger_entity_missing: %.% was created without its entity argument', TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_user   := NEW.user_id;
    v_id     := NEW.id;
    v_after  := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_user   := OLD.user_id;
    v_id     := OLD.id;
    v_before := to_jsonb(OLD);
  ELSE
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
    -- Nothing changed but the stamp the BEFORE trigger just put on it. See the
    -- header: update_updated_at_column writes now() unconditionally, so
    -- OLD IS NOT DISTINCT FROM NEW is never true here and is not the question.
    IF (v_before - 'updated_at') IS NOT DISTINCT FROM (v_after - 'updated_at') THEN
      RETURN NULL;
    END IF;
    v_action := 'update';
    v_user   := NEW.user_id;
    v_id     := NEW.id;
  END IF;

  -- ── THE OWNER MAY ALREADY BE GONE ────────────────────────────────────────
  -- Only reachable on DELETE, and only via one route: all three tables carry
  -- `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, so a row
  -- can lose its owner only by being cascaded away with them. INSERT and
  -- UPDATE events are guaranteed a live owner by that same foreign key, which
  -- is why this costs the hot paths nothing.
  --
  -- Skipping is the only correct answer, and it is not merely defensive:
  -- write_financial_audit derives the user from the caller's JWT, and for a
  -- clerk_id whose users row has just been deleted requesting_user_id()
  -- returns NULL, so the identity check raises `audit_identity_mismatch` and
  -- takes the entire cascade — the whole account deletion — down with it.
  -- Measured: `DELETE FROM public.users` under that user's own claim failed
  -- exactly this way on the second run of restore-roundtrip.test.sql.
  --
  -- Nor is there anything to write. financial_audit_log.user_id carries NO
  -- foreign key (the table has only its primary key and the action check), so
  -- the insert would succeed and leave rows naming a user who no longer
  -- exists — new orphans minted BY an erasure, at the moment the point is to
  -- remove that person. The rows written before the deletion are untouched by
  -- it for the same reason: no key cascades them, and purge_expired_audit_log
  -- (20260611150000) is what eventually clears them.
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_user) THEN
    RETURN NULL;
  END IF;

  IF public.financial_audit_already_written(v_entity, v_id, v_action) THEN
    RETURN NULL;
  END IF;

  PERFORM public.write_financial_audit(v_user, v_entity, v_id, v_action, v_before, v_after);

  RETURN NULL;  -- AFTER trigger: the return value is discarded.
END;
$$;

COMMENT ON FUNCTION public.audit_unlogged_row_change() IS
  'Deferred audit of a row change no RPC accounted for. Fires at COMMIT (see the CONSTRAINT TRIGGERs below), by which time every explicit write_financial_audit call in the transaction has run, and writes only what the registry says was missed. Takes the entity name as its trigger argument.';

REVOKE ALL ON FUNCTION public.audit_unlogged_row_change() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.audit_unlogged_row_change() TO authenticated, service_role;

-- ── 4. The triggers ────────────────────────────────────────────────────────
-- DEFERRABLE INITIALLY DEFERRED is not decoration. An ordinary AFTER trigger
-- fires at statement end, which is BEFORE the calling RPC reaches its own
-- PERFORM write_financial_audit — the registry would be empty and every RPC
-- write would gain a duplicate. Firing at commit is what makes "did anyone
-- already log this?" an answerable question.

DROP TRIGGER IF EXISTS transactions_audit_unlogged_changes ON public.transactions;
CREATE CONSTRAINT TRIGGER transactions_audit_unlogged_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.audit_unlogged_row_change('transaction');

DROP TRIGGER IF EXISTS accounts_audit_unlogged_changes ON public.accounts;
CREATE CONSTRAINT TRIGGER accounts_audit_unlogged_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.accounts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.audit_unlogged_row_change('account');

DROP TRIGGER IF EXISTS categories_audit_unlogged_changes ON public.categories;
CREATE CONSTRAINT TRIGGER categories_audit_unlogged_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.audit_unlogged_row_change('category');

COMMIT;

-- ============================================================================
-- Verification — run after applying
-- ============================================================================

-- 1. Three deferred constraint triggers, one per table. Expected: three rows,
--    every flag true.
SELECT c.relname                AS table_name,
       t.tgname                 AS trigger_name,
       t.tgdeferrable           AS deferrable,
       t.tginitdeferred         AS initially_deferred,
       t.tgconstraint <> 0      AS is_constraint_trigger,
       encode(t.tgargs, 'escape') AS entity_argument
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
 WHERE NOT t.tgisinternal
   AND t.tgname LIKE '%_audit_unlogged_changes'
 ORDER BY c.relname;

-- 2. The writer still carries the identity check AND now carries the registry.
--    Expected: both true.
SELECT position('audit_identity_mismatch' IN pg_get_functiondef(oid)) > 0 AS keeps_identity_check,
       position('wt_audit_written'        IN pg_get_functiondef(oid)) > 0 AS keeps_registry
  FROM pg_proc
 WHERE oid = to_regprocedure('public.write_financial_audit(uuid, text, uuid, text, jsonb, jsonb)');

-- 3. Nobody but the owner can ask the registry question. Expected: no rows.
SELECT grantee, privilege_type
  FROM information_schema.routine_privileges
 WHERE specific_schema = 'public'
   AND routine_name = 'financial_audit_already_written'
   AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role');

-- 4. The gap this closes, on live data: entities changed today with no audit
--    row for the change. Expected to fall to ~0 for changes made from now on.
--    (Historic rows are not backfilled — there is nothing to backfill from.)
SELECT entity, action, actor_clerk_id IS NULL AS acted_outside_a_session, count(*)
  FROM public.financial_audit_log
 WHERE created_at >= date_trunc('day', now())
 GROUP BY 1, 2, 3
 ORDER BY 1, 2, 3;
