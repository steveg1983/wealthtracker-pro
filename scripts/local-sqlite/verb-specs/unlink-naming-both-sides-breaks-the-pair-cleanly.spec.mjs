import { USER, EVERYDAY, RAINY_DAY, OTHER_LEG, THIS_LEG, transferPair,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  linkedRows, auditShape } from './_shared.mjs';

// The call the client is SUPPOSED to make, and the reason the argument is a
// list: *"'Unlink this pair' is two rows that must move together"*
// (`20260805145035:60-63`). Naming both leaves T-7 holding — no one-sided link
// anywhere — and both rows stay transfers with their targets intact, ready to be
// re-linked to whatever they really match.
//
// Balance-neutral, and the audit shape proves it: two `transaction/update` rows
// and no `account/update` at all.
export default {
  invariant: 'T-7',
  title: 'naming both sides breaks the pair and leaves nothing one-sided',
  design: 'clear_transfer_links 20260805145035:131-151 — one UPDATE and one audit row per REAL change',
  consequence: 'the audited way to undo a link does not exist, and the client goes back to a silent table UPDATE',
  parity: 'match',

  setup: transferPair,
  command: { verb: 'clear_transfer_links', payload: { ids: [OTHER_LEG, THIS_LEG], user_id: USER } },
  expect: { outcome: 'ok' },
  result: { id: OTHER_LEG, linked_transfer_id: null },

  state: [
    transferShape(OTHER_LEG, 'transfer:-:0002:-:-'),
    transferShape(THIS_LEG, 'transfer:-:0001:-:-'),
    transferLinksAreMutual(),
    linkedRows('0'),
    balanceOf(EVERYDAY, '-40.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('transaction/update,transaction/update'),
  ],
};
