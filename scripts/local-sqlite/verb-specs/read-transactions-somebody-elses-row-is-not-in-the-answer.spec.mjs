import {
  USER, EVERYDAY, SOMEONE_ELSES_ACCOUNT, WEEKLY_SHOP,
  setups, secondUser, strangersRow, pinnedLedgerTimes, listedTransaction,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-8',
  title: 'a second login\'s rows are in the file and not in the answer',
  design: 'the cloud narrows this twice — .eq(\'user_id\', userId) in the query and RLS underneath it. A file has neither underneath, so the owner in the payload is the WHOLE gate, which is why every read verb takes a required String rather than an Option',
  consequence: 'a file really can hold two logins\' rows — a backup restored from an account that had two, or this harness\'s own second user — and a read that left the owner off would put a stranger\'s spending in this login\'s register and this login\'s totals',
  parity: 'match',

  setup: setups(secondUser, strangersRow, pinnedLedgerTimes),
  command: { verb: 'list_transactions', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    transactions: [listedTransaction({ category: WEEKLY_SHOP })],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
    auditRowsInTotal('0'),
  ],
};
