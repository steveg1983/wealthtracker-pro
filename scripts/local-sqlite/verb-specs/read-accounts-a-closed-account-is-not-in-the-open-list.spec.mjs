import {
  USER, EVERYDAY, RAINY_DAY,
  setups, closedRainyDay, pinnedReadTimes, listedAccount, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-2',
  title: 'closing an account takes it out of this answer and leaves its money exactly where it was',
  design: 'dataPort.ts: "Closed accounts are excluded from listAccounts and read on demand." The cloud does it with .eq(\'is_active\', true); closing is a SOFT close in every implementation, because a deleted account is a hole in a ledger',
  consequence: 'if a closed account stayed in this list it would keep appearing in every picker, every total and every transfer target — which is the whole of what closing an account is for',
  parity: 'match',

  setup: setups(closedRainyDay, pinnedReadTimes),
  command: { verb: 'list_accounts', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    accounts: [
      listedAccount({ id: EVERYDAY, name: 'Everyday', type: 'checking', balance: '-25.00' }),
    ],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
