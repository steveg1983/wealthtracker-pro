import { USER, EVERYDAY, RAINY_DAY, WEEKLY_SHOP, LEG_LINE, PLAIN_LINE,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  splitSumHolds, auditRowsInTotal } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// T-5, applied to all three rows at once. The stranded row is about to become
// half a transfer, so it may not be a split parent for the same reason no row
// may be both — two authorities for one amount.
export default {
  invariant: 'T-5',
  title: 'a split parent cannot be any of the three rows in a repair',
  design: 'repair_claimed_transfer 20260805145035:334-337',
  consequence: 'a split\'s amount is claimed by its lines and by a row in another account at the same time',
  parity: 'match',

  setup: {
    sqlite: `${claimedTransfer.sqlite}
      INSERT INTO _rpc_guard VALUES ('split');
      UPDATE transactions SET is_split = 1, category = '' WHERE id = '${STRANDED}';
      INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order) VALUES
        ('${LEG_LINE}',   '${STRANDED}', '${USER}', '${WEEKLY_SHOP}', -1000, 1),
        ('${PLAIN_LINE}', '${STRANDED}', '${USER}', '${WEEKLY_SHOP}',  -500, 2);
      DELETE FROM _rpc_guard;`,
    postgres: `${claimedTransfer.postgres}
      SELECT set_config('app.split_rpc', '1', true);
      UPDATE public.transactions SET is_split = true, category = '' WHERE id = '${STRANDED}';
      INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order) VALUES
        ('${LEG_LINE}',   '${STRANDED}', '${USER}', '${WEEKLY_SHOP}', -10.00, 1),
        ('${PLAIN_LINE}', '${STRANDED}', '${USER}', '${WEEKLY_SHOP}',  -5.00, 2);
      SELECT set_config('app.split_rpc', '0', true);`,
  },
  command: { verb: 'repair_claimed_transfer', payload: repairPayload() },
  expect: { outcome: 'refused', error: 'a split transaction cannot become a transfer' },

  state: [
    splitSumHolds(STRANDED),
    transferShape(PARTNER, `transfer:-:0002:${COUNTERPART.slice(-4)}:-`),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
