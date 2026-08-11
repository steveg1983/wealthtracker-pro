import { USER, EVERYDAY, CORNER_SHOP,
  storedFlag, storedTriFlag, archivedRowsIn, balanceIdentityHolds } from './_shared.mjs';

// A-3 FROM THE OTHER END, and the reason the sweep moved.
//
// The row is dated 2024-03-01 and the cutoff planted here is 2024-06-30, so it
// is inside the archived period. Under the old trigger — `AFTER UPDATE OF
// is_cleared` — ticking it made it VANISH from the very list the ticking happens
// on, and a working mark is reversible: a row you cannot see is a row you cannot
// untick. The trigger now fires on the committed flag, which only a finalize
// writes.
//
// Its twin is `specs/a3-reconciling-an-old-row-archives-it`, which asserts the
// sweep DOES fire when the same row is committed. Neither is meaningful without
// the other: one alone passes against a trigger that never fires, the other
// alone against a trigger that always does.
export default {
  invariant: 'A-3',
  title: 'marking an old row does not archive it',
  design: 'sweep_reconciled_into_archive as restated by 20260810200000:331-361 — "ticking a row must never make it disappear from the screen the ticking happens on"',
  consequence: 'rows vanish from the reconciliation list as they are ticked, and a mistaken tick cannot be taken back',
  parity: 'match',

  setup: {
    sqlite: `UPDATE accounts SET archive_through_date = '2024-06-30' WHERE id = '${EVERYDAY}';`,
    postgres: `UPDATE public.accounts SET archive_through_date = '2024-06-30' WHERE id = '${EVERYDAY}';`,
  },
  command: { verb: 'set_transactions_cleared', payload: { ids: [CORNER_SHOP], cleared: true, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(CORNER_SHOP, 'is_cleared', 'yes'),
    storedTriFlag(CORNER_SHOP, 'is_reconciled', 'no'),
    storedFlag(CORNER_SHOP, 'archived', 'no'),
    archivedRowsIn(EVERYDAY, '0'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
