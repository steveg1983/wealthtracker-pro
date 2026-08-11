import {
  USER, EVERYDAY, WEEKLY_SHOP,
  A_LATER_DAY, SAME_DAY_EARLIER, SAME_DAY_LATER,
  setups, namedTransferCategories, rowsOnOneDay, pinnedReadTimes, pinnedLedgerTimes,
  listedTransaction, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'BOOT-3',
  title: 'the ledger inside the boot is the ledger the read answers with — newest first, ties settled by id',
  design: 'the composite is built from the reads, so its transactions come back through the same query — .order(\'date\', {ascending: false}).order(\'id\', {ascending: false}), the cloud\'s own "stable tiebreak for paging". R-5 says that proof must not evaporate when the read is composed: an ordering asserted only where it is DEFINED is an ordering nothing checks at the one place the app actually receives it',
  consequence: 'this list IS the register on the first paint. A composite that sorted its own answer — for a join, for a grouping, for a de-duplication somebody thought was tidy — would draw the ledger in an order no read ever produces, and the running balance down the column would be arithmetic nobody could check. The same three rows are asserted through list_transactions; if only that spec existed, the composite could reverse them and stay green',
  parity: 'match',

  // The same fixture the read's own ordering spec uses: one row on a later day
  // and two on the Corner shop's, with ids chosen so id order and INSERTION
  // order disagree — …f3 is written second and must come out first.
  //
  // Everything else is pinned and named because a boot spec compares all six
  // lists (see the reads' fixture block): `rowsOnOneDay` moves the Everyday
  // balance, which stamps the account, so the account pin goes after it.
  setup: setups(namedTransferCategories, rowsOnOneDay, pinnedReadTimes, pinnedLedgerTimes),
  command: { verb: 'load_boot', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    transactions: [
      listedTransaction({
        id: A_LATER_DAY, description: 'A later day', amount: '-1.00',
        date: '2024-03-02', category: null,
      }),
      listedTransaction({
        id: SAME_DAY_LATER, description: 'Second in', amount: '-1.00', category: null,
      }),
      listedTransaction({
        id: SAME_DAY_EARLIER, description: 'First in', amount: '-1.00', category: null,
      }),
      listedTransaction({ category: WEEKLY_SHOP }),
    ],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
