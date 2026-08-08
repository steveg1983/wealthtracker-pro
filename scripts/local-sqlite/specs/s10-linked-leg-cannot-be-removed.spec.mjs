import { splitWithTransferLeg } from './_setups.mjs';

export default {
  invariant: 'S-10',
  title: 'a split line that is one half of a transfer cannot be deleted',
  design: 'DESIGN.md §1.2 S-10 ("D — trg_protect_linked_leg_delete"); cloud 20260806094058:203-216',
  consequence: 'the counterpart points at a line that no longer exists — the one-sided transfer the whole feature exists to prevent',
  parity: 'divergent',
  reason: 'the cloud refuses this inside set_transaction_splits_with_legs only; a plain DELETE succeeds and strands the counterpart. The local file refuses the DELETE itself.',

  sqlite: {
    setup: splitWithTransferLeg.sqlite,
    action: `DELETE FROM transaction_splits WHERE id = '50000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'split_leg_line_removed' },
  },

  postgres: {
    setup: splitWithTransferLeg.postgres,
    action: `DELETE FROM public.transaction_splits WHERE id = '50000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      // T-11 restated: the counterpart still names a split line. In Postgres
      // that line is now gone, so the id it holds resolves to nothing — the FK
      // nulled it, which is the same stranding by another route.
      name: 'counterpart_still_names_a_line',
      sqlite: `SELECT CASE WHEN linked_transfer_split_id IS NULL THEN 'stranded' ELSE 'linked' END
                 FROM transactions WHERE id = '70000000-0000-0000-0000-000000000009'`,
      postgres: `SELECT CASE WHEN linked_transfer_split_id IS NULL THEN 'stranded' ELSE 'linked' END
                   FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000009'`,
      expect: 'stranded',
    },
  ],
};
