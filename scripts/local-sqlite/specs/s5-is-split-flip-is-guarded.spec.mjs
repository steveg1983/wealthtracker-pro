export default {
  invariant: 'S-5',
  title: 'is_split cannot be flipped outside the split writer',
  design: 'DESIGN.md §1.2 S-5 ("D — four BEFORE UPDATE … RAISE(ABORT) triggers"); cloud protect_split_transaction_fields, 20260713100000:67-105',
  consequence: 'a quick edit turns a plain transaction into a split with no lines, or a split into a plain one leaving its lines orphaned',
  parity: 'match',

  sqlite: {
    action: `UPDATE transactions SET is_split = 1, category = ''
              WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'is_split can only change through set_transaction_splits' },
  },

  postgres: {
    action: `UPDATE public.transactions SET is_split = true, category = ''
              WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'is_split can only change through set_transaction_splits' },
  },
};
