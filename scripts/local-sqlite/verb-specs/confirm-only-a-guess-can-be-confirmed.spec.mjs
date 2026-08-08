import { USER, BLANK_ROW, NULL_ROW, SPACES_ROW, FILED_ROW, GUESSED_ROW, EVERYDAY,
  everyShapeOfFiling, filingBoard, auditShape, auditRowsInTotal,
  balanceOf, balanceIdentityHolds } from './_shared.mjs';

// Every state the WHERE clause tells apart, in one call. Three blanks (nothing
// to vouch for), one row already vouched for (re-confirming is free), and one
// genuine suggestion — which is the only row that moves.
//
// The count is "the number of decisions actually recorded", not the number of
// ids sent, and that is what makes re-confirming free rather than a second audit
// entry per row.
export default {
  invariant: 'TS-M3',
  title: 'five rows named, one decision recorded',
  design: 'confirm_transaction_categories 20260808100000:453-461 — category_confirmed = false AND a non-blank category',
  consequence: 'confirming a screenful re-writes every row on it and the log fills with entries recording nothing',
  parity: 'match',

  setup: everyShapeOfFiling,
  command: {
    verb: 'confirm_transaction_categories',
    payload: { ids: [BLANK_ROW, NULL_ROW, SPACES_ROW, FILED_ROW, GUESSED_ROW], user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { id: BLANK_ROW, category_confirmed: false },

  state: [
    filingBoard('Blank=EMPTY/guess | Null=NULL/guess | Spaces=EMPTY/guess | Filed=Weekly shop/vouched | Guessed=Weekly shop/vouched'),
    auditShape('transaction/update'),
    auditRowsInTotal('1'),
    balanceOf(EVERYDAY, '-30.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
