-- Erasing an account: the tombstone trigger stands aside, and nothing else does.
--
-- 20260828140000_a_deletion_is_a_decision.sql puts a BEFORE DELETE trigger on
-- transactions that remembers the external id of every deleted FED row, so the
-- next sync cannot re-import a deletion the owner meant. 20260902140000 adds
-- one guard to it: skip when the owner is already gone.
--
-- Without that guard `DELETE FROM public.users` — step 3 of the GDPR erasure
-- route, api/account/delete.ts — cannot complete for anyone holding a fed
-- transaction. The cascade reaches transactions, the trigger writes a
-- tombstone, and deleted_feed_transactions.user_id REFERENCES users(id) whose
-- parent has just gone:
--
--   ERROR:  insert or update on table "deleted_feed_transactions" violates
--           foreign key constraint "deleted_feed_transactions_user_id_fkey"
--
-- Section (g) reinstalls the old body inside a transaction it rolls back and
-- measures exactly that, so none of the proofs above it can pass vacuously.
--
-- ── ORDER IS LOAD-BEARING ───────────────────────────────────────────────────
-- The seed runs with NO claim at all (a fresh psql session), because the claim
-- set in (a) is the one the rest of the file lives under. Erasing the live user
-- is LAST: (d) needs them still standing to prove the two erasures before it
-- took nobody else's rows with them.
\set ON_ERROR_STOP on
\timing off

\set U_LIVE '''ef000000-0000-0000-0000-000000000001'''
\set U_JWT  '''ef000000-0000-0000-0000-000000000002'''
\set U_SVC  '''ef000000-0000-0000-0000-000000000003'''
\set U_G    '''ef000000-0000-0000-0000-000000000004'''

\set ACCT_LIVE '''ef100000-0000-0000-0000-000000000001'''
\set CONN_LIVE '''ef300000-0000-0000-0000-000000000001'''
\set TX_LIVE_FED  '''ef400000-0000-0000-0000-000000000001'''
\set TX_LIVE_HAND '''ef400000-0000-0000-0000-000000000002'''

-- ── Teardown ────────────────────────────────────────────────────────────────
-- Transactions first, then the tombstones those deletions write, then the
-- users. On a re-run the owners are still alive at this point, so the trigger
-- does its ordinary job and leaves rows behind; deleting them after is what
-- makes "the tombstones this user has" mean only what the proofs below create.
-- (financial_audit_log has no foreign key to users, so the previous run's
-- entries survived its erasures — audit-trigger.test.sql section (h) measures
-- that deliberately. Cleared here for the same reason.)
DELETE FROM public.transactions               WHERE user_id IN (:U_LIVE, :U_JWT, :U_SVC, :U_G);
DELETE FROM public.deleted_feed_transactions  WHERE user_id IN (:U_LIVE, :U_JWT, :U_SVC, :U_G);
DELETE FROM public.financial_audit_log        WHERE user_id IN (:U_LIVE, :U_JWT, :U_SVC, :U_G);
DELETE FROM public.users
 WHERE clerk_id IN ('clerk_erasure_live', 'clerk_erasure_jwt',
                    'clerk_erasure_svc',  'clerk_erasure_nonvacuous');

-- ── Four logins ─────────────────────────────────────────────────────────────
INSERT INTO public.users (id, clerk_id, email) VALUES
  (:U_LIVE, 'clerk_erasure_live',       'erasure-live@example.test'),
  (:U_JWT,  'clerk_erasure_jwt',        'erasure-jwt@example.test'),
  (:U_SVC,  'clerk_erasure_svc',        'erasure-svc@example.test'),
  (:U_G,    'clerk_erasure_nonvacuous', 'erasure-nonvacuous@example.test');
INSERT INTO public.user_profiles (clerk_user_id, email) VALUES
  ('clerk_erasure_live',       'erasure-live@example.test'),
  ('clerk_erasure_jwt',        'erasure-jwt@example.test'),
  ('clerk_erasure_svc',        'erasure-svc@example.test'),
  ('clerk_erasure_nonvacuous', 'erasure-nonvacuous@example.test')
ON CONFLICT (clerk_user_id) DO NOTHING;

-- The Transfer type category first: creating an account fires
-- create_transfer_category_for_account, which needs an anchor to hang its
-- "To/From <account>" category on.
INSERT INTO public.categories (id, user_id, name, type, level) VALUES
  ('ef200000-0000-0000-0000-000000000001', :U_LIVE, 'Transfer', 'both', 'type'),
  ('ef200000-0000-0000-0000-000000000002', :U_JWT,  'Transfer', 'both', 'type'),
  ('ef200000-0000-0000-0000-000000000003', :U_SVC,  'Transfer', 'both', 'type'),
  ('ef200000-0000-0000-0000-000000000004', :U_G,    'Transfer', 'both', 'type');

INSERT INTO public.accounts (id, user_id, name, type, balance, initial_balance) VALUES
  (:ACCT_LIVE,                             :U_LIVE, 'Current', 'checking', 0, 0),
  ('ef100000-0000-0000-0000-000000000002', :U_JWT,  'Current', 'checking', 0, 0),
  ('ef100000-0000-0000-0000-000000000003', :U_SVC,  'Current', 'checking', 0, 0),
  ('ef100000-0000-0000-0000-000000000004', :U_G,    'Current', 'checking', 0, 0);

-- A real bank connection each: the fed rows point at it, and it is what makes
-- the erasure's premise measurable — an erased owner has no feed left, which
-- is why a tombstone for them is one nobody could ever consult.
INSERT INTO public.bank_connections
  (id, user_id, provider, institution_id, institution_name, access_token_encrypted) VALUES
  (:CONN_LIVE,                             :U_LIVE, 'truelayer', 'inst-live', 'Test Bank', 'enc'),
  ('ef300000-0000-0000-0000-000000000002', :U_JWT,  'truelayer', 'inst-jwt',  'Test Bank', 'enc'),
  ('ef300000-0000-0000-0000-000000000003', :U_SVC,  'truelayer', 'inst-svc',  'Test Bank', 'enc'),
  ('ef300000-0000-0000-0000-000000000004', :U_G,    'truelayer', 'inst-g',    'Test Bank', 'enc');

-- Fed rows carry BOTH a connection id and an external id, which is what makes
-- them tombstone-worthy; the hand-entered one carries neither.
INSERT INTO public.transactions
  (id, user_id, account_id, description, amount, type, date,
   external_transaction_id, connection_id) VALUES
  (:TX_LIVE_FED, :U_LIVE, :ACCT_LIVE, 'Fed row 1', -10.00, 'expense', DATE '2026-01-01',
   'ext-live-1', :CONN_LIVE),
  ('ef400000-0000-0000-0000-000000000003', :U_LIVE, :ACCT_LIVE, 'Fed row 2', -11.00, 'expense', DATE '2026-01-02',
   'ext-live-2', :CONN_LIVE),
  ('ef400000-0000-0000-0000-000000000004', :U_LIVE, :ACCT_LIVE, 'Fed row 3', -12.00, 'expense', DATE '2026-01-03',
   'ext-live-3', :CONN_LIVE);
INSERT INTO public.transactions
  (id, user_id, account_id, description, amount, type, date) VALUES
  (:TX_LIVE_HAND, :U_LIVE, :ACCT_LIVE, 'Hand entered', -13.00, 'expense', DATE '2026-01-04');

INSERT INTO public.transactions
  (user_id, account_id, description, amount, type, date,
   external_transaction_id, connection_id)
SELECT v.u, v.a, 'Fed row ' || g, -1.00, 'expense', DATE '2026-01-01' + g,
       v.prefix || g, v.c
  FROM (VALUES
    (:U_JWT::uuid, 'ef100000-0000-0000-0000-000000000002'::uuid, 'ef300000-0000-0000-0000-000000000002'::uuid, 'ext-jwt-'),
    (:U_SVC::uuid, 'ef100000-0000-0000-0000-000000000003'::uuid, 'ef300000-0000-0000-0000-000000000003'::uuid, 'ext-svc-'),
    (:U_G::uuid,   'ef100000-0000-0000-0000-000000000004'::uuid, 'ef300000-0000-0000-0000-000000000004'::uuid, 'ext-g-')
  ) v(u, a, c, prefix), generate_series(1, 3) g;


-- ════════════════════════════════════════════════════════════════════════════
-- (a) A LIVE USER DELETES ONE ROW: the tombstone is written exactly as before
-- ════════════════════════════════════════════════════════════════════════════
-- The behaviour 20260828140000 exists for, and the thing 20260902140000 must
-- not have cost. One fed row and one hand-entered row deleted in the same
-- statement: the fed one is remembered, with its connection and its account;
-- the hand-entered one is not, because no sync will ever offer it again.
SELECT set_config('request.jwt.claims',
  '{"sub":"clerk_erasure_live","role":"authenticated"}', false) IS NOT NULL
    AS a_claim_is_the_live_user;

DELETE FROM public.transactions WHERE id IN (:TX_LIVE_FED, :TX_LIVE_HAND);

SELECT
  count(*) = 1                                             AS a_only_the_fed_row_was_remembered_correct,
  bool_and(external_transaction_id = 'ext-live-1')         AS a_tombstone_names_the_feed_row_correct,
  bool_and(connection_id = :CONN_LIVE)                     AS a_tombstone_carries_the_connection_correct,
  bool_and(account_id = :ACCT_LIVE)                        AS a_tombstone_carries_the_account_correct,
  bool_and(user_id = :U_LIVE)                              AS a_tombstone_names_the_owner_correct
FROM public.deleted_feed_transactions WHERE user_id = :U_LIVE;

-- …and the deletion is still audited, by the deferred trigger of 20260902120000.
-- Two rows deleted, two entries: the tombstone trigger and the audit trigger do
-- not compete, which audit-trigger.test.sql proof (c) also measures from its
-- side.
SELECT count(*) FILTER (WHERE entity = 'transaction' AND action = 'delete') = 2
    AS a_both_deletions_still_audited_correct
FROM public.financial_audit_log WHERE user_id = :U_LIVE;


-- ════════════════════════════════════════════════════════════════════════════
-- (b) ERASURE UNDER THE DEPARTING USER'S OWN JWT
-- ════════════════════════════════════════════════════════════════════════════
-- If the guard is missing, this statement raises and the file stops here —
-- which is the whole point of the section.
SELECT set_config('request.jwt.claims',
  '{"sub":"clerk_erasure_jwt","role":"authenticated"}', false) IS NOT NULL
    AS b_claim_is_the_departing_user;

DELETE FROM public.users WHERE id = :U_JWT;

SELECT
  (SELECT count(*) FROM public.users
    WHERE id = :U_JWT) = 0                                 AS b_the_user_is_gone_correct,
  (SELECT count(*) FROM public.transactions
    WHERE user_id = :U_JWT) = 0                            AS b_the_cascade_completed_correct,
  (SELECT count(*) FROM public.deleted_feed_transactions
    WHERE user_id = :U_JWT) = 0                            AS b_no_tombstone_was_minted_correct,
  -- The premise of the decision, measured rather than asserted: there is no
  -- feed left to re-import from, so there was nothing for a tombstone to stop.
  (SELECT count(*) FROM public.bank_connections
    WHERE user_id = :U_JWT) = 0                            AS b_the_feed_went_with_them_correct;


-- ════════════════════════════════════════════════════════════════════════════
-- (c) ERASURE UNDER THE SERVICE ROLE — how api/account/delete.ts does it
-- ════════════════════════════════════════════════════════════════════════════
-- That route uses SUPABASE_SERVICE_ROLE_KEY (api/_lib/supabase.ts), deletes the
-- audit rows explicitly, and then the users row. The order is not changed by
-- this fix and is not changed here.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false) IS NOT NULL
    AS c_claim_is_service_role;

DELETE FROM public.financial_audit_log WHERE user_id = :U_SVC;
DELETE FROM public.users WHERE id = :U_SVC;

SELECT
  (SELECT count(*) FROM public.users
    WHERE id = :U_SVC) = 0                                 AS c_the_user_is_gone_correct,
  (SELECT count(*) FROM public.transactions
    WHERE user_id = :U_SVC) = 0                            AS c_the_cascade_completed_correct,
  (SELECT count(*) FROM public.deleted_feed_transactions
    WHERE user_id = :U_SVC) = 0                            AS c_no_tombstone_was_minted_correct,
  (SELECT count(*) FROM public.bank_connections
    WHERE user_id = :U_SVC) = 0                            AS c_the_feed_went_with_them_correct;


-- ════════════════════════════════════════════════════════════════════════════
-- (d) TWO ERASURES TOOK NOBODY ELSE'S ROWS
-- ════════════════════════════════════════════════════════════════════════════
SELECT
  (SELECT count(*) FROM public.users
    WHERE id = :U_LIVE) = 1                                AS d_the_live_user_is_still_here_correct,
  (SELECT count(*) FROM public.transactions
    WHERE user_id = :U_LIVE) = 2                           AS d_their_remaining_rows_are_intact,
  (SELECT count(*) FROM public.deleted_feed_transactions
    WHERE user_id = :U_LIVE) = 1                           AS d_their_tombstone_is_untouched;


-- ════════════════════════════════════════════════════════════════════════════
-- (e) AND WHEN THE LIVE USER LEAVES, THEIR TOMBSTONES GO WITH THEM
-- ════════════════════════════════════════════════════════════════════════════
-- The other half of the argument, and the reason the foreign key was not
-- weakened to fix this. A tombstone names one of a person's accounts and one of
-- their bank's transaction ids: it is their data, and an erasure must take it.
-- ON DELETE CASCADE is what does that, and it still does.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false) IS NOT NULL
    AS e_claim_is_service_role;

DELETE FROM public.users WHERE id = :U_LIVE;

SELECT
  (SELECT count(*) FROM public.users
    WHERE id = :U_LIVE) = 0                                AS e_the_user_is_gone_correct,
  (SELECT count(*) FROM public.transactions
    WHERE user_id = :U_LIVE) = 0                           AS e_the_cascade_completed_correct,
  (SELECT count(*) FROM public.deleted_feed_transactions
    WHERE user_id = :U_LIVE) = 0                           AS e_their_existing_tombstone_cascaded_away_correct;


-- ════════════════════════════════════════════════════════════════════════════
-- (f) THE SHAPE THE FIX DELIBERATELY DID NOT CHANGE
-- ════════════════════════════════════════════════════════════════════════════
SELECT
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint
    WHERE conrelid = 'public.deleted_feed_transactions'::regclass AND contype = 'f')
    = 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE'
                                                           AS f_the_key_was_not_weakened_correct,
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
           WHERE t.tgrelid = 'public.transactions'::regclass
             AND NOT t.tgisinternal
             AND p.proname = 'remember_deleted_feed_transaction'
             AND (t.tgtype & 1) = 1    -- FOR EACH ROW
             AND (t.tgtype & 2) = 2    -- BEFORE
             AND (t.tgtype & 8) = 8)   -- DELETE
                                                           AS f_the_trigger_is_still_before_delete_correct;


-- ════════════════════════════════════════════════════════════════════════════
-- (g) …AND NONE OF THAT PASSES VACUOUSLY
-- ════════════════════════════════════════════════════════════════════════════
-- The guard is one IF inside a trigger body, and a test that a deletion
-- SUCCEEDS proves nothing unless the same deletion fails without it. So: put
-- 20260828140000's body back inside a transaction, watch the erasure fail on
-- the tombstone's foreign key by name, and roll the whole thing away.
--
-- Rolled back rather than repaired afterwards, because a repair that is itself
-- skipped (an error earlier in the transaction, psql exiting) would leave the
-- unguarded body installed on the cluster. A ROLLBACK cannot be skipped: if
-- this session dies here, the server undoes it.
BEGIN;

CREATE OR REPLACE FUNCTION public.remember_deleted_feed_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $unguarded$
BEGIN
  IF OLD.external_transaction_id IS NOT NULL
     AND length(trim(OLD.external_transaction_id)) > 0 THEN
    INSERT INTO public.deleted_feed_transactions (
      user_id, connection_id, external_transaction_id, account_id
    )
    VALUES (
      OLD.user_id, OLD.connection_id, OLD.external_transaction_id, OLD.account_id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN OLD;
END;
$unguarded$;

-- The failure, caught rather than raised, so the file can report it instead of
-- stopping on it.
DO $$
DECLARE
  v_failed     boolean := false;
  v_constraint text := '';
BEGIN
  BEGIN
    DELETE FROM public.users WHERE id = 'ef000000-0000-0000-0000-000000000004';
  EXCEPTION WHEN foreign_key_violation THEN
    v_failed := true;
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
  END;
  PERFORM set_config('erasure_test.unguarded_failed', v_failed::text, false);
  PERFORM set_config('erasure_test.unguarded_constraint', v_constraint, false);
END;
$$;

SELECT
  current_setting('erasure_test.unguarded_failed')::boolean
    AS g_the_unguarded_body_still_fails_correct,
  current_setting('erasure_test.unguarded_constraint')
    = 'deleted_feed_transactions_user_id_fkey'
    AS g_and_fails_on_the_tombstone_key_correct,
  (SELECT count(*) FROM public.users
    WHERE id = 'ef000000-0000-0000-0000-000000000004') = 1
    AS g_so_the_user_survived_their_own_erasure_correct;

ROLLBACK;

-- Back to the shipped body, and the same erasure that just failed now works.
SELECT
  position('NOT EXISTS (SELECT 1 FROM public.users WHERE id = OLD.user_id)'
          IN pg_get_functiondef(to_regprocedure('public.remember_deleted_feed_transaction()'))) > 0
    AS g_the_guarded_body_is_back_correct;

DELETE FROM public.users WHERE id = :U_G;

SELECT
  (SELECT count(*) FROM public.users
    WHERE id = :U_G) = 0                                   AS g_the_same_erasure_now_succeeds_correct,
  (SELECT count(*) FROM public.deleted_feed_transactions
    WHERE user_id = :U_G) = 0                              AS g_and_minted_no_tombstone_correct;
