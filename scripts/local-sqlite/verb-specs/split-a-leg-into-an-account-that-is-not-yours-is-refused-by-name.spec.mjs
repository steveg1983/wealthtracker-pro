import {
  USER, EVERYDAY, CORNER_SHOP, WEEKLY_SHOP, SOMEONE_ELSES_ACCOUNT,
  secondUser, balanceOf, balanceIdentityHolds, splitLines, auditShape, storedFlag, rowsIn,
} from './_shared.mjs';

// REFUSAL 9 of 20 — the target-side half of the ownership guard, and the reason
// a split writer is a security surface at all.
//
// Every other verb's ownership check is about the row being edited. This one has
// a second: a leg line names an account, a counterpart is then INSERTED into it,
// and that account's balance moves. Without this check a user could put a
// transaction into a stranger's register and move their balance, having only
// ever touched their own transaction.
//
// The payload names an account that genuinely exists — it belongs to the second
// user in the fixture — so what is being proved is ownership, not existence. The
// refusal is the same one either way, and deliberately so.
//
// It also beats the category lookup on the same line: the category here is
// nonsense too, and both engines report the account. MEASURED.
export default {
  invariant: 'X-6',
  title: 'a leg pointing at somebody else\'s account is refused before the category is even read',
  design: 'set_transaction_splits_with_legs 20260806094058:262-276 — WHERE id::text = … AND user_id = v_old.user_id',
  consequence: 'a transaction appears in a stranger\'s register and their balance moves, from a call that only named the caller\'s own row',
  parity: 'match',

  setup: secondUser,

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      splits: [
        { category: 'no-such-category', amount: '-15.00', transfer_account_id: SOMEONE_ELSES_ACCOUNT },
        { category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'account_not_found_or_not_owned' },

  state: [
    splitLines(CORNER_SHOP, 'NONE'),
    storedFlag(CORNER_SHOP, 'is_split', 'no'),
    rowsIn(SOMEONE_ELSES_ACCOUNT, 'NONE'),
    balanceOf(SOMEONE_ELSES_ACCOUNT, '0.00'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
    auditShape('NONE'),
  ],
};
