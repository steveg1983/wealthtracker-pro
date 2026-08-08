import { secondLogin } from './_setups.mjs';

// SUCCESSOR TO A SPEC WHOSE SUBJECT NO LONGER EXISTS.
//
// LINEAGE
//   verb-specs/split-a-parent-whose-account-is-not-yours-refuses-rather-than-
//              losing-the-money.spec.mjs        (retired 2026-08-08)
//
// That spec was refusal 21 of 21 in `set_transaction_splits_with_legs` — the
// SECOND `account_not_found_or_not_owned` in the function, the one a port is
// most likely to drop because it looks like a copy of the first. Its point:
// the split itself is perfectly legal, so a writer that stored the lines and
// skipped the unreachable balance move would leave the account's balance and
// the sum of its rows disagreeing for ever, silently. It reached that branch
// through a row already sitting against a stranger's account.
//
// The composite key removed the fixture, so it removed the branch. This file
// takes the SECOND half of what the retired spec was really about: it is not
// only the INSERT that has to be refused. A row that is legal today can be
// MOVED, and the migration's own header says the RPCs' named refusals stay in
// place because they "still guard update, delete and split, where the row's
// account can change without the foreign key having anything new to check"
// (20260808170000:225-227).
//
// MEASURED, and worth stating plainly because it corrects that sentence: on the
// UPDATE path the key HAS something to check, and it checks it first. A direct
// `UPDATE … SET account_id` onto a stranger's account is refused by the key on
// both engines, and so is the same move made through
// `update_transaction_atomic` (probe-fk-verbs.sql, P3 and P5). The named
// refusals are second everywhere the row's own account column is written, not
// only on create.
//
// This spec drives the raw UPDATE deliberately rather than the RPC: the point
// is that the SCHEMA holds, with no function in the way that could be replaced.
export default {
  invariant: 'R-12',
  title: 'an existing transaction may not be re-pointed at an account belonging to another login',
  design: 'transactions_account_id_user_fkey — cloud 20260808170000:436-443, local schema.sql "THE OWNERSHIP PAIRING"; against that file\'s own :225-227',
  consequence: 'the lines land, the balance never moves, and the account disagrees with the sum of its own rows for ever — the shape AUDIT3 §3 measured on the create path',
  parity: 'match',

  sqlite: {
    setup: secondLogin.sqlite,
    action: `
      UPDATE transactions SET account_id = 'a0000000-0000-0000-0000-000000000009'
       WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'FOREIGN KEY constraint failed' },
  },

  postgres: {
    setup: secondLogin.postgres,
    action: `
      UPDATE public.transactions SET account_id = 'a0000000-0000-0000-0000-000000000009'
       WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'transactions_account_id_user_fkey' },
  },

  verify: [
    {
      name: 'the_row_kept_the_account_it_had',
      sqlite: `SELECT account_id FROM transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT account_id::text FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      expect: 'a0000000-0000-0000-0000-000000000001',
    },
    {
      // B-1 on the account that would have lost the row: balance =
      // initial_balance + SUM(amount). A refused move must leave it holding.
      name: 'the_ledger_identity_still_holds_for_everyday',
      sqlite: `SELECT (a.balance_minor - a.initial_balance_minor
                       - COALESCE((SELECT SUM(t.amount_minor) FROM transactions t
                                    WHERE t.account_id = a.id), 0))
                 FROM accounts a WHERE a.id = 'a0000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT (a.balance - a.initial_balance
                         - COALESCE((SELECT SUM(t.amount) FROM public.transactions t
                                      WHERE t.account_id = a.id), 0))::text
                   FROM public.accounts a WHERE a.id = 'a0000000-0000-0000-0000-000000000001'`,
      expect: { sqlite: '0', postgres: '0.00' },
    },
  ],
};
