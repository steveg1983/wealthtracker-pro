import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP,
  balanceOf, balanceIdentityHolds, rowsInAccount, transferShape, auditRowsInTotal } from './_shared.mjs';

// The refusal `link_transfer_pair` expresses as half of T-1 and this verb makes
// on its own, because there is no second row to compare against yet. Minting the
// negation of zero would produce a second zero-amount row in another account and
// a "transfer" that moves nothing — which every matching sweep would then offer
// to repair, forever.
export default {
  invariant: 'T-1',
  title: 'a zero-amount row cannot become a transfer',
  design: 'create_transfer_counterpart 20260721090000:41-43',
  consequence: 'a transfer of nothing is minted into another account and re-offered by every sweep',
  parity: 'match',

  setup: {
    sqlite: `UPDATE transactions SET amount_minor = 0 WHERE id = '${CORNER_SHOP}';
             UPDATE accounts SET balance_minor = 0 WHERE id = '${EVERYDAY}';`,
    postgres: `UPDATE public.transactions SET amount = 0.00 WHERE id = '${CORNER_SHOP}';
               UPDATE public.accounts SET balance = 0.00 WHERE id = '${EVERYDAY}';`,
  },
  command: {
    verb: 'create_transfer_counterpart',
    payload: { id: CORNER_SHOP, target_account_id: RAINY_DAY, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'a zero-amount transaction cannot become a transfer' },

  state: [
    transferShape(CORNER_SHOP, 'expense:Weekly shop:-:-:-'),
    rowsInAccount(RAINY_DAY, '0'),
    balanceOf(EVERYDAY, '0.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
