import {
  USER, EVERYDAY, WEEKLY_SHOP, OUTGOINGS, CORNER_SHOP,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, auditShape, storedAmount,
} from './_shared.mjs';

// B-2 for the parent's own account, and the one balance move in this verb that
// has nothing to do with transfers.
//
// A split does not have to preserve the total. Filing a −25.00 row as two −20.00
// lines is how a receipt that was entered wrong gets corrected, and the RPC
// takes the lines as the truth: the parent's amount BECOMES their sum
// (`:445-451`) and its account moves by the difference (`:461-465`) — here
// −15.00, because −40.00 replaced −25.00.
//
// The delta is arithmetic on the transaction's own two amounts and the balance
// itself is only ever `balance = balance + ?`, in SQL. Never read-modify-write:
// DESIGN.md §1.10 names that as the seam floats came back through last time, and
// a local port that reads the balance into Rust, adds, and writes it back is
// arithmetically identical and wrong.
//
// `audit_shape` is the second half of the assertion. Two entities are recorded
// for one call — the parent and the account — and an entry the ledger cannot
// explain is exactly what the log exists to make visible.
export default {
  invariant: 'B-2',
  title: 'a split whose lines sum to something else moves the account by the difference',
  design: 'set_transaction_splits_with_legs 20260806094058:453-470 — balance = balance + (new − old), in SQL, with the account audited',
  consequence: 'B-1 breaks on the first re-split: the account says one thing and the sum of its rows says another, permanently and silently',
  parity: 'match',

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      // Deliberately absent: p_expected_amount is only checked when it is
      // given (`:424`), and this is the call that proves an absent one does not
      // block a total from changing.
      splits: [
        { category: WEEKLY_SHOP, amount: '-20.00' },
        { category: OUTGOINGS, amount: '-20.00' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { id: CORNER_SHOP, amount: '-40.00', is_split: true },

  state: [
    storedAmount(CORNER_SHOP, '-40.00'),
    splitLines(CORNER_SHOP, '1:-20.00:Weekly shop:-:-:- | 2:-20.00:Outgoings:-:-:-'),
    splitSumHolds(CORNER_SHOP),
    balanceOf(EVERYDAY, '-40.00'),
    balanceIdentityHolds(EVERYDAY),
    auditShape('account/update,transaction/update'),
  ],
};
