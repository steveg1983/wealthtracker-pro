import { splitParent } from './_setups.mjs';

export default {
  invariant: 'R-4',
  title: 'deleting a split parent deletes its lines',
  design: 'DESIGN.md §1.8 R-4 ("D"); cloud 20260713100000:35',
  consequence: 'lines with no parent are counted by category reports and by nothing else, so the two never agree again',
  parity: 'match',

  sqlite: {
    setup: splitParent.sqlite,
    action: `DELETE FROM transactions WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: splitParent.postgres,
    action: `DELETE FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'orphan_split_lines',
      sqlite: `SELECT COUNT(*) FROM transaction_splits
                WHERE transaction_id = '70000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT COUNT(*) FROM public.transaction_splits
                  WHERE transaction_id = '70000000-0000-0000-0000-000000000001'`,
      expect: '0',
    },
  ],
};
