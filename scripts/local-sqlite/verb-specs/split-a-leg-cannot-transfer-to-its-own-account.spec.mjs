import {
  USER, EVERYDAY, CORNER_SHOP, WEEKLY_SHOP,
  balanceOf, balanceIdentityHolds, splitLines, auditShape, storedFlag, rowsInAccount,
} from './_shared.mjs';

// REFUSAL 10 of 20 — T-2, on a split line.
//
// A transfer to the account you are already in is not a transfer, it is a pair
// of rows in one register that cancel each other and a balance that moves twice
// by equal and opposite amounts. Nothing is *wrong* with the arithmetic
// afterwards, which is what makes it worth refusing rather than tolerating: the
// register grows a phantom pair that no reconciliation will ever explain.
//
// The local schema also has it declaratively for the transactions table
// (`transactions_transfer_two_accounts`), so the minted counterpart could not
// land anyway. The verb refuses first, with the cloud's sentence, and the
// constraint stays the backstop.
//
// Like refusal 9, this one beats the category lookup on the same line —
// MEASURED, with a category that does not exist.
export default {
  invariant: 'T-2',
  title: 'a leg that points back at the account the transaction is already in is refused',
  design: 'set_transaction_splits_with_legs 20260806094058:271-274; schema.sql CONSTRAINT transactions_transfer_two_accounts is the backstop',
  consequence: 'a phantom pair of rows in one register that cancel out, and a balance moved twice for money that never went anywhere',
  parity: 'match',

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      splits: [
        { category: 'no-such-category', amount: '-15.00', transfer_account_id: EVERYDAY },
        { category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'a transfer needs two different accounts' },

  state: [
    splitLines(CORNER_SHOP, 'NONE'),
    storedFlag(CORNER_SHOP, 'is_split', 'no'),
    rowsInAccount(EVERYDAY, '1'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditShape('NONE'),
  ],
};
