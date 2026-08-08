export default {
  invariant: 'R-9',
  title: 'deleting an account deletes the holdings inside it',
  design: 'DESIGN.md §1.8 R-9 ("D"); cloud initial-schema.sql:1836',
  consequence: 'a holding with no account is counted in net worth and shown on no screen',
  parity: 'match',

  sqlite: {
    setup: `
      INSERT INTO investments (id, user_id, account_id, symbol, name, asset_type, quantity_e8, cost_basis_minor)
      VALUES ('93000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000002', 'TESTCO', 'Fixture Holdings plc', 'stock',
              1000000000, 12345);`,
    action: `DELETE FROM accounts WHERE id = 'a0000000-0000-0000-0000-000000000002';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: `
      INSERT INTO public.investments (id, user_id, account_id, symbol, name, asset_type, quantity, cost_basis)
      VALUES ('93000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000002', 'TESTCO', 'Fixture Holdings plc', 'stock',
              10.00000000, 123.45);`,
    action: `DELETE FROM public.accounts WHERE id = 'a0000000-0000-0000-0000-000000000002';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'holdings_left_behind',
      sqlite: `SELECT COUNT(*) FROM investments WHERE id = '93000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT COUNT(*) FROM public.investments WHERE id = '93000000-0000-0000-0000-000000000001'`,
      expect: '0',
    },
  ],
};
