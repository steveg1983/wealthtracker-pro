export default {
  invariant: 'S-3',
  title: 'a split line must move a non-zero amount',
  design: 'DESIGN.md §1.2 S-3 ("D"); cloud CHECK at 20260713100000:43-44',
  consequence: 'a zero line pads the line count so a "split" can satisfy S-2 while carrying only one real line',
  parity: 'match',

  sqlite: {
    action: `
      INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order)
      VALUES ('50000000-0000-0000-0000-000000000002',
              '70000000-0000-0000-0000-000000000001',
              '11111111-1111-1111-1111-111111111111',
              'c0000000-0000-0000-0000-000000000003', 0, 0);`,
    expect: { outcome: 'refused', message: 'transaction_splits_amount_nonzero' },
  },

  postgres: {
    action: `
      INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order)
      VALUES ('50000000-0000-0000-0000-000000000002',
              '70000000-0000-0000-0000-000000000001',
              '11111111-1111-1111-1111-111111111111',
              'c0000000-0000-0000-0000-000000000003', 0.00, 0);`,
    expect: { outcome: 'refused', message: 'transaction_splits_amount_nonzero' },
  },
};
