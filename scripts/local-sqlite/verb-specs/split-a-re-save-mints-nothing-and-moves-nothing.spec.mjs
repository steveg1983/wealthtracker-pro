import {
  USER, EVERYDAY, RAINY_DAY, WEEKLY_SHOP, CORNER_SHOP, LEG_LINE, PLAIN_LINE,
  TO_FROM_RAINY_DAY, setups, namedTransferCategories, splitWithTransferLeg,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  auditShape, rowsIn, rowsInAccount,
} from './_shared.mjs';

// IDEMPOTENCE, which for a writer that mints rows is not a nicety. The save
// button is pressed twice; a phone re-sends a request it never saw acknowledged;
// a user opens the split, changes nothing and saves. If any of those minted a
// second counterpart, the ledger would claim the money moved twice and the
// account on the other side would be wrong by exactly one leg — silently,
// because both rows would look perfectly well-formed.
//
// The rule that prevents it, from the RPC's own comment (`:359-365`): a
// counterpart is minted only when the line "did not already point at that
// account". A line whose target is unchanged keeps whatever link state it has.
//
// This spec sends back EXACTLY what the previous save stored — same ids, same
// amounts, same target — and asserts that nothing was created, nothing moved,
// and the only audit row is the parent's. The `rows_in_account` count is the one
// that would catch a duplicate: it is 1 before and 1 after.
export default {
  invariant: 'T-3',
  title: 'sending the same split back a second time creates no second counterpart',
  design: 'set_transaction_splits_with_legs 20260806094058:366-367 — the mint is gated on v_prev_target IS DISTINCT FROM v_target',
  consequence: 'a double-submit mints a second transfer for money that only moved once, and the target account is permanently wrong by one leg',
  parity: 'match',

  setup: setups(namedTransferCategories, splitWithTransferLeg),

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      expected_amount: '-25.00',
      splits: [
        { id: LEG_LINE, category: TO_FROM_RAINY_DAY, amount: '-15.00', transfer_account_id: RAINY_DAY },
        { id: PLAIN_LINE, category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { id: CORNER_SHOP, amount: '-25.00', is_split: true },

  state: [
    splitLines(
      CORNER_SHOP,
      '1:-15.00:To/From Rainy day:0002:linked:- | 2:-10.00:Weekly shop:-:-:-',
    ),
    // One row in Rainy day, not two. This is the assertion the whole spec is
    // about.
    rowsInAccount(RAINY_DAY, '1'),
    rowsIn(RAINY_DAY, '15.00:transfer:-:Counterpart:-:uncleared:leg-of-a-split'),
    legPairsAreMutual(),
    splitSumHolds(CORNER_SHOP),
    balanceOf(RAINY_DAY, '15.00'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    // No mint, no balance move: one audit row, at the parent.
    auditShape('transaction/update'),
  ],
};
