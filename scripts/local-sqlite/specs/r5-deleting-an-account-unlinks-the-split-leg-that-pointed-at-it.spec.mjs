import { splitWithTransferLeg } from './_setups.mjs';

export default {
  invariant: 'R-5',
  title: 'deleting an account unlinks the split line that pointed at it — with the leg guard held',
  design:
    'PHASE1-PLAN addendum §A (the R-5 leg guard) plus schema.sql\'s trg_unnest_account_references. ' +
    'The cloud reaches the same end state through transaction_splits_transfer_account_id_user_fkey ' +
    'ON DELETE SET NULL (20260808170000:470-474) and the split key\'s own SET NULL when the ' +
    'counterpart cascades',
  consequence:
    'a split line is the shape 86 of the owner\'s 364 imported split lines have; if deleting an ' +
    'account cannot pass one, neither the wipe nor an ordinary account deletion can run on a real file',
  parity: 'match',

  sqlite: {
    setup: splitWithTransferLeg.sqlite,
    // R-5: SQLite applies the clear as an UPDATE of the line, and
    // trg_protect_linked_leg watches every column being cleared. The guard is
    // the CALLER's to hold — the same block delete_transaction holds — and this
    // spec holds it because the wipe verb does.
    action: `
      INSERT OR IGNORE INTO _rpc_guard VALUES ('leg');
      DELETE FROM accounts WHERE id = 'a0000000-0000-0000-0000-000000000002';
      DELETE FROM _rpc_guard WHERE flag = 'leg';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: splitWithTransferLeg.postgres,
    action: `DELETE FROM public.accounts WHERE id = 'a0000000-0000-0000-0000-000000000002';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      // Both lines survive: they belong to a transaction in the OTHER account.
      name: 'lines_survive',
      sqlite: `SELECT COUNT(*) FROM transaction_splits`,
      postgres: `SELECT COUNT(*) FROM public.transaction_splits`,
      expect: '2',
    },
    {
      name: 'leg_is_unlinked',
      sqlite: `SELECT COALESCE(transfer_account_id, 'CLEARED') || '/' || COALESCE(linked_transfer_id, 'CLEARED')
                 FROM transaction_splits WHERE id = '50000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT COALESCE(transfer_account_id::text, 'CLEARED') || '/' || COALESCE(linked_transfer_id::text, 'CLEARED')
                   FROM public.transaction_splits WHERE id = '50000000-0000-0000-0000-000000000001'`,
      expect: 'CLEARED/CLEARED',
    },
    {
      // The counterpart lived in the deleted account, so it goes (R-1). The
      // parent survives with its lines; nothing points at a ghost.
      name: 'counterpart_is_gone',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE id = '70000000-0000-0000-0000-000000000009'`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000009'`,
      expect: '0',
    },
  ],
};
