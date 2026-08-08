import { secondLogin } from './_setups.mjs';

// R-12 on `investments.account_id` (initial-schema.sql:1832-1836). Same shape
// as the others, and the one with the clearest money consequence: holdings roll
// up into a portfolio figure, so a holding filed against a stranger's account
// moves a number on this login's dashboard that nothing in this login's data
// can account for (20260808170000:119-121).
//
// The setup plants the same holding against an account of the caller's own —
// the control — and the action tries to move it across.
export default {
  invariant: 'R-12',
  title: 'a holding may not sit in an account belonging to another login',
  design: 'investments_account_id_user_fkey — cloud 20260808170000:518-525, local schema.sql investments table foot',
  consequence: 'the portfolio total includes a position held in an account this login does not own, and no query it can run explains the difference',
  parity: 'match',

  sqlite: {
    setup: `
      ${secondLogin.sqlite}
      INSERT INTO investments (id, user_id, account_id, symbol, name, asset_type,
                               quantity_e8, cost_basis_minor)
      VALUES ('93000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000002', 'EXMPL', 'Example Fund', 'etf',
              100000000, 100000);`,
    action: `
      UPDATE investments SET account_id = 'a0000000-0000-0000-0000-000000000009'
       WHERE id = '93000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'FOREIGN KEY constraint failed' },
  },

  postgres: {
    setup: `
      ${secondLogin.postgres}
      INSERT INTO public.investments (id, user_id, account_id, symbol, name, asset_type,
                                      quantity, cost_basis)
      VALUES ('93000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000002', 'EXMPL', 'Example Fund', 'etf',
              1.00000000, 1000.00);`,
    action: `
      UPDATE public.investments SET account_id = 'a0000000-0000-0000-0000-000000000009'
       WHERE id = '93000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'investments_account_id_user_fkey' },
  },

  verify: [
    {
      name: 'the_holding_kept_the_account_of_your_own',
      sqlite: `SELECT COALESCE(account_id, 'UNPLACED') FROM investments
                WHERE id = '93000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT COALESCE(account_id::text, 'UNPLACED') FROM public.investments
                  WHERE id = '93000000-0000-0000-0000-000000000001'`,
      expect: 'a0000000-0000-0000-0000-000000000002',
    },
    {
      name: 'no_holding_sits_in_another_logins_account',
      sqlite: `SELECT COUNT(*) FROM investments x JOIN accounts a ON a.id = x.account_id
                WHERE a.user_id <> x.user_id`,
      postgres: `SELECT COUNT(*) FROM public.investments x JOIN public.accounts a ON a.id = x.account_id
                  WHERE a.user_id <> x.user_id`,
      expect: '0',
    },
  ],
};
