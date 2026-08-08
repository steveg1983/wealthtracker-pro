import {
  USER, EVERYDAY, CORNER_SHOP, WEEKLY_SHOP,
  enriched, balanceIdentityHolds, storedFlag,
} from './_shared.mjs';

// The three-way CASE, branch 3 — and the reason branch 2 tests the VALUE rather
// than the key.
//
//     WHEN p ? 'category' AND (p->>'category') IS DISTINCT FROM category
//       THEN true
//
// A form that posts every field on save sends the category back unchanged on
// every edit. If the branch fired on the key alone, the first time a user fixed
// a typo in a payee name the app's own guess would be promoted to a human
// decision — silently, and for every suggested row in the file.
//
// MEASURED on the reference cluster: category unchanged, category_confirmed
// stays false.
//
// So a spec exists for the case where nothing should happen, because "nothing
// happened" is not observable anywhere else and this is a rule whose whole
// value is in what it declines to do.
export default {
  invariant: 'TS-M3',
  title: 'sending the category back unchanged does not turn a guess into a decision',
  design: 'update_transaction_atomic 20260808100000:315-317 — the condition is IS DISTINCT FROM, not the key being present',
  consequence: "a form that posts every field would confirm every suggested category the first time the user touched anything on the row, and the app would stop being able to show what it guessed",
  parity: 'match',

  setup: enriched,

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: { category: WEEKLY_SHOP, description: 'Corner shop, tidied' },
    },
  },

  expect: { outcome: 'ok' },
  result: {
    category: WEEKLY_SHOP,
    description: 'Corner shop, tidied',
    category_confirmed: false,
  },

  state: [
    storedFlag(CORNER_SHOP, 'category_confirmed', 'no'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
