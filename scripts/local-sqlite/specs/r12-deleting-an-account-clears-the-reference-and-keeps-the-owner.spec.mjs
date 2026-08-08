import { splitParent } from './_setups.mjs';

// THE SPEC FOR THE ONE PLACE THE TWO ENGINES REACH THE SAME BEHAVIOUR BY
// DIFFERENT MECHANISMS.
//
// Four of R-12's seven keys were `ON DELETE SET NULL` before they were widened,
// and "null the reference" now means "null ONE of the two columns" — because
// the second column is `user_id`, which is NOT NULL on all four tables.
//
//   Postgres  says so in the key:  ON DELETE SET NULL (transfer_account_id).
//             Column-list SET NULL is PostgreSQL 15+, and 20260808170000's
//             guard 1 refuses to apply on anything older rather than shipping a
//             bare SET NULL that would null user_id too (:274-287).
//
//   SQLite    CANNOT SAY IT. MEASURED (probe-composite-fk.mjs, SQLite 3.50.0):
//               ON DELETE SET NULL (pid)     -> near "(": syntax error
//               bare SET NULL, uid NULLABLE  -> BOTH columns nulled
//               bare SET NULL, uid NOT NULL  -> the parent DELETE is REFUSED,
//                                               "NOT NULL constraint failed"
//             So the four keys carry no on-delete action and
//             trg_unnest_account_references — a BEFORE DELETE trigger on
//             accounts — clears the account column and leaves user_id alone.
//
// A DIVERGENCE IN MECHANISM IS NOT A DIVERGENCE IN BEHAVIOUR, and this file is
// what makes that claim checkable rather than a sentence in a header. It
// deletes ONE account that four different rows point at and reads all four
// back: reference cleared, owner intact, row alive, on both engines. Declared
// `match`, so if the two ever stop agreeing the harness says so.
//
// THE FOURTH REFERENCE — the split leg — is deliberately UNLINKED. A linked leg
// is immutable (S-9), and specs/r5-split-leg-links-are-set-null-never-cascaded
// records what happens when a SET NULL meets that lock: SQLite refuses the
// whole delete. That is a real, separate, already-declared divergence; planting
// a linked leg here would measure it a second time instead of measuring this.
//
// Holiday fund is deleted rather than Rainy day because Rainy day holds the
// split's own rows in some sibling specs; a spec that deletes the account it is
// also observing is measuring cascade order, not SET NULL.
export default {
  invariant: 'R-12',
  title: 'deleting an account clears every reference to it without disturbing the owner beside it',
  design: 'cloud ON DELETE SET NULL (col) at 20260808170000:456-514; local trg_unnest_account_references, because SQLite has no column-list SET NULL',
  consequence: 'a bare SET NULL on the composite key would null user_id too — which is NOT NULL — so deleting an account anybody had transferred to would become impossible',
  parity: 'match',

  sqlite: {
    setup: `
      ${splitParent.sqlite}
      INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
        VALUES ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
                'Holiday fund', 'savings', 0, 0);

      -- 1. a transaction's far side
      UPDATE transactions SET transfer_account_id = 'a0000000-0000-0000-0000-000000000003'
       WHERE id = '70000000-0000-0000-0000-000000000001';
      -- 2. a split line's far side, UNLINKED (see the header)
      INSERT INTO _rpc_guard VALUES ('leg');
      UPDATE transaction_splits SET transfer_account_id = 'a0000000-0000-0000-0000-000000000003'
       WHERE id = '50000000-0000-0000-0000-000000000001';
      DELETE FROM _rpc_guard;
      -- 3. a goal
      INSERT INTO goals (id, user_id, name, target_amount_minor, current_amount_minor, account_id)
        VALUES ('90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
                'New boiler', 250000, 0, 'a0000000-0000-0000-0000-000000000003');
      -- 4. a nested account
      UPDATE accounts SET parent_account_id = 'a0000000-0000-0000-0000-000000000003'
       WHERE id = 'a0000000-0000-0000-0000-000000000002';`,
    action: `DELETE FROM accounts WHERE id = 'a0000000-0000-0000-0000-000000000003';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: `
      ${splitParent.postgres}
      INSERT INTO public.accounts (id, user_id, name, type, balance, initial_balance)
        VALUES ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
                'Holiday fund', 'savings', 0.00, 0.00);

      UPDATE public.transactions SET transfer_account_id = 'a0000000-0000-0000-0000-000000000003'
       WHERE id = '70000000-0000-0000-0000-000000000001';
      UPDATE public.transaction_splits SET transfer_account_id = 'a0000000-0000-0000-0000-000000000003'
       WHERE id = '50000000-0000-0000-0000-000000000001';
      INSERT INTO public.goals (id, user_id, name, target_amount, current_amount, account_id)
        VALUES ('90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
                'New boiler', 2500.00, 0.00, 'a0000000-0000-0000-0000-000000000003');
      UPDATE public.accounts SET parent_account_id = 'a0000000-0000-0000-0000-000000000003'
       WHERE id = 'a0000000-0000-0000-0000-000000000002';`,
    action: `DELETE FROM public.accounts WHERE id = 'a0000000-0000-0000-0000-000000000003';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'transaction_far_side_cleared_owner_kept',
      sqlite: `SELECT COALESCE(transfer_account_id, 'CLEARED') || '/' || user_id FROM transactions
                WHERE id = '70000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT COALESCE(transfer_account_id::text, 'CLEARED') || '/' || user_id::text
                   FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      expect: 'CLEARED/11111111-1111-1111-1111-111111111111',
    },
    {
      name: 'split_leg_far_side_cleared_owner_kept',
      sqlite: `SELECT COALESCE(transfer_account_id, 'CLEARED') || '/' || user_id FROM transaction_splits
                WHERE id = '50000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT COALESCE(transfer_account_id::text, 'CLEARED') || '/' || user_id::text
                   FROM public.transaction_splits WHERE id = '50000000-0000-0000-0000-000000000001'`,
      expect: 'CLEARED/11111111-1111-1111-1111-111111111111',
    },
    {
      name: 'goal_untied_owner_kept',
      sqlite: `SELECT COALESCE(account_id, 'CLEARED') || '/' || user_id FROM goals
                WHERE id = '90000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT COALESCE(account_id::text, 'CLEARED') || '/' || user_id::text
                   FROM public.goals WHERE id = '90000000-0000-0000-0000-000000000001'`,
      expect: 'CLEARED/11111111-1111-1111-1111-111111111111',
    },
    {
      name: 'child_account_unnested_owner_kept',
      sqlite: `SELECT COALESCE(parent_account_id, 'CLEARED') || '/' || user_id FROM accounts
                WHERE id = 'a0000000-0000-0000-0000-000000000002'`,
      postgres: `SELECT COALESCE(parent_account_id::text, 'CLEARED') || '/' || user_id::text
                   FROM public.accounts WHERE id = 'a0000000-0000-0000-0000-000000000002'`,
      expect: 'CLEARED/11111111-1111-1111-1111-111111111111',
    },
    {
      // All four rows are still THERE. "Cleared" must not have meant "deleted"
      // on either engine, which is R-5's and R-8's whole point.
      name: 'nothing_was_cascaded_away',
      sqlite: `SELECT (SELECT COUNT(*) FROM transactions WHERE id = '70000000-0000-0000-0000-000000000001')
                    + (SELECT COUNT(*) FROM transaction_splits WHERE id = '50000000-0000-0000-0000-000000000001')
                    + (SELECT COUNT(*) FROM goals WHERE id = '90000000-0000-0000-0000-000000000001')
                    + (SELECT COUNT(*) FROM accounts WHERE id = 'a0000000-0000-0000-0000-000000000002')`,
      postgres: `SELECT (SELECT COUNT(*) FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000001')
                      + (SELECT COUNT(*) FROM public.transaction_splits WHERE id = '50000000-0000-0000-0000-000000000001')
                      + (SELECT COUNT(*) FROM public.goals WHERE id = '90000000-0000-0000-0000-000000000001')
                      + (SELECT COUNT(*) FROM public.accounts WHERE id = 'a0000000-0000-0000-0000-000000000002')`,
      expect: '4',
    },
    {
      name: 'the_account_itself_is_gone',
      sqlite: `SELECT COUNT(*) FROM accounts WHERE id = 'a0000000-0000-0000-0000-000000000003'`,
      postgres: `SELECT COUNT(*) FROM public.accounts WHERE id = 'a0000000-0000-0000-0000-000000000003'`,
      expect: '0',
    },
  ],
};
