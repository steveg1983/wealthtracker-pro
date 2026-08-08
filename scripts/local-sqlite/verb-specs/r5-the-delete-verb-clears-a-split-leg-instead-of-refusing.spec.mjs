import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, LEG_COUNTERPART, LEG_LINE,
  splitWithTransferLeg, balanceOf, balanceIdentityHolds, rowExists,
  auditRowsForDelete,
} from './_shared.mjs';

// R-5. THE SPEC THIS VERB WAS BUILT AROUND, and the one that closes an
// obligation written down before the verb existed.
//
// `specs/r5-split-leg-links-are-set-null-never-cascaded.spec.mjs` measured the
// problem against RAW SQL and PHASE1-PLAN's addendum §A carries it:
//
//     sqlite    refused  split_leg_locked: that line is one half of a transfer —
//                        delete that transfer first, then edit the split
//     postgres  accepted leg_line_survives=1  leg_link_cleared=CLEARED
//
// SQLite applies `ON DELETE SET NULL` as an UPDATE of the child row, and that
// UPDATE fires `trg_protect_linked_leg` (the S-9 port), which raises. So the
// same delete that Postgres performs is refused locally — and the trap is worse
// than a divergence, because the message the user is shown for the FIRST
// refusal is "delete that transfer first, then edit the split", and that remedy
// is itself the refused operation. A user following the app's own instruction
// hits a dead end.
//
// The verb therefore holds `_rpc_guard('leg')` across the delete, and this spec
// is the proof that the guard makes the local edition behave like Postgres
// rather than refuse. Note what it does NOT do: it does not stand the trigger
// down generally, and it does not delete the split line. The line survives, in
// another account's transaction, with its link cleared — R-5 in both engines.
//
// The raw-SQL spec stays where it is, declaring the divergence at the SCHEMA
// level, because that divergence is real: it is the command layer that resolves
// it, and if the guard is ever dropped from this verb the schema-level spec will
// still be green while this one fails. That is the intended division.
export default {
  invariant: 'R-5',
  title: 'deleting a transfer a split line links to clears the line, exactly as Postgres does',
  design: "PHASE1-PLAN addendum §A; the guard mechanism is schema.sql §6; the trigger is trg_protect_linked_leg (port of 20260806094058:314-331)",
  consequence: "without the guard the local edition refuses the delete the cloud performs — including the one its own error message instructs the user to perform, which is a dead end with no way out of it",
  parity: 'match',

  setup: splitWithTransferLeg,

  command: {
    verb: 'delete_transaction',
    payload: { id: LEG_COUNTERPART, user_id: USER },
  },

  expect: { outcome: 'ok' },
  result: { id: LEG_COUNTERPART, amount: '15.00' },

  state: [
    rowExists(LEG_COUNTERPART, '0'),
    {
      // The line is NOT deleted. A cascade here would remove a line of a split
      // in another account, moving that account by an amount nobody asked to
      // move.
      name: 'leg_line_survives',
      sqlite: `SELECT COUNT(*) FROM transaction_splits WHERE id = '${LEG_LINE}'`,
      postgres: `SELECT COUNT(*) FROM public.transaction_splits WHERE id = '${LEG_LINE}'`,
      expect: '1',
    },
    {
      name: 'leg_link_cleared',
      sqlite: `SELECT COALESCE(linked_transfer_id, 'CLEARED') FROM transaction_splits
                WHERE id = '${LEG_LINE}'`,
      postgres: `SELECT COALESCE(linked_transfer_id::text, 'CLEARED') FROM public.transaction_splits
                  WHERE id = '${LEG_LINE}'`,
      expect: 'CLEARED',
    },
    {
      // …and the line's own money is untouched, which is the thing R-5 protects.
      name: 'leg_line_amount',
      sqlite: `SELECT CAST(amount_minor AS TEXT) FROM transaction_splits WHERE id = '${LEG_LINE}'`,
      postgres: `SELECT (amount * 100)::bigint::text FROM public.transaction_splits WHERE id = '${LEG_LINE}'`,
      expect: '-1500',
    },
    {
      // The guard was released. A flag left behind would silently disable the
      // leg protection for every later write on this file.
      name: 'guard_released',
      sqlite: "SELECT COUNT(*) FROM _rpc_guard WHERE flag = 'leg'",
      postgres: "SELECT COALESCE(NULLIF(current_setting('app.split_rpc', true), ''), '0')",
      expect: '0',
    },
    // The split parent is untouched, so Everyday does not move; Rainy day gives
    // back the 15.00 the deleted counterpart put there.
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    rowExists(CORNER_SHOP, '1'),
    auditRowsForDelete(LEG_COUNTERPART, '1'),
  ],
};
