-- ============================================================================
-- 20260902150000_an_empty_claim_is_no_claim.sql
--
-- requesting_clerk_id() RAISES INSTEAD OF ANSWERING "NOBODY" — one NULLIF moved
-- from outside the cast to inside it.
--
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ── THE BUG, IN ONE LINE ────────────────────────────────────────────────────
--
-- The body installed by 20260610130000_restore_rls_data_isolation.sql, live
-- and unchanged since (20260725120000 only re-grants it):
--
--     SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
--
-- The NULLIF wraps the RESULT. The `true` makes current_setting return NULL
-- for a GUC that was never set, and NULL::jsonb is NULL, so an unset claim is
-- handled. What is not handled is a claim set to the EMPTY STRING:
--
--     SELECT set_config('request.jwt.claims', '', false);
--     SELECT public.requesting_clerk_id();
--     ERROR:  invalid input syntax for type json
--     DETAIL: The input string ended unexpectedly.
--
-- Measured on scripts/local-db's cluster, 2 Sep 2026.
--
-- ── WHY THAT IS NOT A CURIOSITY ─────────────────────────────────────────────
--
-- '' is what a transaction-local GUC BECOMES. Setting `request.jwt.claims`
-- with is_local = true — which is how PostgREST scopes a request's claims to
-- its transaction — resets the VALUE at commit but never reclaims the
-- PLACEHOLDER, which answers '' rather than NULL from then on. The measurement
-- is in 20260902120000's header ("A transaction-local GUC per audited row
-- LEAKS ACROSS TRANSACTIONS. Not the value… but the ENTRY") and it is a
-- property of the session, not of that migration.
--
-- So on a pooled connection this is one-way. Once any request has set the
-- claim, that backend can never again act as "no identity": every later call
-- raises where it used to return NULL. Every auditing RPC reaches
-- requesting_clerk_id on its first line (write_financial_audit,
-- 20260725120000), requesting_user_id() is defined in terms of it, every RLS
-- policy in 20260610130000 is written on requesting_user_id(), and since
-- 20260902120000 the deferred triggers put it on the path of a PLAIN TABLE
-- WRITE as well. A JSON syntax error is what all of that turns into.
--
-- It is also why scripts/local-db/audit-trigger.test.sql is ordered the way it
-- is, and says so at the top: "request.jwt.claims cannot be put back… That is
-- a pre-existing sharp edge in requesting_clerk_id (20260610130000)." This is
-- that edge, filed off. The ordering note stays true either way; it no longer
-- has to be true.
--
-- ── THE FIX ─────────────────────────────────────────────────────────────────
--
--     SELECT NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')
--
-- The inner NULLIF turns an empty GUC into NULL BEFORE the cast, so '' means
-- "no claim" exactly as an unset GUC does. The outer NULLIF is 20260610130000's
-- and is kept for its own reason: a claims object carrying `"sub": ""` is a
-- session with no subject, not a user whose id is the empty string.
--
-- Nothing else changes. Same name, same signature, same STABLE volatility,
-- same SECURITY INVOKER, same (absent) search_path setting, same grants —
-- read off the live catalog and restated below rather than assumed. Guard 2
-- refuses to run if any of them is not what this file was written against.
--
-- This is not a new idiom: write_financial_audit already reads the same GUC
-- the same way, three lines below the call that fails —
-- `NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'`
-- (20260725120000). The role branch was written safely and the sub branch was
-- not; this makes them agree.
--
-- ── WHY ITS OWN FILE ────────────────────────────────────────────────────────
--
-- requesting_user_id() and every row-level security policy in the schema sit
-- on this one function. A change here is the smallest possible edit with the
-- largest possible blast radius, and it should be revertible on its own,
-- reviewable on its own, and refuse to apply to a base that is not the one it
-- was written against — which is what the guards below do, by comparing the
-- INSTALLED BODY, whitespace-normalised, against the only two texts this
-- migration will accept.
--
-- ── BLAST RADIUS ────────────────────────────────────────────────────────────
--
-- * Every caller that today gets an answer gets the same answer. The two
--   inputs whose result changes are '' (was: ERROR, now: NULL) and, unchanged
--   in meaning but worth stating, a JSON claims object without a usable `sub`
--   (was: NULL, still NULL).
-- * NULL is what makes an anon request match no row — 20260725120000 §2b, on
--   why these helpers are granted to anon at all. Returning NULL more often
--   grants nothing: it is the fail-closed value.
-- * No table, index, policy, trigger or grant is created, dropped or altered.
--   CREATE OR REPLACE keeps the function's OID, so the policies that depend on
--   it are not disturbed.
-- * No amount, sign, date, account or balance is read or written. The ledger
--   invariant `balance = initial_balance + Σ(amount)` cannot be moved here.
--
-- ── ON RE-RUNNING THIS FILE ─────────────────────────────────────────────────
--
-- Idempotent: CREATE OR REPLACE, no DDL, and Guard 2 accepts EITHER the
-- 20260610130000 body or this file's own. What it refuses is a third thing —
-- some later hand-edit nobody recorded — because replacing that wholesale is
-- how a line gets lost (20260808150000 and 20260808180000 each document one).
-- ============================================================================

BEGIN;

-- ── Guards ─────────────────────────────────────────────────────────────────
DO $do$
DECLARE
  v_oid    oid;
  v_body   text;
  v_before text;
  v_after  text;
  v_attrs  text;
BEGIN
  -- Guard 1: it is there, with the signature every policy calls.
  v_oid := to_regprocedure('public.requesting_clerk_id()');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'requesting_clerk_id_missing: expected requesting_clerk_id() to exist before changing it — apply 20260610130000_restore_rls_data_isolation.sql first'
      USING ERRCODE = 'P0002';
  END IF;

  -- Guard 2: THE RIGHT BASE, by the body itself rather than a fingerprint.
  -- This function is four tokens long and the whole schema's isolation rests
  -- on it, so "contains the word sub" is not enough of a check: the exact text
  -- is affordable here in a way it would not be for a hundred-line RPC.
  --
  -- prosrc, not pg_get_functiondef: the definition the server prints wraps the
  -- body in a header it regenerates from the catalog, and those attributes are
  -- checked separately below. Whitespace is normalised so that a reformatting
  -- cannot cause a false refusal — indentation is not the base.
  SELECT btrim(regexp_replace(prosrc, '\s+', ' ', 'g')) INTO v_body
    FROM pg_proc WHERE oid = v_oid;

  v_before := $want$SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')$want$;
  v_after  := $want$SELECT NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')$want$;

  IF v_body IS DISTINCT FROM v_before AND v_body IS DISTINCT FROM v_after THEN
    RAISE EXCEPTION 'requesting_clerk_id_wrong_base: the installed body is neither 20260610130000''s nor this migration''s. Refusing to replace it. Installed: %', v_body
      USING ERRCODE = 'P0001',
            HINT = 'Expected either "' || v_before || '" (apply this migration) or "' || v_after || '" (already applied — nothing to do). Anything else is an unrecorded change; find out what it was for before overwriting it.';
  END IF;

  -- Guard 3: the attributes, which prosrc does not carry and which
  -- CREATE OR REPLACE resets to the defaults of whatever the new statement
  -- says. The statement below restates LANGUAGE sql + STABLE and nothing else,
  -- so if the live function is a SECURITY DEFINER, or carries a pinned
  -- search_path, or has been marked PARALLEL SAFE, applying this would quietly
  -- take that away.
  SELECT format('language=%s volatility=%s security_definer=%s config=%s parallel=%s',
                l.lanname, p.provolatile, p.prosecdef::text,
                COALESCE(array_to_string(p.proconfig, ','), 'none'), p.proparallel)
    INTO v_attrs
    FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
   WHERE p.oid = v_oid;

  IF v_attrs <> 'language=sql volatility=s security_definer=false config=none parallel=u' THEN
    RAISE EXCEPTION 'requesting_clerk_id_wrong_attributes: expected "language=sql volatility=s security_definer=false config=none parallel=u", found "%". Refusing to replace it, because CREATE OR REPLACE would reset whatever is different to the default.', v_attrs
      USING ERRCODE = 'P0001';
  END IF;
END;
$do$;

-- ── The function ───────────────────────────────────────────────────────────
-- Clerk user id of the requester, from the verified JWT. NULL when anon —
-- 20260610130000's own comment, still the contract.
CREATE OR REPLACE FUNCTION public.requesting_clerk_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')
$$;

COMMENT ON FUNCTION public.requesting_clerk_id() IS
  'Clerk user id of the requester, from the verified JWT; NULL when there is none. An absent claims GUC, an empty one (what a transaction-local setting leaves behind on a pooled connection), a claims object with no sub and a sub of "" all mean the same thing: nobody.';

-- ── Grants: a restatement, not a change ────────────────────────────────────
-- CREATE OR REPLACE preserves the access list, so these two lines alter
-- nothing; they are here so the file says out loud what it is preserving, and
-- they reproduce the live catalog exactly. anon is deliberate and 20260725120000
-- §2b argues it: these helpers "leak nothing: for a caller with no `sub` claim
-- they return NULL, which is precisely what makes an anon request match no
-- row." One more input now returns NULL instead of raising, which is the same
-- argument, further along.
REVOKE ALL ON FUNCTION public.requesting_clerk_id() FROM public;
GRANT EXECUTE ON FUNCTION public.requesting_clerk_id() TO anon, authenticated, service_role;

COMMIT;

-- ============================================================================
-- Verification — run after applying
-- ============================================================================

-- 1. What is installed, and its attributes. Expected: the inner NULLIF present,
--    and sql/STABLE/invoker/no config, unchanged from before.
SELECT btrim(regexp_replace(p.prosrc, '\s+', ' ', 'g')) AS body,
       l.lanname                                        AS language,
       p.provolatile = 's'                              AS is_stable,
       NOT p.prosecdef                                  AS is_security_invoker,
       p.proconfig IS NULL                              AS has_no_pinned_search_path
  FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
 WHERE p.oid = to_regprocedure('public.requesting_clerk_id()');

-- 2. The grants. Expected: EXECUTE for anon, authenticated and service_role,
--    and no row for PUBLIC.
SELECT grantee, privilege_type
  FROM information_schema.routine_privileges
 WHERE specific_schema = 'public'
   AND routine_name = 'requesting_clerk_id'
 ORDER BY grantee;

-- 3-6. The behaviour, four inputs, each in its own statement so the claim it
--    forces is transaction-local and gone again at the semicolon. The
--    placeholder it leaves behind reads '' for the rest of this session, which
--    after this migration is indistinguishable from unset — that being the
--    whole point of the file.

-- 3. The empty claim: NULL, and no error. This raised before this migration.
SELECT public.requesting_clerk_id() IS NULL AS an_empty_claim_is_nobody
  FROM (SELECT set_config('request.jwt.claims', '', true)) AS forced;

-- 4. A real claim still resolves.
SELECT public.requesting_clerk_id() = 'clerk_verification_probe' AS a_real_claim_still_resolves
  FROM (SELECT set_config('request.jwt.claims', '{"sub":"clerk_verification_probe"}', true)) AS forced;

-- 5. A claims object with no sub — the service role's shape.
SELECT public.requesting_clerk_id() IS NULL AS a_claim_without_a_sub_is_nobody
  FROM (SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true)) AS forced;

-- 6. And an explicitly empty sub, which is what the OUTER NULLIF is for.
SELECT public.requesting_clerk_id() IS NULL AS an_empty_sub_is_nobody
  FROM (SELECT set_config('request.jwt.claims', '{"sub":""}', true)) AS forced;
