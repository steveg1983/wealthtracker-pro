import {
  USER, EVERYDAY, WEEKLY_SHOP,
  setups, namedTransferCategories, anArchivedRow, pinnedReadTimes, pinnedLedgerTimes,
  listedTransaction, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'BOOT-4',
  title: 'the boot carries an archived row like any other, with its flag set',
  design: '20260721130000_soft_archive.sql: "A transaction is archived purely as a VIEW flag. It stays in the transactions table." The boot query filters on user_id and nothing else, and the composite is that query — so the archive has no third place to be filtered in',
  consequence: 'R-1, arriving through the door the composite opens. The client sums the list the boot gave it; account_balances counts archived rows on purpose. A composite that hid them would put two figures on one dashboard that disagree by however much history was archived, with nothing on screen to explain it — and it would do it while the read it was built from still answered correctly, so the read\'s own spec would stay green',
  parity: 'match',

  // Named and pinned throughout: a boot spec compares all six lists, so the
  // categories, the accounts and the ledger all have to be comparable even
  // though this one is about a single flag.
  setup: setups(namedTransferCategories, anArchivedRow, pinnedReadTimes, pinnedLedgerTimes),
  command: { verb: 'load_boot', payload: { user_id: USER } },
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
