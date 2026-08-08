import {
  USER, EVERYDAY, CORNER_SHOP, OPENING_BALANCE, SOMEONE_ELSES_ACCOUNT, secondUser,
  balanceOf, balanceIdentityHolds, rowsInAccount, auditRowsInTotal, accountExists,
} from './_shared.mjs';

// THE MIGRATION'S OWN HEADER, CORRECTED BY MEASUREMENT.
//
// 20260808170000:222-229 says the RPCs' named `account_not_found_or_not_owned`
// refusals are "deliberately left in place unchanged — [they] still guard
// update, delete and split, where the row's account can change without the
// foreign key having anything new to check".
//
// The second half of that sentence is wrong, and it is worth a spec rather than
// a footnote because it is the difference between a defence that fires and one
// that cannot. On update the key HAS something new to check: the statement that
// writes `account_id` is exactly a write of the key's own columns, so the pair
// (new account, existing owner) is re-checked at that moment.
//
// MEASURED on the reference cluster (probe-fk-verbs.sql):
//
//     P3  update_transaction_atomic, patch {"account_id": a stranger's}
//           -> REFUSED, transactions_account_id_user_fkey, raised from INSIDE
//              the RPC's own UPDATE statement — before either of the two
//              `account_not_found_or_not_owned` checks on the move path
//     P5  the same move as a raw UPDATE
//           -> REFUSED, same key
//
// So on create, update AND delete the named refusals are now second, and on the
// paths where the only route to them was the my-row-your-account pairing they
// are unreachable altogether. That is not a reason to remove them: they are the
// guard for the next write path somebody adds that reaches a balance without
// going through this key. It is a reason to stop describing them as first.
//
// The row itself is legal and stays legal. `b2-moving-a-row-between-accounts-
// reverses-one-and-applies-the-other` is the same move between two accounts of
// the caller's own, accepted, with both balances moved — that spec is this
// one's control, and the pair of them is what makes "refused because of WHOSE
// account" a measurement rather than a claim.
export default {
  invariant: 'R-12',
  title: 'an edit may not move a row onto an account belonging to another login',
  design: 'transactions_account_id_user_fkey (20260808170000:439-443) firing inside update_transaction_atomic\'s own UPDATE (20260808100000:311), ahead of the two account_not_found_or_not_owned checks at :338-364',
  consequence: 'the row leaves one ledger without its balance moving and joins another that cannot see it — both accounts wrong, in opposite directions, with no error',
  parity: 'match',

  setup: secondUser,

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: { account_id: SOMEONE_ELSES_ACCOUNT },
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'FOREIGN KEY constraint failed' },
    postgres: { outcome: 'refused', error: 'transactions_account_id_user_fkey' },
  },

  state: [
    accountExists(SOMEONE_ELSES_ACCOUNT, '1'),
    {
      name: 'the_row_kept_the_account_it_had',
      sqlite: `SELECT account_id FROM transactions WHERE id = '${CORNER_SHOP}'`,
      postgres: `SELECT account_id::text FROM public.transactions WHERE id = '${CORNER_SHOP}'`,
      expect: EVERYDAY,
    },
    // Neither ledger moved: not the one that would have lost the row, not the
    // one that would have gained it.
    balanceOf(EVERYDAY, OPENING_BALANCE),
    balanceOf(SOMEONE_ELSES_ACCOUNT, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
    rowsInAccount(SOMEONE_ELSES_ACCOUNT, '0'),
    auditRowsInTotal('0'),
  ],
};
