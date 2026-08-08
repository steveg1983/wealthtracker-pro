import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, WEEKLY_SHOP, OUTGOINGS,
  balanceOf, balanceIdentityHolds, splitLines, auditShape, storedFlag,
} from './_shared.mjs';

// REFUSAL 4 of 20 — S-6, which is also T-5 read from the other end.
//
// A transfer's amount is pinned by the row on its other side. If it could be
// split, its lines would have to sum to that amount forever, and any edit to
// them would be an edit to the other account's row made at a distance. The two
// rules the schema already has would then contradict each other: S-1 says the
// parent is the sum of its lines, T-1 says the two sides are exact opposites,
// and the first edit that changed a line would break one of them.
//
// The local schema goes further than the cloud here and makes it declarative —
// `transactions_transfer_not_split` — so the file refuses it even if a future
// code path forgets. The verb refuses FIRST and by name, so the message matches
// the cloud's; the constraint is the backstop, not the messenger.
export default {
  invariant: 'S-6',
  title: 'a transfer cannot be split, and the verb says so before the constraint has to',
  design: 'set_transaction_splits_with_legs 20260806094058:177-179; schema.sql CONSTRAINT transactions_transfer_not_split is the local backstop',
  consequence: 'S-1 and T-1 contradict each other on the same row, and editing a split line silently rewrites another account\'s transaction',
  parity: 'match',

  setup: {
    sqlite: `UPDATE transactions
                SET type = 'transfer', transfer_account_id = '${RAINY_DAY}'
              WHERE id = '${CORNER_SHOP}';`,
    postgres: `UPDATE public.transactions
                  SET type = 'transfer', transfer_account_id = '${RAINY_DAY}'
                WHERE id = '${CORNER_SHOP}';`,
  },

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      expected_amount: '-25.00',
      splits: [
        { category: WEEKLY_SHOP, amount: '-15.00' },
        { category: OUTGOINGS, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'transfers cannot be split' },

  state: [
    splitLines(CORNER_SHOP, 'NONE'),
    storedFlag(CORNER_SHOP, 'is_split', 'no'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditShape('NONE'),
  ],
};
