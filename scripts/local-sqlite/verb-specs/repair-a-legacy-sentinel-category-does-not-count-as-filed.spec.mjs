import { EVERYDAY, RAINY_DAY, balanceOf, balanceIdentityHolds, transferShape,
  transferLinksAreMutual, auditShape } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// The subtlety in refusal 9, and the reason it is not `category IS NULL`.
//
// "Uncategorised" means what the SWEEP means by it (`:356-358`): blank, **or**
// naming a category this user does not actually have. `'transfer-out'` is a
// legacy sentinel that predates the To/From lifecycle, lives in
// `transactions.category` — which has no foreign key, R-3, precisely so it can —
// and resolves to no row. It is not a filing, so the repair proceeds.
//
// A port that tested `IS NULL` would refuse exactly the population this sweep
// exists to repair: the MS Money import, whose rows carry sentinels.
export default {
  invariant: 'R-3',
  title: 'a row filed under a legacy sentinel is still uncategorised, and is repaired',
  design: 'repair_claimed_transfer 20260805145035:359-367 — btrim <> \'\' AND EXISTS(a real category), not IS NULL',
  consequence: 'every imported row carrying a transfer-out sentinel is refused by the sweep built to repair it',
  parity: 'match',

  setup: {
    sqlite: `${claimedTransfer.sqlite}
      UPDATE transactions SET category = 'transfer-out' WHERE id = '${STRANDED}';`,
    postgres: `${claimedTransfer.postgres}
      UPDATE public.transactions SET category = 'transfer-out' WHERE id = '${STRANDED}';`,
  },
  command: { verb: 'repair_claimed_transfer', payload: repairPayload() },
  expect: { outcome: 'ok' },
  result: { id: STRANDED, amount: '-15.00', type: 'transfer' },

  rowDivergence: {
    category: 'a To/From category\'s id is minted by a trigger on both engines and is unknowable at authoring time on either — the state assertions compare it by NAME instead',
  },

  state: [
    transferShape(STRANDED, `transfer:To/From Rainy day:0002:${COUNTERPART.slice(-4)}:-`),
    transferShape(COUNTERPART, `transfer:To/From Everyday:0001:${STRANDED.slice(-4)}:-`),
    transferShape(PARTNER, 'expense:Account Adjustment:-:-:-'),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('transaction/update,transaction/update,transaction/update'),
  ],
};
