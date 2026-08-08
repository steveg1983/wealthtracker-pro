import { splitParent } from './_setups.mjs';

export default {
  invariant: 'S-5',
  title: 'a split parent’s amount is the sum of its lines and cannot be set directly',
  design: 'DESIGN.md §1.2 S-5 ("D"); cloud protect_split_transaction_fields, 20260713100000:79-83',
  consequence: 'the transaction says one figure while its lines say another, and the category totals stop adding up to the account',
  parity: 'match',

  sqlite: {
    setup: splitParent.sqlite,
    action: `UPDATE transactions SET amount_minor = -9999 WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'split_amount_locked' },
  },

  postgres: {
    setup: splitParent.postgres,
    action: `UPDATE public.transactions SET amount = -99.99 WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'split_amount_locked' },
  },
};
