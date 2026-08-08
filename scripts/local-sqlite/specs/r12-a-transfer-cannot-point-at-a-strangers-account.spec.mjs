import { secondLogin } from './_setups.mjs';

// SUCCESSOR TO A SPEC WHOSE SUBJECT NO LONGER EXISTS — AND THE ONE WHOSE
// REASON-FOR-BEING IS NOW CLOSED STRUCTURALLY RATHER THAN MERELY UNTESTED.
//
// LINEAGE
//   verb-specs/counterpart-a-row-against-a-foreign-account-skips-the-currency-
//              guard.spec.mjs                   (retired 2026-08-08)
//
// That spec pinned a HOLE rather than a rule. `create_transfer_counterpart`
// reads (20260721090000:65-74):
//
//     SELECT * INTO v_src_acct FROM public.accounts
//      WHERE id = v_src.account_id AND user_id = v_src.user_id;
//     IF FOUND AND … currency <> … THEN RAISE
//
// For a row whose account belongs to another login the lookup finds NOTHING,
// `IF FOUND` is false, and the currency guard is skipped in silence — so a
// counterpart is minted with no currency comparison at all and a USD ledger
// moves by a GBP magnitude. MEASURED (probe-transfers2.sh,
// `ctc-source-account-foreign`) and reproduced by the port, on the rule that a
// local edition which refuses what the cloud accepts is a bug in the port.
//
// THE HOLE IS NOW CLOSED, AND CLOSED IN THE RIGHT PLACE. It is not closed by
// changing `IF FOUND` to `IF NOT FOUND THEN RAISE` — nobody rewrote the guard,
// and nobody should have to. It is closed because the guard's PREMISE is now
// enforced by the schema: `WHERE id = … AND user_id = …` cannot fail to find
// the account of a row that exists, because a row whose account belongs to
// somebody else is not a row either engine will hold. The guard is not wrong;
// its premise was never guaranteed, and now it is. That is the difference
// between a defect fixed and a defect made unreachable, and this is the second
// kind — which is the durable kind, because the next function written against
// the same assumption inherits it for free.
//
// This file proves the pairing the retired spec depended on is refused, on the
// FAR side of a transfer specifically. That column is R-12's weakest link and
// the reason the migration calls the pairing non-optional: the cloud's
// create_transaction_atomic copies `transfer_account_id` straight out of the
// caller's payload with NO ownership check at all (20260808150000:196), so
// unlike `account_id` this one was reachable through a trusted RPC and not only
// through a raw insert. MEASURED before the key existed: accepted. After:
// refused (probe-fk-verbs.sql, P1 and P4); a verb spec drives that path.
export default {
  invariant: 'R-12',
  title: 'the far side of a transfer may not be an account belonging to another login',
  design: 'transactions_transfer_account_id_user_fkey — cloud 20260808170000:453-463, local schema.sql "THE OWNERSHIP PAIRING"; the guard whose premise it restores is 20260721090000:65-74',
  consequence: 'the currency guard is skipped in silence and a counterpart is minted in another currency at the source\'s magnitude — the exact movement that guard exists to refuse',
  parity: 'match',

  sqlite: {
    // The setup plants the SAME SHAPE pointing at an account of the caller's
    // own. It is the control, built in: if it were refused the setup would
    // fail, and the refusal below could no longer be attributed to ownership.
    setup: `
      ${secondLogin.sqlite}
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                                transfer_account_id)
      VALUES ('70000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'To my own savings', -1000, 'transfer', '2024-05-01',
              'a0000000-0000-0000-0000-000000000002');
      UPDATE accounts SET balance_minor = balance_minor - 1000
       WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    action: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                                transfer_account_id)
      VALUES ('70000000-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'To a stranger', -1000, 'transfer', '2024-05-01',
              'a0000000-0000-0000-0000-000000000009');`,
    expect: { outcome: 'refused', message: 'FOREIGN KEY constraint failed' },
  },

  postgres: {
    setup: `
      ${secondLogin.postgres}
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                       transfer_account_id)
      VALUES ('70000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'To my own savings', -10.00, 'transfer', '2024-05-01',
              'a0000000-0000-0000-0000-000000000002');
      UPDATE public.accounts SET balance = balance - 10.00
       WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    action: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                       transfer_account_id)
      VALUES ('70000000-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'To a stranger', -10.00, 'transfer', '2024-05-01',
              'a0000000-0000-0000-0000-000000000009');`,
    expect: { outcome: 'refused', message: 'transactions_transfer_account_id_user_fkey' },
  },

  verify: [
    {
      name: 'no_row_landed_at_all',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE id = '70000000-0000-0000-0000-00000000000f'`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE id = '70000000-0000-0000-0000-00000000000f'`,
      expect: '0',
    },
    {
      // The guard's premise, expressed as the migration's own verification 4
      // for this column: no transfer names an account of a different login.
      name: 'no_transfer_disagrees_with_its_far_side_about_its_owner',
      sqlite: `SELECT COUNT(*) FROM transactions t JOIN accounts a ON a.id = t.transfer_account_id
                WHERE a.user_id <> t.user_id`,
      postgres: `SELECT COUNT(*) FROM public.transactions t JOIN public.accounts a ON a.id = t.transfer_account_id
                  WHERE a.user_id <> t.user_id`,
      expect: '0',
    },
    {
      // The CONTROL, planted by the setup and read back here: the same shape
      // pointing at an account of the caller's own IS legal. Without it the
      // refusal above could be about the column rather than about the owner.
      name: 'the_same_shape_between_your_own_accounts_is_there',
      sqlite: `SELECT COUNT(*) FROM transactions
                WHERE id = '70000000-0000-0000-0000-00000000000c'
                  AND transfer_account_id = 'a0000000-0000-0000-0000-000000000002'`,
      postgres: `SELECT COUNT(*) FROM public.transactions
                  WHERE id = '70000000-0000-0000-0000-00000000000c'
                    AND transfer_account_id = 'a0000000-0000-0000-0000-000000000002'`,
      expect: '1',
    },
  ],
};
