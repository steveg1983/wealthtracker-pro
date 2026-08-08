import { splitWithTransferLeg } from './_setups.mjs';

// READ THIS ONE. It is the spec that found something.
//
// The intent (R-5) is that deleting a transaction never deletes a split line in
// another account: the link is ON DELETE SET NULL, never CASCADE. Postgres does
// exactly that. SQLite refuses the delete outright, because its SET NULL fires
// the BEFORE UPDATE trigger that S-9 installs on transaction_splits, and that
// trigger raises.
//
// So in the local file, deleting a transfer that is one half of a split leg is
// impossible outside the 'leg' guard — including through the very remedy the
// error message recommends ("delete that transfer first, then edit the split").
// The command layer must therefore hold _rpc_guard('leg') while deleting any
// transaction that a split line links to. Nothing in DESIGN.md says so yet.
export default {
  invariant: 'R-5',
  title: 'deleting a transfer counterpart must clear the split line, not delete it',
  design: 'DESIGN.md §1.8 R-5 ("D"); cloud 20260720120000:40-48, rationale at :18',
  consequence: 'a cascade here would delete a line of a split in another account, moving that account by an amount nobody asked to move',
  parity: 'divergent',
  reason: 'FINDING: SQLite applies ON DELETE SET NULL as an UPDATE of the child row, which fires trg_protect_linked_leg and aborts the whole delete. Postgres allows it and nulls the link. R-5 holds in both — no cascade — but the SQLite side is unreachable without the leg guard.',

  sqlite: {
    setup: splitWithTransferLeg.sqlite,
    action: `DELETE FROM transactions WHERE id = '70000000-0000-0000-0000-000000000009';`,
    expect: { outcome: 'refused', message: 'split_leg_locked' },
  },

  postgres: {
    setup: splitWithTransferLeg.postgres,
    action: `DELETE FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000009';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'leg_line_survives',
      sqlite: `SELECT COUNT(*) FROM transaction_splits WHERE id = '50000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT COUNT(*) FROM public.transaction_splits WHERE id = '50000000-0000-0000-0000-000000000001'`,
      expect: '1',
    },
    {
      name: 'leg_link_cleared',
      sqlite: `SELECT COALESCE(linked_transfer_id, 'CLEARED') FROM transaction_splits
                WHERE id = '50000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT COALESCE(linked_transfer_id::text, 'CLEARED') FROM public.transaction_splits
                  WHERE id = '50000000-0000-0000-0000-000000000001'`,
      expect: 'CLEARED',
    },
  ],
};
