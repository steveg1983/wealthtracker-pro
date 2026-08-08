import { USER, EVERYDAY, SOMEONE_ELSES_ACCOUNT, secondUser } from './_shared.mjs';

export default {
  invariant: 'R-12',
  title: 'nesting an account under a stranger\'s account is refused by the ownership key',
  design: '20260808170000:486-490 pairs accounts.parent_account_id with user_id; schema.sql carries the twin. MEASURED on the reference cluster: accounts_parent_account_id_user_fkey refuses it',
  consequence: 'the investment/cash pairing is a private arrangement between two of one person\'s accounts; a restore that could nest one under a stranger\'s would put a figure in somebody else\'s portfolio roll-up',
  parity: 'match',

  setup: secondUser,
  command: {
    verb: 'finalize_user_restore',
    payload: {
      links: { account_parents: [{ id: EVERYDAY, parent_account_id: SOMEONE_ELSES_ACCOUNT }] },
      user_id: USER,
    },
  },
  // Both refuse. Postgres names the key; SQLite does not name keys in its
  // message at all, which is why the whole family of foreign-key refusals reads
  // the same there.
  expect: {
    sqlite: { outcome: 'refused', error: 'FOREIGN KEY constraint failed' },
    postgres: { outcome: 'refused', error: 'accounts_parent_account_id_user_fkey' },
  },
  state: [
    {
      name: 'nothing_was_nested',
      sqlite: `SELECT COALESCE(parent_account_id, 'NONE') FROM accounts WHERE id = '${EVERYDAY}'`,
      postgres: `SELECT COALESCE(parent_account_id::text, 'NONE') FROM public.accounts WHERE id = '${EVERYDAY}'`,
      expect: 'NONE',
    },
    {
      name: 'and_nothing_was_audited',
      sqlite: `SELECT COUNT(*) FROM financial_audit_log WHERE user_id = '${USER}'`,
      postgres: `SELECT COUNT(*) FROM public.financial_audit_log WHERE user_id = '${USER}'`,
      expect: '0',
    },
  ],
};
