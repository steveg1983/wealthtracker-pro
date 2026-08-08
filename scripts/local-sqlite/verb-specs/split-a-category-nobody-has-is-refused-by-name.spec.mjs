import {
  USER, EVERYDAY, CORNER_SHOP, WEEKLY_SHOP,
  balanceOf, balanceIdentityHolds, splitLines, auditShape, storedFlag,
} from './_shared.mjs';

// REFUSAL 11 of 20 — S-7, and the ONE place where the three implementations of
// this operation are known to disagree.
//
// AUDIT3's D-4 records it, and `dataService.setTransactionSplitsLocally`'s own
// comment states it outright: "Unlike the server, a category that is simply
// absent from local storage is not fatal — demo/offline fixtures routinely carry
// transactions without the tree they were filed against." That is a reasonable
// thing for a browser cache to do and a bad thing for a ledger to do, and the
// port does not reproduce it. The RPC is the specification; the mirrors are
// recorded, not copied.
//
// So this spec is written from the CLOUD side on purpose. It pins the behaviour
// the port chose to follow, which means the day somebody softens the RPC to
// match the TypeScript, this spec fails and the decision gets made again out
// loud instead of by drift.
//
// The category column is TEXT with no foreign key in both engines (R-3) — legacy
// sentinels live in it — so nothing structural stops a dangling reference. This
// procedural check is the whole of the enforcement, which is exactly why it has
// to be in the port.
export default {
  invariant: 'S-7',
  title: 'a split line filed under a category that does not exist is refused by name',
  design: 'set_transaction_splits_with_legs 20260806094058:279-283 — the category must be one of this user\'s; AUDIT3 §D-4 records the TypeScript mirror\'s divergence',
  consequence: 'an orphaned categorisation with no way back: the line reports under a category nobody can name, edit or merge',
  parity: 'match',

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      expected_amount: '-25.00',
      splits: [
        { category: 'c0000000-0000-0000-0000-0000000000ff', amount: '-15.00' },
        { category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'unknown category' },

  state: [
    splitLines(CORNER_SHOP, 'NONE'),
    storedFlag(CORNER_SHOP, 'is_split', 'no'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditShape('NONE'),
  ],
};
