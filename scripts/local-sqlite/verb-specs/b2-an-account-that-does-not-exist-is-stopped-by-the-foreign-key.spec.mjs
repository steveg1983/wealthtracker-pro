import {
  USER, EVERYDAY, OPENING_BALANCE,
  balanceOf, balanceIdentityHolds, rowsInAccount, auditRowsInTotal, accountExists,
} from './_shared.mjs';

const NO_SUCH_ACCOUNT = 'a0000000-0000-0000-0000-0000000000ff';

// The control for its sibling. Both engines refuse, and NEITHER of them uses
// `account_not_found_or_not_owned` to do it: `transactions.account_id` is a
// foreign key, so the INSERT fails before the balance UPDATE is ever reached.
//
// It is worth a spec of its own because the obvious way to test "a missing
// account is refused" is to invent a uuid — and that test passes on a port with
// NO changes() assert at all. This spec pins which mechanism fires, so the pair
// of them cannot both be satisfied by the wrong one.
//
// On SQLite the foreign key is only enforced because the connection said so
// (PRAGMA foreign_keys defaults to 0, per connection). So this spec is also a
// live check that the Rust connection setup did its job: if the pragma stopped
// being applied, the INSERT would succeed, the UPDATE would match nothing, and
// the refusal would change name.
//
// THE CONSTRAINT NAME MOVED, on purpose.
// 20260808170000_rows_cannot_name_a_foreign_account.sql widened this key from
// `(account_id)` to `(account_id, user_id)` and RENAMED it in the same breath —
// `transactions_account_id_fkey` → `transactions_account_id_user_fkey` — so
// that a reader can tell the two-column key from the one-column key it replaced
// without reading the definition (:178-182). This spec pins the name, so the
// rename lands here; that is the pin working, not the pin being a nuisance.
//
// The migration considered and REFUSED the alternative of keeping the old name
// to leave this spec green (:231-234): a composite key still called
// `transactions_account_id_fkey` would have left this file passing while it
// silently stopped distinguishing "no such account" from "not your account" —
// the two cases this spec and its sibling exist to hold apart.
//
// So the distinction moved off the error string and onto the data, and
// `accountExists` is where it now lives: here the named account is ABSENT and a
// single-column key would have refused this too; in the sibling it is PRESENT
// and only the ownership half of the composite key can refuse it.
export default {
  invariant: 'R-1',
  title: 'an account id that names nothing is stopped by the foreign key, not by the named refusal',
  design: 'transactions_account_id_user_fkey (20260808170000:439-443), which replaced initial-schema.sql:1932\'s transactions_account_id_fkey; DESIGN.md §2.1 for why SQLite needs the pragma',
  consequence: 'confusing this with the not-owned case lets a port ship with no changes() assert and a green suite',
  parity: 'match',

  command: {
    verb: 'create_transaction',
    payload: {
      id: '70000000-0000-0000-0000-0000000000a6',
      user_id: USER,
      account_id: NO_SUCH_ACCOUNT,
      description: 'An account that is not there',
      amount: '-10.00',
      type: 'expense',
      date: '2024-03-02',
    },
  },

  // Both refuse; each engine words its own foreign key failure. The runner
  // matches a substring per engine, so the difference in prose is declared
  // rather than smoothed over.
  expect: {
    sqlite: { outcome: 'refused', error: 'FOREIGN KEY constraint failed' },
    postgres: { outcome: 'refused', error: 'transactions_account_id_user_fkey' },
  },

  state: [
    // The half of the composite key doing the work here: there is no such
    // account, so EXISTENCE refuses this one. The sibling's account is present.
    accountExists(NO_SUCH_ACCOUNT, '0'),
    balanceOf(EVERYDAY, OPENING_BALANCE),
    balanceIdentityHolds(EVERYDAY),
    rowsInAccount(EVERYDAY, '1'),
    auditRowsInTotal('0'),
  ],
};
