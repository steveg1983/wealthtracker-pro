import { USER, THEIR_ROW, SOMEONE_ELSES_ACCOUNT, secondUser, strangersRow, setups,
  storedTriFlag, storedFlag, accountText, auditShape, balanceIdentityHolds } from './_shared.mjs';

// The account lookup is `id = p_account_id AND user_id = p_user_id`, so another
// login's account is not found rather than found-and-refused — one refusal for
// two cases, which is the cloud's own shape and the reason its message says "or
// not owned".
//
// What makes this spec discriminate rather than pass on any refusal at all: the
// stranger's row is ticked in the setup and asserted UNCOMMITTED afterwards, and
// their account is asserted to have no reconciliation date. A verb that
// committed the working set first and checked ownership second would refuse with
// exactly the right word and still have settled somebody else's statement.
export default {
  invariant: 'X-6',
  title: 'finalizing an account that is not yours is refused, and settles nothing of theirs',
  design: 'finalize_reconciliation 20260810200000:232-238',
  consequence: 'a mis-routed owner id finishes a reconciliation in another login\'s account',
  parity: 'match',

  setup: setups(secondUser, strangersRow, {
    sqlite: `UPDATE transactions SET is_cleared = 1, is_reconciled = 0 WHERE id = '${THEIR_ROW}';`,
    postgres: `UPDATE public.transactions SET is_cleared = true, is_reconciled = false
                WHERE id = '${THEIR_ROW}';`,
  }),
  command: {
    verb: 'finalize_reconciliation',
    payload: { account_id: SOMEONE_ELSES_ACCOUNT, ending_balance: '0', user_id: USER },
  },
  expect: { outcome: 'refused', error: 'account_not_found_or_not_owned' },

  state: [
    storedFlag(THEIR_ROW, 'is_cleared', 'yes'),
    storedTriFlag(THEIR_ROW, 'is_reconciled', 'no'),
    accountText(SOMEONE_ELSES_ACCOUNT, 'last_reconciled_date', 'NULL'),
    auditShape('NONE'),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
  ],
};
