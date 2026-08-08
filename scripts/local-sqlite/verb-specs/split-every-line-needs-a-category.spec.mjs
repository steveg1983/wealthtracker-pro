import {
  USER, EVERYDAY, CORNER_SHOP, WEEKLY_SHOP,
  balanceOf, balanceIdentityHolds, splitLines, auditShape, storedFlag,
} from './_shared.mjs';

// REFUSAL 7 of 20 — S-3's first half, and the first refusal inside the per-line
// loop, which makes it the first thing said about a line that breaks several
// rules at once.
//
// Two things about the payload below are measurements rather than choices:
//
//   * the key is ABSENT, not empty. `->>` returns NULL for a missing key and
//     `btrim(COALESCE(NULL,''))` is `''`, so the cloud treats "no category" and
//     "a category of spaces" identically. MEASURED: both give this refusal.
//   * the second line is valid and the first is not, and this refusal wins over
//     the second line's — the loop runs in payload order and stops at the first
//     line that will not do. MEASURED both ways round.
//
// It also beats the zero-amount check on the SAME line: the payload's first line
// has neither a category nor a usable amount, and the category is what both
// engines complain about.
export default {
  invariant: 'S-3',
  title: 'a line with no category is refused, and it is the first thing said about that line',
  design: 'set_transaction_splits_with_legs 20260806094058:249-252, before the amount cast at :254',
  consequence: 'a split line with nowhere to be filed — an orphaned categorisation with no way back, and a report that silently drops the money',
  parity: 'match',

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      splits: [
        // No category AND a zero amount. The category is named.
        { amount: '0.00' },
        { category: WEEKLY_SHOP, amount: '-25.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'every split line needs a category' },

  state: [
    splitLines(CORNER_SHOP, 'NONE'),
    storedFlag(CORNER_SHOP, 'is_split', 'no'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditShape('NONE'),
  ],
};
