import {
  EVERYDAY, THEIR_CATEGORY, USER, prunablePair, secondUser, setups, strangersCategory,
  balanceIdentityHolds, categoryPresent,
} from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'with an owner named, another login\'s category is not this call\'s business',
  design: '20260713100000:333, `p_user_id IS NULL OR c.user_id = p_user_id`. In the cloud RLS has already narrowed what the caller can see; the argument is the second lock',
  consequence: 'a local file can hold more than one login — a restored backup, a shared machine — and a prune that reached across them would delete a category out of a tree its owner is still using',
  parity: 'match',

  setup: setups(prunablePair, secondUser, strangersCategory),
  command: { verb: 'delete_unused_categories', payload: { ids: [THEIR_CATEGORY], user_id: USER } },
  expect: { outcome: 'ok' },
  result: { deleted: 0 },
  state: [categoryPresent(THEIR_CATEGORY, 'HERE'), balanceIdentityHolds(EVERYDAY)],
};
