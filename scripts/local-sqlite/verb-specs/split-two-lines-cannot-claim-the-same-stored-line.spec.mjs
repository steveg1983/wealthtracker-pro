import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, WEEKLY_SHOP, LEG_LINE, PLAIN_LINE,
  setups, namedTransferCategories, splitWithTransferLeg,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, auditShape, splitLineState,
} from './_shared.mjs';

// REFUSAL 5 of 20 — S-11, first half, and the one that would make the sum check
// a lie rather than merely wrong.
//
// This writer matches incoming lines to stored ones BY IDENTITY. If two incoming
// lines claim the same id, the second UPDATE overwrites the first and one stored
// row is counted twice in `v_sum` — so the parent takes a total that no set of
// stored lines adds up to, and S-12's storage re-read would be the only thing
// left standing between that and the register.
//
// MEASURED, and worth the spec on its own: this refusal beats
// `split_leg_line_removed`. The payload below drops a linked leg AND repeats an
// id, and both engines report the repeat. Ordering matters here because the
// repeat is the one the user can fix by reloading, while the leg message tells
// them to go and delete a transfer in another account.
export default {
  invariant: 'S-11',
  title: 'two lines claiming to be the same stored line are refused before anything else',
  design: 'set_transaction_splits_with_legs 20260806094058:192-196 — count(*) vs count(DISTINCT) over the incoming ids',
  consequence: 'one stored line is written twice and counted twice; the parent takes a total no line set supports',
  parity: 'match',

  setup: setups(namedTransferCategories, splitWithTransferLeg),

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      // Two rule breaks at once: the leg is not named (so it would be dropped)
      // and the ordinary line is named twice. The repeat wins.
      splits: [
        { id: PLAIN_LINE, category: WEEKLY_SHOP, amount: '-15.00' },
        { id: PLAIN_LINE, category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'split_line_id_repeated' },

  state: [
    splitLines(
      CORNER_SHOP,
      '0:-15.00:To/From Rainy day:0002:linked:- | 1:-10.00:Weekly shop:-:-:-',
    ),
    splitLineState(LEG_LINE, 'linked'),
    splitSumHolds(CORNER_SHOP),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('NONE'),
  ],
};
