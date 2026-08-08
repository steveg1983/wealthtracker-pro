export default {
  invariant: 'MONEY-1',
  title: 'a sub-penny amount is refused, not rounded',
  design: 'DESIGN.md §2.2 (every table is STRICT) and §3.1 (money is INTEGER minor units)',
  consequence: 'CLAUDE.md BLOCKER #1 is floating-point money. A column that accepts 12.345 and stores 12.35 has already lost half a penny, and nothing downstream can tell that it happened',
  parity: 'divergent',
  reason: 'Postgres numeric(20,2) silently ROUNDS the value to scale and accepts it. The local file cannot express a fractional minor unit at all: STRICT refuses a REAL in an INTEGER column, so the write fails where the cloud quietly changes the number.',

  sqlite: {
    action: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
      VALUES ('70000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Sub-penny', -1234.5, 'expense', '2024-06-01');`,
    expect: { outcome: 'refused', message: 'cannot store REAL value in INTEGER column' },
  },

  postgres: {
    action: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date)
      VALUES ('70000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Sub-penny', -12.345, 'expense', '2024-06-01');`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'stored_amount_in_minor_units',
      sqlite: `SELECT amount_minor FROM transactions WHERE id = '70000000-0000-0000-0000-000000000010'`,
      postgres: `SELECT (amount * 100)::bigint FROM public.transactions
                  WHERE id = '70000000-0000-0000-0000-000000000010'`,
      // -12.345 asked for; -1234.5 minor units meant; -1235 stored.
      expect: '-1235',
    },
  ],
};
