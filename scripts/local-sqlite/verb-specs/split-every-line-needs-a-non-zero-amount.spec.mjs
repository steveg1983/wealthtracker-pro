import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, WEEKLY_SHOP,
  balanceOf, balanceIdentityHolds, splitLines, auditShape, storedFlag,
} from './_shared.mjs';

// REFUSAL 8 of 20 — S-3's second half.
//
// A zero line is not a small line, it is a line that says nothing: it takes up a
// row, a category and a place in the display order while contributing nothing to
// the sum, and the first person to read the split has to work out whether it was
// a mistake or a placeholder. The schema refuses it declaratively too
// (`transaction_splits_amount_nonzero`); the verb refuses it first so that the
// message is the cloud's rather than a constraint name.
//
// The payload also carries a nonsense transfer target on the same line, and the
// AMOUNT is what both engines report — the ordering measurement that puts this
// refusal above the target lookup. Which matters: "that account is not yours" is
// an alarming thing to be told about a line whose real problem is that it is
// empty.
export default {
  invariant: 'S-3',
  title: 'a line whose amount is zero is refused before its transfer target is even looked up',
  design: 'set_transaction_splits_with_legs 20260806094058:254-257, before the account lookup at :262-276',
  consequence: 'a line that occupies a row and a category while contributing nothing, and a reader who cannot tell whether it was meant',
  parity: 'match',

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      splits: [
        { category: WEEKLY_SHOP, amount: '0.00', transfer_account_id: 'not-an-account-at-all' },
        { category: WEEKLY_SHOP, amount: '-25.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'every split line needs a non-zero amount' },

  state: [
    splitLines(CORNER_SHOP, 'NONE'),
    storedFlag(CORNER_SHOP, 'is_split', 'no'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    auditShape('NONE'),
  ],
};
