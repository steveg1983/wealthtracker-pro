import { USER, THEIR_ROW, SOMEONE_ELSES_ACCOUNT, secondUser, strangersRow, setups,
  storedFlag, accountText, balanceIdentityHolds } from './_shared.mjs';

// `account_not_found`, and NOT `account_not_found_or_not_owned`.
//
// Two names for one shape of failure, in one schema: the transaction RPCs and
// `finalize_reconciliation` raise the second, the two archive functions raise
// the first. That is the cloud's inconsistency and the port keeps it, because a
// port that unified them would refuse with a word no cloud caller has ever seen
// — and a caller that branches on a refusal code is branching on the cloud's
// behaviour.
export default {
  invariant: 'X-6',
  title: 'archiving an account that is not yours is refused by the archive\'s own name for it',
  design: 'archive_transactions_before 20260810200000:303-309 — RAISE account_not_found',
  consequence: 'a mis-routed owner id hides another login\'s history from their register',
  parity: 'match',

  setup: setups(secondUser, strangersRow, {
    sqlite: `UPDATE transactions SET is_cleared = 1, is_reconciled = 1 WHERE id = '${THEIR_ROW}';`,
    postgres: `UPDATE public.transactions SET is_cleared = true, is_reconciled = true
                WHERE id = '${THEIR_ROW}';`,
  }),
  command: {
    verb: 'archive_transactions_before',
    payload: { account_id: SOMEONE_ELSES_ACCOUNT, cutoff: '2025-01-01', user_id: USER },
  },
  expect: { outcome: 'refused', error: 'account_not_found' },

  state: [
    storedFlag(THEIR_ROW, 'archived', 'no'),
    accountText(SOMEONE_ELSES_ACCOUNT, 'archive_through_date', 'NULL'),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
  ],
};
