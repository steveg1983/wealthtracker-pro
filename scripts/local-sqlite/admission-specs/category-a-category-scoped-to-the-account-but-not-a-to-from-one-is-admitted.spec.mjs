// All THREE conditions are required. C-11 forbids this shape in the file — a
// non-transfer category has no account_id — but the rule still has to answer
// for a row that reaches it, and the answer is that this is not the refusal.
import { category } from './_shared.mjs';

export default {
  invariant: 'TS-I8',
  title: 'the account matching is not enough on its own; the category must BE a To/From one',
  design: 'src/utils/transferMatch.ts:91-93 — three conditions, all of them',
  consequence: 'a rule that refused on the account alone would block every category the user '
    + 'had scoped to that account for any other reason',
  parity: 'match',

  command: {
    verb: 'plan_category_admission',
    payload: {
      categories: [category({ id: 'odd', is_transfer_category: false, account_id: 'current' })],
      category_id: 'odd',
      account_id: 'current',
    },
  },

  expect: { outcome: 'ok' },
  result: { admitted: true, refusal: null },
};
