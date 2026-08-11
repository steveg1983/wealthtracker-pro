import { USER, EVERYDAY, MARKED_ROW, COMMITTED_ROW, PRE_SPLIT_ROW, CORNER_SHOP,
  everyStateOfCommitment, archivedThroughFebruary, setups,
  storedFlag, storedTriFlag, archivedRowsIn, balanceOf, balanceIdentityHolds } from './_shared.mjs';

// A-3 THROUGH THE VERB, which is where a person actually meets it.
//
// The account is archived through 2024-02-28. MARKED_ROW is dated 2024-01-15,
// inside that period, so committing it drops it off the live register in the
// same call — which is what "reconciling old items keeps them from lingering"
// means. CORNER_SHOP is dated 2024-03-01, outside it, and stays live even after
// it is committed... except that it is not ticked, so it is not committed at
// all: the working set is what the sweep can reach.
//
// The two engines get here differently and the end state is identical: the cloud
// assigns `NEW.archived` in a BEFORE trigger, SQLite issues a second UPDATE from
// an AFTER trigger. `archived_rows_in` is asserted as a COUNT so a port that
// archived MORE than the sweep should cannot pass by having the named row come
// out right.
export default {
  invariant: 'A-3',
  title: 'committing a row that is older than the account cutoff archives it',
  design: 'finalize_reconciliation 20260810200000:248-252 writing is_reconciled, and sweep_reconciled_into_archive :336-361 reading it',
  consequence: 'old reconciled items linger in the live register for ever, and the register stops matching the period the user thinks they are looking at',
  parity: 'match',

  setup: setups(everyStateOfCommitment, archivedThroughFebruary),
  command: {
    verb: 'finalize_reconciliation',
    payload: { account_id: EVERYDAY, ending_balance: '-28.00', reconciled_on: '2024-03-31', user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { reconciled: 1 },

  state: [
    storedFlag(MARKED_ROW, 'archived', 'yes'),
    storedTriFlag(MARKED_ROW, 'is_reconciled', 'yes'),
    // Already committed before this call, so no transition happened and the
    // sweep — which fires on the CHANGE — never looked at it.
    storedFlag(COMMITTED_ROW, 'archived', 'no'),
    // Pre-split history: not in the working set, so not committed and not swept.
    storedFlag(PRE_SPLIT_ROW, 'archived', 'no'),
    storedFlag(CORNER_SHOP, 'archived', 'no'),
    archivedRowsIn(EVERYDAY, '1'),
    balanceOf(EVERYDAY, '-28.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
