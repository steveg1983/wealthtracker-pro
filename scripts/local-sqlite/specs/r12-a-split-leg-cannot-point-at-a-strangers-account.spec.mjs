import { secondLogin, splitParent } from './_setups.mjs';

// R-12 on `transaction_splits.transfer_account_id`.
//
// A split leg moves money to another account exactly the way a transaction-level
// transfer does (20260720120000:40-42) and is written by the same class of
// payload, so it needs the same pairing — otherwise the tighter rule on
// `transactions` would just push the shape one table sideways
// (20260808170000:100-104).
//
// The setup builds an ordinary two-line split and gives line 1 a target of the
// caller's OWN second account, unlinked. That is the control: the column
// accepts a target, so the refusal below is about whose account it is.
//
// Unlinked deliberately. A LINKED leg is immutable (S-9,
// trg_protect_linked_leg) and a spec that planted one would be measuring the
// leg lock rather than the ownership key — the same confusion
// specs/r5-split-leg-links-are-set-null-never-cascaded found the hard way.
export default {
  invariant: 'R-12',
  title: 'a split leg may not transfer to an account belonging to another login',
  design: 'transaction_splits_transfer_account_id_user_fkey — cloud 20260808170000:467-474, local schema.sql "THE OWNERSHIP PAIRING"',
  consequence: 'without it the rule on transactions moves the same defect one table sideways: a leg that moves a stranger\'s account, counted by every aggregate that reaches it',
  parity: 'match',

  sqlite: {
    setup: `
      ${secondLogin.sqlite}
      ${splitParent.sqlite}
      INSERT INTO _rpc_guard VALUES ('leg');
      UPDATE transaction_splits SET transfer_account_id = 'a0000000-0000-0000-0000-000000000002'
       WHERE id = '50000000-0000-0000-0000-000000000001';
      DELETE FROM _rpc_guard;`,
    action: `
      UPDATE transaction_splits SET transfer_account_id = 'a0000000-0000-0000-0000-000000000009'
       WHERE id = '50000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'FOREIGN KEY constraint failed' },
  },

  postgres: {
    setup: `
      ${secondLogin.postgres}
      ${splitParent.postgres}
      UPDATE public.transaction_splits SET transfer_account_id = 'a0000000-0000-0000-0000-000000000002'
       WHERE id = '50000000-0000-0000-0000-000000000001';`,
    action: `
      UPDATE public.transaction_splits SET transfer_account_id = 'a0000000-0000-0000-0000-000000000009'
       WHERE id = '50000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'transaction_splits_transfer_account_id_user_fkey' },
  },

  verify: [
    {
      // The control, read back: the leg kept the legal target the setup gave
      // it, so the column takes targets and it is the OWNER that was refused.
      name: 'the_leg_kept_the_target_of_your_own',
      sqlite: `SELECT COALESCE(transfer_account_id, 'CLEARED') FROM transaction_splits
                WHERE id = '50000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT COALESCE(transfer_account_id::text, 'CLEARED') FROM public.transaction_splits
                  WHERE id = '50000000-0000-0000-0000-000000000001'`,
      expect: 'a0000000-0000-0000-0000-000000000002',
    },
    {
      name: 'no_split_line_disagrees_with_its_target_about_its_owner',
      sqlite: `SELECT COUNT(*) FROM transaction_splits s JOIN accounts a ON a.id = s.transfer_account_id
                WHERE a.user_id <> s.user_id`,
      postgres: `SELECT COUNT(*) FROM public.transaction_splits s JOIN public.accounts a ON a.id = s.transfer_account_id
                  WHERE a.user_id <> s.user_id`,
      expect: '0',
    },
  ],
};
