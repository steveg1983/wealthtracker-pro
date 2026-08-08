import {
  USER, STRANGER, RESTORED_ACCOUNT, RESTORED_ROW, backupTransaction, chunk, wipedWithOneAccount,
} from './_shared.mjs';

export default {
  invariant: 'R-12',
  title: 'a bundle exported by another login satisfies the new composite key trivially, and it is proved rather than assumed',
  design: '20260808170000:439-443 — (account_id, user_id) REFERENCES accounts(id, user_id). The chunked restore predates that key, so whether its insert order still satisfies it was an open question. It does, for one reason: every branch re-owns EVERY row to the same caller (20260807083000:279-292), so the account and the transaction carry the same user_id by construction',
  consequence: 'if a restore could land a row whose account belongs to somebody else, the composite key would refuse it mid-file and leave a half-restored login — and if it could NOT be refused, the key would be a rule the one bulk writer in the product routinely broke',
  parity: 'match',

  setup: wipedWithOneAccount,
  command: {
    verb: 'restore_user_chunk',
    payload: {
      // The row insists it belongs to the STRANGER; the account it names belongs
      // to USER. Nothing in the payload pairs them.
      chunks: [chunk('transactions', [backupTransaction({ user_id: STRANGER })])],
      user_id: USER,
    },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 1 },
  state: [
    {
      name: 'the_pairing',
      sqlite: `SELECT CASE WHEN t.user_id = a.user_id THEN 'PAIRED' ELSE 'CROSSED' END
                 FROM transactions t JOIN accounts a ON a.id = t.account_id
                WHERE t.id = '${RESTORED_ROW}'`,
      postgres: `SELECT CASE WHEN t.user_id = a.user_id THEN 'PAIRED' ELSE 'CROSSED' END
                   FROM public.transactions t JOIN public.accounts a ON a.id = t.account_id
                  WHERE t.id = '${RESTORED_ROW}'`,
      expect: 'PAIRED',
    },
    {
      name: 'no_crossed_rows_anywhere',
      sqlite: `SELECT COUNT(*) FROM transactions t JOIN accounts a ON a.id = t.account_id
                WHERE t.user_id <> a.user_id`,
      postgres: `SELECT COUNT(*) FROM public.transactions t JOIN public.accounts a ON a.id = t.account_id
                  WHERE t.user_id <> a.user_id`,
      expect: '0',
    },
    {
      name: 'the_account_still_belongs_to_the_caller',
      sqlite: `SELECT user_id FROM accounts WHERE id = '${RESTORED_ACCOUNT}'`,
      postgres: `SELECT user_id::text FROM public.accounts WHERE id = '${RESTORED_ACCOUNT}'`,
      expect: USER,
    },
  ],
};
