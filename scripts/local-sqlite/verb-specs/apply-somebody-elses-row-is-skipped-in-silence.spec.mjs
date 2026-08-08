import { USER, WEEKLY_SHOP, THEIR_ROW, everyShapeOfFiling, secondUser, strangersRow,
  setups, storedText, storedFlag, auditShape,
  balanceIdentityHolds, SOMEONE_ELSES_ACCOUNT } from './_shared.mjs';

// X-6, and note the SHAPE of the refusal: there is not one. The owner guard is
// part of the cursor's WHERE clause, so a foreign row is simply not selected —
// no error, no count, no audit row. That is right for a bulk verb, and it is a
// different answer from every single-row verb in this crate, all of which refuse
// `transaction_not_found`.
export default {
  invariant: 'X-6',
  title: 'a row belonging to somebody else is not filed and not mentioned',
  design: 'apply_category_to_uncategorized 20260808100000:404 — (p_user_id IS NULL OR user_id = p_user_id) inside the cursor',
  consequence: 'a mis-routed owner id files another login\'s uncategorised history in bulk',
  parity: 'match',

  setup: setups(everyShapeOfFiling, secondUser, strangersRow),
  command: {
    verb: 'apply_category_to_uncategorized',
    payload: { ids: [THEIR_ROW], category: WEEKLY_SHOP, user_id: USER },
  },
  expect: { outcome: 'ok' },

  state: [
    storedText(THEIR_ROW, 'category', 'NULL'),
    storedFlag(THEIR_ROW, 'category_confirmed', 'no'),
    auditShape('NONE'),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
  ],
};
