// THE CONTROL, in the house style of restore-cross-user.test.sql: prove the
// lock is a lock and not a wall. If this spec ever fails, the split writer
// itself can no longer write, and the four S-5 specs above are passing for the
// wrong reason.
import { splitParent } from './_setups.mjs';

export default {
  invariant: 'S-5',
  title: 'the split writer can still change what the lock forbids everyone else',
  design: 'DESIGN.md §2.4 (_rpc_guard replaces the cloud\'s app.split_rpc session variable)',
  consequence: 'if the guard stops opening, the lock is indistinguishable from a schema that simply cannot record a split',
  parity: 'match',

  sqlite: {
    setup: splitParent.sqlite,
    action: `
      INSERT INTO _rpc_guard VALUES ('split');
      UPDATE transactions SET amount_minor = -3000 WHERE id = '70000000-0000-0000-0000-000000000001';
      UPDATE transaction_splits SET amount_minor = -2000 WHERE id = '50000000-0000-0000-0000-000000000001';
      DELETE FROM _rpc_guard;`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: splitParent.postgres,
    action: `
      SELECT set_config('app.split_rpc', '1', true);
      UPDATE public.transactions SET amount = -30.00 WHERE id = '70000000-0000-0000-0000-000000000001';
      UPDATE public.transaction_splits SET amount = -20.00 WHERE id = '50000000-0000-0000-0000-000000000001';
      SELECT set_config('app.split_rpc', '0', true);`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'parent_amount_minor',
      sqlite: `SELECT amount_minor FROM transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT (amount * 100)::bigint FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      expect: '-3000',
    },
    {
      // S-1 stated as an assertion both engines can run: the lines still sum to
      // the parent. verify_integrity() calls this one split_sum.
      name: 'split_sum_matches_parent',
      sqlite: `SELECT CASE WHEN (SELECT SUM(amount_minor) FROM transaction_splits
                              WHERE transaction_id = '70000000-0000-0000-0000-000000000001')
                          = (SELECT amount_minor FROM transactions
                              WHERE id = '70000000-0000-0000-0000-000000000001') THEN 1 ELSE 0 END`,
      postgres: `SELECT CASE WHEN (SELECT SUM(amount) FROM public.transaction_splits
                                WHERE transaction_id = '70000000-0000-0000-0000-000000000001')
                            = (SELECT amount FROM public.transactions
                                WHERE id = '70000000-0000-0000-0000-000000000001') THEN 1 ELSE 0 END`,
      expect: '1',
    },
  ],
};
