import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, OTHER_LEG, THIS_LEG, transferPair,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  linkedRows, auditRowsInTotal } from './_shared.mjs';

// A row that is already unlinked is SKIPPED, not refused and not counted: no
// write, no audit row, no noise. That is what makes an "unlink this" that runs
// twice a no-op rather than an error — and the all-or-nothing check above is
// what still distinguishes "already unlinked" from "not there".
export default {
  invariant: 'U-1',
  title: 'a row that is already unlinked is skipped, and writes no audit noise',
  design: 'clear_transfer_links 20260805145035:135 — AND linked_transfer_id IS NOT NULL, in the cursor',
  consequence: 'the audit log fills with entries recording that nothing happened, and the returned count stops meaning "rows changed"',
  parity: 'match',

  setup: transferPair,
  command: { verb: 'clear_transfer_links', payload: { ids: [CORNER_SHOP], user_id: USER } },
  expect: { outcome: 'ok' },
  result: { id: CORNER_SHOP, linked_transfer_id: null },

  state: [
    transferShape(CORNER_SHOP, 'expense:Weekly shop:-:-:-'),
    transferShape(OTHER_LEG, `transfer:-:0002:${THIS_LEG.slice(-4)}:-`),
    transferLinksAreMutual(),
    linkedRows('2'),
    balanceOf(EVERYDAY, '-40.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
