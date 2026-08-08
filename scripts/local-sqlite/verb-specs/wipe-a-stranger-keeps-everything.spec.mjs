import { USER, STRANGER, SOMEONE_ELSES_ACCOUNT, secondUser } from './_shared.mjs';

export default {
  invariant: 'X-6',
  title: 'a wipe reaches exactly one login',
  design: '20260807083000:180-207 — every DELETE is scoped by user_id. In the cloud RLS is a second gate; in a local file this predicate is the only one, which is why it is worth a spec of its own',
  consequence: 'a household file, or a restored bundle that still carries another login\'s rows, would lose data belonging to somebody who did not ask for it',
  parity: 'match',

  setup: secondUser,
  command: {
    verb: 'wipe_user_financial_data',
    payload: { confirm: 'DELETE EVERYTHING', user_id: USER },
  },
  expect: { outcome: 'ok' },
  state: [
    {
      name: 'their_account_survives',
      sqlite: `SELECT COUNT(*) FROM accounts WHERE id = '${SOMEONE_ELSES_ACCOUNT}'`,
      postgres: `SELECT COUNT(*) FROM public.accounts WHERE id = '${SOMEONE_ELSES_ACCOUNT}'`,
      expect: '1',
    },
    {
      name: 'nothing_was_audited_against_them',
      sqlite: `SELECT COUNT(*) FROM financial_audit_log WHERE user_id = '${STRANGER}'`,
      postgres: `SELECT COUNT(*) FROM public.financial_audit_log WHERE user_id = '${STRANGER}'`,
      expect: '0',
    },
  ],
};
