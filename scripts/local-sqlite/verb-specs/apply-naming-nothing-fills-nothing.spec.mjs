import { USER, WEEKLY_SHOP, everyShapeOfFiling, filingBoard, auditShape } from './_shared.mjs';

// `id = ANY('{}')` matches nothing, so an empty list is a zero with no writes —
// and the local verb returns before opening a transaction at all, which is the
// same observable outcome reached one step earlier. A NULL list is the same
// thing on both engines, because array_length(NULL, 1) and array_length('{}', 1)
// are both NULL.
export default {
  invariant: 'TS-M3',
  title: 'an empty list of rows is a zero, not an error',
  design: 'apply_category_to_uncategorized 20260808100000:401-406 — the loop simply does not run',
  consequence: 'a bulk tool with nothing selected raises an error the user has to dismiss',
  parity: 'match',

  setup: everyShapeOfFiling,
  command: { verb: 'apply_category_to_uncategorized', payload: { ids: [], category: WEEKLY_SHOP, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    filingBoard('Blank=EMPTY/guess | Null=NULL/guess | Spaces=EMPTY/guess | Filed=Weekly shop/vouched | Guessed=Weekly shop/guess'),
    auditShape('NONE'),
  ],
};
