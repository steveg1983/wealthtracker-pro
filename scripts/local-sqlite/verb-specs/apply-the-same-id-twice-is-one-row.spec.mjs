import { USER, WEEKLY_SHOP, BLANK_ROW, everyShapeOfFiling, filingBoard,
  auditRowsInTotal } from './_shared.mjs';

// `id = ANY(p_ids)` matches a row ONCE however many times its id appears. The
// local port reaches the same answer through a set of the named ids, which also
// fixes the order — and the order matters locally in a way it does not in the
// cloud, because the audit chain is dense and hashed.
//
// A port that iterated the raw list would write two audit rows for one change,
// and the second would carry a `before` identical to its `after`.
export default {
  invariant: 'U-1',
  title: 'a repeated id fills one row and writes one audit entry',
  design: 'apply_category_to_uncategorized 20260808100000:403 — id = ANY(p_ids)',
  consequence: 'the log gains an entry recording a change that did not happen, and the returned count is a fiction',
  parity: 'match',

  setup: everyShapeOfFiling,
  command: {
    verb: 'apply_category_to_uncategorized',
    payload: { ids: [BLANK_ROW, BLANK_ROW], category: WEEKLY_SHOP, user_id: USER },
  },
  expect: { outcome: 'ok' },

  state: [
    filingBoard('Blank=Weekly shop/vouched | Null=NULL/guess | Spaces=EMPTY/guess | Filed=Weekly shop/vouched | Guessed=Weekly shop/guess'),
    auditRowsInTotal('1'),
  ],
};
