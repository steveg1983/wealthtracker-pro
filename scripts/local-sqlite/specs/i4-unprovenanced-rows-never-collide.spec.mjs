export default {
  invariant: 'I-4',
  title: 'hand-entered rows never collide with each other, however many there are',
  design: 'DESIGN.md §1.5 I-4 — the index is non-partial deliberately (20260722170000:34-39); NULLs are distinct in both engines',
  consequence: 'if NULLs collided, a user could enter exactly one transaction that did not come from a file',
  parity: 'match',

  sqlite: {
    action: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date) VALUES
        ('70000000-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111',
         'a0000000-0000-0000-0000-000000000001', 'Typed in', -300, 'expense', '2024-05-03'),
        ('70000000-0000-0000-0000-00000000000e', '11111111-1111-1111-1111-111111111111',
         'a0000000-0000-0000-0000-000000000001', 'Typed in too', -400, 'expense', '2024-05-03');`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    action: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date) VALUES
        ('70000000-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111',
         'a0000000-0000-0000-0000-000000000001', 'Typed in', -3.00, 'expense', '2024-05-03'),
        ('70000000-0000-0000-0000-00000000000e', '11111111-1111-1111-1111-111111111111',
         'a0000000-0000-0000-0000-000000000001', 'Typed in too', -4.00, 'expense', '2024-05-03');`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'unprovenanced_rows',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE import_source IS NULL`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE import_source IS NULL`,
      expect: '3',
    },
  ],
};
