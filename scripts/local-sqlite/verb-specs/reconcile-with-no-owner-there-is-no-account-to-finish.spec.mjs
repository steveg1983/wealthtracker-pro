import { EVERYDAY, MARKED_ROW, everyStateOfCommitment, storedTriFlag,
  accountText, auditShape, balanceIdentityHolds } from './_shared.mjs';

// THE ONE VERB IN THIS CRATE WHERE AN ABSENT OWNER IS NOT A STAND-DOWN.
//
// Everywhere else `p_user_id IS NULL` means "name no owner" — defence in depth
// on top of RLS, deliberately optional. `finalize_reconciliation`'s first
// argument has no default and its lookup is a plain equality, so a NULL owner
// matches no account and the call is refused. Ported as the SQL behaves rather
// than as the family reads: a port that let an absent owner through here would
// finalize an account belonging to whoever the id happened to name.
export default {
  invariant: 'X-6',
  title: 'with no owner named there is no account to finish, and it is refused',
  design: 'finalize_reconciliation 20260810200000:209-238 — p_user_id has no DEFAULT and the lookup is an equality',
  consequence: 'a call that forgot to say whose ledger it is finishes somebody\'s reconciliation anyway',
  parity: 'match',

  setup: everyStateOfCommitment,
  command: {
    verb: 'finalize_reconciliation',
    payload: { account_id: EVERYDAY, ending_balance: '-28.00' },
  },
  expect: { outcome: 'refused', error: 'account_not_found_or_not_owned' },

  state: [
    storedTriFlag(MARKED_ROW, 'is_reconciled', 'no'),
    accountText(EVERYDAY, 'last_reconciled_date', 'NULL'),
    auditShape('NONE'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
