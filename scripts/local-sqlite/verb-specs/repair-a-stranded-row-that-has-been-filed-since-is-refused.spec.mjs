import { EVERYDAY, RAINY_DAY, WEEKLY_SHOP, balanceOf, balanceIdentityHolds, transferShape,
  transferLinksAreMutual, auditRowsInTotal } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// The sweep only ever offers UNCATEGORISED rows as candidates: a row somebody
// has filed under "Weekly shop" is a row somebody has looked at and decided
// about, and turning it into half a transfer would overwrite that decision.
//
// MEASURED to beat the account and amount checks below it (probe-transfers3.sh,
// `rct-categorised-beats-accounts`), so a stale list is told it is stale before
// it is told anything about the money.
export default {
  invariant: 'T-15',
  title: 'a stranded row somebody has filed since the list was built is refused',
  design: 'repair_claimed_transfer 20260805145035:359-367',
  consequence: 'a filing the user made by hand is overwritten by a sweep acting on a list built before they made it',
  parity: 'match',

  setup: {
    sqlite: `${claimedTransfer.sqlite}
      UPDATE transactions SET category = '${WEEKLY_SHOP}' WHERE id = '${STRANDED}';`,
    postgres: `${claimedTransfer.postgres}
      UPDATE public.transactions SET category = '${WEEKLY_SHOP}' WHERE id = '${STRANDED}';`,
  },
  command: { verb: 'repair_claimed_transfer', payload: repairPayload() },
  expect: { outcome: 'refused', error: 'stranded_row_already_categorised' },

  state: [
    transferShape(STRANDED, 'expense:Weekly shop:-:-:-'),
    transferShape(PARTNER, `transfer:-:0002:${COUNTERPART.slice(-4)}:-`),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
