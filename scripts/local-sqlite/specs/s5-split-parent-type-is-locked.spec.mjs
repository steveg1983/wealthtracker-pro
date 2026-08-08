import { splitParent } from './_setups.mjs';

export default {
  invariant: 'S-5',
  title: 'a split parent’s type cannot be changed while it is split',
  design: 'DESIGN.md §1.2 S-5 ("D"); cloud protect_split_transaction_fields, 20260713100000:85-88',
  consequence: 'an expense becomes income while its lines keep expense signs, and the account moves the wrong way',
  parity: 'match',

  sqlite: {
    setup: splitParent.sqlite,
    action: `UPDATE transactions SET type = 'income' WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'split_type_locked' },
  },

  postgres: {
    setup: splitParent.postgres,
    action: `UPDATE public.transactions SET type = 'income' WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'split_type_locked' },
  },
};
