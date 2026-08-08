import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP,
  balanceOf, balanceIdentityHolds, storedText, storedAmount, auditRowsForUpdate,
} from './_shared.mjs';

// The second shape of balance movement, and the one with two asserts in it.
//
//     ELSE
//       UPDATE accounts SET balance = balance - v_old.amount
//        WHERE id = v_old.account_id AND user_id = v_old.user_id;
//       IF NOT FOUND THEN RAISE ...;
//       UPDATE accounts SET balance = balance + v_new.amount
//        WHERE id = v_new.account_id AND user_id = v_new.user_id;
//       IF NOT FOUND THEN RAISE ...;
//     END IF;                                          -- 20260808100000:349-367
//
// Note the branch is chosen on the ACCOUNT changing, not on the amount, and it
// runs whether or not the amount also changed — `balance - old` where the row
// was and `balance + new` where it now is covers both in one shape. A port that
// combined the two branches, or that skipped the reversal when the amount was
// unchanged, would leave the money in the old account AND put it in the new one.
//
// This payload moves the amount as well as the account, which is the case that
// catches a port using the wrong amount on the wrong side: the reversal must use
// the OLD figure (-25.00) and the application the NEW one (-40.00). Doing it
// with one figure leaves both accounts wrong by 15.00 in opposite directions —
// and the two errors cancel in a net-worth total, so only B-1 per account
// catches it. Both are asserted.
export default {
  invariant: 'B-2',
  title: 'moving a row to another account reverses the old effect and applies the new one, each asserted',
  design: 'update_transaction_atomic 20260808100000:349-367 — two relative statements, two IF NOT FOUND guards',
  consequence: 'a single combined statement leaves the money in the account it left as well as the one it arrived in; the net worth total still looks right, which is what makes it survive',
  parity: 'match',

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: { account_id: RAINY_DAY, amount: '-40.00' },
    },
  },

  expect: { outcome: 'ok' },
  result: { account_id: RAINY_DAY, amount: '-40.00' },

  state: [
    storedText(CORNER_SHOP, 'account_id', RAINY_DAY),
    storedAmount(CORNER_SHOP, '-40.00'),
    // Everyday gets its -25.00 back: it now holds no rows at all.
    balanceOf(EVERYDAY, '0.00'),
    // Rainy day takes the new figure, not the old one.
    balanceOf(RAINY_DAY, '-40.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsForUpdate(CORNER_SHOP, '1'),
  ],
};
