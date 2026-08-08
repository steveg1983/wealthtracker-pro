import { EVERYDAY, RAINY_DAY, balanceOf, balanceIdentityHolds, transferShape,
  transferLinksAreMutual, auditRowsInTotal } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// T-1 in its third copy, and note the ARGUMENT ORDER in the message: this one
// prints the counterpart first and the stranded row second (`15.00 vs -99.00`),
// where `link_transfer_pair` prints a then b. The condition is the same and the
// sentence is not, so a port that shared the message-building without sharing
// the order would refuse the right call and show the wrong figures.
//
// MEASURED to beat the adjustment-category check (probe-transfers3.sh,
// `rct-amounts-beat-category`).
export default {
  invariant: 'T-1',
  title: 'the pair a repair makes must be exactly opposite, and the figures print counterpart-first',
  design: 'repair_claimed_transfer 20260805145035:373-376',
  consequence: 'the repair creates a pair whose two sides claim different sizes for one movement of money',
  parity: 'match',

  setup: {
    sqlite: `${claimedTransfer.sqlite}
      UPDATE transactions SET amount_minor = -9900 WHERE id = '${STRANDED}';
      UPDATE accounts SET balance_minor = balance_minor - 8400 WHERE id = '${EVERYDAY}';`,
    postgres: `${claimedTransfer.postgres}
      UPDATE public.transactions SET amount = -99.00 WHERE id = '${STRANDED}';
      UPDATE public.accounts SET balance = balance - 84.00 WHERE id = '${EVERYDAY}';`,
  },
  command: { verb: 'repair_claimed_transfer', payload: repairPayload() },
  expect: { outcome: 'refused', error: 'transfer sides must have exactly opposite non-zero amounts (15.00 vs -99.00)' },

  state: [
    transferShape(STRANDED, 'expense:-:-:-:-'),
    transferShape(PARTNER, `transfer:-:0002:${COUNTERPART.slice(-4)}:-`),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-139.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
