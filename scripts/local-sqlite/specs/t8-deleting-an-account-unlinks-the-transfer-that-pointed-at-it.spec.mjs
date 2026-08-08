import { transferPair } from './_setups.mjs';

export default {
  invariant: 'T-8',
  title: 'deleting an account leaves the transfer that pointed at it unlinked, not refused',
  design:
    'DESIGN.md §1.3 T-8; the local half is schema.sql\'s trg_unnest_account_references, which exists ' +
    'only because SQLite has no ON DELETE SET NULL (column). Postgres reaches the same end state ' +
    'through two independent key actions (20260808170000:456-460 nulls the target, the transactions ' +
    'key nulls the link when the counterpart cascades)',
  consequence:
    'without the link clear, "delete everything" is refused outright on any file holding one linked ' +
    'transfer — the wipe stops on a CHECK about transfer targets while the user is trying to erase ' +
    'the whole ledger, and nothing in the UI can get past it',
  parity: 'match',

  // Deleting Rainy day takes the +15.00 row that lives in it (R-1) and leaves
  // the −15.00 row in Everyday behind, pointing at neither.
  sqlite: {
    setup: transferPair.sqlite,
    action: `DELETE FROM accounts WHERE id = 'a0000000-0000-0000-0000-000000000002';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: transferPair.postgres,
    action: `DELETE FROM public.accounts WHERE id = 'a0000000-0000-0000-0000-000000000002';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'survivor_count',
      sqlite: `SELECT COUNT(*) FROM transactions`,
      postgres: `SELECT COUNT(*) FROM public.transactions`,
      expect: '2',
    },
    {
      // Both columns, in one string, because the whole finding is that they
      // must be cleared TOGETHER: a row with the link kept and the target
      // nulled is the state transactions_linked_has_target refuses.
      name: 'survivor_is_unlinked',
      sqlite: `SELECT COALESCE(transfer_account_id, 'CLEARED') || '/' || COALESCE(linked_transfer_id, 'CLEARED')
                 FROM transactions WHERE id = '70000000-0000-0000-0000-000000000004'`,
      postgres: `SELECT COALESCE(transfer_account_id::text, 'CLEARED') || '/' || COALESCE(linked_transfer_id::text, 'CLEARED')
                   FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000004'`,
      expect: 'CLEARED/CLEARED',
    },
  ],
};
