import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, WEEKLY_SHOP, LEG_LINE, PLAIN_LINE, TO_FROM_RAINY_DAY,
  setups, namedTransferCategories, splitWithTransferLeg,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  auditShape, storedAmount,
} from './_shared.mjs';

// REFUSAL 15 of 20 — S-9's first and most consequential third.
//
// A linked leg's amount is not the split's to change: the transaction on the
// other side is for exactly that much, and it lives in another account whose
// balance has already moved by it. Letting the amount change here would make the
// ledger claim two different sizes for one movement of money — the LINE↔
// counterpart opposite-amounts invariant (T-10) false on the spot, with no
// constraint anywhere to notice.
//
// The refusal names the account AND the amount it is pinned to
// (`to_char(…, 'FM999999999990.00')` in the cloud, `Money`'s own rendering here —
// both produce `-15.00`), because the remedy is arithmetic the user has to do:
// the other lines have to absorb the difference. A message that said only
// "cannot change" would leave them guessing at the number.
//
// This is also the highest-priority of the three pinned checks. MEASURED: the
// payload below breaks all three at once — wrong amount, wrong target, wrong
// category — and both engines report the amount.
export default {
  invariant: 'S-9',
  title: 'a linked leg\'s amount cannot change, and the refusal says what it has to stay',
  design: 'set_transaction_splits_with_legs 20260806094058:314-321 — checked before the target and the category',
  consequence: 'the ledger claims two different sizes for one movement of money, and the account on the other side is wrong by the difference',
  parity: 'match',

  // The leg is filed under its To/From category here, which is why the CATEGORY
  // in the payload has to be that same category for the amount check to be
  // reached at all — see the ordering spec.
  setup: setups(namedTransferCategories, splitWithTransferLeg),

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      expected_amount: '-25.00',
      splits: [
        { id: LEG_LINE, category: TO_FROM_RAINY_DAY, amount: '-16.00', transfer_account_id: RAINY_DAY },
        { id: PLAIN_LINE, category: WEEKLY_SHOP, amount: '-9.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'split_leg_amount_locked' },

  state: [
    splitLines(
      CORNER_SHOP,
      '0:-15.00:To/From Rainy day:0002:linked:- | 1:-10.00:Weekly shop:-:-:-',
    ),
    storedAmount(CORNER_SHOP, '-25.00'),
    splitSumHolds(CORNER_SHOP),
    legPairsAreMutual(),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('NONE'),
  ],
};
