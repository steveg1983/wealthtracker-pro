import { USER, BLANK_ROW, everyShapeOfFiling, storedText, storedFlag,
  auditRowsForUpdate } from './_shared.mjs';

// The oddest measured behaviour of the three verbs, and it is real: filing a
// blank row under an EMPTY category leaves it blank and marks it VOUCHED FOR.
// The row is still uncategorised and now claims a human agreed with that.
//
// Reproduced rather than corrected, for the reason clear_transfer_links states
// about reciprocals: a local edition that refused this would disagree with the
// cloud about what a call did. It is written down here so that if it is ever
// fixed, it is fixed in a migration and both editions move together.
export default {
  invariant: 'TS-M3',
  title: 'filing a row under nothing still records that somebody vouched for it',
  design: 'apply_category_to_uncategorized 20260808100000:408-411 — SET category = p_category, category_confirmed = true, unconditionally',
  consequence: 'a local port "fixes" this quietly and the two editions disagree about which rows are still guesses',
  parity: 'match',

  setup: everyShapeOfFiling,
  command: { verb: 'apply_category_to_uncategorized', payload: { ids: [BLANK_ROW], category: '', user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedText(BLANK_ROW, 'category', 'EMPTY'),
    storedFlag(BLANK_ROW, 'category_confirmed', 'yes'),
    auditRowsForUpdate(BLANK_ROW, '1'),
  ],
};
