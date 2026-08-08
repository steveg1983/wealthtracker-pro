import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, WEEKLY_SHOP, LEG_LINE, PLAIN_LINE, TO_FROM_RAINY_DAY,
  setups, namedTransferCategories, splitWithTransferLeg,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual, auditShape,
} from './_shared.mjs';

// THE REFUSAL ORDER, PART 2 — and this is the one that changes what a port has
// to be able to TEST, not just what it has to return.
//
// A client drops `transfer_account_id` from a line that is a linked leg. The
// obvious answer is `split_leg_target_locked`: the leg IS pinned to Rainy day
// and the payload no longer says so. MEASURED: both engines say
// `split_leg_not_declared` instead.
//
// The reason is that the leg is filed under a To/From category, and S-8's
// "a To/From line must say which account" (`:287-291`) is checked in the
// payload-only phase, long before any stored line is read (`:303-309`) or any
// pinned column is compared (`:314-331`).
//
// The consequence is worth stating plainly, because it caught this port out:
// `split_leg_target_locked` is UNREACHABLE for a leg filed under a To/From
// category. Every payload that would trigger it trips S-8 first. The only way to
// reach it at all is a leg filed under an ORDINARY category — which is why
// `splitWithAnOrdinarilyFiledLeg` exists as a fixture, and why the MS Money
// import population is not an edge case but the ONLY case for that refusal.
export default {
  invariant: 'S-8',
  title: 'a pinned leg sent without its target is told about its filing, not about the lock',
  design: 'set_transaction_splits_with_legs 20260806094058:287-291 runs before :322-326 — MEASURED, and it makes split_leg_target_locked unreachable for To/From-filed legs',
  consequence: 'a port that assumed the lock fires first would ship a refusal it could never reach, and a message that never matches the cloud\'s',
  parity: 'match',

  setup: setups(namedTransferCategories, splitWithTransferLeg),

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      expected_amount: '-25.00',
      splits: [
        // Same id, same amount, same category — but no transfer_account_id.
        { id: LEG_LINE, category: TO_FROM_RAINY_DAY, amount: '-15.00' },
        { id: PLAIN_LINE, category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'split_leg_not_declared' },

  state: [
    splitLines(
      CORNER_SHOP,
      '0:-15.00:To/From Rainy day:0002:linked:- | 1:-10.00:Weekly shop:-:-:-',
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
