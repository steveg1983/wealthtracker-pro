export default {
  invariant: 'I-1',
  title: 'one bank-feed id can appear once per connection',
  design: 'DESIGN.md §1.5 I-1 ("D — SQLite supports partial unique indexes"); cloud 20260308000000:115-117',
  consequence: 'a re-sync duplicates every transaction it re-sees, and the balance moves twice for one payment',
  parity: 'match',

  sqlite: {
    setup: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                                connection_id, external_transaction_id, external_provider)
      VALUES ('70000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Feed row', -1200, 'expense', '2024-05-01',
              'b0000000-0000-0000-0000-000000000001', 'feed-fixture-1', 'truelayer');`,
    action: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                                connection_id, external_transaction_id, external_provider)
      VALUES ('70000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Feed row again', -1200, 'expense', '2024-05-01',
              'b0000000-0000-0000-0000-000000000001', 'feed-fixture-1', 'truelayer');`,
    expect: {
      outcome: 'refused',
      message: 'UNIQUE constraint failed: transactions.connection_id, transactions.external_transaction_id',
    },
  },

  postgres: {
    setup: `
      -- connection_id is a real foreign key in the cloud, so the connection has
      -- to exist. The local file keeps the column with no FK, because
      -- bank_connections does not exist there (schema.sql, "WHAT IS NOT HERE").
      INSERT INTO public.bank_connections (id, user_id, provider, institution_id, institution_name,
                                           access_token_encrypted)
      VALUES ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
              'truelayer', 'inst-fixture', 'Fixture Bank', 'not-a-real-token');
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                       connection_id, external_transaction_id, external_provider)
      VALUES ('70000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Feed row', -12.00, 'expense', '2024-05-01',
              'b0000000-0000-0000-0000-000000000001', 'feed-fixture-1', 'truelayer');`,
    action: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                       connection_id, external_transaction_id, external_provider)
      VALUES ('70000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Feed row again', -12.00, 'expense', '2024-05-01',
              'b0000000-0000-0000-0000-000000000001', 'feed-fixture-1', 'truelayer');`,
    expect: { outcome: 'refused', message: 'idx_unique_external_transaction' },
  },
};
