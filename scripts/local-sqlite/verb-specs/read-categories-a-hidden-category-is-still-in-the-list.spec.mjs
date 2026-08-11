import {
  USER, EVERYDAY, RAINY_DAY, OUTGOINGS, WEEKLY_SHOP,
  TO_FROM_EVERYDAY, TO_FROM_RAINY_DAY,
  setups, namedTransferCategories, closedRainyDay, pinnedReadTimes, listedCategory, auditRowsInTotal,
} from './_shared.mjs';

const TRANSFER_ROOT = 'c0000000-0000-0000-0000-000000000001';

export default {
  invariant: 'READ-6',
  title: 'closing an account hides its To/From category and does not remove it from this answer',
  design: 'C-4 mirrors an account\'s is_active onto its transfer category, and ensureCategories\' query has NO is_active filter. The pickers filter; the read does not',
  consequence: 'every transaction ever filed under a closed account\'s To/From category resolves through this list. Drop the hidden rows here and a closed account\'s history comes back with a blank category column — the rows are fine, the file is fine, and the register lies about it',
  parity: 'match',

  setup: setups(namedTransferCategories, closedRainyDay, pinnedReadTimes),
  command: { verb: 'list_categories', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    categories: [
      listedCategory({
        id: TO_FROM_EVERYDAY, name: 'To/From Everyday', type: 'both',
        parent_id: TRANSFER_ROOT, account_id: EVERYDAY, is_transfer_category: true,
      }),
      listedCategory({
        id: TO_FROM_RAINY_DAY, name: 'To/From Rainy day', type: 'both',
        parent_id: TRANSFER_ROOT, account_id: RAINY_DAY, is_transfer_category: true,
        // C-4, and the whole point of this spec.
        is_active: false,
      }),
      listedCategory({ id: WEEKLY_SHOP, name: 'Weekly shop', level: 'sub', parent_id: OUTGOINGS }),
      listedCategory({ id: OUTGOINGS, name: 'Outgoings', level: 'type' }),
      listedCategory({ id: TRANSFER_ROOT, name: 'Transfer', type: 'both', level: 'type' }),
    ],
  },
  state: [auditRowsInTotal('0')],
};
