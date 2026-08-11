import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, WEEKLY_SHOP,
  LEG_LINE, PLAIN_LINE, LEG_COUNTERPART, TO_FROM_RAINY_DAY,
  setups, namedTransferCategories, splitWithTransferLeg, pinnedLedgerTimes, listedSplit,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-11',
  title: 'a line that is half of a transfer answers with the account it points at and the row it is paired with',
  design: '20260720120000 added transfer_account_id and linked_transfer_id to transaction_splits, so select(\'*\') carries them. A line with a target and no link is an UNMATCHED leg — the other side exists somewhere and nobody has recognised it — and a line with both is a movement of money that has already happened twice',
  consequence: 'these two columns are how the app draws a split line as a transfer rather than as spending, and how the matching sweep knows which legs are still looking for a partner. A reader that dropped them would turn every transfer leg in every split into an ordinary expense on screen, in the right amount and against the wrong story',
  parity: 'match',

  // namedTransferCategories first, so the To/From category the leg is filed
  // under has an id a spec can name: both engines mint it from a trigger with a
  // generated one, and no spec may assume it.
  setup: setups(namedTransferCategories, splitWithTransferLeg, pinnedLedgerTimes),
  command: { verb: 'list_transaction_splits', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    transaction_splits: [
      listedSplit({
        id: LEG_LINE, transaction_id: CORNER_SHOP,
        category: TO_FROM_RAINY_DAY, amount: '-15.00', sort_order: 0,
        transfer_account_id: RAINY_DAY, linked_transfer_id: LEG_COUNTERPART,
      }),
      listedSplit({
        id: PLAIN_LINE, transaction_id: CORNER_SHOP,
        category: WEEKLY_SHOP, amount: '-10.00', sort_order: 1,
      }),
    ],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
