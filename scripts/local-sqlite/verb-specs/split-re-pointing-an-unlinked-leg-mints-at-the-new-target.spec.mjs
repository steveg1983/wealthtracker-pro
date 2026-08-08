import {
  USER, EVERYDAY, RAINY_DAY, HOLIDAY_FUND, WEEKLY_SHOP, CORNER_SHOP, LEG_LINE, PLAIN_LINE,
  setups, thirdAccount, splitWithAnUnlinkedLeg,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  auditShape, rowsIn,
} from './_shared.mjs';

// The third of the four leg movements — mint, adopt, RE-POINT, remove — and the
// one that only makes sense once you know what an unlinked leg is.
//
// A line carrying a `transfer_account_id` with a NULL `linked_transfer_id` is an
// UNMATCHED leg: the other side exists somewhere and has not been recognised
// yet, or existed and was deleted (R-5 leaves exactly this state behind). The
// re-save rule is stated per line: mint "only when it did not already point at
// that account" (`:359-367`).
//
// So the same payload shape has two different outcomes, and both are correct:
//
//   * target unchanged  → nothing is minted. The matching sweep re-pairs those,
//     and inventing a row here would duplicate a movement that already happened.
//     (`split-a-re-save-mints-nothing-and-moves-nothing.spec.mjs`.)
//   * target CHANGED    → this spec. The line now claims money moved somewhere
//     else, so somewhere else gets the row, and Holiday fund's balance moves.
//     Rainy day is left alone: no counterpart ever existed there to unwind.
//
// That last sentence is the whole reason this is not simply "changing a field".
export default {
  invariant: 'T-10',
  title: 'pointing an unmatched leg at a different account mints the counterpart there',
  design: 'set_transaction_splits_with_legs 20260806094058:359-367 — the mint is gated on v_prev_target IS DISTINCT FROM v_target, per line',
  consequence: 'either the leg silently keeps pointing at the old account, or a second counterpart appears for money that moved once',
  parity: 'match',

  setup: setups(thirdAccount, splitWithAnUnlinkedLeg),

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      expected_amount: '-25.00',
      splits: [
        { id: LEG_LINE, category: WEEKLY_SHOP, amount: '-15.00', transfer_account_id: HOLIDAY_FUND },
        { id: PLAIN_LINE, category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { id: CORNER_SHOP, amount: '-25.00', is_split: true },

  state: [
    splitLines(
      CORNER_SHOP,
      '1:-15.00:Weekly shop:0003:linked:- | 2:-10.00:Weekly shop:-:-:-',
    ),
    rowsIn(HOLIDAY_FUND, '15.00:transfer:To/From Everyday:Corner shop:-:uncleared:leg-of-a-split'),
    // Nothing was ever there to unwind, and nothing is put there now.
    rowsIn(RAINY_DAY, 'NONE'),
    balanceOf(HOLIDAY_FUND, '15.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    balanceIdentityHolds(HOLIDAY_FUND),
    legPairsAreMutual(),
    splitSumHolds(CORNER_SHOP),
    auditShape('account/update,transaction/create,transaction/update'),
  ],
};
