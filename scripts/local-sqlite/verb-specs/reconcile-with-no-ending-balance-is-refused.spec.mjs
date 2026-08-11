import { USER, EVERYDAY, MARKED_ROW, everyStateOfCommitment, storedTriFlag,
  accountText, accountMoney, auditShape, balanceIdentityHolds } from './_shared.mjs';

// The ending balance is the whole point of finishing, and a NULL one would
// record "reconciled against nothing". Refused FIRST, before the account is even
// looked up, so a finalize that cannot say what it settled against changes
// nothing at all — no row committed, no date stamped, no audit entry.
export default {
  invariant: 'A-2',
  title: 'finalizing against no figure at all is refused, and changes nothing',
  design: 'finalize_reconciliation 20260810200000:226-230',
  consequence: 'an account records a reconciliation nobody can check, and the next one opens at nothing',
  parity: 'match',

  setup: everyStateOfCommitment,
  command: {
    verb: 'finalize_reconciliation',
    payload: { account_id: EVERYDAY, reconciled_on: '2024-03-31', user_id: USER },
  },
  expect: { outcome: 'refused', error: 'ending_balance_required' },

  state: [
    storedTriFlag(MARKED_ROW, 'is_reconciled', 'no'),
    accountText(EVERYDAY, 'last_reconciled_date', 'NULL'),
    accountMoney(EVERYDAY, 'last_reconciled_balance', 'NULL'),
    auditShape('NONE'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
