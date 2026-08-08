import { EVERYDAY, RAINY_DAY, balanceOf, balanceIdentityHolds, transferShape,
  transferLinksAreMutual, storedFlag, auditRowsInTotal } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// T-13, in the migration's own words (`:344-345`): *"Archived rows are out of
// the live register: repairing one would change something the user cannot see."*
//
// Note the asymmetry this pins: `link_transfer_pair` has no such gate and links
// archived rows happily (see
// `transfer-pair-an-archived-row-is-linked-not-refused`). Both behaviours are
// the cloud's and both are reproduced; the difference is real and is recorded
// rather than harmonised.
export default {
  invariant: 'T-13',
  title: 'an archived row cannot be re-paired, because the change would happen out of sight',
  design: 'repair_claimed_transfer 20260805145035:346-349',
  consequence: 'a row the user cannot see is silently re-filed and re-linked, and the register they are looking at does not change',
  parity: 'match',

  setup: {
    sqlite: `${claimedTransfer.sqlite}
      UPDATE transactions SET archived = 1 WHERE id = '${PARTNER}';`,
    postgres: `${claimedTransfer.postgres}
      UPDATE public.transactions SET archived = true WHERE id = '${PARTNER}';`,
  },
  command: { verb: 'repair_claimed_transfer', payload: repairPayload() },
  expect: { outcome: 'refused', error: 'archived_row_not_repairable' },

  state: [
    storedFlag(PARTNER, 'archived', 'yes'),
    transferShape(PARTNER, `transfer:-:0002:${COUNTERPART.slice(-4)}:-`),
    transferShape(STRANDED, 'expense:-:-:-:-'),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
