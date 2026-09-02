-- Round-trip proof: build data, snapshot it, wipe, restore, compare.
\set ON_ERROR_STOP on
\timing off

SELECT set_config('request.jwt.claims', '{"sub":"clerk_test_1","role":"authenticated"}', false);

-- ── Identity ────────────────────────────────────────────────────────────────
DELETE FROM public.users WHERE clerk_id = 'clerk_test_1';
INSERT INTO public.users (id, clerk_id, email)
VALUES ('11111111-1111-1111-1111-111111111111', 'clerk_test_1', 'rt@example.test');

INSERT INTO public.user_profiles (clerk_user_id, email)
VALUES ('clerk_test_1', 'rt@example.test')
ON CONFLICT (clerk_user_id) DO NOTHING;

\set U '''11111111-1111-1111-1111-111111111111'''

-- ── Build a dataset that exercises every hazard ─────────────────────────────
-- Deliberately old updated_at values: the headline claim is that a restore
-- preserves them rather than re-dating history to today.
INSERT INTO public.categories (id, user_id, name, type, level, created_at, updated_at) VALUES
  ('c0000000-0000-0000-0000-000000000001', :U, 'Transfer', 'both',    'type',   '2019-01-01', '2019-01-01'),
  ('c0000000-0000-0000-0000-000000000002', :U, 'Expenses', 'expense', 'type',   '2019-01-01', '2019-01-01');
INSERT INTO public.categories (id, user_id, name, type, level, parent_id, created_at, updated_at) VALUES
  ('c0000000-0000-0000-0000-000000000003', :U, 'Food', 'expense', 'sub', 'c0000000-0000-0000-0000-000000000002', '2019-02-02', '2019-02-02');

-- Parent/child accounts exercise the deferred self-reference.
INSERT INTO public.accounts (id, user_id, name, type, balance, initial_balance, created_at, updated_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', :U, 'Current',    'checking',   1234.56, 0, '2019-03-03', '2019-03-03'),
  ('a0000000-0000-0000-0000-000000000002', :U, 'Savings',    'savings',    9876.54, 0, '2019-03-03', '2019-03-03'),
  ('a0000000-0000-0000-0000-000000000003', :U, 'Broker Cash','investment',  100.00, 0, '2019-03-03', '2019-03-03');
UPDATE public.accounts SET parent_account_id = 'a0000000-0000-0000-0000-000000000002'
 WHERE id = 'a0000000-0000-0000-0000-000000000003';

-- A transfer pair (mutual linked_transfer_id) and a split parent.
INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, category, created_at, updated_at) VALUES
  ('70000000-0000-0000-0000-000000000001', :U, 'a0000000-0000-0000-0000-000000000001', 'To Savings',   -500.00, 'transfer', '2020-05-05', 'c0000000-0000-0000-0000-000000000001', '2020-05-05', '2020-05-05'),
  ('70000000-0000-0000-0000-000000000002', :U, 'a0000000-0000-0000-0000-000000000002', 'From Current',  500.00, 'transfer', '2020-05-05', 'c0000000-0000-0000-0000-000000000001', '2020-05-05', '2020-05-05'),
  ('70000000-0000-0000-0000-000000000003', :U, 'a0000000-0000-0000-0000-000000000001', 'Big Shop',      -80.00, 'expense',  '2021-06-06', 'c0000000-0000-0000-0000-000000000003', '2021-06-06', '2021-06-06');

SELECT set_config('app.split_rpc', '1', false);
UPDATE public.transactions SET linked_transfer_id = '70000000-0000-0000-0000-000000000002' WHERE id = '70000000-0000-0000-0000-000000000001';
UPDATE public.transactions SET linked_transfer_id = '70000000-0000-0000-0000-000000000001' WHERE id = '70000000-0000-0000-0000-000000000002';
UPDATE public.transactions SET is_split = true WHERE id = '70000000-0000-0000-0000-000000000003';

INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order, created_at, updated_at) VALUES
  ('50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', :U, 'c0000000-0000-0000-0000-000000000003', -50.00, 0, '2021-06-06', '2021-06-06'),
  ('50000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000003', :U, 'c0000000-0000-0000-0000-000000000003', -30.00, 1, '2021-06-06', '2021-06-06');

-- The setup UPDATEs above fired update_transactions_updated_at themselves, so
-- re-stamp the historical values now — otherwise the snapshot would carry
-- today's date and the preservation check would prove nothing. Disabling the
-- trigger is a test-harness liberty (superuser); the restore never does this.
ALTER TABLE public.transactions DISABLE TRIGGER update_transactions_updated_at;
ALTER TABLE public.accounts     DISABLE TRIGGER update_accounts_updated_at;
UPDATE public.transactions SET updated_at = date::timestamptz WHERE user_id = :U;
UPDATE public.accounts     SET updated_at = '2019-03-03'      WHERE user_id = :U;
ALTER TABLE public.transactions ENABLE TRIGGER update_transactions_updated_at;
ALTER TABLE public.accounts     ENABLE TRIGGER update_accounts_updated_at;

-- ── Snapshot: exactly what the export will write (whole rows) ────────────────
CREATE TEMP TABLE backup AS
SELECT 'categories' AS entity, jsonb_agg(to_jsonb(t) ORDER BY t.level) AS rows FROM public.categories t WHERE t.user_id = :U
UNION ALL SELECT 'accounts',           jsonb_agg(to_jsonb(t)) FROM public.accounts t           WHERE t.user_id = :U
UNION ALL SELECT 'transactions',       jsonb_agg(to_jsonb(t)) FROM public.transactions t       WHERE t.user_id = :U
UNION ALL SELECT 'transaction_splits', jsonb_agg(to_jsonb(t)) FROM public.transaction_splits t WHERE t.user_id = :U;

CREATE TEMP TABLE links AS
SELECT jsonb_build_object(
  'account_parents', (SELECT jsonb_agg(jsonb_build_object('id', id, 'parent_account_id', parent_account_id))
                        FROM public.accounts WHERE user_id = :U AND parent_account_id IS NOT NULL),
  'transaction_links', (SELECT jsonb_agg(jsonb_build_object('id', id,
                                'linked_transfer_id', linked_transfer_id,
                                'linked_transfer_split_id', linked_transfer_split_id))
                        FROM public.transactions WHERE user_id = :U
                         AND (linked_transfer_id IS NOT NULL OR linked_transfer_split_id IS NOT NULL))
) AS payload;

CREATE TEMP TABLE before_state AS
SELECT (SELECT count(*) FROM public.accounts           WHERE user_id = :U) AS accounts,
       (SELECT count(*) FROM public.categories         WHERE user_id = :U) AS categories,
       (SELECT count(*) FROM public.transactions       WHERE user_id = :U) AS transactions,
       (SELECT count(*) FROM public.transaction_splits WHERE user_id = :U) AS splits,
       (SELECT sum(balance) FROM public.accounts       WHERE user_id = :U) AS balance_sum,
       (SELECT max(updated_at) FROM public.transactions WHERE user_id = :U) AS newest_updated,
       (SELECT count(*) FROM public.transactions WHERE user_id = :U AND linked_transfer_id IS NOT NULL) AS linked,
       (SELECT count(*) FROM public.accounts WHERE user_id = :U AND parent_account_id IS NOT NULL) AS nested;

-- ── Wipe ────────────────────────────────────────────────────────────────────
SELECT public.wipe_user_financial_data('DELETE EVERYTHING', :U) AS wiped;
SELECT public.user_financial_data_is_empty(:U) AS empty_after_wipe;

-- ── Restore, in the order the client will send ──────────────────────────────
SELECT public.restore_user_chunk('accounts',
         (SELECT rows FROM backup WHERE entity = 'accounts'), :U) AS accounts_in;
SELECT public.restore_user_chunk('categories',
         (SELECT jsonb_agg(e) FROM backup b, jsonb_array_elements(b.rows) e
           WHERE b.entity='categories' AND e->>'level'='type'), :U) AS cats_type_in;
SELECT public.restore_user_chunk('categories',
         (SELECT jsonb_agg(e) FROM backup b, jsonb_array_elements(b.rows) e
           WHERE b.entity='categories' AND e->>'level'='sub'), :U) AS cats_sub_in;
SELECT public.restore_user_chunk('categories',
         (SELECT jsonb_agg(e) FROM backup b, jsonb_array_elements(b.rows) e
           WHERE b.entity='categories' AND e->>'level'='detail'), :U) AS cats_detail_in;
SELECT public.restore_user_chunk('transactions',
         (SELECT rows FROM backup WHERE entity = 'transactions'), :U) AS txns_in;
SELECT public.restore_user_chunk('transaction_splits',
         (SELECT rows FROM backup WHERE entity = 'transaction_splits'), :U) AS splits_in;
SELECT public.finalize_user_restore((SELECT payload FROM links), :U) AS finalised;

-- ── Compare ─────────────────────────────────────────────────────────────────
SELECT
  b.accounts     = (SELECT count(*) FROM public.accounts           WHERE user_id = :U) AS accounts_match,
  b.categories AS cats_before, (SELECT count(*) FROM public.categories WHERE user_id = :U) AS cats_after,
  b.transactions = (SELECT count(*) FROM public.transactions       WHERE user_id = :U) AS transactions_match,
  b.splits       = (SELECT count(*) FROM public.transaction_splits WHERE user_id = :U) AS splits_match,
  b.balance_sum  = (SELECT sum(balance) FROM public.accounts       WHERE user_id = :U) AS balances_match,
  b.newest_updated = (SELECT max(updated_at) FROM public.transactions WHERE user_id = :U) AS updated_at_preserved,
  b.linked       = (SELECT count(*) FROM public.transactions WHERE user_id = :U AND linked_transfer_id IS NOT NULL) AS transfer_links_restored,
  b.nested       = (SELECT count(*) FROM public.accounts WHERE user_id = :U AND parent_account_id IS NOT NULL) AS nesting_restored,
  (SELECT count(*) FROM public.transactions WHERE user_id = :U AND is_split) = 1 AS split_flag_preserved,
  (SELECT count(*) FROM public.categories WHERE user_id = :U AND is_transfer_category) AS stray_transfer_cats
FROM before_state b;

-- ── The precondition must refuse a second restore ───────────────────────────
\echo 'Expect: restore_target_not_empty'
-- OFF for this ONE statement, which is meant to raise. Without it psql aborts
-- and exits 3, and test.sh (which now fails on a non-zero exit, so that a file
-- stopping early cannot be mistaken for a pass) could not tell this expected
-- refusal from the teardown at line 8 failing.
\set ON_ERROR_STOP off
SELECT public.restore_user_chunk('accounts', (SELECT rows FROM backup WHERE entity='accounts'), :U);
