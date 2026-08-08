import { USER, SOMEONE_ELSES_ACCOUNT, secondUser } from './_shared.mjs';

export default {
  invariant: 'B-4',
  title: 'snapping somebody else\'s account is refused by the same name as one that does not exist',
  design: '20260613090000:197-203 — SELECT … WHERE id = p_account_id AND user_id = p_user_id, then IF NOT FOUND. MEASURED: both cases give account_not_found_or_not_owned',
  consequence: 'telling the two apart confirms an id exists to a caller who may not see it; and the snap is the one write in the schema that assigns an absolute balance, so it is the last place to be helpful about ids',
  parity: 'match',

  setup: secondUser,
  command: {
    verb: 'link_bank_account_snap',
    payload: { account_id: SOMEONE_ELSES_ACCOUNT, user_id: USER, bank_balance: '100.00' },
  },
  expect: { outcome: 'refused', error: 'account_not_found_or_not_owned' },
  state: [
    {
      name: 'their_balance_is_untouched',
      sqlite: `SELECT (CAST(balance_minor / 100 AS TEXT) || '.'
                 || substr('0' || CAST(abs(balance_minor) % 100 AS TEXT), -2, 2))
                 FROM accounts WHERE id = '${SOMEONE_ELSES_ACCOUNT}'`,
      postgres: `SELECT balance::text FROM public.accounts WHERE id = '${SOMEONE_ELSES_ACCOUNT}'`,
      expect: '0.00',
    },
  ],
};
