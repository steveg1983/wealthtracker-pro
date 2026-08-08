import { splitParent } from './_setups.mjs';

export default {
  invariant: 'S-5',
  title: 'a split parent cannot be given a category behind its lines’ back',
  design: 'DESIGN.md §1.2 S-5 ("D"); cloud protect_split_transaction_fields, 20260713100000:90-93',
  consequence: 'the parent and its lines both claim the money, so the category report counts it twice',
  parity: 'match',

  sqlite: {
    setup: splitParent.sqlite,
    action: `UPDATE transactions SET category = 'c0000000-0000-0000-0000-000000000003' WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'split_category_locked' },
  },

  postgres: {
    setup: splitParent.postgres,
    action: `UPDATE public.transactions SET category = 'c0000000-0000-0000-0000-000000000003' WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'split_category_locked' },
  },
};
