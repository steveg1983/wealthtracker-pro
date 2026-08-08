import { splitParent } from './_setups.mjs';

export default {
  invariant: 'R-11',
  title: 'a transaction and the split line it links to can be written in one transaction',
  design: 'DESIGN.md §1.8 R-11 ("D, and better than the cloud"); the cloud restore defers the links to a second pass precisely because it cannot do this, 20260807083000:294-299',
  consequence: 'without deferral, neither side of the cycle can be inserted first, so a restore has to be split into passes and stops being atomic',
  parity: 'divergent',
  reason: 'SQLite supports DEFERRABLE INITIALLY DEFERRED on this foreign key; Postgres\'s transactions_linked_transfer_split_id_fkey is not deferrable, and SET CONSTRAINTS ALL DEFERRED does not reach it. This is the local file being better, and it is why X-7 (chunked restore) can become one transaction locally.',

  sqlite: {
    // Its own file: a deferred constraint is only checked at COMMIT, so a spec
    // that rolls back would prove nothing about it.
    isolation: 'fresh-db',
    setup: splitParent.sqlite,
    action: `
      BEGIN;
      -- Names a split line that does not exist yet.
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                                transfer_account_id, linked_transfer_split_id)
      VALUES ('70000000-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000002', 'Counterpart', 1500, 'transfer', '2024-03-01',
              'a0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003');
      -- …and now the line, naming the transaction back. Both sides land in one
      -- COMMIT, which is where the deferred check finally runs.
      INSERT INTO _rpc_guard VALUES ('leg');
      INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order,
                                      transfer_account_id, linked_transfer_id)
      VALUES ('50000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001',
              '11111111-1111-1111-1111-111111111111',
              (SELECT id FROM categories
                WHERE account_id = 'a0000000-0000-0000-0000-000000000002' AND is_transfer_category = 1),
              -1500, 2, 'a0000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-00000000000f');
      DELETE FROM _rpc_guard;
      COMMIT;`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    action: `
      SET CONSTRAINTS ALL DEFERRED;
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                       transfer_account_id, linked_transfer_split_id)
      VALUES ('70000000-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000002', 'Counterpart', 15.00, 'transfer', '2024-03-01',
              'a0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003');`,
    expect: { outcome: 'refused', message: 'transactions_linked_transfer_split_id_fkey' },
  },

  verify: [
    {
      name: 'cycle_closed',
      sqlite: `SELECT COUNT(*) FROM transactions t
                 JOIN transaction_splits s ON s.id = t.linked_transfer_split_id
                WHERE t.id = '70000000-0000-0000-0000-00000000000f'
                  AND s.linked_transfer_id = t.id`,
      postgres: `SELECT COUNT(*) FROM public.transactions t
                   JOIN public.transaction_splits s ON s.id = t.linked_transfer_split_id
                  WHERE t.id = '70000000-0000-0000-0000-00000000000f'
                    AND s.linked_transfer_id = t.id`,
      expect: '1',
    },
  ],
};
