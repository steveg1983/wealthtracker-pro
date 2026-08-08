import { USER, EVERYDAY, RAINY_DAY, PAIR_OUT, PAIR_IN, pairableRows,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  auditRowsInTotal } from './_shared.mjs';

// T-1, the rule the whole feature rests on: if the two sides are not exact
// negations then money appears or disappears between two accounts, and B-1 goes
// on holding on each account separately while the ledger as a whole becomes a
// lie. One penny is enough — this pairs −30.00 with 29.99 — and the refusal
// carries BOTH figures, which is what lets a user see which side is wrong.
export default {
  invariant: 'T-1',
  title: 'two sides that are a penny apart are refused, with both figures named',
  design: 'link_transfer_pair 20260716100000:108-111 — v_a.amount = 0 OR v_a.amount <> -v_b.amount',
  consequence: 'money appears or disappears between two accounts and every report is wrong by the difference',
  parity: 'match',

  setup: {
    sqlite: `${pairableRows.sqlite}
      UPDATE transactions SET amount_minor = 2999 WHERE id = '${PAIR_IN}';
      UPDATE accounts SET balance_minor = balance_minor - 1 WHERE id = '${RAINY_DAY}';`,
    postgres: `${pairableRows.postgres}
      UPDATE public.transactions SET amount = 29.99 WHERE id = '${PAIR_IN}';
      UPDATE public.accounts SET balance = balance - 0.01 WHERE id = '${RAINY_DAY}';`,
  },
  command: { verb: 'link_transfer_pair', payload: { id_a: PAIR_OUT, id_b: PAIR_IN, user_id: USER } },
  expect: { outcome: 'refused', error: 'transfer sides must have exactly opposite non-zero amounts (-30.00 vs 29.99)' },

  state: [
    transferShape(PAIR_OUT, 'expense:Weekly shop:-:-:-'),
    transferShape(PAIR_IN, 'income:-:-:-:-'),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '29.99'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
