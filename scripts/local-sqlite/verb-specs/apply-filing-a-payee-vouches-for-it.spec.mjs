import { USER, WEEKLY_SHOP, BLANK_ROW, everyShapeOfFiling,
  storedFlag, filingBoard, auditRowsForUpdate } from './_shared.mjs';

// The ONE thing 20260808100000 changed about this function, and its reasoning is
// worth keeping: "Every caller of this is the user filing a payee they have just
// chosen a category for, and payee memory spreading that choice to the identical
// rows IS the choice". Marking those rows as suggestions would hand back, as a
// list to re-check, the exact rows he asked to be dealt with.
//
// Contrast with the row that was ALREADY a suggestion: this verb does not touch
// it, because it is not blank. Confirming that one is a different verb.
export default {
  invariant: 'TS-M3',
  title: 'a bulk filing is a decision, not a suggestion',
  design: 'apply_category_to_uncategorized 20260808100000:377-386 and :408-411 — category_confirmed = true',
  consequence: 'the bulk tool hands its own output back as a review list and becomes slower than filing rows one at a time',
  parity: 'match',

  setup: everyShapeOfFiling,
  command: {
    verb: 'apply_category_to_uncategorized',
    payload: { ids: [BLANK_ROW], category: WEEKLY_SHOP, user_id: USER },
  },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(BLANK_ROW, 'category_confirmed', 'yes'),
    // The row that was ALREADY a suggestion is in the board, not in a second
    // storedFlag: that helper names itself after the column, so two of them
    // would be one assertion. The harness refuses a duplicate state name for
    // exactly this reason.
    filingBoard('Blank=Weekly shop/vouched | Null=NULL/guess | Spaces=EMPTY/guess | Filed=Weekly shop/vouched | Guessed=Weekly shop/guess'),
    auditRowsForUpdate(BLANK_ROW, '1'),
  ],
};
