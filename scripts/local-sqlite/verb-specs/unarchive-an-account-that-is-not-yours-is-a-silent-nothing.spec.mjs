import { USER, THEIR_ROW, SOMEONE_ELSES_ACCOUNT, secondUser, strangersRow, setups,
  storedFlag, accountText, auditShape, balanceIdentityHolds } from './_shared.mjs';

// THE VERB WITH NO REFUSAL AT ALL, and it is traced rather than assumed: the RPC
// does not look the account up, does not check FOUND, and raises nothing. It
// issues two UPDATEs whose WHERE clauses carry the owner, and answers with a
// count.
//
// So somebody else's account is `{unarchived: 0}` and no error — the OPPOSITE
// decision from `archive_transactions_before` beside it, which raises
// `account_not_found`, twenty lines apart in the same migration. Reproduced
// rather than smoothed over, because a port that invented a refusal here would
// turn a silent no-op into an error dialog nobody has ever seen.
//
// The stranger's row is archived in the setup and asserted STILL archived: the
// answer is zero because the WHERE clause matched nothing, not because the verb
// declined to run.
export default {
  invariant: 'X-6',
  title: 'unarchiving an account that is not yours is a silent nothing',
  design: 'unarchive_account 20260721130000:100-112 — no lookup, no FOUND check, no RAISE',
  consequence: 'a mis-routed owner id brings another login\'s archived history back into their register',
  parity: 'match',

  setup: setups(secondUser, strangersRow, {
    sqlite: `UPDATE transactions SET archived = 1 WHERE id = '${THEIR_ROW}';
             UPDATE accounts SET archive_through_date = '2025-01-01'
              WHERE id = '${SOMEONE_ELSES_ACCOUNT}';`,
    postgres: `UPDATE public.transactions SET archived = true WHERE id = '${THEIR_ROW}';
               UPDATE public.accounts SET archive_through_date = '2025-01-01'
                WHERE id = '${SOMEONE_ELSES_ACCOUNT}';`,
  }),
  command: {
    verb: 'unarchive_account',
    payload: { account_id: SOMEONE_ELSES_ACCOUNT, user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { unarchived: 0 },

  state: [
    storedFlag(THEIR_ROW, 'archived', 'yes'),
    accountText(SOMEONE_ELSES_ACCOUNT, 'archive_through_date', '2025-01-01'),
    auditShape('NONE'),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
  ],
};
