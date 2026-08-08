import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, WEEKLY_SHOP, OUTGOINGS, LEG_LINE, PLAIN_LINE,
  TO_FROM_RAINY_DAY, setups, namedTransferCategories, splitWithTransferLeg,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, auditShape, storedAmount,
} from './_shared.mjs';

// REFUSAL 19 of 20 — S-1 as a REFUSAL rather than as an assignment.
//
// The parent's amount becomes the sum of its lines unconditionally, so this
// check is not about keeping the two in step — that is automatic. It is about
// the client's belief: `p_expected_amount` is the figure the user was looking at
// when they pressed save, and a mismatch means the transaction moved underneath
// them. Writing the new sum anyway would silently change an amount they never
// agreed to.
//
// The HINT is the useful part and it is carried across verbatim: "A transfer
// line's amount is pinned by the transaction on its other side, so the remaining
// lines have to absorb the difference." That is exactly the situation this
// fixture is in — a −15.00 leg that cannot move — and without the sentence the
// user is left staring at a locked line and an arithmetic they cannot complete.
//
// The refusal reports BOTH figures, so the difference is arithmetic the user can
// do rather than guess at.
export default {
  invariant: 'S-1',
  title: 'lines that do not sum to the amount the client sent are refused, with both figures named',
  design: 'set_transaction_splits_with_legs 20260806094058:424-429, and its HINT about the pinned leg',
  consequence: 'the transaction\'s amount changes to a total the user never agreed to, and the balance moves with it',
  parity: 'match',

  setup: setups(namedTransferCategories, splitWithTransferLeg),

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      // The client still thinks this is −25.00; the lines say −30.00.
      expected_amount: '-25.00',
      splits: [
        { id: LEG_LINE, category: TO_FROM_RAINY_DAY, amount: '-15.00', transfer_account_id: RAINY_DAY },
        { id: PLAIN_LINE, category: WEEKLY_SHOP, amount: '-10.00' },
        { category: OUTGOINGS, amount: '-5.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'split_total_mismatch' },

  state: [
    // Two lines, not three: the third was written and rolled back with the rest.
    splitLines(
      CORNER_SHOP,
      '0:-15.00:To/From Rainy day:0002:linked:- | 1:-10.00:Weekly shop:-:-:-',
    ),
    storedAmount(CORNER_SHOP, '-25.00'),
    splitSumHolds(CORNER_SHOP),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('NONE'),
  ],
};
