import {
  USER, EVERYDAY, RAINY_DAY, OTHER_LEG, THIS_LEG,
  transferPair, balanceOf, balanceIdentityHolds, storedText, rowExists,
} from './_shared.mjs';

// T-8, the DELIBERATE stranding, and the reason the delete verb does not need
// to know anything about transfers.
//
// `20260716100000:27-29`: "ON DELETE SET NULL: deleting one side never leaves
// the survivor pointing at a ghost (it simply becomes an unlinked transfer
// again, eligible for re-linking)."
//
// Both engines spell it as a foreign key, so both do it without the verb
// mentioning it — and that is the property worth pinning, because it is the
// kind a port "helpfully" reimplements. A verb that nulled the counterpart by
// hand would work identically today and diverge the moment the FK changed;
// a verb that deleted the counterpart would destroy a row in another account
// that the user did not ask to touch.
//
// The survivor keeps `transfer_account_id` — it is still a transfer, it is just
// no longer a linked one — and only `linked_transfer_id` clears. Both are
// asserted, because clearing too much looks exactly like clearing the right
// amount until someone tries to re-link.
//
// PRAGMA foreign_keys is per connection and defaults to OFF (DESIGN.md §2.1), so
// on the local side this spec is also the standing proof that the Rust
// connection has it on: with it off, nothing fails — the link simply stays,
// pointing at a row that is gone.
export default {
  invariant: 'T-8',
  title: 'deleting one half of a linked transfer unlinks the other half without touching it',
  design: '20260716100000:27-33 — linked_transfer_id REFERENCES transactions(id) ON DELETE SET NULL, in both engines',
  consequence: 'a cascade here would delete a row in another account; a hand-written unlink would drift from the constraint the moment either changed',
  parity: 'match',

  setup: transferPair,

  command: {
    verb: 'delete_transaction',
    payload: { id: OTHER_LEG, user_id: USER },
  },

  expect: { outcome: 'ok' },
  result: { id: OTHER_LEG, amount: '-15.00' },

  state: [
    rowExists(OTHER_LEG, '0'),
    // The survivor is still there, still a transfer, no longer linked.
    rowExists(THIS_LEG, '1'),
    storedText(THIS_LEG, 'linked_transfer_id', 'NULL'),
    storedText(THIS_LEG, 'transfer_account_id', EVERYDAY),
    // Only the deleted side's account moved: -40.00 + 15.00.
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
  ],
};
