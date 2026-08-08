import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, WEEKLY_SHOP, OUTGOINGS, LEG_LINE, PLAIN_LINE,
  setups, namedTransferCategories, splitWithAnOrdinarilyFiledLeg,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual, auditShape,
} from './_shared.mjs';

// REFUSAL 17 of 20 — S-9's last third.
//
// A leg's category is how the transfer is FILED, and re-filing it while the pair
// exists would leave the two halves describing the movement differently: the
// counterpart still files under the To/From category of the account the split
// sits in, and the line would no longer agree. The RPC's remedy is the same one
// it gives everywhere else — delete the transfer, then re-file — because a
// category change on a leg is really a change to a transfer, and transfers are
// edited from both ends or not at all.
//
// The fixture files the leg under an ordinary category and the payload moves it
// to another ordinary one, which keeps every earlier check satisfied: the target
// is unchanged, so `split_leg_target_locked` cannot fire; neither category is a
// To/From, so S-8's pair cannot fire. What is left is the category lock itself.
export default {
  invariant: 'S-9',
  title: 'a linked leg cannot be re-filed while its counterpart exists',
  design: 'set_transaction_splits_with_legs 20260806094058:327-330 — the last of the three pinned checks',
  consequence: 'the two halves of one transfer are filed under different categories, and every report that groups by category shows one of them',
  parity: 'match',

  setup: setups(namedTransferCategories, splitWithAnOrdinarilyFiledLeg),

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      expected_amount: '-25.00',
      splits: [
        // Same amount, same target, different category.
        { id: LEG_LINE, category: OUTGOINGS, amount: '-15.00', transfer_account_id: RAINY_DAY },
        { id: PLAIN_LINE, category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'split_leg_category_locked' },

  state: [
    splitLines(
      CORNER_SHOP,
      '0:-15.00:Weekly shop:0002:linked:- | 1:-10.00:Weekly shop:-:-:-',
    ),
    splitSumHolds(CORNER_SHOP),
    legPairsAreMutual(),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('NONE'),
  ],
};
