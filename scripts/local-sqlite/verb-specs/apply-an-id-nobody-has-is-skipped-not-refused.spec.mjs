import { USER, WEEKLY_SHOP, BLANK_ROW, everyShapeOfFiling, filingBoard,
  auditRowsInTotal } from './_shared.mjs';

// The deliberate difference from clear_transfer_links, which refuses the WHOLE
// call when one named id does not resolve. This verb skips it, because its
// argument is not a list of rows the caller is asserting exist — it is a list of
// candidates, computed from a snapshot, and the whole design assumes that
// snapshot is stale.
//
// Same call, one good id and one that resolves to nothing: the good one is
// filed. A port that copied the unlink verb's all-or-nothing rule would make the
// bulk tool fail whenever a row had been deleted on another device.
export default {
  invariant: 'TS-M3',
  title: 'one id that resolves to nothing does not cost the rows that do',
  design: 'apply_category_to_uncategorized 20260808100000:401-406 — a cursor, not an assertion about the list',
  consequence: 'the bulk tool fails whole because one row was deleted elsewhere, and the user cannot tell which',
  parity: 'match',

  setup: everyShapeOfFiling,
  command: {
    verb: 'apply_category_to_uncategorized',
    payload: { ids: [BLANK_ROW, '70000000-0000-0000-0000-0000000000ff'], category: WEEKLY_SHOP, user_id: USER },
  },
  expect: { outcome: 'ok' },

  state: [
    filingBoard('Blank=Weekly shop/vouched | Null=NULL/guess | Spaces=EMPTY/guess | Filed=Weekly shop/vouched | Guessed=Weekly shop/guess'),
    auditRowsInTotal('1'),
  ],
};
