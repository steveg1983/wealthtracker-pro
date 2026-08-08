import { transferPair } from './_setups.mjs';

export default {
  invariant: 'T-8',
  title: 'deleting one side of a transfer strands the other, it does not delete it',
  design: 'DESIGN.md §1.3 T-8 ("D, but only with PRAGMA foreign_keys = ON"); cloud 20260716100000:30-32',
  consequence: 'a cascade here would delete a transaction in another account and move that account\'s balance without anyone asking',
  parity: 'match',

  sqlite: {
    setup: transferPair.sqlite,
    action: `DELETE FROM transactions WHERE id = '70000000-0000-0000-0000-000000000005';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: transferPair.postgres,
    action: `DELETE FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000005';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'other_leg_survives',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE id = '70000000-0000-0000-0000-000000000004'`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000004'`,
      expect: '1',
    },
    {
      name: 'other_leg_link_cleared',
      sqlite: `SELECT COALESCE(linked_transfer_id, 'CLEARED') FROM transactions
                WHERE id = '70000000-0000-0000-0000-000000000004'`,
      postgres: `SELECT COALESCE(linked_transfer_id::text, 'CLEARED') FROM public.transactions
                  WHERE id = '70000000-0000-0000-0000-000000000004'`,
      expect: 'CLEARED',
    },
  ],
};
