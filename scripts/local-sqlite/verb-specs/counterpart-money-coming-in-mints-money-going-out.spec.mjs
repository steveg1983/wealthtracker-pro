import { USER, EVERYDAY, RAINY_DAY, PAIR_OUT, pairableRows,
  balanceOf, balanceIdentityHolds, rowsIn, transferShape, transferLinksAreMutual,
  auditShape } from './_shared.mjs';

// The sign, in the other direction, because "negate the amount" is the one line
// of this verb that a port can get exactly backwards and still pass every test
// written around a single expense.
//
// +40.00 arriving in Everyday mints −40.00 leaving Rainy day, and Rainy day's
// balance goes NEGATIVE by that much. If the sign were copied rather than
// negated, both accounts would gain 40.00 and the ledger would have invented
// 80.00 out of a movement of 40.00.
export default {
  invariant: 'T-1',
  title: 'money arriving mints money leaving, and the target balance goes the other way',
  design: 'create_transfer_counterpart 20260721090000:80 — -v_src.amount',
  consequence: 'both accounts gain the amount and the ledger invents twice the money that moved',
  parity: 'match',

  setup: {
    sqlite: `${pairableRows.sqlite}
      UPDATE transactions SET amount_minor = 4000, type = 'income', description = 'Money in', category = NULL
       WHERE id = '${PAIR_OUT}';
      UPDATE accounts SET balance_minor = balance_minor + 7000 WHERE id = '${EVERYDAY}';`,
    postgres: `${pairableRows.postgres}
      UPDATE public.transactions SET amount = 40.00, type = 'income', description = 'Money in', category = NULL
       WHERE id = '${PAIR_OUT}';
      UPDATE public.accounts SET balance = balance + 70.00 WHERE id = '${EVERYDAY}';`,
  },
  command: {
    verb: 'create_transfer_counterpart',
    payload: { id: PAIR_OUT, target_account_id: RAINY_DAY, user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { id: PAIR_OUT, amount: '40.00', type: 'transfer' },

  rowDivergence: {
    category: 'a To/From category\'s id is minted by a trigger on both engines and is unknowable at authoring time on either — the state assertions compare it by NAME instead',
    linked_transfer_id: 'the counterpart is minted DURING the call, so its uuid differs per engine and always will',
  },

  state: [
    transferShape(PAIR_OUT, 'transfer:To/From Rainy day:0002:linked:-', { namesIds: false }),
    rowsIn(RAINY_DAY, '-40.00:transfer:To/From Everyday:Money in:-:uncleared:linked | 30.00:income:-:Moved in:-:uncleared:-'),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '15.00'),
    balanceOf(RAINY_DAY, '-10.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('account/update,transaction/create,transaction/update'),
  ],
};
