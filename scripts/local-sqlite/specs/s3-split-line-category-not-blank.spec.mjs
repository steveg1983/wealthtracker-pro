export default {
  invariant: 'S-3',
  title: 'a split line must carry a category',
  design: 'DESIGN.md §1.2 S-3 ("D"); cloud CHECK at 20260713100000:43-44',
  consequence: 'a line of money filed nowhere — it leaves the parent categorised as a blank string, which every report groups together',
  parity: 'match',

  sqlite: {
    action: `
      INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order)
      VALUES ('50000000-0000-0000-0000-000000000001',
              '70000000-0000-0000-0000-000000000001',
              '11111111-1111-1111-1111-111111111111', '   ', -1000, 0);`,
    expect: { outcome: 'refused', message: 'transaction_splits_category_not_blank' },
  },

  postgres: {
    action: `
      INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order)
      VALUES ('50000000-0000-0000-0000-000000000001',
              '70000000-0000-0000-0000-000000000001',
              '11111111-1111-1111-1111-111111111111', '   ', -10.00, 0);`,
    expect: { outcome: 'refused', message: 'transaction_splits_category_not_blank' },
  },
};
