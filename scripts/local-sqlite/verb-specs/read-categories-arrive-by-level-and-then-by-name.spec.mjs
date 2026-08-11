import {
  USER, EVERYDAY, RAINY_DAY, OUTGOINGS, WEEKLY_SHOP,
  TO_FROM_EVERYDAY, TO_FROM_RAINY_DAY,
  setups, namedTransferCategories, pinnedReadTimes, listedCategory, auditRowsInTotal,
} from './_shared.mjs';

const TRANSFER_ROOT = 'c0000000-0000-0000-0000-000000000001';

export default {
  invariant: 'READ-1',
  title: 'the categories come back by level and then by name — which is alphabetical, not hierarchical',
  design: 'planningService.ensureCategories: .select(\'*\').eq(\'user_id\', …).order(\'level\').order(\'name\'). NOT dataService.listCategories, which reads browser storage: a signed-in boot\'s category list comes from this query. `level` is a text column, so ascending means detail, sub, type',
  consequence: 'this is the list the register\'s category column and every picker resolve an id through, so a port that dropped a row — or invented a hierarchical order the app has never received — changes what a filed transaction looks like on screen',
  parity: 'match',

  setup: setups(namedTransferCategories, pinnedReadTimes),
  command: { verb: 'list_categories', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    categories: [
      // detail, by name: the two To/From categories C-3's trigger minted.
      listedCategory({
        id: TO_FROM_EVERYDAY, name: 'To/From Everyday', type: 'both',
        parent_id: TRANSFER_ROOT, account_id: EVERYDAY, is_transfer_category: true,
      }),
      listedCategory({
        id: TO_FROM_RAINY_DAY, name: 'To/From Rainy day', type: 'both',
        parent_id: TRANSFER_ROOT, account_id: RAINY_DAY, is_transfer_category: true,
      }),
      // sub
      listedCategory({ id: WEEKLY_SHOP, name: 'Weekly shop', level: 'sub', parent_id: OUTGOINGS }),
      // type, by name
      listedCategory({ id: OUTGOINGS, name: 'Outgoings', level: 'type' }),
      listedCategory({ id: TRANSFER_ROOT, name: 'Transfer', type: 'both', level: 'type' }),
    ],
  },
  state: [auditRowsInTotal('0')],
};
