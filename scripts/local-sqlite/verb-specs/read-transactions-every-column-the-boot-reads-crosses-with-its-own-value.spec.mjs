import {
  USER, EVERYDAY, RAINY_DAY, WEEKLY_SHOP,
  setups, everyColumnTheBootReads, pinnedLedgerTimes, listedTransaction,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-9',
  title: 'the twenty-two columns the boot asks for come back, money as a decimal string and tags as an array',
  design: 'BOOT_TRANSACTION_COLUMNS is an EXPLICIT list, not select(\'*\'): the wide table is 32 columns, PostgREST sends a key for every one even when null, and across 51k rows ~38% of the payload was columns nothing reads. What a read projects is what the cloud\'s own query projects, so the port carries that list and not the table',
  consequence: 'a column dropped here is a field silently undefined in app state — the transactionService comment says exactly that. The one this fixture exists for is the DEFAULT: on a bare row needs_review, statement_sequence and category_confirmed are all at their defaults, and a default is the one value that cannot tell a working mapping from a missing one',
  parity: 'match',

  // ONE tag: this spec is about the columns being CARRIED. Whether two of them
  // come back in the same order is a different question with a different answer
  // on each engine, and it has its own spec.
  setup: setups(everyColumnTheBootReads, pinnedLedgerTimes),
  command: { verb: 'list_transactions', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    transactions: [
      listedTransaction({
        category: WEEKLY_SHOP,
        category_id: WEEKLY_SHOP,
        category_confirmed: false,
        needs_review: true,
        notes: 'a note',
        is_cleared: true,
        is_recurring: true,
        statement_sequence: 7,
        transfer_account_id: RAINY_DAY,
        tags: ['zebra'],
      }),
    ],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
