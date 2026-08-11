import {
  USER, EVERYDAY, RAINY_DAY, OUTGOINGS, WEEKLY_SHOP,
  TO_FROM_EVERYDAY, TO_FROM_RAINY_DAY, OPENED_SECOND,
  setups, secondUser, strangersRow, namedTransferCategories, pinnedReadTimes, pinnedLedgerTimes,
  listedAccount, listedCategory, listedTransaction,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

const TRANSFER_ROOT = 'c0000000-0000-0000-0000-000000000001';

export default {
  invariant: 'BOOT-7',
  title: 'a file holding two logins boots one of them: the owner is passed to every read, not to five of six',
  design: 'every cloud read is .eq(\'user_id\', userId) with RLS underneath it. A file has neither — the owner in the payload is the whole gate — and the composite is the one verb that has to apply it SIX times. A second login\'s rows are a real local state: a backup restored from an account that had two, or the harness\'s own',
  consequence: 'the composite is where this goes wrong quietly. Five reads scoped and one not gives a boot that mostly looks right: a stranger\'s account in the sidebar and their money in net worth, or a stranger\'s categories in the register\'s picker. Each read has its own scoping spec; none of them can prove the composite passed the owner along',
  parity: 'match',

  setup: setups(
    secondUser,
    strangersRow,
    namedTransferCategories,
    pinnedReadTimes,
    pinnedLedgerTimes,
  ),
  command: { verb: 'load_boot', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    // The stranger's account is in the file and not in this list.
    accounts: [
      listedAccount({ id: EVERYDAY, name: 'Everyday', type: 'checking', balance: '-25.00' }),
      listedAccount({
        id: RAINY_DAY, name: 'Rainy day', type: 'savings', balance: '0.00',
        created_at: OPENED_SECOND, updated_at: OPENED_SECOND,
      }),
    ],
    // So is the To/From category C-3's trigger minted for it — which is why the
    // categories are spelled out rather than counted: an unscoped read would add
    // a sixth row here, and its timestamps are not pinned because it is not this
    // login's to pin.
    categories: [
      listedCategory({
        id: TO_FROM_EVERYDAY, name: 'To/From Everyday', type: 'both',
        parent_id: TRANSFER_ROOT, account_id: EVERYDAY, is_transfer_category: true,
      }),
      listedCategory({
        id: TO_FROM_RAINY_DAY, name: 'To/From Rainy day', type: 'both',
        parent_id: TRANSFER_ROOT, account_id: RAINY_DAY, is_transfer_category: true,
      }),
      listedCategory({ id: WEEKLY_SHOP, name: 'Weekly shop', level: 'sub', parent_id: OUTGOINGS }),
      listedCategory({ id: OUTGOINGS, name: 'Outgoings', level: 'type' }),
      listedCategory({ id: TRANSFER_ROOT, name: 'Transfer', type: 'both', level: 'type' }),
    ],
    // And their transaction: same date as this login's, so an unscoped read
    // would interleave it rather than append it.
    transactions: [listedTransaction({ category: WEEKLY_SHOP })],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
