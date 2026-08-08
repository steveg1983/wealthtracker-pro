import { secondLogin } from './_setups.mjs';

// R-12 on `goals.account_id` (initial-schema.sql:1800-1804) — the smallest of
// the seven and included because the shape is identical
// (20260808170000:117-118). A goal names the account whose balance is supposed
// to be filling it; naming somebody else's makes the progress bar a reading of
// a ledger this login has no part in.
//
// The setup plants a goal tied to an account of the caller's own, so the column
// is proved to accept an account before the action is refused for naming the
// wrong one.
export default {
  invariant: 'R-12',
  title: 'a goal may not be tied to an account belonging to another login',
  design: 'goals_account_id_user_fkey — cloud 20260808170000:507-514, local schema.sql goals table foot',
  consequence: 'the goal reads its progress from a balance this login neither owns nor can see, and the figure moves for reasons nothing here can explain',
  parity: 'match',

  sqlite: {
    setup: `
      ${secondLogin.sqlite}
      INSERT INTO goals (id, user_id, name, target_amount_minor, current_amount_minor, account_id)
      VALUES ('90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
              'New boiler', 250000, 0, 'a0000000-0000-0000-0000-000000000002');`,
    action: `
      UPDATE goals SET account_id = 'a0000000-0000-0000-0000-000000000009'
       WHERE id = '90000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'FOREIGN KEY constraint failed' },
  },

  postgres: {
    setup: `
      ${secondLogin.postgres}
      INSERT INTO public.goals (id, user_id, name, target_amount, current_amount, account_id)
      VALUES ('90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
              'New boiler', 2500.00, 0.00, 'a0000000-0000-0000-0000-000000000002');`,
    action: `
      UPDATE public.goals SET account_id = 'a0000000-0000-0000-0000-000000000009'
       WHERE id = '90000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'goals_account_id_user_fkey' },
  },

  verify: [
    {
      name: 'the_goal_kept_the_account_of_your_own',
      sqlite: `SELECT COALESCE(account_id, 'UNTIED') FROM goals
                WHERE id = '90000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT COALESCE(account_id::text, 'UNTIED') FROM public.goals
                  WHERE id = '90000000-0000-0000-0000-000000000001'`,
      expect: 'a0000000-0000-0000-0000-000000000002',
    },
    {
      name: 'no_goal_is_tied_to_another_logins_account',
      sqlite: `SELECT COUNT(*) FROM goals x JOIN accounts a ON a.id = x.account_id
                WHERE a.user_id <> x.user_id`,
      postgres: `SELECT COUNT(*) FROM public.goals x JOIN public.accounts a ON a.id = x.account_id
                  WHERE a.user_id <> x.user_id`,
      expect: '0',
    },
  ],
};
