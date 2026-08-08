import {
  USER, EVERYDAY, RAINY_DAY, HOLIDAY_FUND, CORNER_SHOP, WEEKLY_SHOP, LEG_LINE, PLAIN_LINE,
  setups, thirdAccount, splitWithAnOrdinarilyFiledLeg,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  auditShape, rowsIn,
} from './_shared.mjs';

// REFUSAL 16 of 20 — S-9's second third, and the one that needs a fixture
// nobody would have written by accident.
//
// `split_leg_target_locked` is UNREACHABLE while the leg is filed under a
// To/From category: that category names an account, so changing the target
// either drops the category's account (→ `split_leg_category_mismatch`) or drops
// the target entirely (→ `split_leg_not_declared`), and both of those fire
// EARLIER in the loop. MEASURED on the reference cluster; it is the second of
// the two orderings in this function that a port written from the source's
// sections rather than its statements gets wrong.
//
// So the only way in is a leg filed under an ORDINARY category — which is not a
// contrivance but the majority case in the owner's own data: the MS Money
// importer filed 86 legs under whatever category the file named, To/From or not,
// and the RPC deliberately allows it (`:297-301`).
//
// What the refusal protects: the counterpart is a real row in Rainy day. Moving
// the line's target to Holiday fund would leave that row pointing at a line that
// now claims to be about a different account — a pair that is mutual, valid, and
// says two different things.
export default {
  invariant: 'S-9',
  title: 'a linked leg cannot be re-pointed at a different account, and the refusal names the one it is tied to',
  design: 'set_transaction_splits_with_legs 20260806094058:322-326; reachable only when the leg is filed under an ordinary category, per :297-301',
  consequence: 'the counterpart is stranded in an account the split no longer mentions, still linked, still spending its balance',
  parity: 'match',

  setup: setups(thirdAccount, splitWithAnOrdinarilyFiledLeg),

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

  expect: { outcome: 'refused', error: 'split_leg_target_locked' },

  state: [
    splitLines(
      CORNER_SHOP,
      '0:-15.00:Weekly shop:0002:linked:- | 1:-10.00:Weekly shop:-:-:-',
    ),
    // Nothing was minted in the account the caller tried to move it to.
    rowsIn(HOLIDAY_FUND, 'NONE'),
    balanceOf(HOLIDAY_FUND, '0.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    balanceIdentityHolds(HOLIDAY_FUND),
    legPairsAreMutual(),
    splitSumHolds(CORNER_SHOP),
    auditShape('NONE'),
  ],
};
