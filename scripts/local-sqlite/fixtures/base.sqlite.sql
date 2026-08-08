-- Base fixture — SQLite (local edition schema).
--
-- Applied inside every spec's transaction, then rolled back, so specs never see
-- each other's rows. Money is minor units here and decimal in the Postgres twin;
-- the two files are deliberately hand-written rather than generated, because a
-- generator would hide exactly the divergences this harness exists to find.
--
-- All data is invented. This repo is public: no real payee, account number or
-- figure appears anywhere in it.
--
-- The two files are now SYMMETRIC. They were not at first: schema.sql had no
-- create_transfer_category_for_account trigger, so this fixture had to write
-- the To/From categories by hand while Postgres minted its own. The harness
-- reported that as a finding (C-3/C-4), the trigger was written, and the hand
-- -written rows came out of this file. Both engines now mint them from an
-- account INSERT, with ids nobody can predict — which is why no spec may name a
-- transfer category by id on either side.

INSERT INTO users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'harness@example.test');

-- The Transfer type root is the anchor the Postgres trigger looks for, so both
-- engines must have it or the two fixtures are not the same starting point.
INSERT INTO categories (id, user_id, name, type, level) VALUES
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Transfer', 'both',    'type'),
  ('c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Outgoings', 'expense', 'type');
INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
  ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Weekly shop', 'expense', 'sub',
   'c0000000-0000-0000-0000-000000000002');

-- Each of these fires trg_create_transfer_category_for_account, which mints
-- 'To/From Everyday' and 'To/From Rainy day' with generated ids — the same
-- thing the Postgres fixture's INSERTs do through their own trigger.
INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor) VALUES
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Everyday',  'checking', -2500, 0),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Rainy day', 'savings',      0, 0);

-- One ordinary expense, and the account balance that B-1 says must match it:
-- balance = initial_balance + SUM(amount) = 0 + (-2500).
INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, category) VALUES
  ('70000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-000000000001', 'Corner shop', -2500, 'expense', '2024-03-01',
   'c0000000-0000-0000-0000-000000000003');
