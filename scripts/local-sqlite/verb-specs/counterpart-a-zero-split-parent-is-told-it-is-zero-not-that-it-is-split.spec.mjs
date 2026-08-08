import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, WEEKLY_SHOP, LEG_LINE, PLAIN_LINE,
  balanceOf, balanceIdentityHolds, rowsInAccount, splitSumHolds, auditRowsInTotal } from './_shared.mjs';

// A REFUSAL-ORDER SPEC. This payload breaks two rules at once — the row is zero
// AND it is a split parent — and the two engines must produce the same FIRST
// sentence or an application that surfaces `error.message` shows different prose
// depending on where it is running.
//
// MEASURED on the reference cluster (probe-transfers2.sh, `ctc-zero-beats-split`):
// the zero check wins, because it is the statement above. A split of +10.00 and
// −10.00 summing to zero is a shape real data takes, so this is reachable rather
// than contrived.
export default {
  invariant: 'T-1',
  title: 'a zero-amount split parent is refused for being zero, not for being split',
  design: 'create_transfer_counterpart 20260721090000:41-43 above :44-47 — MEASURED, not read off the source',
  consequence: 'the two engines show a user two different explanations for one payload',
  parity: 'match',

  setup: {
    sqlite: `
      INSERT INTO _rpc_guard VALUES ('split');
      UPDATE transactions SET is_split = 1, category = '', amount_minor = 0 WHERE id = '${CORNER_SHOP}';
      UPDATE accounts SET balance_minor = 0 WHERE id = '${EVERYDAY}';
      INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order) VALUES
        ('${LEG_LINE}',   '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}',  1000, 1),
        ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -1000, 2);
      DELETE FROM _rpc_guard;`,
    postgres: `
      SELECT set_config('app.split_rpc', '1', true);
      UPDATE public.transactions SET is_split = true, category = '', amount = 0.00 WHERE id = '${CORNER_SHOP}';
      UPDATE public.accounts SET balance = 0.00 WHERE id = '${EVERYDAY}';
      INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order) VALUES
        ('${LEG_LINE}',   '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}',  10.00, 1),
        ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -10.00, 2);
      SELECT set_config('app.split_rpc', '0', true);`,
  },
  command: {
    verb: 'create_transfer_counterpart',
    payload: { id: CORNER_SHOP, target_account_id: RAINY_DAY, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'a zero-amount transaction cannot become a transfer' },

  state: [
    splitSumHolds(CORNER_SHOP),
    rowsInAccount(RAINY_DAY, '0'),
    balanceOf(EVERYDAY, '0.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
