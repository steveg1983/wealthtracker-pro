import {
  USER, EVERYDAY, WEEKLY_SHOP,
  setups, anArchivedRow, pinnedLedgerTimes, listedTransaction,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-10',
  title: 'the archive is a view flag, so an archived row is in this answer with its flag set',
  design: '20260721130000_soft_archive.sql: "A transaction is archived purely as a VIEW flag. It stays in the transactions table." The boot query filters on user_id and NOTHING else — it selects `archived` as a column and the register does its hiding in memory',
  consequence: 'R-1 from the other end. The client sums the list it is given, so a read that filtered the archive would take a user\'s archived history out of every client-side total while account_balances kept it in — two figures on one dashboard, disagreeing by however much history was archived, with nothing on screen to explain it',
  parity: 'match',

  setup: setups(anArchivedRow, pinnedLedgerTimes),
  command: { verb: 'list_transactions', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    transactions: [listedTransaction({ archived: true, category: WEEKLY_SHOP })],
  },
  state: [
    // Archiving moved no money, which is the rule it exists to keep.
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
