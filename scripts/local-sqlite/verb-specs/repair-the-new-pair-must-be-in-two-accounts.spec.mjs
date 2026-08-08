import { RAINY_DAY, EVERYDAY, balanceOf, balanceIdentityHolds, transferShape,
  transferLinksAreMutual, auditRowsInTotal } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// T-2, copied verbatim from `link_transfer_pair` into this function
// (`:369-372`) and applied to the pair the repair is about to MAKE, not the one
// it is breaking. Moving the stranded row into the counterpart's own account is
// enough to reach it.
//
// MEASURED to beat the amount check (probe-transfers3.sh,
// `rct-accounts-beat-amounts`), which is the same order `link_transfer_pair`
// uses — the two copies agree, which is the property the migration's "must be
// kept in step with it" comment is asking for.
export default {
  invariant: 'T-2',
  title: 'the pair a repair makes needs two different accounts',
  design: 'repair_claimed_transfer 20260805145035:370-372 — copied verbatim from link_transfer_pair',
  consequence: 'the repair produces exactly the malformed transfer the verb it copies its rules from would have refused',
  parity: 'match',

  setup: {
    sqlite: `${claimedTransfer.sqlite}
      UPDATE transactions SET account_id = '${RAINY_DAY}' WHERE id = '${STRANDED}';
      UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '${EVERYDAY}';
      UPDATE accounts SET balance_minor = balance_minor - 1500 WHERE id = '${RAINY_DAY}';`,
    postgres: `${claimedTransfer.postgres}
      UPDATE public.transactions SET account_id = '${RAINY_DAY}' WHERE id = '${STRANDED}';
      UPDATE public.accounts SET balance = balance + 15.00 WHERE id = '${EVERYDAY}';
      UPDATE public.accounts SET balance = balance - 15.00 WHERE id = '${RAINY_DAY}';`,
  },
  command: { verb: 'repair_claimed_transfer', payload: repairPayload() },
  expect: { outcome: 'refused', error: 'a transfer needs two different accounts' },

  state: [
    transferShape(STRANDED, 'expense:-:-:-:-'),
    transferShape(PARTNER, `transfer:-:0002:${COUNTERPART.slice(-4)}:-`),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-40.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
