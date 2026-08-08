import { secondLogin } from './_setups.mjs';

// SUCCESSOR TO A SPEC WHOSE SUBJECT NO LONGER EXISTS.
//
// LINEAGE
//   verb-specs/b1-a-delete-that-cannot-reach-its-account-refuses-rather-than-
//              losing-the-money.spec.mjs        (retired 2026-08-08)
//
// That spec measured `delete_transaction`'s `changes() != 1` assert — the one
// AUDIT3 §3 called "the highest-value single line item in this report", because
// SQLite reports zero changed rows after a balance write that reaches nothing
// and raises NOTHING. On the DELETE path that means the row is gone and its
// money stays in a balance for ever, with no artefact left to notice it by.
//
// Reaching that assert required a row this user owns sitting against an account
// they do not, "the pairing neither schema forbids", because the account foreign
// key caught every other way a balance write could miss.
//
// 20260808170000_rows_cannot_name_a_foreign_account.sql, and the local twin of
// it in schema.sql, now forbid the pairing. The spec's fixture stopped being
// buildable, which is the strongest possible evidence that the migration does
// what it claims: THE STATE IT MEASURED CANNOT BE REACHED. This file records
// that ending by proving the refusal directly.
//
// The retired spec's rule is not lost. `changes() != 1` is still in the Rust
// port and `IF NOT FOUND` is still in the cloud RPC, both untouched — they are
// now the second line of defence behind a key, which is where a hand-written
// assert belongs. What is gone is the only route that reached them.
export default {
  invariant: 'R-12',
  title: 'a transaction may not be filed against an account belonging to another login',
  design: 'transactions_account_id_user_fkey — cloud 20260808170000:436-443, local schema.sql "THE OWNERSHIP PAIRING". NEW: R-12 is not one of DESIGN.md §1.8\'s eleven',
  consequence: 'the row is invisible to the account\'s owner and counted by every aggregate that reaches their data through account_id; and locally it is the one shape that lets a balance write silently reach nothing',
  parity: 'match',

  sqlite: {
    setup: secondLogin.sqlite,
    action: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
      VALUES ('70000000-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000009', 'Filed against a stranger',
              -1000, 'expense', '2024-05-01');`,
    expect: { outcome: 'refused', message: 'FOREIGN KEY constraint failed' },
  },

  postgres: {
    setup: secondLogin.postgres,
    action: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date)
      VALUES ('70000000-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000009', 'Filed against a stranger',
              -10.00, 'expense', '2024-05-01');`,
    expect: { outcome: 'refused', message: 'transactions_account_id_user_fkey' },
  },

  verify: [
    {
      // The account is REAL — which is what makes this the ownership half of
      // the key doing the work rather than the existence half. A single-column
      // foreign key would have accepted this row.
      name: 'the_account_named_does_exist',
      sqlite: `SELECT COUNT(*) FROM accounts WHERE id = 'a0000000-0000-0000-0000-000000000009'`,
      postgres: `SELECT COUNT(*) FROM public.accounts WHERE id = 'a0000000-0000-0000-0000-000000000009'`,
      expect: '1',
    },
    {
      name: 'no_row_landed_in_the_strangers_account',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE account_id = 'a0000000-0000-0000-0000-000000000009'`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE account_id = 'a0000000-0000-0000-0000-000000000009'`,
      expect: '0',
    },
    {
      // The measurement the migration itself makes (its verification 4): zero
      // rows whose account belongs to a different login.
      name: 'no_transaction_disagrees_with_its_account_about_its_owner',
      sqlite: `SELECT COUNT(*) FROM transactions t JOIN accounts a ON a.id = t.account_id
                WHERE a.user_id <> t.user_id`,
      postgres: `SELECT COUNT(*) FROM public.transactions t JOIN public.accounts a ON a.id = t.account_id
                  WHERE a.user_id <> t.user_id`,
      expect: '0',
    },
  ],
};
