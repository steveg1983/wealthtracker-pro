-- Base fixture — Postgres (the cloud schema, as scripts/local-db/up.sh builds it).
--
-- The same starting state as fixtures/base.sqlite.sql, expressed in the cloud's
-- types: numeric money instead of minor units, boolean instead of 0/1, and a
-- clerk_id because public.users still carries one.
--
-- Applied inside every spec's transaction, then rolled back.
-- All data is invented; this repo is public.

INSERT INTO public.users (id, clerk_id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'clerk_local_sqlite_harness', 'harness@example.test');

-- The Transfer type root must exist BEFORE the accounts are inserted: the
-- create_transfer_category_for_account trigger looks for it and silently
-- skips if it is missing, which would leave the two fixtures unequal.
INSERT INTO public.categories (id, user_id, name, type, level) VALUES
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Transfer', 'both',    'type'),
  ('c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Outgoings', 'expense', 'type');
INSERT INTO public.categories (id, user_id, name, type, level, parent_id) VALUES
  ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Weekly shop', 'expense', 'sub',
   'c0000000-0000-0000-0000-000000000002');

-- These two INSERTs each fire create_transfer_category_for_account, which mints
-- 'To/From Everyday' and 'To/From Rainy day' with server-generated ids. The
-- SQLite twin now does exactly the same through its own ported trigger, so
-- nothing may assume a transfer category's id on either engine: specs reach
-- them through (SELECT id FROM categories WHERE account_id = ... AND
-- is_transfer_category).
INSERT INTO public.accounts (id, user_id, name, type, balance, initial_balance) VALUES
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Everyday',  'checking', -25.00, 0),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Rainy day', 'savings',    0.00, 0);

INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, category) VALUES
  ('70000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-000000000001', 'Corner shop', -25.00, 'expense', '2024-03-01',
   'c0000000-0000-0000-0000-000000000003');
