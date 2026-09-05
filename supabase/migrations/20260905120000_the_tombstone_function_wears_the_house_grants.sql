-- ============================================================================
-- 20260905120000_the_tombstone_function_wears_the_house_grants.sql
--
-- remember_deleted_feed_transaction() — the BEFORE DELETE trigger function of
-- 20260828140000, guarded in 20260902140000 — has been carrying the DEFAULT
-- function ACL: EXECUTE for PUBLIC, and every role is in PUBLIC, so EXECUTE
-- for anon. 20260725120000 §2 swept exactly that off every routine in this
-- schema on 25 Jul 2026; this function was created a month later, so the
-- sweep never saw it. Noticed 2 Sep 2026 while proving 20260902140000, parked
-- as harmless, tidied here on the owner's word (5 Sep 2026).
--
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ── WHY IT WAS HARMLESS, AND WHY IT IS TIDIED ANYWAY ────────────────────────
--
-- A trigger function cannot be called. `SELECT remember_deleted_feed_transaction()`
-- fails with "trigger functions can only be called as triggers" whatever the
-- caller's privileges, so EXECUTE for anon was a grant nobody could use, and
-- the trigger itself fires for a deleting user without consulting their
-- EXECUTE on its function (the privilege is checked once, at CREATE TRIGGER).
--
-- It is tidied because the schema's other trigger function of this kind,
-- audit_unlogged_row_change() (20260902120000), wears the house shape — no
-- EXECUTE for public or anon, EXECUTE for authenticated and service_role — and
-- one function left on the default is the sort of exception a later reader
-- has to stop and explain. After this the two read the same, and a privilege
-- listing of the schema has one fewer thing on it that means nothing.
--
-- Idempotent: REVOKE and GRANT both settle to the same ACL on a re-run. The
-- DO block below measures the outcome rather than assuming it, and
-- scripts/local-db/erasure.test.sql (f) measures it again on every run of the
-- SQL proofs.
-- ============================================================================

REVOKE ALL ON FUNCTION public.remember_deleted_feed_transaction() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remember_deleted_feed_transaction() TO authenticated, service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.remember_deleted_feed_transaction()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can still execute remember_deleted_feed_transaction(); the REVOKE above did not take';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.remember_deleted_feed_transaction()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost EXECUTE on remember_deleted_feed_transaction(); the GRANT above did not take';
  END IF;
END
$$;
