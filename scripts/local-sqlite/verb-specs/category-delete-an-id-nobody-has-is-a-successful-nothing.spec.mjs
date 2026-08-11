import { USER, balanceIdentityHolds, categoriesOwnedBy } from './_shared.mjs';

// The delete has no `.single()`, so a request that matched no row is a request
// that did nothing. The UPDATE beside it does have one and refuses. Two ports of
// two queries, and the difference is that one word.
export default {
  invariant: 'C-13',
  title: 'deleting a category that is not there is accepted, not refused',
  design: 'planningService.deleteCategory sends `.delete().eq().eq()` with no `.single()`; DataServiceImpl’s local branch writes the list back unchanged',
  consequence: 'the Categories page deletes from a list it read a moment ago; a second click, or a row another tab already removed, must not be an error message',
  parity: 'match',

  command: {
    verb: 'delete_category',
    payload: { id: 'c0000000-0000-0000-0000-0000000000ff', user_id: USER },
  },

  expect: { outcome: 'ok' },

  result: { deleted: 0 },

  state: [
    categoriesOwnedBy(USER, '5'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
