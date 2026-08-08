import {
  EVERYDAY, TO_FROM_EVERYDAY, namedTransferCategories, prunablePair,
  balanceIdentityHolds, categoryPresent, transferCategoryCount,
} from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'an account\'s To/From category is skipped before C-5 ever hears about it',
  design: '20260713100000:335, `c.is_transfer_category IS NOT TRUE`, and C-5\'s protect trigger behind it (20260708140000:127-146)',
  consequence: 'losing an account\'s To/From category takes the transfer bookkeeping for that account with it — the category every transfer verb resolves through is simply gone, and verify_integrity reports the account as unable to transfer at all',
  parity: 'match',

  // The interesting half is that C-5 is never consulted: the WHERE clause
  // filters the row out before any DELETE is attempted, so the trigger stands
  // down by not being reached. The spec that reaches it is the one where the
  // To/From row arrives through a CASCADE instead.
  setup: { sqlite: `${prunablePair.sqlite}\n${namedTransferCategories.sqlite}`,
           postgres: `${prunablePair.postgres}\n${namedTransferCategories.postgres}` },
  command: { verb: 'delete_unused_categories', payload: { ids: [TO_FROM_EVERYDAY], user_id: null } },
  expect: { outcome: 'ok' },
  result: { deleted: 0 },
  state: [
    categoryPresent(TO_FROM_EVERYDAY, 'HERE'),
    transferCategoryCount('2'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
