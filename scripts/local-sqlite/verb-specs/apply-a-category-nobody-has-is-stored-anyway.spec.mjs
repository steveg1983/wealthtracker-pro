import { USER, BLANK_ROW, everyShapeOfFiling, storedText, storedFlag,
  auditRowsForUpdate } from './_shared.mjs';

// MEASURED, and it surprises people: `p_category` is written VERBATIM with no
// validation of any kind. Not a foreign key, not an EXISTS, not even a uuid cast
// — the parameter is `text`.
//
// That is not sloppiness, it is R-3: `transactions.category` is TEXT with no
// foreign key precisely so the legacy sentinels 'transfer-in' and 'transfer-out'
// keep resolving, and a validating port would refuse to file rows the cloud
// files. The spec exists so the absence is a recorded decision rather than a gap
// somebody "fixes" later.
export default {
  invariant: 'R-3',
  title: 'the category is stored as given, whether or not it names anything',
  design: 'apply_category_to_uncategorized 20260808100000:387-390 — p_category text, and no check anywhere in the body',
  consequence: 'a port validates the category, and every transfer sentinel in the file becomes unfileable',
  parity: 'match',

  setup: everyShapeOfFiling,
  command: {
    verb: 'apply_category_to_uncategorized',
    payload: { ids: [BLANK_ROW], category: 'c0000000-0000-0000-0000-0000000000ff', user_id: USER },
  },
  expect: { outcome: 'ok' },

  state: [
    storedText(BLANK_ROW, 'category', 'c0000000-0000-0000-0000-0000000000ff'),
    storedFlag(BLANK_ROW, 'category_confirmed', 'yes'),
    auditRowsForUpdate(BLANK_ROW, '1'),
  ],
};
