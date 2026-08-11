import { EMPTY_LOGIN, emptyLogin, categoriesOwnedBy } from './_shared.mjs';

// The RPC's own refusal, by name, and it is reachable only when the file is
// empty — which is the one state either engine looks at the payload in.
export default {
  invariant: 'B-4',
  title: 'seeding a file with an empty set is refused rather than leaving it with nowhere to file anything',
  design: 'migrate_categories_atomic (20260724100000:67-70): `categories_payload_empty`, ERRCODE P0004',
  consequence: 'answering "fine" to a seed that seeded nothing would leave a new file with no categories and no second chance — the gate only opens once, because the next boot finds rows',
  parity: 'match',

  setup: emptyLogin,

  command: {
    verb: 'seed_categories',
    payload: { user_id: EMPTY_LOGIN, categories: [] },
  },

  expect: { outcome: 'refused', error: 'categories_payload_empty' },

  state: [categoriesOwnedBy(EMPTY_LOGIN, '0')],
};
