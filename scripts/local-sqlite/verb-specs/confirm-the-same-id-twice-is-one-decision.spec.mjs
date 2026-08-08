import { USER, GUESSED_ROW, everyShapeOfFiling, storedFlag, auditRowsInTotal } from './_shared.mjs';

// `id = ANY(p_ids)` again, and it matters more here than for its sibling: the
// count this verb returns is shown to the user as "N confirmed", so a repeated
// id inflating it would be a number the screen contradicts.
export default {
  invariant: 'U-1',
  title: 'a repeated id is one confirmation and one audit entry',
  design: 'confirm_transaction_categories 20260808100000:455 — id = ANY(p_ids)',
  consequence: 'the toast reports more decisions than were made, and the log agrees with it',
  parity: 'match',

  setup: everyShapeOfFiling,
  command: { verb: 'confirm_transaction_categories', payload: { ids: [GUESSED_ROW, GUESSED_ROW], user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(GUESSED_ROW, 'category_confirmed', 'yes'),
    auditRowsInTotal('1'),
  ],
};
