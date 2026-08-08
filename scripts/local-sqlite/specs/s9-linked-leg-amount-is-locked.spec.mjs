import { splitWithTransferLeg } from './_setups.mjs';

export default {
  invariant: 'S-9',
  title: 'a split line that is one half of a transfer cannot have its amount changed',
  design: 'DESIGN.md §1.2 S-9 ("D — trg_protect_linked_leg, stronger than the cloud"); cloud 20260806094058:314-331',
  consequence: 'the ledger claims two different sizes for one movement of money — the account on the other side moves by an amount no line records',
  parity: 'divergent',
  reason: 'in the cloud this is a procedural check inside set_transaction_splits_with_legs; any other writer may change the line. In the local file it is a trigger, so no write path can.',

  sqlite: {
    setup: splitWithTransferLeg.sqlite,
    action: `UPDATE transaction_splits SET amount_minor = -1000
              WHERE id = '50000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'split_leg_locked' },
  },

  postgres: {
    setup: splitWithTransferLeg.postgres,
    action: `UPDATE public.transaction_splits SET amount = -10.00
              WHERE id = '50000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      // T-10: a leg and its counterpart must be exact opposites. After the
      // unguarded edit they are not, and nothing in the cloud noticed.
      name: 'leg_and_counterpart_are_opposite',
      sqlite: `SELECT CASE WHEN (SELECT amount_minor FROM transaction_splits WHERE id = '50000000-0000-0000-0000-000000000001')
                          = -(SELECT amount_minor FROM transactions WHERE id = '70000000-0000-0000-0000-000000000009')
                     THEN 1 ELSE 0 END`,
      postgres: `SELECT CASE WHEN (SELECT amount FROM public.transaction_splits WHERE id = '50000000-0000-0000-0000-000000000001')
                            = -(SELECT amount FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000009')
                       THEN 1 ELSE 0 END`,
      expect: '0',
    },
  ],
};
