import { USER, RESTORED_ROW, backupTransaction, chunk, wipedWithOneAccount } from './_shared.mjs';

export default {
  invariant: 'X-5',
  title: 'a restored transaction arrives with no feed identity at all',
  design: '20260807083000:284-286 strips plaid_transaction_id, connection_id, external_transaction_id and external_provider. The first is GLOBALLY unique, so restoring it collides with whoever exported the file; connection_id points at bank_connections, which a backup deliberately does not carry because it holds credentials',
  consequence: 'a restored row that still claims a feed identity would be deduped against a live feed it has no connection to, and would collide with the login the file came from',
  parity: 'match',

  setup: wipedWithOneAccount,
  command: {
    verb: 'restore_user_chunk',
    payload: {
      chunks: [chunk('transactions', [backupTransaction({
        connection_id: 'c0ffee00-0000-0000-0000-000000000001',
        external_transaction_id: 'feed-1',
        external_provider: 'truelayer',
        plaid_transaction_id: 'plaid-1',
      })])],
      user_id: USER,
    },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 1 },
  state: [
    {
      name: 'feed_identity',
      sqlite: `SELECT COALESCE(external_transaction_id, 'STRIPPED') || '/'
                 || COALESCE(external_provider, 'STRIPPED') || '/'
                 || COALESCE(connection_id, 'STRIPPED')
                 FROM transactions WHERE id = '${RESTORED_ROW}'`,
      postgres: `SELECT COALESCE(external_transaction_id, 'STRIPPED') || '/'
                   || COALESCE(external_provider, 'STRIPPED') || '/'
                   || COALESCE(connection_id::text, 'STRIPPED')
                   FROM public.transactions WHERE id = '${RESTORED_ROW}'`,
      expect: 'STRIPPED/STRIPPED/STRIPPED',
    },
  ],
};
