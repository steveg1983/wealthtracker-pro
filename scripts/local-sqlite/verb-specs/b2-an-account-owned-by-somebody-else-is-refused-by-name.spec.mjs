import {
  USER, EVERYDAY, OPENING_BALANCE, SOMEONE_ELSES_ACCOUNT, secondUser,
  balanceOf, balanceIdentityHolds, rowsInAccount, auditRowsInTotal, accountExists,
} from './_shared.mjs';

// THE SPEC THE WHOLE VERB EXISTED TO SATISFY, AND THE DAY IT STOPPED BEING THE
// FIRST LINE OF DEFENCE.
//
// It was written like this, and the reasoning was right at the time:
//
//   "Postgres gets `IF NOT FOUND` free after an UPDATE. SQLite reports zero
//    changed rows and raises NOTHING — measured, and the reason this verb reads
//    `changes()` and refuses with the RPC's own name."
//
// The filename still says `…-is-refused-by-name` and is deliberately left
// alone: renaming it would break the lineage between what this measured before
// 20260808170000_rows_cannot_name_a_foreign_account.sql and what it measures
// after. What it asserts has changed, and this header is the record of why.
//
// WHAT CHANGED. That migration widened `transactions.account_id` from a key on
// (account) to a key on (account, owner). The pairing the RPC's `changes()`
// assert existed to catch — my row, your account — is no longer a row either
// engine will hold, so the INSERT is refused before any balance statement is
// reached, on BOTH engines:
//
//   postgres  transactions_account_id_user_fkey        (SQLSTATE 23503)
//   sqlite    FOREIGN KEY constraint failed            (code constraint_violated)
//
// The prose differs and the mechanism does not: one composite key, two engines,
// same verdict, nothing partial left behind on either. That convergence is the
// point of the parity work — before it, Postgres refused at the key and SQLite
// still refused by the RPC's name, which is two engines disagreeing about WHY.
//
// WHAT KEEPS THIS APART FROM ITS SIBLING, now that both refusals are worded the
// same. `b2-an-account-that-does-not-exist-is-stopped-by-the-foreign-key` names
// a uuid nobody has; this one names an account that IS THERE. A single-column
// key would have caught the sibling and NOT this — so the distinction the pair
// was written to hold is now made by what is in the database rather than by the
// error string, and `accountExists` is the assertion that holds it. The
// migration refused to give the widened keys their old names back for exactly
// this reason (20260808170000:231-234): a green spec that has quietly stopped
// distinguishing its two cases is worse than a red one that says so.
//
// The RPC's own `account_not_found_or_not_owned` is NOT gone and is not
// weakened — it is now second, on the create path, and the message a user sees
// here is the database's rather than ours (20260808170000:222-229). The
// `changes()` assert in the Rust port stays for the same reason the cloud's
// stays: it is the guard for the day someone adds a write path that reaches a
// balance without going through this key.
export default {
  invariant: 'B-2',
  title: 'an account that exists but belongs to another login is refused before a balance can move',
  design: 'transactions_account_id_user_fkey (20260808170000:439-443) firing ahead of the RPC\'s own refusal (live RPC 20260808150000:214-218)',
  consequence: 'without either, the row lands, the balance never moves, and B-1 is broken silently on the first write',
  parity: 'match',

  setup: secondUser,

  command: {
    verb: 'create_transaction',
    payload: {
      id: '70000000-0000-0000-0000-0000000000a5',
      user_id: USER,
      account_id: SOMEONE_ELSES_ACCOUNT,
      description: 'Not mine to spend',
      amount: '-10.00',
      type: 'expense',
      date: '2024-03-02',
    },
  },

  // Both refuse at the same key; each engine words its own failure. Postgres
  // names the constraint, SQLite has no constraint names to give.
  expect: {
    sqlite: { outcome: 'refused', error: 'FOREIGN KEY constraint failed' },
    postgres: { outcome: 'refused', error: 'transactions_account_id_user_fkey' },
  },

  state: [
    // THE assertion that keeps this spec apart from its sibling: the account is
    // real. Only the ownership half of the composite key can refuse this row.
    accountExists(SOMEONE_ELSES_ACCOUNT, '1'),
    // Nothing survived the refusal on either engine: no row, no balance move,
    // no audit entry. An atomic verb that refuses must leave no trace.
    balanceOf(SOMEONE_ELSES_ACCOUNT, '0.00'),
    balanceOf(EVERYDAY, OPENING_BALANCE),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
    rowsInAccount(SOMEONE_ELSES_ACCOUNT, '0'),
    auditRowsInTotal('0'),
  ],
};
