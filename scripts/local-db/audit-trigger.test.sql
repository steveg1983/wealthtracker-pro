-- Deferred audit triggers: prove they fill the gap and never duplicate.
--
-- 20260902120000_a_change_is_audited_wherever_it_is_made.sql puts a deferred
-- CONSTRAINT TRIGGER on transactions, accounts and categories so that a change
-- made outside the RPC layer — a psql repair, a PostgREST write straight at a
-- table, a migration's backfill — lands in financial_audit_log like everything
-- else. The whole design turns on ONE question: at commit, can the trigger
-- tell "the app already logged this" from "nobody logged this"? Everything
-- below is that question asked four ways.
--
-- ── ORDER IS LOAD-BEARING ───────────────────────────────────────────────────
-- The JWT is set in the LAST section and nowhere before it, because
-- request.jwt.claims cannot be put back. A placeholder GUC resets to the empty
-- string, not to NULL, and public.requesting_clerk_id() does
-- current_setting(...)::jsonb on it — which RAISES on ''. So a session that has
-- ever set the claim can never again act as "psql, no identity", and the
-- proofs that need actor_clerk_id to be NULL have to come first. That is a
-- pre-existing sharp edge in requesting_clerk_id (20260610130000), not
-- something this migration introduced; it is written down here because it is
-- the reason this file is ordered the way it is.
\set ON_ERROR_STOP on
\timing off

\set U '''ad000000-0000-0000-0000-000000000001'''
\set ACCT '''ad100000-0000-0000-0000-000000000001'''
\set CAT_EXPENSES '''ad200000-0000-0000-0000-000000000002'''

-- ── Identity ────────────────────────────────────────────────────────────────
-- The transactions go BEFORE the user, not with it. Deleting the user row
-- cascades into transactions, whose BEFORE DELETE trigger
-- (transactions_remember_deletion, 20260828140000) writes a tombstone that
-- references public.users — and by then there is no user to reference, so the
-- cascade dies on deleted_feed_transactions_user_id_fkey. That is a
-- pre-existing edge in the tombstone trigger, not something the audit triggers
-- do; it is reproduced in this repository's notes rather than worked around
-- silently. Here it just means the teardown has an order.
DELETE FROM public.transactions            WHERE user_id = :U;
DELETE FROM public.deleted_feed_transactions WHERE user_id = :U;
DELETE FROM public.financial_audit_log     WHERE user_id = :U;
DELETE FROM public.users WHERE clerk_id = 'clerk_audit_trigger';
INSERT INTO public.users (id, clerk_id, email)
VALUES (:U, 'clerk_audit_trigger', 'audit-trigger@example.test');
INSERT INTO public.user_profiles (clerk_user_id, email)
VALUES ('clerk_audit_trigger', 'audit-trigger@example.test')
ON CONFLICT (clerk_user_id) DO NOTHING;

-- ── A ledger to damage ──────────────────────────────────────────────────────
-- The Transfer type category first: creating an account fires
-- create_transfer_category_for_account, which needs an anchor to hang the
-- "To/From <account>" category on.
INSERT INTO public.categories (id, user_id, name, type, level) VALUES
  ('ad200000-0000-0000-0000-000000000001', :U, 'Transfer', 'both',    'type'),
  (:CAT_EXPENSES,                          :U, 'Expenses', 'expense', 'type');

INSERT INTO public.accounts (id, user_id, name, type, balance, initial_balance)
VALUES (:ACCT, :U, 'Current', 'checking', 0, 0);

-- 900 uncategorised rows: 20 for the RPC proof, 800 for the bulk proof, the
-- rest are elbow room. Every one carries an external id, so the deletion in
-- proof (c) has a tombstone to leave behind.
INSERT INTO public.transactions
  (user_id, account_id, description, amount, type, date, external_transaction_id, connection_id)
SELECT :U, :ACCT, 'Payee ' || (g % 40), -1.00, 'expense',
       DATE '2026-01-01' + (g % 300), 'ext-' || g, NULL
  FROM generate_series(1, 900) g;

CREATE TEMP TABLE ids AS
SELECT id, row_number() OVER (ORDER BY external_transaction_id) AS n
  FROM public.transactions WHERE user_id = :U;

-- The setup above wrote audit rows of its own (three categories, one account,
-- 900 transactions — the triggers work, which is the point). Clear this user's
-- history so each proof counts only its own damage.
DELETE FROM public.financial_audit_log WHERE user_id = :U;


-- ════════════════════════════════════════════════════════════════════════════
-- (a) AN RPC THAT AUDITS: exactly one row per change, no trigger duplicate
-- ════════════════════════════════════════════════════════════════════════════
-- apply_category_to_uncategorized writes its own audit entry per row
-- (20260901150000). If the deferred trigger could not see that, every row here
-- would be logged twice — which is the failure this whole design exists to
-- avoid.
SELECT public.apply_category_to_uncategorized(
         ARRAY(SELECT id FROM ids WHERE n <= 20),
         :CAT_EXPENSES, :U) AS filed;

SELECT
  count(*) = 20                                    AS a_one_row_per_change_correct,
  count(*) FILTER (WHERE entity = 'transaction'
                     AND action = 'update') = 20   AS a_entity_and_action_correct,
  max(per_entity) = 1                              AS a_no_trigger_duplicate_correct
FROM (
  SELECT entity, action, count(*) OVER (PARTITION BY entity_id) AS per_entity
    FROM public.financial_audit_log WHERE user_id = :U
) s;

DELETE FROM public.financial_audit_log WHERE user_id = :U;

-- The same question of a second RPC shape — one that changes TWO tables and
-- audits only one of them. create_transaction_atomic logs the transaction it
-- creates and moves the account's balance without logging that. The registry
-- suppresses the duplicate for the transaction; the balance move was never
-- logged by anybody, so the trigger records it. THIS IS NEW BEHAVIOUR and it
-- is measured here rather than left to be discovered: every create/update/
-- delete through the three atomic transaction RPCs now also writes an
-- 'account'/'update' row whose before/after differ in balance alone.
SELECT id IS NOT NULL AS a2_rpc_ran_correct
  FROM public.create_transaction_atomic(jsonb_build_object(
    'user_id', :U, 'account_id', :ACCT, 'description', 'Coffee',
    'amount', -3.50, 'type', 'expense', 'date', '2026-09-01'));

SELECT
  count(*) FILTER (WHERE entity = 'transaction' AND action = 'create') = 1
    AS a2_transaction_logged_once_correct,
  count(*) FILTER (WHERE entity = 'account' AND action = 'update') = 1
    AS a2_derived_balance_move_present,
  bool_and((before_data->>'balance')::numeric <> (after_data->>'balance')::numeric)
    FILTER (WHERE entity = 'account')            AS a2_balance_is_what_moved_correct,
  count(*) = 2                                   AS a2_nothing_else_logged_correct
FROM public.financial_audit_log WHERE user_id = :U;

DELETE FROM public.financial_audit_log WHERE user_id = :U;


-- ════════════════════════════════════════════════════════════════════════════
-- (b) THE REPAIR NOBODY RECORDED: a plain UPDATE in psql
-- ════════════════════════════════════════════════════════════════════════════
-- The shape of the night of 1 Sep 2026, small enough to check by hand: five
-- rows put back to a name, by a session with no JWT and no service role.
UPDATE public.transactions
   SET description = 'Decathalon'
 WHERE user_id = :U
   AND id IN (SELECT id FROM ids WHERE n BETWEEN 101 AND 105);

SELECT
  count(*) = 5                                          AS b_one_row_per_changed_row_correct,
  count(*) FILTER (WHERE action = 'update') = 5         AS b_action_correct,
  count(*) FILTER (WHERE entity = 'transaction') = 5    AS b_entity_correct,
  count(*) FILTER (WHERE actor_clerk_id IS NULL) = 5    AS b_actor_is_nobody_correct,
  count(*) FILTER (WHERE before_data->>'description' LIKE 'Payee %') = 5
                                                        AS b_before_carries_old_name_correct,
  count(*) FILTER (WHERE after_data->>'description' = 'Decathalon') = 5
                                                        AS b_after_carries_new_name_correct,
  -- The whole row, not a diff: the shape every RPC call site already writes,
  -- which is what makes undo-from-history one code path rather than two.
  bool_and(before_data ? 'amount' AND before_data ? 'account_id'
           AND after_data ? 'amount' AND after_data ? 'account_id')
                                                        AS b_whole_rows_present,
  bool_and(user_id = :U)                                AS b_owner_correct
FROM public.financial_audit_log WHERE user_id = :U;

DELETE FROM public.financial_audit_log WHERE user_id = :U;


-- ════════════════════════════════════════════════════════════════════════════
-- (c) A DIRECT DELETE AND A DIRECT INSERT
-- ════════════════════════════════════════════════════════════════════════════
-- …and the trigger that was already on this table must still do its job. A
-- deferred audit trigger fires at commit; transactions_remember_deletion is a
-- BEFORE DELETE trigger and fires at statement time. They do not compete, and
-- proving it here is cheaper than finding out from a bank feed.
DELETE FROM public.deleted_feed_transactions WHERE user_id = :U;

DELETE FROM public.transactions
 WHERE id = (SELECT id FROM ids WHERE n = 200);

INSERT INTO public.transactions
  (id, user_id, account_id, description, amount, type, date)
VALUES ('ad900000-0000-0000-0000-000000000001', :U, :ACCT,
        'Hand entered', -12.34, 'expense', DATE '2026-09-02');

SELECT
  count(*) FILTER (WHERE action = 'delete') = 1        AS c_delete_logged_once_correct,
  count(*) FILTER (WHERE action = 'create') = 1        AS c_insert_logged_once_correct,
  count(*) = 2                                         AS c_nothing_else_logged_correct,
  bool_and(before_data IS NOT NULL AND after_data IS NULL)
    FILTER (WHERE action = 'delete')                   AS c_delete_payload_correct,
  bool_and(before_data IS NULL AND after_data IS NOT NULL)
    FILTER (WHERE action = 'create')                   AS c_insert_payload_correct,
  bool_and(after_data->>'description' = 'Hand entered')
    FILTER (WHERE action = 'create')                   AS c_insert_carries_the_row_correct,
  count(*) FILTER (WHERE actor_clerk_id IS NULL) = 2   AS c_actor_is_nobody_correct
FROM public.financial_audit_log WHERE user_id = :U;

-- The tombstone the older trigger owes, untouched by any of this.
SELECT
  count(*) = 1                                       AS c_tombstone_still_written_correct,
  bool_and(external_transaction_id LIKE 'ext-%')     AS c_tombstone_names_the_feed_row_correct
FROM public.deleted_feed_transactions WHERE user_id = :U;

DELETE FROM public.financial_audit_log WHERE user_id = :U;


-- ════════════════════════════════════════════════════════════════════════════
-- (d) NOTHING CHANGED, AND THE FULL-SIZED REPAIR
-- ════════════════════════════════════════════════════════════════════════════
-- An UPDATE that writes the values already there is not a change. The literal
-- OLD IS NOT DISTINCT FROM NEW cannot say so: update_updated_at_column is a
-- BEFORE UPDATE trigger that stamps now() unconditionally, so the two rows DO
-- differ, in exactly one column. If this ever returns anything but zero, the
-- comparison has stopped ignoring updated_at and every no-op maintenance sweep
-- is writing a row per transaction.
SELECT set_config('audit_test.stamp0',
  (SELECT max(updated_at) FROM public.transactions
    WHERE user_id = :U AND id IN (SELECT id FROM ids WHERE n BETWEEN 301 AND 400))::text,
  false) IS NOT NULL AS d_stamp_recorded;

UPDATE public.transactions
   SET description = description
 WHERE user_id = :U
   AND id IN (SELECT id FROM ids WHERE n BETWEEN 301 AND 400);

SELECT count(*) = 0                                    AS d_same_values_wrote_nothing_correct,
       count(*)                                        AS d_rows_written
  FROM public.financial_audit_log WHERE user_id = :U;

-- …and that the stamp really did move, so the check above is not passing
-- because the UPDATE did nothing at all. Compared against the value read
-- BEFORE the update: now() in this statement belongs to a later transaction
-- than the one that did the stamping, so it would answer the wrong question.
SELECT count(*) = 100 AS d_the_stamp_did_move_correct
  FROM public.transactions
 WHERE user_id = :U AND id IN (SELECT id FROM ids WHERE n BETWEEN 301 AND 400)
   AND updated_at > current_setting('audit_test.stamp0')::timestamptz;

DELETE FROM public.financial_audit_log WHERE user_id = :U;

-- The real thing: one statement, more rows than the 771 the owner repaired,
-- and the deferred queue has to carry every one of them to commit.
--
-- 801 candidates less the one proof (c) deleted is 800 live rows, and the new
-- description differs from every value any of them holds — including the five
-- proof (b) already renamed, which would otherwise be no-ops. The first run of
-- this file asked for 800 and got 794 for exactly that reason: the same-values
-- guard is not a special case, it applies inside a bulk statement too.
SELECT set_config('audit_test.t0', clock_timestamp()::text, false) IS NOT NULL
    AS d_stopwatch_started;

UPDATE public.transactions
   SET description = 'Decathalon (repaired)'
 WHERE user_id = :U
   AND id IN (SELECT id FROM ids WHERE n BETWEEN 1 AND 801 AND n <> 200);

SELECT
  count(*) = 800                                       AS d_bulk_one_row_each_correct,
  count(DISTINCT entity_id) = 800                      AS d_bulk_no_duplicates_correct,
  count(*) FILTER (WHERE action = 'update') = 800      AS d_bulk_action_correct,
  count(*) FILTER (WHERE actor_clerk_id IS NULL) = 800 AS d_bulk_actor_is_nobody_correct,
  count(*) AS d_rows_written,
  round(extract(epoch FROM (clock_timestamp()
        - current_setting('audit_test.t0')::timestamptz)) * 1000) AS d_elapsed_ms
FROM public.financial_audit_log WHERE user_id = :U;

DELETE FROM public.financial_audit_log WHERE user_id = :U;


-- ════════════════════════════════════════════════════════════════════════════
-- (e) THE ACTOR, WHEN THERE IS ONE
-- ════════════════════════════════════════════════════════════════════════════
-- LAST, and read the header before moving it: setting request.jwt.claims is a
-- one-way door in a psql session. Everything above needed the claim absent.
--
-- Nothing about the derivation is new — write_financial_audit has taken the
-- actor from the verified JWT since 20260725120000 — and that is the point: a
-- trigger-written row and an RPC-written row name the same person, because
-- there is still one INSERT path into the table.
SELECT set_config('request.jwt.claims',
  '{"sub":"clerk_audit_trigger","role":"authenticated"}', false) IS NOT NULL AS e_claim_set;

UPDATE public.transactions
   SET description = 'Filed by hand'
 WHERE user_id = :U
   AND id IN (SELECT id FROM ids WHERE n BETWEEN 501 AND 503);

SELECT
  count(*) = 3                                                       AS e_rows_written_correct,
  count(*) FILTER (WHERE actor_clerk_id = 'clerk_audit_trigger') = 3 AS e_actor_is_the_signed_in_user_correct,
  bool_and(user_id = :U)                                             AS e_owner_correct
FROM public.financial_audit_log WHERE user_id = :U;

-- ── …and when the caller is the API rather than a person ────────────────────
-- The bank-sync handler writes straight at the table with the service-role key
-- (api/banking/sync-transactions.ts) — no RPC, and therefore, until now, no
-- audit row. AUDIT_2026-06-12_DEEP_REAUDIT.md calls that finding 13. This is
-- that path's claim check: a service-role session has no `sub`, so
-- write_financial_audit takes its service-role branch and the row is attributed
-- to the account's owner with no actor, which is the truth.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false) IS NOT NULL
    AS g_service_role_claim_set;

DELETE FROM public.financial_audit_log WHERE user_id = :U;

INSERT INTO public.transactions
  (id, user_id, account_id, description, amount, type, date, external_transaction_id)
VALUES ('ad900000-0000-0000-0000-000000000002', :U, :ACCT,
        'Fed by the sync handler', -9.99, 'expense', DATE '2026-09-02', 'ext-sync-1');

UPDATE public.accounts SET balance = balance - 9.99 WHERE id = :ACCT;

SELECT
  count(*) FILTER (WHERE entity = 'transaction' AND action = 'create') = 1
    AS g_raw_insert_now_audited_correct,
  count(*) FILTER (WHERE entity = 'account' AND action = 'update') = 1
    AS g_raw_balance_overwrite_now_audited_correct,
  count(*) FILTER (WHERE actor_clerk_id IS NULL) = 2
    AS g_actor_is_nobody_correct,
  bool_and(user_id = :U)                            AS g_attributed_to_the_owner_correct
FROM public.financial_audit_log WHERE user_id = :U;


-- ── The registry cannot outlive its transaction ─────────────────────────────
-- The one property the whole design rests on, asked directly. Rows written
-- inside a transaction are visible to the deferred triggers at commit (proved
-- by every count above) and gone afterwards — so a registry entry from one
-- request can never silence another request's audit row on a pooled
-- connection.
BEGIN;
  INSERT INTO pg_temp.wt_audit_written (entity, entity_id, action)
  VALUES ('transaction', 'ad900000-0000-0000-0000-000000000009', 'update')
  ON CONFLICT DO NOTHING;
  SELECT count(*) > 0 AS f_registry_holds_inside_its_transaction_correct
    FROM pg_temp.wt_audit_written;
COMMIT;

SELECT count(*) = 0 AS f_registry_is_empty_after_commit
  FROM pg_temp.wt_audit_written;

-- And that a change is still audited in the very next transaction, i.e. the
-- emptied registry has not left the trigger believing everything is logged.
DELETE FROM public.financial_audit_log WHERE user_id = :U;
UPDATE public.transactions
   SET description = 'After the registry emptied'
 WHERE user_id = :U AND id IN (SELECT id FROM ids WHERE n = 600);
SELECT count(*) = 1 AS f_next_transaction_still_audited_correct
  FROM public.financial_audit_log WHERE user_id = :U;


-- ════════════════════════════════════════════════════════════════════════════
-- (h) DELETING A USER: the owner is gone before the trigger runs
-- ════════════════════════════════════════════════════════════════════════════
-- The regression that made this section exist. Deleting a users row cascades
-- into transactions, accounts and categories; the deferred triggers then fire
-- at COMMIT, by which time requesting_user_id() can no longer resolve that
-- clerk_id — so write_financial_audit raised `audit_identity_mismatch` and the
-- whole erasure failed. It only showed up on a RE-RUN: on a fresh cluster the
-- teardown at the top of restore-roundtrip.test.sql deletes nobody.
--
-- No external ids on these rows: transactions_remember_deletion writes a
-- tombstone referencing public.users, which a cascade cannot satisfy. That is
-- the pre-existing edge noted at the top of this file, kept out of the way
-- here so this section measures one thing.

-- ── h1: under the departing user's OWN claim ────────────────────────────────
DELETE FROM public.users WHERE clerk_id IN ('clerk_gone_1', 'clerk_gone_2');
INSERT INTO public.users (id, clerk_id, email) VALUES
  ('adaa0000-0000-0000-0000-000000000001', 'clerk_gone_1', 'gone1@example.test'),
  ('adaa0000-0000-0000-0000-000000000002', 'clerk_gone_2', 'gone2@example.test');
INSERT INTO public.categories (id, user_id, name, type, level) VALUES
  ('adbb0000-0000-0000-0000-000000000001', 'adaa0000-0000-0000-0000-000000000001', 'Transfer', 'both', 'type'),
  ('adbb0000-0000-0000-0000-000000000002', 'adaa0000-0000-0000-0000-000000000002', 'Transfer', 'both', 'type');
INSERT INTO public.accounts (id, user_id, name, type, balance, initial_balance) VALUES
  ('adcc0000-0000-0000-0000-000000000001', 'adaa0000-0000-0000-0000-000000000001', 'Current', 'checking', 0, 0),
  ('adcc0000-0000-0000-0000-000000000002', 'adaa0000-0000-0000-0000-000000000002', 'Current', 'checking', 0, 0);
INSERT INTO public.transactions (user_id, account_id, description, amount, type, date)
SELECT u, a, 'Row ' || g, -1.00, 'expense', DATE '2026-01-01'
  FROM (VALUES ('adaa0000-0000-0000-0000-000000000001'::uuid, 'adcc0000-0000-0000-0000-000000000001'::uuid),
               ('adaa0000-0000-0000-0000-000000000002'::uuid, 'adcc0000-0000-0000-0000-000000000002'::uuid)) v(u, a),
       generate_series(1, 3) g;

-- Clear the slate AFTER the seed, not before. Two things would otherwise make
-- this section count differently on a re-run, and both are properties this
-- file is elsewhere asserting are correct: the seed's own inserts are audited
-- (six transactions, two accounts, two categories), and the previous run's
-- rows for these ids SURVIVED its erasure, because financial_audit_log has no
-- foreign key to users. Deleting here makes "the rows already there" mean
-- exactly the six the next statement writes.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false) IS NOT NULL AS h_seeded_as_service;
DELETE FROM public.financial_audit_log
 WHERE user_id IN ('adaa0000-0000-0000-0000-000000000001', 'adaa0000-0000-0000-0000-000000000002');

UPDATE public.transactions SET description = 'Before the erasure'
 WHERE user_id IN ('adaa0000-0000-0000-0000-000000000001', 'adaa0000-0000-0000-0000-000000000002');

SELECT count(*) = 6 AS h_history_present
  FROM public.financial_audit_log
 WHERE user_id IN ('adaa0000-0000-0000-0000-000000000001', 'adaa0000-0000-0000-0000-000000000002');

-- The erasure itself. If either of these raises, the file stops here and
-- test.sh reports the failure — which is the whole point of the section.
SELECT set_config('request.jwt.claims',
  '{"sub":"clerk_gone_1","role":"authenticated"}', false) IS NOT NULL AS h_claim_is_the_departing_user;
DELETE FROM public.users WHERE clerk_id = 'clerk_gone_1';

-- ── h2: and under the service role, which is how the API would do it ────────
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false) IS NOT NULL AS h_claim_is_service_role;
DELETE FROM public.users WHERE clerk_id = 'clerk_gone_2';

SELECT
  (SELECT count(*) FROM public.users
    WHERE clerk_id IN ('clerk_gone_1', 'clerk_gone_2')) = 0   AS h_both_users_gone_correct,
  (SELECT count(*) FROM public.transactions
    WHERE user_id IN ('adaa0000-0000-0000-0000-000000000001',
                      'adaa0000-0000-0000-0000-000000000002')) = 0 AS h_cascade_completed_correct,
  -- Not one row minted BY the erasure: still the six from before it.
  (SELECT count(*) FROM public.financial_audit_log
    WHERE user_id IN ('adaa0000-0000-0000-0000-000000000001',
                      'adaa0000-0000-0000-0000-000000000002')) = 6 AS h_no_orphans_minted_correct,
  -- financial_audit_log.user_id carries no foreign key, so nothing cascades
  -- the history away with the person. Stated as a measurement, because if a
  -- key is ever added this flips and the erasure story changes with it.
  NOT EXISTS (SELECT 1 FROM pg_constraint
               WHERE conrelid = 'public.financial_audit_log'::regclass
                 AND contype = 'f')                            AS h_log_has_no_owner_fk_correct,
  (SELECT count(*) FROM public.financial_audit_log f
     WHERE f.user_id IN ('adaa0000-0000-0000-0000-000000000001',
                         'adaa0000-0000-0000-0000-000000000002')
       AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = f.user_id)) = 6
                                                               AS h_prior_history_survives_correct;
