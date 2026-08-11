import { USER, EVERYDAY, COMMITTED_ROW, everyStateOfCommitment,
  storedFlag, storedTriFlag, auditRowsForUpdate, balanceIdentityHolds } from './_shared.mjs';

// The other half of the CASE, and the reason it is a CASE. `is_reconciled`
// IMPLIES `is_cleared`: a row that is not ticked cannot be a row a statement was
// balanced against, and the pair (committed, unmarked) would put the cleared
// balance and the reconciled set permanently out of step.
//
// The local file makes that a CHECK as well
// (`transactions_reconciled_implies_cleared`), so this call has to write both
// columns in ONE statement — which it does, and which is why the constraint does
// not fire here. A port that unticked first and cleared the commitment second
// would be refused by its own file, and this spec is what would say so.
export default {
  invariant: 'A-1',
  title: 'unmarking takes any commitment with it',
  design: 'set_transactions_cleared 20260810200000:130-136 and :166-169 — the ELSE branch',
  consequence: 'a row stays committed while un-ticked, so the cleared balance and the reconciled set drift apart for good',
  parity: 'match',

  setup: everyStateOfCommitment,
  command: { verb: 'set_transactions_cleared', payload: { ids: [COMMITTED_ROW], cleared: false, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(COMMITTED_ROW, 'is_cleared', 'no'),
    storedTriFlag(COMMITTED_ROW, 'is_reconciled', 'no'),
    auditRowsForUpdate(COMMITTED_ROW, '1'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
