import {
  USER, EVERYDAY, CORNER_SHOP, WEEKLY_SHOP,
  A_LATER_DAY, SAME_DAY_EARLIER, SAME_DAY_LATER,
  setups, rowsOnOneDay, pinnedLedgerTimes, listedTransaction,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-8',
  title: 'the ledger comes back newest first, and rows sharing a day are settled by id',
  design: 'transactionService.fetchTransactionPage: .eq(\'user_id\', …).order(\'date\', { ascending: false }).order(\'id\', { ascending: false }). The second key is the CLOUD\'s own and its comment says why — "stable tiebreak for paging" — so unlike every other read in this crate the tie-break here is ported rather than stated: a fetch spread over ~52 pages of an unstably-ordered query hands the same row over twice and loses another',
  consequence: 'the register draws in the order this answer arrives. Three rows on one day that swapped places between boots would be a page that reshuffles itself for no reason, and a running balance drawn down a column would be arithmetic nobody could check',
  parity: 'match',

  // The ids are chosen so id order and INSERTION order disagree: …f3 is written
  // second and must come out first. They also settle a cross-engine question
  // nothing else here asks — SQLite compares these as 36 characters of
  // lower-case hex and Postgres as sixteen bytes, and the two orders agree only
  // because hex digits sort the same way in ASCII as their nibble values do.
  setup: setups(rowsOnOneDay, pinnedLedgerTimes),
  command: { verb: 'list_transactions', payload: { user_id: USER } },
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
