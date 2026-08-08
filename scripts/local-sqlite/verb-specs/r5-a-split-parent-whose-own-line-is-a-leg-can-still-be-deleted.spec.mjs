import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, LEG_COUNTERPART, LEG_LINE,
  splitWithTransferLeg, balanceOf, balanceIdentityHolds, rowExists,
  storedText, auditRowsForDelete,
} from './_shared.mjs';

// THE HALF OF THE R-5 OBLIGATION NOBODY HAD SEEN, found while writing the verb.
//
// PHASE1-PLAN's addendum §A says the guard is needed "iff a split line links to
// it". That is one of the two directions this delete can touch a leg:
//
//   inbound  — a line elsewhere has linked_transfer_id = <this row>. SET NULL
//              fires an UPDATE, and trg_protect_linked_leg raises
//              `split_leg_locked`. This is the addendum's case, and the sibling
//              spec r5-the-delete-verb-clears-a-split-leg-instead-of-refusing.
//
//   outbound — THIS row is the split parent, and one of its OWN lines is a leg.
//              The delete CASCADEs those lines away, and
//              trg_protect_linked_leg_delete raises `split_leg_line_removed`.
//
// MEASURED, both directions, both engines, 2026-08-08:
//
//     sqlite, no guard   REFUSED  split_leg_line_removed
//     sqlite, guard      OK       splits=0, counterpart's split link cleared
//     postgres           OK       splits=0, counterpart's split link cleared
//
// So a guard covering only the inbound direction would leave "delete a split
// transaction that has a transfer line on it" working in the cloud and refused
// locally. That is an ordinary thing for a user to do — split a bill, make one
// line a transfer to savings, later delete the whole transaction — and it would
// have diverged silently.
//
// Why permitting it is right rather than merely convenient: the trigger's own
// message says the fear is "the transaction on the other side would be left
// pointing at a line that no longer exists", and on THIS path that does not
// happen. `transactions.linked_transfer_split_id` is itself ON DELETE SET NULL,
// so the counterpart is stranded — T-8's deliberate outcome — not left pointing
// at a ghost. The trigger exists to stop the SPLIT WRITER removing a leg line
// while its parent survives, which is a different operation, and it is still
// standing for that one.
export default {
  invariant: 'R-5',
  title: 'deleting a split parent whose own line is a transfer leg succeeds, and strands the counterpart rather than refusing',
  design: 'the outbound half of PHASE1-PLAN addendum §A; trg_protect_linked_leg_delete in schema.sql, and transactions.linked_transfer_split_id ON DELETE SET NULL (20260720120000:46-48)',
  consequence: 'a guard covering only the inbound direction refuses an ordinary delete that the cloud performs, and the user is told a line "is one half of a transfer" about a transaction they are throwing away',
  parity: 'match',

  setup: splitWithTransferLeg,

  command: {
    verb: 'delete_transaction',
    payload: { id: CORNER_SHOP, user_id: USER },
  },

  expect: { outcome: 'ok' },
  result: { id: CORNER_SHOP, amount: '-25.00' },

  state: [
    rowExists(CORNER_SHOP, '0'),
    {
      // Both lines went with their parent — that IS the cascade, and it is
      // correct: a split line has no meaning without the transaction it splits.
      name: 'split_lines_remaining',
      sqlite: 'SELECT COUNT(*) FROM transaction_splits',
      postgres: 'SELECT COUNT(*) FROM public.transaction_splits',
      expect: '0',
    },
    // The counterpart in the OTHER account survives, unlinked. Its money is
    // untouched: deleting a transaction in one account may never move another.
    rowExists(LEG_COUNTERPART, '1'),
    storedText(LEG_COUNTERPART, 'linked_transfer_split_id', 'NULL'),
    storedText(LEG_COUNTERPART, 'transfer_account_id', EVERYDAY),
    balanceOf(RAINY_DAY, '15.00'),
    balanceOf(EVERYDAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    {
      name: 'guard_released',
      sqlite: "SELECT COUNT(*) FROM _rpc_guard WHERE flag = 'leg'",
      postgres: "SELECT COALESCE(NULLIF(current_setting('app.split_rpc', true), ''), '0')",
      expect: '0',
    },
    auditRowsForDelete(CORNER_SHOP, '1'),
  ],
};
