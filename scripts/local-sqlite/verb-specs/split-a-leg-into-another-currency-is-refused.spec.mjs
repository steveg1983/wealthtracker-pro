import {
  USER, EVERYDAY, DOLLARS, CORNER_SHOP, WEEKLY_SHOP,
  dollarAccount, balanceOf, balanceIdentityHolds, splitLines, auditShape, rowsIn, storedFlag,
} from './_shared.mjs';

// REFUSAL 18 of 20 — T-9, the last refusal inside the loop and the only one that
// fires after a line has already been written.
//
// The counterpart is `-amount` with no conversion. Between two accounts in one
// currency that is exactly right; between a GBP account and a USD one it moves
// the dollar balance by a sterling magnitude, and the two ledgers are then both
// internally consistent and jointly meaningless. The same guard, and the same
// reasoning, as `create_transfer_counterpart` (20260721090000).
//
// The refusal names both currencies, because the remedy depends on which pair it
// is — and because "not supported yet" without saying what was attempted is the
// least actionable sentence in a finance app.
//
// Note where in the sequence this sits: the line has been INSERTed by the time
// the currency is compared (`:373-382` is inside the mint block, after the store
// at `:352-356`). Nothing survives, because the whole call is one transaction —
// but it is the clearest demonstration in the verb that "refused" means "rolled
// back", not "stopped in time".
export default {
  invariant: 'T-9',
  title: 'a leg into an account in another currency is refused, naming both currencies',
  design: 'set_transaction_splits_with_legs 20260806094058:369-382 — the same guard as create_transfer_counterpart, 20260721090000',
  consequence: 'a dollar balance moves by a sterling magnitude; both ledgers stay internally consistent and neither means anything',
  parity: 'match',

  setup: dollarAccount,

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      expected_amount: '-25.00',
      splits: [
        { category: WEEKLY_SHOP, amount: '-15.00', transfer_account_id: DOLLARS },
        { category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: {
    outcome: 'refused',
    error: 'Transfers between accounts in different currencies are not supported yet',
  },

  state: [
    // The line WAS written before this refusal and is gone again, which is the
    // point: one verb, one transaction, all of it or none of it.
    splitLines(CORNER_SHOP, 'NONE'),
    storedFlag(CORNER_SHOP, 'is_split', 'no'),
    rowsIn(DOLLARS, 'NONE'),
    balanceOf(DOLLARS, '0.00'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(DOLLARS),
    auditShape('NONE'),
  ],
};
