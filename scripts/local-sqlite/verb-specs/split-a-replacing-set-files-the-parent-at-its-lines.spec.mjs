import {
  USER, EVERYDAY, RAINY_DAY, WEEKLY_SHOP, OUTGOINGS, CORNER_SHOP,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  auditShape, rowsIn,
} from './_shared.mjs';

// S-1 + S-4, the whole happy path in one call: an ordinary row becomes a split
// of two lines, the parent takes their sum as its amount and gives up its own
// categorisation, and nothing else in the file moves.
//
// The two assertions that make this more than a smoke test:
//
//   * `split_lines` compares the WHOLE line set as one string, so the sort order
//     the writer assigns (1-based, in payload order — the fixture's own lines
//     start at 0) and the memo it stores are pinned, not just the amounts.
//   * `audit_shape` is `transaction/update` and nothing else. A split that
//     re-files the same total moves no money, so an `account/update` entry here
//     would mean a balance had been touched that had no business moving.
export default {
  invariant: 'S-1',
  title: 'a split of two lines takes the parent\'s amount from its lines and blanks its category',
  design: 'set_transaction_splits_with_legs 20260806094058:445-451 — amount = the sum, category = \'\', is_split = true, in one statement',
  consequence: 'a transaction that says one thing and is categorised as another, and a parent that double-counts against a category its own lines already claim',
  parity: 'match',

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      expected_amount: '-25.00',
      splits: [
        { category: WEEKLY_SHOP, amount: '-15.00', memo: 'bread' },
        { category: OUTGOINGS, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { id: CORNER_SHOP, amount: '-25.00', is_split: true, category: '' },

  state: [
    splitLines(
      CORNER_SHOP,
      '1:-15.00:Weekly shop:-:-:bread | 2:-10.00:Outgoings:-:-:-',
    ),
    splitSumHolds(CORNER_SHOP),
    legPairsAreMutual(),
    // The total did not change, so no balance moved and no account was audited.
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    rowsIn(RAINY_DAY, 'NONE'),
    auditShape('transaction/update'),
  ],
};
