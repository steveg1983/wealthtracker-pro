export default {
  invariant: 'MONEY-2',
  title: 'a single transaction cannot exceed one billion pounds',
  design: 'DESIGN.md §3.1: MONEY_ROW = ±1e11 minor units, chosen so 92,233,720 rows can be summed before int64 overflows',
  consequence: 'without the bound, one absurd row makes every SUM over that account raise "integer overflow" — the balance stops being computable at all rather than merely wrong',
  parity: 'divergent',
  reason: 'numeric(20,2) permits up to 1e18 − 0.01, which is wider than int64 once scaled by 100. The cloud accepts a row the local file must refuse; a cloud→local restore has to reject or rescale it, and this spec is where that is written down.',

  sqlite: {
    action: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
      VALUES ('70000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Absurd', 200000000000, 'income', '2024-06-01');`,
    expect: { outcome: 'refused', message: 'transactions_amount_bounded' },
  },

  postgres: {
    action: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date)
      VALUES ('70000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Absurd', 2000000000.00, 'income', '2024-06-01');`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'rows_above_the_local_bound',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE abs(amount_minor) > 100000000000`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE abs(amount) > 1000000000.00`,
      expect: '1',
    },
  ],
};
