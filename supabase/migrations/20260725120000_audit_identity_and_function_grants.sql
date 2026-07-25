-- ============================================================================
-- AUDIT IDENTITY + FUNCTION GRANT HARDENING
-- ============================================================================
-- Two database-layer findings from the behavioural security audit of
-- 2026-07-25. RLS itself held up (the anon key returns nothing from any
-- table); these are the two weaknesses underneath it.
--
-- ── FINDING 1: the audit log was forgeable ─────────────────────────────────
-- public.write_financial_audit (20260610150000_financial_audit_log.sql) is
-- SECURITY DEFINER and is the ONLY write path into financial_audit_log — the
-- table has a SELECT-only policy and no INSERT/UPDATE/DELETE policies at all,
-- which is right. But the function took p_user_id on trust and inserted it
-- verbatim, while being executable by `authenticated`. Any signed-in user
-- could therefore write audit rows attributed to somebody else: the one
-- artifact whose whole purpose is to say who did what could be made to lie.
--
-- Below, the recorded user is DERIVED from the caller's verified JWT whenever
-- there is one, and the parameter is trusted only where there is genuinely no
-- end-user identity to derive it from (service-role calls from api/, and
-- direct DBA/psql sessions, which can write the table regardless).
--
-- ── FINDING 2: REVOKE ... FROM public does NOT revoke anon ─────────────────
-- THE SUBTLE TRAP, and the reason this migration exists at all:
--
--   In a Supabase project, every function created in schema `public` picks up
--   an EXPLICIT default-privilege grant of EXECUTE to `anon`, `authenticated`
--   and `service_role` — separate, named ACL entries. `REVOKE ... FROM public`
--   removes only the PostgreSQL PUBLIC pseudo-role entry. The named `anon`
--   entry survives untouched.
--
-- So a migration that says `REVOKE ALL ON FUNCTION f() FROM public;` and
-- believes anon is locked out is wrong, and the codebase believed exactly
-- that. Verified behaviourally on 2026-07-25: with the anon key and no JWT,
-- account_balances(), update_usage_counts(), set_current_user_id(),
-- cleanup_old_notifications(), update_transaction_atomic(),
-- create_account_from_plaid(), get_net_worth(), get_user_subscription(),
-- has_feature_access(), get_usage_limits() and is_connection_healthy() all
-- executed. No data leaked — each takes identity from the JWT or runs
-- SECURITY INVOKER under RLS, so anon matched nothing — but the surface was
-- open, and "no data leaked" is a property of today's function bodies, not a
-- guarantee about tomorrow's.
--
-- Note which functions those are: precisely the ones whose migration either
-- said `FROM public` (no `anon`) or said nothing. Every function whose
-- migration spelled out `FROM public, anon` was genuinely closed. The pattern
-- is exactly as described.
--
-- The fix has three parts: sweep every repo-created public function, keep the
-- deliberate exceptions, and stop the trap recurring via ALTER DEFAULT
-- PRIVILEGES so newly created functions never receive the anon grant again.
--
-- Safe to run twice: CREATE OR REPLACE, GRANT and REVOKE are all idempotent,
-- and the loops below are catalog-driven rather than state-changing.
-- ============================================================================

BEGIN;

-- ── Precondition ───────────────────────────────────────────────────────────
-- Everything below names the three Supabase API roles. Fail loudly and early
-- rather than half-applying against a database that does not have them.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'expected the Supabase roles anon/authenticated/service_role to exist';
  END IF;
END
$$;

-- ============================================================================
-- PART 1 — write_financial_audit records who actually called it
-- ============================================================================
-- Signature is preserved EXACTLY: (uuid, text, uuid, text, jsonb, jsonb)
-- RETURNS void, same parameter names. Thirty-four call sites across fourteen
-- migrations pass p_user_id positionally; changing the shape would be worse
-- than the bug. Only the body changes (sql -> plpgsql to allow the check).
--
-- Who is allowed to write, and how the caller is identified:
--
--   * End user (a Clerk JWT is present, so requesting_clerk_id() is non-NULL):
--     the row MUST be attributed to that user. p_user_id is compared against
--     requesting_user_id() and a mismatch raises. A signed-in caller whose
--     Clerk id has no users row cannot write at all.
--
--   * service_role (api/_lib/supabase.ts uses SUPABASE_SERVICE_ROLE_KEY):
--     no `sub` claim exists, so there is no identity to derive — p_user_id is
--     the only source and is trusted. This is what keeps the server-side
--     import paths working (import_bank_transactions_atomic,
--     import_transactions_atomic, link_bank_account_snap), all of which write
--     audit rows for a user in a context with no end-user JWT.
--
--   * A session with no PostgREST role at all (psql, a migration, pg_cron):
--     trusted, because such a session can INSERT into financial_audit_log
--     directly anyway; refusing here would buy nothing and break maintenance.
--
--   * anon: refused. Belt and braces — Part 2 also removes its EXECUTE.
--
-- EXECUTE is deliberately KEPT for `authenticated`. It is not a client-facing
-- RPC (grep confirms no .rpc('write_financial_audit') anywhere in src/ or
-- api/), but EVERY caller is a SECURITY INVOKER function — create/update/
-- delete_transaction_atomic, set_transactions_cleared, set_transaction_splits,
-- link_transfer_pair, create_transfer_counterpart, apply_category_to_
-- uncategorized, migrate_categories_atomic and the rest — so the nested call
-- executes as `authenticated`. Revoking it would make every financial write
-- in the app fail with "permission denied for function". The identity check,
-- not the grant, is what stops forgery.
--
-- The role is read straight from the verified JWT claims, the same way
-- requesting_clerk_id() reads `sub`. That is precisely what Supabase's
-- auth.role() does (20260722120000_usage_counts_definer.sql uses it), inlined
-- here so this function has no dependency on the auth schema; the session
-- `role` GUC is a second source in case a future non-JWT API key format stops
-- populating request.jwt.claims.
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
END;
$$;

COMMENT ON FUNCTION public.write_financial_audit(uuid, text, uuid, text, jsonb, jsonb) IS
  'Sole write path into financial_audit_log. The user recorded is derived from the caller''s verified JWT; p_user_id is trusted only for service-role and direct database sessions, which have no end-user identity to derive. An authenticated caller cannot attribute an audit row to anyone but themselves.';

-- ============================================================================
-- PART 2 — anon loses the default EXECUTE grant it was never meant to have
-- ============================================================================

-- ── 2a. Sweep every repo-created function in schema public ─────────────────
-- Catalog-driven rather than a hand-written list, because the catalog is the
-- authority on what is actually installed (the repo and the database drift:
-- some migrations are applied by hand and some overloads were dropped).
--
-- Precisely scoped:
--   * schema public only;
--   * extension-owned routines EXCLUDED via pg_depend deptype = 'e' — that is
--     the catalog's own definition of "belongs to an extension", so pgcrypto
--     (20250124/20260308) and anything installed later are untouched rather
--     than guessed at by name;
--   * ROUTINE, not FUNCTION, so procedures and aggregates are covered too.
--
-- It revokes from PUBLIC and anon ONLY. It deliberately does not touch
-- `authenticated` or `service_role`: those grants are what the app runs on,
-- and leaving them alone means this sweep cannot break a working call path.
-- The few functions that should not be reachable by `authenticated` are
-- tightened explicitly in 2c, where the reasoning is visible per function.
--
-- Ownership: a REVOKE on a routine this role does not own raises
-- insufficient_privilege. Those are caught per routine and reported instead
-- of aborting the whole migration, since they are by definition not ours.
DO $$
DECLARE
  fn        record;
  v_sig     text;
  v_swept   integer := 0;
  v_skipped text[] := '{}';
BEGIN
  FOR fn IN
    SELECT p.oid, n.nspname, p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND NOT EXISTS (
             SELECT 1
               FROM pg_depend d
              WHERE d.classid = 'pg_proc'::regclass
                AND d.objid   = p.oid
                AND d.deptype = 'e'
           )
  LOOP
    v_sig := format('%I.%I(%s)', fn.nspname, fn.proname,
                    pg_get_function_identity_arguments(fn.oid));
    BEGIN
      EXECUTE format('REVOKE ALL ON ROUTINE %s FROM PUBLIC, anon', v_sig);
      v_swept := v_swept + 1;
    EXCEPTION WHEN insufficient_privilege THEN
      v_skipped := v_skipped || v_sig;
    END;
  END LOOP;

  RAISE NOTICE 'anon/PUBLIC EXECUTE revoked on % public routine(s)', v_swept;
  IF array_length(v_skipped, 1) IS NOT NULL THEN
    RAISE NOTICE 'not owned by this role, left alone: %', array_to_string(v_skipped, ', ');
  END IF;
END
$$;

-- ── 2b. The two deliberate anon exceptions ─────────────────────────────────
-- requesting_clerk_id() / requesting_user_id() are the identity helpers every
-- RLS policy is written in terms of, and 20260610130000 granted them to anon
-- on purpose. They leak nothing: for a caller with no `sub` claim they return
-- NULL, which is precisely what makes an anon request match no row. Keeping
-- the grant preserves that migration's stated intent and keeps policy
-- expressions evaluable whatever role reaches them.
GRANT EXECUTE ON FUNCTION public.requesting_clerk_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.requesting_user_id()  TO anon, authenticated, service_role;

-- ── 2c. Server-only functions: authenticated loses EXECUTE too ─────────────
-- These have no client call path — verified by grepping src/ for each name,
-- not assumed. Several are outright legacy. They are reachable only from
-- api/ with the service key, from cron, or from nothing at all.
--
-- Each entry is applied only if the function is actually present, so a
-- database that has not yet had every migration applied by hand degrades to
-- "no change" rather than to a failed migration or a stripped grant.
DO $$
DECLARE
  e         record;
  v_missing text[] := '{}';
BEGIN
  FOR e IN
    SELECT * FROM (VALUES
      -- Bank-feed import: api/banking/sync-transactions.ts, service key only.
      -- Already service_role-only by intent (20260613090000).
      ('public.import_bank_transactions_atomic(uuid, jsonb)'),
      -- File import: api/data/import-transactions.ts, service key only.
      ('public.import_transactions_atomic(uuid, uuid, jsonb)'),
      -- Bank account linking snapshot: api/banking/link-accounts.ts.
      ('public.link_bank_account_snap(uuid, uuid, numeric)'),
      -- Retention cron: api/cron/retention.ts. Deletes audit history — the
      -- last thing a client should be able to reach.
      ('public.purge_expired_audit_log(integer)'),
      -- Maintenance sweeps. No caller in src/ or api/; housekeeping only.
      ('public.cleanup_old_notifications()'),
      ('public.cleanup_expired_oauth_states()'),
      -- Open-banking connection health probe. No caller in src/.
      ('public.is_connection_healthy(uuid)'),
      -- Legacy Plaid provisioning. The Plaid tables were dropped in
      -- 20260613100000; the app is on TrueLayer. No caller anywhere.
      ('public.create_account_from_plaid(uuid, text, text, text, numeric, text)'),
      -- Legacy identity shim: sets the app.current_user_id GUC that the
      -- pre-Clerk RLS policies read. Those policies were replaced in
      -- 20260610130000 and nothing calls this now. Keeping it callable by a
      -- signed-in user is a standing impersonation footgun if any stale
      -- policy anywhere still reads that GUC.
      ('public.set_current_user_id(text)')
    ) AS t(sig)
  LOOP
    IF to_regprocedure(e.sig) IS NULL THEN
      v_missing := v_missing || e.sig;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', e.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', e.sig);
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE NOTICE 'server-only tightening skipped, function not present: %',
      array_to_string(v_missing, ', ');
  END IF;
END
$$;

-- ── 2d. Client-facing functions: confirm authenticated + service_role ──────
-- These are the RPCs the browser calls with the Clerk session JWT, plus the
-- SECURITY INVOKER read helpers that are safe under RLS. The grants are
-- restated rather than assumed: several were only ever granted implicitly by
-- Supabase's defaults (update_transaction_atomic's three-argument form, added
-- in 20260612110000, was never revoked from anything at all), and after 2a
-- their PUBLIC entry is gone, so their reachability must now be explicit.
--
-- Additive by construction: 2a did not revoke `authenticated`, so an entry
-- that fails to resolve leaves a working function working.
DO $$
DECLARE
  e         record;
  v_missing text[] := '{}';
BEGIN
  FOR e IN
    SELECT * FROM (VALUES
      -- Dashboard boot: one round trip for every account balance.
      ('public.account_balances()'),
      -- Transaction write path (src/services/transactionService).
      ('public.create_transaction_atomic(jsonb)'),
      ('public.update_transaction_atomic(uuid, jsonb, uuid)'),
      ('public.delete_transaction_atomic(uuid, uuid)'),
      -- Sole write path into the audit log, called from inside every
      -- SECURITY INVOKER RPC above, so it executes as `authenticated`.
      -- Forgery is prevented by the identity check in Part 1, not by this
      -- grant. See the long note there.
      ('public.write_financial_audit(uuid, text, uuid, text, jsonb, jsonb)'),
      -- Category sync / cleanup.
      ('public.migrate_categories_atomic(uuid, jsonb)'),
      ('public.apply_category_to_uncategorized(uuid[], text, uuid)'),
      ('public.delete_unused_categories(uuid[], uuid)'),
      -- Reconciliation.
      ('public.set_transactions_cleared(uuid[], boolean, uuid)'),
      -- Splits.
      ('public.set_transaction_splits(uuid, jsonb, numeric, uuid)'),
      -- Transfers.
      ('public.transfer_category_for(uuid, uuid, numeric)'),
      ('public.link_transfer_pair(uuid, uuid, uuid)'),
      ('public.create_transfer_counterpart(uuid, uuid, uuid)'),
      -- Soft archive.
      ('public.archive_transactions_before(uuid, uuid, date)'),
      ('public.unarchive_account(uuid, uuid)'),
      -- Import prefill helper, shared by server and client rules.
      ('public.payee_memory_category(uuid, text, text)'),
      -- Subscription/usage: src/services/supabaseSubscriptionService.ts.
      -- update_usage_counts is SECURITY DEFINER but already derives the user
      -- from the JWT and ignores its parameter (20260722120000).
      ('public.update_usage_counts(uuid)'),
      ('public.has_feature_access(uuid, text)'),
      -- SECURITY INVOKER read helpers. No current caller in src/, but they
      -- read only the caller's own rows under RLS, and get_usage_limits is a
      -- static tier lookup with no user data in it at all — nothing is gained
      -- by locking a signed-in user out of their own figures.
      ('public.get_net_worth(uuid)'),
      ('public.get_user_subscription(uuid)'),
      ('public.get_usage_limits(text)')
    ) AS t(sig)
  LOOP
    IF to_regprocedure(e.sig) IS NULL THEN
      v_missing := v_missing || e.sig;
      CONTINUE;
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', e.sig);
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE NOTICE 'client grant skipped, function not present: %',
      array_to_string(v_missing, ', ');
  END IF;
END
$$;

-- ── 2e. Trigger functions get no EXECUTE grant, and need none ──────────────
-- create_transfer_category_for_account, sync_transfer_category_for_account,
-- protect_transfer_category, protect_split_transaction_fields,
-- sweep_reconciled_into_archive, ensure_single_default_layout,
-- sync_user_subscription, trigger_update_usage, update_updated_at_column.
--
-- PostgreSQL checks EXECUTE on a trigger function at CREATE TRIGGER time, not
-- each time the trigger fires, so 2a's revoke cannot stop a trigger firing.
-- They are covered by 2a and appear in no list above — that is the whole
-- intent. Their `authenticated` grant is left as-is deliberately: calling one
-- directly only ever raises "can only be called as a trigger", so removing it
-- would buy nothing while risking the one thing that must never break.

-- ============================================================================
-- PART 3 — stop the trap coming back
-- ============================================================================
-- Without this, the very next `CREATE FUNCTION` in schema public silently
-- receives the anon EXECUTE grant again from Supabase's default privileges,
-- and the sweep above is a one-time snapshot rather than a fix.
--
-- Scoped to PUBLIC and anon only. The defaults for `authenticated` and
-- `service_role` are left in place so a future migration that forgets its
-- GRANT still works for the app — the finding is about anon, and failing a
-- future migration closed on a role it did need would be a different bug.
--
-- Default privileges attach to the role that CREATES the object; migrations
-- here are applied as `postgres`, both by hand in the SQL editor and by the
-- CLI, so an unqualified ALTER DEFAULT PRIVILEGES (which means "for the
-- current role") is the right scope. To undo: repeat the statement with GRANT
-- EXECUTE ON FUNCTIONS TO anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

COMMIT;

-- ============================================================================
-- VERIFICATION — what every public routine is now reachable by
-- ============================================================================
-- Read this output after applying. Expected shape:
--   * no row lists PUBLIC or anon, except requesting_clerk_id /
--     requesting_user_id, which list anon deliberately (2b);
--   * the nine trigger functions and anything unused show `authenticated`
--     or `—` and no anon;
--   * the server-only list from 2c shows `service_role` alone.
-- A row showing `—` has no EXECUTE grant to any API role and is unreachable
-- from PostgREST, which is correct for trigger functions and a red flag for
-- anything else.
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
  AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
         WHERE d.classid = 'pg_proc'::regclass
           AND d.objid = p.oid
           AND d.deptype = 'e'
      )
ORDER BY 1;
