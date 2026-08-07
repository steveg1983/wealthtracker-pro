-- Cross-user restore proof: build under user A, remap the ids, restore under
-- user B while A's rows are STILL THERE.
--
-- This is the case the owner hit against real data. restore-roundtrip.test.sql
-- wipes before restoring, so every id it re-inserts is free again and a restore
-- that preserved ids passed it happily. Restoring into a SECOND login does not
-- get that: the ids in the file belong to rows that still exist, owned by
-- somebody else, and `accounts_pkey` refuses them. `user_financial_data_is_empty`
-- cannot see the clash — it counts rows owned by the TARGET, and the rows in the
-- way are owned by the source.
--
-- The remap below mirrors src/services/backupService.ts remapBackupIds. It is
-- deliberately a re-implementation rather than a translation: if the two agree
-- about which columns carry a reference, that list is probably right, and if
-- they disagree the assertions here fail rather than the user's data.
\set ON_ERROR_STOP on
\timing off

\set A '''a1111111-1111-1111-1111-111111111111'''
\set B '''b2222222-2222-2222-2222-222222222222'''

-- ── Two separate logins ─────────────────────────────────────────────────────
DELETE FROM public.users WHERE clerk_id IN ('clerk_xu_a', 'clerk_xu_b');
INSERT INTO public.users (id, clerk_id, email) VALUES
  (:A, 'clerk_xu_a', 'xu-a@example.test'),
  (:B, 'clerk_xu_b', 'xu-b@example.test');
INSERT INTO public.user_profiles (clerk_user_id, email) VALUES
  ('clerk_xu_a', 'xu-a@example.test'), ('clerk_xu_b', 'xu-b@example.test')
ON CONFLICT (clerk_user_id) DO NOTHING;

SELECT set_config('request.jwt.claims', '{"sub":"clerk_xu_a","role":"authenticated"}', false);

-- ── Build A's dataset — one of every reference kind ─────────────────────────
INSERT INTO public.categories (id, user_id, name, type, level, created_at, updated_at) VALUES
  ('c1000000-0000-0000-0000-000000000001', :A, 'Transfer', 'both',    'type', '2019-01-01', '2019-01-01'),
  ('c1000000-0000-0000-0000-000000000002', :A, 'Expenses', 'expense', 'type', '2019-01-01', '2019-01-01');
INSERT INTO public.categories (id, user_id, name, type, level, parent_id, created_at, updated_at) VALUES
  ('c1000000-0000-0000-0000-000000000003', :A, 'Food', 'expense', 'sub', 'c1000000-0000-0000-0000-000000000002', '2019-02-02', '2019-02-02');

INSERT INTO public.accounts (id, user_id, name, type, balance, initial_balance, created_at, updated_at) VALUES
  ('a1000000-0000-0000-0000-000000000001', :A, 'Current',     'checking',   1234.56, 0, '2019-03-03', '2019-03-03'),
  ('a1000000-0000-0000-0000-000000000002', :A, 'Savings',     'savings',    9876.54, 0, '2019-03-03', '2019-03-03'),
  ('a1000000-0000-0000-0000-000000000003', :A, 'Broker Cash', 'investment',  100.00, 0, '2019-03-03', '2019-03-03');
UPDATE public.accounts SET parent_account_id = 'a1000000-0000-0000-0000-000000000002'
 WHERE id = 'a1000000-0000-0000-0000-000000000003';

INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, category, category_id, created_at, updated_at) VALUES
  ('71000000-0000-0000-0000-000000000001', :A, 'a1000000-0000-0000-0000-000000000001', 'To Savings',   -500.00, 'transfer', '2020-05-05', 'c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '2020-05-05', '2020-05-05'),
  ('71000000-0000-0000-0000-000000000002', :A, 'a1000000-0000-0000-0000-000000000002', 'From Current',  500.00, 'transfer', '2020-05-05', 'c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '2020-05-05', '2020-05-05'),
  ('71000000-0000-0000-0000-000000000003', :A, 'a1000000-0000-0000-0000-000000000001', 'Big Shop',      -80.00, 'expense',  '2021-06-06', 'c1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', '2021-06-06', '2021-06-06');

SELECT set_config('app.split_rpc', '1', false);
UPDATE public.transactions SET linked_transfer_id = '71000000-0000-0000-0000-000000000002', transfer_account_id = 'a1000000-0000-0000-0000-000000000002' WHERE id = '71000000-0000-0000-0000-000000000001';
UPDATE public.transactions SET linked_transfer_id = '71000000-0000-0000-0000-000000000001', transfer_account_id = 'a1000000-0000-0000-0000-000000000001' WHERE id = '71000000-0000-0000-0000-000000000002';
UPDATE public.transactions SET is_split = true WHERE id = '71000000-0000-0000-0000-000000000003';

INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order, created_at, updated_at) VALUES
  ('51000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', :A, 'c1000000-0000-0000-0000-000000000003', -50.00, 0, '2021-06-06', '2021-06-06'),
  ('51000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000003', :A, 'c1000000-0000-0000-0000-000000000003', -30.00, 1, '2021-06-06', '2021-06-06');

INSERT INTO public.budgets (id, user_id, name, amount, period, start_date, category, category_id, created_at, updated_at) VALUES
  ('b1000000-0000-0000-0000-000000000001', :A, 'Food', 300.00, 'monthly', '2021-01-01', 'c1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', '2021-01-01', '2021-01-01');

INSERT INTO public.goals (id, user_id, name, target_amount, current_amount, target_date, category, account_id, created_at, updated_at) VALUES
  ('91000000-0000-0000-0000-000000000001', :A, 'New roof', 5000.00, 250.00, '2027-01-01', 'Home', 'a1000000-0000-0000-0000-000000000002', '2021-01-01', '2021-01-01');

INSERT INTO public.goal_contributions (id, goal_id, user_id, transaction_id, amount, date, created_at) VALUES
  ('c2000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', :A, '71000000-0000-0000-0000-000000000003', 25.00, '2021-06-06', '2021-06-06');

-- subject_key is TEXT built out of transaction ids, sorted. Remapping
-- subject_ids and leaving this alone would bring back every suggestion the user
-- has already refused.
INSERT INTO public.suggestion_dismissals (id, user_id, kind, subject_key, subject_ids) VALUES
  ('d1000000-0000-0000-0000-000000000001', :A, 'duplicate',
   (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(ARRAY[
      '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002']) x),
   ARRAY['71000000-0000-0000-0000-000000000001',
         '71000000-0000-0000-0000-000000000002']::uuid[]);

-- Re-stamp the historical updated_at the setup UPDATEs clobbered, so the
-- preservation check below proves something.
ALTER TABLE public.transactions DISABLE TRIGGER update_transactions_updated_at;
ALTER TABLE public.accounts     DISABLE TRIGGER update_accounts_updated_at;
UPDATE public.transactions SET updated_at = date::timestamptz WHERE user_id = :A;
UPDATE public.accounts     SET updated_at = '2019-03-03'      WHERE user_id = :A;
ALTER TABLE public.transactions ENABLE TRIGGER update_transactions_updated_at;
ALTER TABLE public.accounts     ENABLE TRIGGER update_accounts_updated_at;

-- ── Export shape: whole rows, exactly as select * gives them ────────────────
CREATE TEMP TABLE backup AS
SELECT 'categories' AS entity, jsonb_agg(to_jsonb(t)) AS rows FROM public.categories t WHERE t.user_id = :A
UNION ALL SELECT 'accounts',           jsonb_agg(to_jsonb(t)) FROM public.accounts t           WHERE t.user_id = :A
UNION ALL SELECT 'transactions',       jsonb_agg(to_jsonb(t)) FROM public.transactions t       WHERE t.user_id = :A
UNION ALL SELECT 'transaction_splits', jsonb_agg(to_jsonb(t)) FROM public.transaction_splits t WHERE t.user_id = :A
UNION ALL SELECT 'budgets',            jsonb_agg(to_jsonb(t)) FROM public.budgets t            WHERE t.user_id = :A
UNION ALL SELECT 'goals',              jsonb_agg(to_jsonb(t)) FROM public.goals t              WHERE t.user_id = :A
UNION ALL SELECT 'goal_contributions', jsonb_agg(to_jsonb(t)) FROM public.goal_contributions t WHERE t.user_id = :A
UNION ALL SELECT 'suggestion_dismissals', jsonb_agg(to_jsonb(t)) FROM public.suggestion_dismissals t WHERE t.user_id = :A;

CREATE TEMP TABLE links AS
SELECT jsonb_build_object(
  'account_parents', (SELECT jsonb_agg(jsonb_build_object('id', id, 'parent_account_id', parent_account_id))
                        FROM public.accounts WHERE user_id = :A AND parent_account_id IS NOT NULL),
  'transaction_links', (SELECT jsonb_agg(jsonb_build_object('id', id,
                                'linked_transfer_id', linked_transfer_id,
                                'linked_transfer_split_id', linked_transfer_split_id))
                        FROM public.transactions WHERE user_id = :A
                         AND (linked_transfer_id IS NOT NULL OR linked_transfer_split_id IS NOT NULL))
) AS payload;

CREATE TEMP TABLE before_state AS
SELECT (SELECT count(*) FROM public.accounts           WHERE user_id = :A) AS accounts,
       (SELECT count(*) FROM public.categories         WHERE user_id = :A) AS categories,
       (SELECT count(*) FROM public.transactions       WHERE user_id = :A) AS transactions,
       (SELECT count(*) FROM public.transaction_splits WHERE user_id = :A) AS splits,
       (SELECT count(*) FROM public.budgets            WHERE user_id = :A) AS budgets,
       (SELECT count(*) FROM public.goals              WHERE user_id = :A) AS goals,
       (SELECT count(*) FROM public.goal_contributions WHERE user_id = :A) AS contribs,
       (SELECT sum(balance)     FROM public.accounts     WHERE user_id = :A) AS balance_sum,
       (SELECT sum(amount)      FROM public.transactions WHERE user_id = :A) AS amount_sum,
       (SELECT max(updated_at)  FROM public.transactions WHERE user_id = :A) AS newest_updated;

-- ── The remap ───────────────────────────────────────────────────────────────
-- One map for every table: ids are uuids from one generator, so a value cannot
-- mean one row in accounts and another in categories. suggestion_dismissals
-- needs exactly this, mixing transaction and split ids in a single string.
CREATE TEMP TABLE idmap AS
SELECT old_id, gen_random_uuid() AS new_id FROM (
  SELECT id AS old_id FROM public.accounts              WHERE user_id = :A
  UNION ALL SELECT id FROM public.categories            WHERE user_id = :A
  UNION ALL SELECT id FROM public.transactions          WHERE user_id = :A
  UNION ALL SELECT id FROM public.transaction_splits    WHERE user_id = :A
  UNION ALL SELECT id FROM public.budgets               WHERE user_id = :A
  UNION ALL SELECT id FROM public.goals                 WHERE user_id = :A
  UNION ALL SELECT id FROM public.goal_contributions    WHERE user_id = :A
  UNION ALL SELECT id FROM public.suggestion_dismissals WHERE user_id = :A
) s;

-- Rewrites one row: its own id, its uuid references, and the TEXT columns that
-- hold an id. The text columns are gated on the value LOOKING like a uuid,
-- because the same column is free text in other rows — goals.category holds a
-- label somebody typed, transactions.category holds a category's uuid.
-- A reference that resolves to nothing is left exactly as it is, never blanked.
CREATE OR REPLACE FUNCTION pg_temp.remap_row(e jsonb, uuid_fields text[], text_fields text[])
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE f text; v text; n text; out_row jsonb := e;
BEGIN
  SELECT new_id::text INTO n FROM idmap WHERE old_id::text = e->>'id';
  IF n IS NOT NULL THEN out_row := out_row || jsonb_build_object('id', n); END IF;

  FOREACH f IN ARRAY uuid_fields LOOP
    v := e->>f;
    IF v IS NOT NULL THEN
      SELECT new_id::text INTO n FROM idmap WHERE old_id::text = v;
      IF n IS NOT NULL THEN out_row := out_row || jsonb_build_object(f, n); END IF;
    END IF;
  END LOOP;

  FOREACH f IN ARRAY text_fields LOOP
    v := e->>f;
    IF v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT new_id::text INTO n FROM idmap WHERE old_id::text = v;
      IF n IS NOT NULL THEN out_row := out_row || jsonb_build_object(f, n); END IF;
    END IF;
  END LOOP;

  RETURN out_row;
END $$;

CREATE TEMP TABLE remapped AS
SELECT 'accounts' AS entity,
       jsonb_agg(pg_temp.remap_row(e, ARRAY['parent_account_id'], ARRAY[]::text[])) AS rows
  FROM backup b, jsonb_array_elements(b.rows) e WHERE b.entity='accounts'
UNION ALL
SELECT 'categories',
       jsonb_agg(pg_temp.remap_row(e, ARRAY['parent_id','account_id'], ARRAY[]::text[]))
  FROM backup b, jsonb_array_elements(b.rows) e WHERE b.entity='categories'
UNION ALL
SELECT 'transactions',
       jsonb_agg(pg_temp.remap_row(e,
         ARRAY['account_id','category_id','transfer_account_id','linked_transfer_id','linked_transfer_split_id'],
         ARRAY['category']))
  FROM backup b, jsonb_array_elements(b.rows) e WHERE b.entity='transactions'
UNION ALL
SELECT 'transaction_splits',
       jsonb_agg(pg_temp.remap_row(e,
         ARRAY['transaction_id','transfer_account_id','linked_transfer_id'], ARRAY['category']))
  FROM backup b, jsonb_array_elements(b.rows) e WHERE b.entity='transaction_splits'
UNION ALL
SELECT 'budgets',
       jsonb_agg(pg_temp.remap_row(e, ARRAY['category_id'], ARRAY['category']))
  FROM backup b, jsonb_array_elements(b.rows) e WHERE b.entity='budgets'
UNION ALL
SELECT 'goals',
       jsonb_agg(pg_temp.remap_row(e, ARRAY['account_id'], ARRAY['category']))
  FROM backup b, jsonb_array_elements(b.rows) e WHERE b.entity='goals'
UNION ALL
SELECT 'goal_contributions',
       jsonb_agg(pg_temp.remap_row(e, ARRAY['goal_id','transaction_id'], ARRAY[]::text[]))
  FROM backup b, jsonb_array_elements(b.rows) e WHERE b.entity='goal_contributions'
UNION ALL
-- subject_ids is a uuid ARRAY of transaction ids, and subject_key is the same
-- ids as sorted text. Both are rewritten, and the key is re-sorted afterwards
-- because fresh ids do not sort the way the originals did.
SELECT 'suggestion_dismissals',
       jsonb_agg(
         pg_temp.remap_row(e, ARRAY[]::text[], ARRAY[]::text[])
         || jsonb_build_object(
              'subject_ids',
              (SELECT jsonb_agg(COALESCE((SELECT new_id::text FROM idmap WHERE old_id::text = x), x))
                 FROM jsonb_array_elements_text(e->'subject_ids') x),
              'subject_key',
              (SELECT string_agg(y, '|' ORDER BY y)
                 FROM (SELECT COALESCE((SELECT new_id::text FROM idmap WHERE old_id::text = seg), seg) AS y
                         FROM unnest(string_to_array(e->>'subject_key', '|')) seg) z)))
  FROM backup b, jsonb_array_elements(b.rows) e WHERE b.entity='suggestion_dismissals';

CREATE TEMP TABLE remapped_links AS
SELECT jsonb_build_object(
  'account_parents', (SELECT jsonb_agg(jsonb_build_object(
                        'id', (SELECT new_id FROM idmap WHERE old_id::text = e->>'id'),
                        'parent_account_id', (SELECT new_id FROM idmap WHERE old_id::text = e->>'parent_account_id')))
                        FROM links l, jsonb_array_elements(l.payload->'account_parents') e),
  'transaction_links', (SELECT jsonb_agg(jsonb_build_object(
                        'id', (SELECT new_id FROM idmap WHERE old_id::text = e->>'id'),
                        'linked_transfer_id', (SELECT new_id FROM idmap WHERE old_id::text = e->>'linked_transfer_id'),
                        'linked_transfer_split_id', (SELECT new_id FROM idmap WHERE old_id::text = e->>'linked_transfer_split_id')))
                        FROM links l, jsonb_array_elements(l.payload->'transaction_links') e)
) AS payload;

-- ── Restore into B. A's rows are still there. ───────────────────────────────
SELECT set_config('request.jwt.claims', '{"sub":"clerk_xu_b","role":"authenticated"}', false);

SELECT public.user_financial_data_is_empty(:B) AS target_b_is_empty;
SELECT count(*) > 0 AS source_a_still_present FROM public.accounts WHERE user_id = :A;

SELECT public.restore_user_chunk('accounts',
         (SELECT rows FROM remapped WHERE entity='accounts'), :B) AS accounts_in;
SELECT public.restore_user_chunk('categories',
         (SELECT jsonb_agg(e) FROM remapped r, jsonb_array_elements(r.rows) e
           WHERE r.entity='categories' AND e->>'level'='type'), :B) AS cats_type_in;
SELECT public.restore_user_chunk('categories',
         (SELECT jsonb_agg(e) FROM remapped r, jsonb_array_elements(r.rows) e
           WHERE r.entity='categories' AND e->>'level'='sub'), :B) AS cats_sub_in;
-- The detail level is where the "To/From <account>" transfer categories live —
-- minted by create_transfer_category_for_account when A's accounts were made.
-- They are the only categories carrying an account_id, so they are the ones that
-- prove categories.account_id is remapped.
SELECT public.restore_user_chunk('categories',
         (SELECT jsonb_agg(e) FROM remapped r, jsonb_array_elements(r.rows) e
           WHERE r.entity='categories' AND e->>'level'='detail'), :B) AS cats_detail_in;
SELECT public.restore_user_chunk('budgets',
         (SELECT rows FROM remapped WHERE entity='budgets'), :B) AS budgets_in;
SELECT public.restore_user_chunk('goals',
         (SELECT rows FROM remapped WHERE entity='goals'), :B) AS goals_in;
SELECT public.restore_user_chunk('transactions',
         (SELECT rows FROM remapped WHERE entity='transactions'), :B) AS txns_in;
SELECT public.restore_user_chunk('transaction_splits',
         (SELECT rows FROM remapped WHERE entity='transaction_splits'), :B) AS splits_in;
SELECT public.restore_user_chunk('goal_contributions',
         (SELECT rows FROM remapped WHERE entity='goal_contributions'), :B) AS contribs_in;
SELECT public.restore_user_chunk('suggestion_dismissals',
         (SELECT rows FROM remapped WHERE entity='suggestion_dismissals'), :B) AS dismissals_in;
SELECT public.finalize_user_restore((SELECT payload FROM remapped_links), :B) AS finalised;

-- ── Compare ─────────────────────────────────────────────────────────────────
SELECT
  b.accounts     = (SELECT count(*) FROM public.accounts           WHERE user_id = :B) AS accounts_match,
  b.categories   = (SELECT count(*) FROM public.categories         WHERE user_id = :B) AS categories_match,
  b.transactions = (SELECT count(*) FROM public.transactions       WHERE user_id = :B) AS transactions_match,
  b.splits       = (SELECT count(*) FROM public.transaction_splits WHERE user_id = :B) AS splits_match,
  b.budgets      = (SELECT count(*) FROM public.budgets            WHERE user_id = :B) AS budgets_match,
  b.goals        = (SELECT count(*) FROM public.goals              WHERE user_id = :B) AS goals_match,
  b.contribs     = (SELECT count(*) FROM public.goal_contributions WHERE user_id = :B) AS contribs_match,
  b.balance_sum  = (SELECT sum(balance) FROM public.accounts       WHERE user_id = :B) AS balances_match,
  b.amount_sum   = (SELECT sum(amount)  FROM public.transactions   WHERE user_id = :B) AS amounts_match,
  b.newest_updated = (SELECT max(updated_at) FROM public.transactions WHERE user_id = :B) AS updated_at_preserved
FROM before_state b;

-- The relationships, one by one. Every check is "does this row still find the
-- other one", never "did the id change".
SELECT
  -- The transfer pair points at each other, and both legs are B's rows.
  (SELECT count(*) FROM public.transactions t
     JOIN public.transactions o ON o.id = t.linked_transfer_id
    WHERE t.user_id = :B AND o.user_id = :B AND o.linked_transfer_id = t.id) = 2
    AS transfer_pair_mutual,
  -- …and each leg's transfer_account_id is the OTHER leg's account.
  (SELECT count(*) FROM public.transactions t
     JOIN public.transactions o ON o.id = t.linked_transfer_id
    WHERE t.user_id = :B AND t.transfer_account_id = o.account_id) = 2
    AS transfer_far_side_correct,
  -- Both splits still belong to the one split parent, and it is B's.
  (SELECT count(*) FROM public.transaction_splits s
     JOIN public.transactions t ON t.id = s.transaction_id
    WHERE s.user_id = :B AND t.user_id = :B AND t.is_split) = 2
    AS split_parentage_intact,
  -- The nested account still hangs under Savings.
  (SELECT count(*) FROM public.accounts c
     JOIN public.accounts p ON p.id = c.parent_account_id
    WHERE c.user_id = :B AND p.user_id = :B AND p.name = 'Savings' AND c.name = 'Broker Cash') = 1
    AS nesting_intact,
  -- The sub-category still hangs under its type-level parent.
  (SELECT count(*) FROM public.categories c
     JOIN public.categories p ON p.id = c.parent_id
    WHERE c.user_id = :B AND p.user_id = :B AND c.name = 'Food' AND p.name = 'Expenses') = 1
    AS category_nesting_intact,
  -- Every transaction resolves to a category by BOTH spellings — the uuid
  -- column and the TEXT one the app actually reads.
  (SELECT count(*) FROM public.transactions t
     JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = :B AND c.user_id = :B) = 3
    AS category_id_resolves,
  (SELECT count(*) FROM public.transactions t
     JOIN public.categories c ON c.id::text = t.category
    WHERE t.user_id = :B AND c.user_id = :B) = 3
    AS category_text_resolves,
  -- Splits file under a real category by the same TEXT column.
  (SELECT count(*) FROM public.transaction_splits s
     JOIN public.categories c ON c.id::text = s.category
    WHERE s.user_id = :B AND c.user_id = :B) = 2
    AS split_category_resolves,
  -- The budget resolves both ways too.
  (SELECT count(*) FROM public.budgets bu
     JOIN public.categories c ON c.id = bu.category_id
     JOIN public.categories c2 ON c2.id::text = bu.category
    WHERE bu.user_id = :B) = 1
    AS budget_category_resolves,
  -- The goal still names an account, and its contribution still names both the
  -- goal and the transaction.
  (SELECT count(*) FROM public.goals g JOIN public.accounts a ON a.id = g.account_id
    WHERE g.user_id = :B AND a.user_id = :B) = 1 AS goal_account_resolves,
  (SELECT count(*) FROM public.goal_contributions gc
     JOIN public.goals g ON g.id = gc.goal_id
     JOIN public.transactions t ON t.id = gc.transaction_id
    WHERE gc.user_id = :B AND g.user_id = :B AND t.user_id = :B) = 1
    AS contribution_resolves,
  -- Every "To/From <account>" transfer category still names one of B's own
  -- accounts — categories.account_id, the reference easiest to overlook.
  (SELECT count(*) FROM public.categories c
     JOIN public.accounts a ON a.id = c.account_id
    WHERE c.user_id = :B AND a.user_id = :B AND c.is_transfer_category) = 3
    AS transfer_categories_resolve,
  -- …and none of them leaked a pointer at A's accounts.
  (SELECT count(*) FROM public.categories c
     JOIN public.accounts a ON a.id = c.account_id
    WHERE c.user_id = :B AND a.user_id = :A) = 0
    AS no_cross_user_category_pointers,
  -- The free-text label was NOT treated as an id.
  (SELECT category FROM public.goals WHERE user_id = :B) = 'Home' AS goal_label_untouched;

-- suggestion_dismissals: subject_ids must name B's transactions, and
-- subject_key must be the SAME ids as sorted text — otherwise the sweep
-- recomputes a key that matches nothing and every dismissal comes back.
SELECT
  (SELECT count(*) FROM public.suggestion_dismissals d,
          unnest(d.subject_ids) sid
     JOIN public.transactions t ON t.id = sid
    WHERE d.user_id = :B AND t.user_id = :B) = 2 AS subject_ids_resolve,
  (SELECT d.subject_key FROM public.suggestion_dismissals d WHERE d.user_id = :B)
    = (SELECT string_agg(x::text, '|' ORDER BY x::text)
         FROM public.suggestion_dismissals d, unnest(d.subject_ids) x
        WHERE d.user_id = :B) AS subject_key_matches_ids,
  -- And it is no longer A's key — proof the text was rewritten, not copied.
  (SELECT count(DISTINCT subject_key) FROM public.suggestion_dismissals
    WHERE user_id IN (:A, :B)) = 2 AS subject_key_rewritten;

-- ── A must be untouched, and no id may be shared between the two logins ─────
SELECT
  b.accounts     = (SELECT count(*) FROM public.accounts     WHERE user_id = :A) AS source_accounts_intact,
  b.transactions = (SELECT count(*) FROM public.transactions WHERE user_id = :A) AS source_transactions_intact,
  b.balance_sum  = (SELECT sum(balance) FROM public.accounts WHERE user_id = :A) AS source_balances_intact,
  (SELECT count(*) FROM public.accounts x JOIN public.accounts y ON x.id = y.id
    WHERE x.user_id = :A AND y.user_id = :B) = 0 AS no_shared_account_ids,
  (SELECT count(*) FROM public.transactions x JOIN public.transactions y ON x.id = y.id
    WHERE x.user_id = :A AND y.user_id = :B) = 0 AS no_shared_transaction_ids
FROM before_state b;

-- ── And the bug itself: the SAME file, ids preserved, must still collide ────
-- If this ever stops raising, the remap has stopped being load-bearing and
-- these tests are no longer proving anything.
\echo 'Expect: duplicate key value violates unique constraint "accounts_pkey"'
DELETE FROM public.users WHERE clerk_id = 'clerk_xu_c';
INSERT INTO public.users (id, clerk_id, email)
VALUES ('c3333333-3333-3333-3333-333333333333', 'clerk_xu_c', 'xu-c@example.test');
SELECT public.restore_user_chunk('accounts',
         (SELECT rows FROM backup WHERE entity='accounts'),
         'c3333333-3333-3333-3333-333333333333');
