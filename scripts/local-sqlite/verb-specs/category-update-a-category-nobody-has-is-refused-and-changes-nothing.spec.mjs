import { USER, balanceIdentityHolds, categoriesOwnedBy, categoryTree } from './_shared.mjs';

// `.single()` is the whole difference between this verb and the delete: it
// raises when the update matches nothing, and the delete has no such clause.
export default {
  invariant: 'D-7',
  title: 'updating a category that is not there is refused, and the store is untouched',
  design: 'the `.single()` on planningService.updateCategory:578 — PostgREST answers PGRST116 when it matches no row; the verb refuses category_not_found before its first write',
  consequence: 'an id that names nothing is a stale page, and inventing the category to satisfy it would put a name in somebody’s list that they never typed',
  parity: 'match',

  command: {
    verb: 'update_category',
    payload: {
      id: 'c0000000-0000-0000-0000-0000000000ff',
      user_id: USER,
      patch: { name: 'Nowhere' },
    },
  },

  // The same outcome under two names, and the names are the two layers each
  // engine refuses IN: a PostgREST contract on one side, the verb's own guard on
  // the other. Stated per engine rather than merged, because a caller that has
  // to tell "gone" from "broken" reads the code.
  expect: {
    sqlite: { outcome: 'refused', error: 'category_not_found' },
    postgres: { outcome: 'refused', error: 'PGRST116' },
  },

  state: [
    categoriesOwnedBy(USER, '5'),
    categoryTree(USER, 'Outgoings:expense:type:-:-:active | To/From Everyday:both:detail:Transfer:t:active | To/From Rainy day:both:detail:Transfer:t:active | Transfer:both:type:-:-:active | Weekly shop:expense:sub:Outgoings:-:active'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
