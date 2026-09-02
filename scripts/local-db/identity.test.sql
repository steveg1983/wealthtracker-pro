-- requesting_clerk_id(): an empty claim is no claim, not an error.
--
-- 20260610130000_restore_rls_data_isolation.sql defined the function every RLS
-- policy in the schema is written in terms of:
--
--     SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
--
-- The NULLIF wraps the RESULT, so an unset GUC is handled (current_setting's
-- `true` gives NULL) and an EMPTY one is not — `''::jsonb` raises. That matters
-- because '' is what a transaction-local GUC leaves behind: the value is reset
-- at commit, the PLACEHOLDER is not, and it answers '' from then on
-- (20260902120000's header measures the same leak from the other side). On a
-- pooled connection that makes the failure one-way — once any request has set
-- the claim, that backend can never again act as "no identity".
--
-- 20260902150000_an_empty_claim_is_no_claim.sql moves the NULLIF inside the
-- cast. This file is the proof, and sections (b) and (h) put the old body back
-- inside transactions they roll back, so nothing here can pass vacuously.
--
-- ── ORDER IS LOAD-BEARING ───────────────────────────────────────────────────
-- Section (a) is FIRST because it is the only one that can be: it needs the
-- claim GUC genuinely UNSET, which is a state a session cannot return to. Every
-- section after it runs on a session where the placeholder exists — which is
-- the very condition the fix is about.
\set ON_ERROR_STOP on
\timing off

\set U '''ed000000-0000-0000-0000-000000000001'''
\set ACCT '''ed100000-0000-0000-0000-000000000001'''
\set TX '''ed400000-0000-0000-0000-000000000001'''


-- ════════════════════════════════════════════════════════════════════════════
-- (a) NO CLAIM AT ALL — the state a fresh backend starts in
-- ════════════════════════════════════════════════════════════════════════════
SELECT
  current_setting('request.jwt.claims', true) IS NULL      AS a_the_guc_is_genuinely_unset,
  public.requesting_clerk_id() IS NULL                     AS a_no_claim_is_nobody_correct,
  public.requesting_user_id()  IS NULL                     AS a_and_resolves_to_no_user_correct;


-- ── A ledger for sections (g) and (h) ───────────────────────────────────────
DELETE FROM public.transactions              WHERE user_id = :U;
DELETE FROM public.deleted_feed_transactions WHERE user_id = :U;
DELETE FROM public.financial_audit_log       WHERE user_id = :U;
DELETE FROM public.users WHERE clerk_id = 'clerk_identity';

INSERT INTO public.users (id, clerk_id, email)
VALUES (:U, 'clerk_identity', 'identity@example.test');
INSERT INTO public.user_profiles (clerk_user_id, email)
VALUES ('clerk_identity', 'identity@example.test')
ON CONFLICT (clerk_user_id) DO NOTHING;

INSERT INTO public.categories (id, user_id, name, type, level)
VALUES ('ed200000-0000-0000-0000-000000000001', :U, 'Transfer', 'both', 'type');
INSERT INTO public.accounts (id, user_id, name, type, balance, initial_balance)
VALUES (:ACCT, :U, 'Current', 'checking', 0, 0);
INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date)
VALUES (:TX, :U, :ACCT, 'Before', -1.00, 'expense', DATE '2026-01-01');


-- ════════════════════════════════════════════════════════════════════════════
-- (b) THE EMPTY CLAIM — the bug, and that it was one
-- ════════════════════════════════════════════════════════════════════════════
-- From here on the session can never be "unset" again, which is the point.
SELECT set_config('request.jwt.claims', '', false) = '' AS b_the_claim_is_now_empty;

SELECT public.requesting_clerk_id() IS NULL AS b_an_empty_claim_is_nobody_correct;

-- …and that this is not a vacuous pass. Two ways of asking, both on the value
-- the session is holding right now.
--
-- First the raw expression the old body used: an unwrapped ''::jsonb still
-- raises, so '' really is a value that breaks the cast.
DO $$
DECLARE v_state text := 'no error';
BEGIN
  BEGIN
    PERFORM current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN others THEN v_state := SQLSTATE;
  END;
  PERFORM set_config('identity_test.raw_cast_state', v_state, false);
END;
$$;

SELECT current_setting('identity_test.raw_cast_state') = '22P02'
    AS b_the_unwrapped_cast_still_raises_correct;

-- Then the function itself, with 20260610130000's body put back inside a
-- transaction that is rolled away. Rolled back rather than repaired
-- afterwards, because a repair that is itself skipped would leave every RLS
-- policy in the schema sitting on the broken body.
BEGIN;

CREATE OR REPLACE FUNCTION public.requesting_clerk_id()
RETURNS text
LANGUAGE sql STABLE
AS $before$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
$before$;

DO $$
DECLARE v_state text := 'no error';
BEGIN
  BEGIN
    PERFORM public.requesting_clerk_id();
  EXCEPTION WHEN others THEN v_state := SQLSTATE;
  END;
  PERFORM set_config('identity_test.old_body_state', v_state, false);
END;
$$;

SELECT current_setting('identity_test.old_body_state') = '22P02'
    AS b_the_old_body_raised_on_this_very_value_correct;

ROLLBACK;

SELECT public.requesting_clerk_id() IS NULL AS b_and_the_fixed_body_is_back_correct;


-- ════════════════════════════════════════════════════════════════════════════
-- (c) TO (e) THE THREE INPUTS THAT WERE ALREADY RIGHT, STILL RIGHT
-- ════════════════════════════════════════════════════════════════════════════
-- The claim each answer is measured under is set in the same statement that
-- reads it, so a line of output can never be attributed to the wrong session
-- state. `false` for is_local: these persist, as a request's claims do.
SELECT public.requesting_clerk_id() = 'clerk_x' AS c_a_real_claim_resolves
  FROM (SELECT set_config('request.jwt.claims',
                          '{"sub":"clerk_x","role":"authenticated"}', false)) AS claim;

-- The service role's shape: a claims object with no sub at all.
SELECT public.requesting_clerk_id() IS NULL AS d_a_claim_without_a_sub_is_nobody_correct
  FROM (SELECT set_config('request.jwt.claims',
                          '{"role":"service_role"}', false)) AS claim;

-- And an explicitly empty sub — what 20260610130000's OUTER NULLIF is for, and
-- the reason the fix nests rather than replaces.
SELECT public.requesting_clerk_id() IS NULL AS e_an_empty_sub_is_nobody_correct
  FROM (SELECT set_config('request.jwt.claims', '{"sub":""}', false)) AS claim;


-- ════════════════════════════════════════════════════════════════════════════
-- (f) THE ONE-WAY DOOR IS CLOSED
-- ════════════════════════════════════════════════════════════════════════════
-- The property the fix exists for, asked directly: a session that has been
-- somebody can go back to being nobody, and round again — which is what a
-- pooled backend does between two users' requests. Before the fix the second
-- of these three raised, and every later request on that backend with it.
SELECT public.requesting_clerk_id() = 'clerk_x' AS f_is_somebody_correct
  FROM (SELECT set_config('request.jwt.claims', '{"sub":"clerk_x"}', false)) AS claim;

SELECT public.requesting_clerk_id() IS NULL AS f_is_nobody_again_correct
  FROM (SELECT set_config('request.jwt.claims', '', false)) AS claim;

SELECT public.requesting_clerk_id() = 'clerk_identity' AS f_is_the_next_person_correct
  FROM (SELECT set_config('request.jwt.claims', '{"sub":"clerk_identity"}', false)) AS claim;


-- ════════════════════════════════════════════════════════════════════════════
-- (g) EVERYTHING BUILT ON IT
-- ════════════════════════════════════════════════════════════════════════════
-- requesting_user_id() is `SELECT id FROM users WHERE clerk_id =
-- requesting_clerk_id()`, and every RLS policy in 20260610130000 is written on
-- that. It resolves under a claim and returns NULL — rather than raising —
-- under an empty one, which is the fail-closed answer a policy needs.
SELECT public.requesting_user_id() = :U AS g_resolves_the_signed_in_user_correct;

SELECT public.requesting_user_id() IS NULL AS g_an_empty_claim_resolves_to_no_user_correct
  FROM (SELECT set_config('request.jwt.claims', '', false)) AS claim;


-- ════════════════════════════════════════════════════════════════════════════
-- (h) A PLAIN TABLE WRITE, ON A SESSION THAT HAS SIGNED OUT
-- ════════════════════════════════════════════════════════════════════════════
-- The end of the chain, and the reason this is not a cosmetic fix. Since
-- 20260902120000 a deferred trigger audits any row change no RPC accounted
-- for, and every audit row goes through write_financial_audit, whose FIRST
-- line is `public.requesting_clerk_id()`. So on a pooled backend holding an
-- empty claim the function's raise is no longer confined to the RPCs: it takes
-- an ordinary UPDATE down with it, at COMMIT, after the statement reported
-- success.
--
-- The claim is still '' from (g).
UPDATE public.transactions SET description = 'Written while signed out'
 WHERE id = :TX;

SELECT
  count(*) = 1                                            AS h_the_write_was_audited_correct,
  bool_and(actor_clerk_id IS NULL)                        AS h_with_no_actor_correct,
  bool_and(user_id = :U)                                  AS h_attributed_to_the_owner_correct,
  bool_and(after_data->>'description' = 'Written while signed out')
                                                          AS h_carries_the_new_row_correct
FROM public.financial_audit_log
 WHERE user_id = :U AND entity = 'transaction' AND action = 'update';

-- …and the same write, with 20260610130000's body back, does not survive its
-- own commit. SET CONSTRAINTS ALL IMMEDIATE fires the deferred audit trigger
-- on the spot so the failure can be caught and reported rather than aborting
-- the file; at a real commit there is nothing to catch it and the UPDATE is
-- simply lost.
BEGIN;

CREATE OR REPLACE FUNCTION public.requesting_clerk_id()
RETURNS text
LANGUAGE sql STABLE
AS $before$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
$before$;

DO $$
DECLARE v_state text := 'no error';
BEGIN
  BEGIN
    UPDATE public.transactions SET description = 'Doomed'
     WHERE id = 'ed400000-0000-0000-0000-000000000001';
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN others THEN v_state := SQLSTATE;
  END;
  PERFORM set_config('identity_test.doomed_write_state', v_state, false);
END;
$$;

SELECT current_setting('identity_test.doomed_write_state') = '22P02'
    AS h_the_old_body_lost_an_ordinary_update_correct;

ROLLBACK;

SELECT
  (SELECT description FROM public.transactions WHERE id = :TX)
    = 'Written while signed out'                          AS h_the_ledger_is_as_h_left_it,
  public.requesting_clerk_id() IS NULL                    AS h_and_the_fixed_body_is_back_correct;


-- ════════════════════════════════════════════════════════════════════════════
-- (i) THE SHAPE AROUND THE BODY, UNCHANGED
-- ════════════════════════════════════════════════════════════════════════════
-- CREATE OR REPLACE resets every attribute the new statement does not restate,
-- so "same function, one expression different" has to be measured rather than
-- assumed. anon is deliberate — 20260725120000 §2b.
SELECT
  l.lanname = 'sql'                                       AS i_language_correct,
  p.provolatile = 's'                                     AS i_still_stable_correct,
  NOT p.prosecdef                                         AS i_still_security_invoker_correct,
  p.proconfig IS NULL                                     AS i_still_no_pinned_search_path_correct,
  p.prorettype = 'text'::regtype                          AS i_still_returns_text_correct,
  p.pronargs = 0                                          AS i_still_takes_no_argument_correct
FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
WHERE p.oid = to_regprocedure('public.requesting_clerk_id()');

SELECT
  count(*) FILTER (WHERE grantee = 'anon')          = 1   AS i_anon_keeps_execute_correct,
  count(*) FILTER (WHERE grantee = 'authenticated') = 1   AS i_authenticated_keeps_execute_correct,
  count(*) FILTER (WHERE grantee = 'service_role')  = 1   AS i_service_role_keeps_execute_correct,
  count(*) FILTER (WHERE grantee = 'PUBLIC')        = 0   AS i_public_has_none_correct
FROM information_schema.routine_privileges
 WHERE specific_schema = 'public'
   AND routine_name = 'requesting_clerk_id'
   AND privilege_type = 'EXECUTE';
