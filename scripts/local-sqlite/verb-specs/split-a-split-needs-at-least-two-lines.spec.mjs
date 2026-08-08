import {
  USER, EVERYDAY, CORNER_SHOP, WEEKLY_SHOP,
  balanceOf, balanceIdentityHolds, splitLines, auditShape, storedFlag,
} from './_shared.mjs';

// REFUSAL 2 of 20 — S-2, and the sentence that makes this writer refuse to
// un-split.
//
// An empty set is not "remove the split" here, and that is deliberate. The RPC's
// header says why (`:113-115`): "an empty set has no leg to preserve and no line
// to match, so that path stays with set_transaction_splits (which refuses while
// a leg is present — correctly, since un-splitting deletes every line)". A
// writer that both preserves legs by identity AND deletes every line on request
// would have to choose which rule to break.
//
// One line is refused for the older reason: a "split" of one line is a category,
// and storing it as a split gives a transaction two places to keep its
// categorisation and no rule about which one wins.
//
// MEASURED: this beats `transaction_not_found` — with a non-existent id and one
// line, the cloud says this.
export default {
  invariant: 'S-2',
  title: 'a split of fewer than two lines is refused, and an empty set is not an un-split',
  design: 'set_transaction_splits_with_legs 20260806094058:164-166; the un-split path is deliberately left to set_transaction_splits, :113-115',
  consequence: 'a one-line "split" is a category with extra steps, and an empty one deletes every line including the legs this writer exists to preserve',
  parity: 'match',

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      splits: [{ category: WEEKLY_SHOP, amount: '-25.00' }],
    },
  },

  expect: { outcome: 'refused', error: 'a split needs at least 2 lines' },

  state: [
    splitLines(CORNER_SHOP, 'NONE'),
    storedFlag(CORNER_SHOP, 'is_split', 'no'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditShape('NONE'),
  ],
};
