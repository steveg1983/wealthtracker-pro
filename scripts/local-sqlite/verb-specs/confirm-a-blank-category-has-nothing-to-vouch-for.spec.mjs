import { USER, BLANK_ROW, NULL_ROW, SPACES_ROW, everyShapeOfFiling,
  filingBoard, auditShape } from './_shared.mjs';

// The guard the migration put in the database as well as in the app, and said
// why: "Guarded here as well as in the app so a stale client list cannot mark
// empty rows 'checked'."
//
// All three shapes of blank, because `btrim(category) <> ''` is the test and a
// port that only checked `IS NOT NULL` would mark the whitespace row as
// reviewed — quietly removing it from the review band with no category on it.
export default {
  invariant: 'TS-M3',
  title: 'a row with nothing filed cannot be marked as checked',
  design: 'confirm_transaction_categories 20260808100000:458-460 — category IS NOT NULL AND btrim(category) <> \'\'',
  consequence: 'uncategorised rows vanish from the review band still uncategorised, and nothing ever brings them back',
  parity: 'match',

  setup: everyShapeOfFiling,
  command: { verb: 'confirm_transaction_categories', payload: { ids: [BLANK_ROW, NULL_ROW, SPACES_ROW], user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    filingBoard('Blank=EMPTY/guess | Null=NULL/guess | Spaces=EMPTY/guess | Filed=Weekly shop/vouched | Guessed=Weekly shop/guess'),
    auditShape('NONE'),
  ],
};
