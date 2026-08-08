import { USER, EVERYDAY, RAINY_DAY, PAIR_OUT, PAIR_IN, pairableRows,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  auditRowsInTotal } from './_shared.mjs';

// The half of T-1 that is easy to drop: `v_a.amount = 0 OR …`. Two zero-amount
// rows ARE exact negations of each other — `0 = -0` — so a port that kept only
// the negation test would pair them and the ledger would gain a transfer that
// moves nothing between two accounts, which every sweep would then offer to
// "repair" forever. MEASURED: the cloud refuses, and names both zeroes.
export default {
  invariant: 'T-1',
  title: 'two zero-amount rows are refused, because a transfer of nothing is not a transfer',
  design: 'link_transfer_pair 20260716100000:108 — the `= 0` disjunct, which `<> -b` alone would miss',
  consequence: 'a transfer that moves no money sits in both registers forever, re-offered by every matching sweep',
  parity: 'match',

  setup: {
    sqlite: `${pairableRows.sqlite}
      UPDATE transactions SET amount_minor = 0 WHERE id IN ('${PAIR_OUT}', '${PAIR_IN}');
      UPDATE accounts SET balance_minor = balance_minor + 3000 WHERE id = '${EVERYDAY}';
      UPDATE accounts SET balance_minor = balance_minor - 3000 WHERE id = '${RAINY_DAY}';`,
    postgres: `${pairableRows.postgres}
      UPDATE public.transactions SET amount = 0.00 WHERE id IN ('${PAIR_OUT}', '${PAIR_IN}');
      UPDATE public.accounts SET balance = balance + 30.00 WHERE id = '${EVERYDAY}';
      UPDATE public.accounts SET balance = balance - 30.00 WHERE id = '${RAINY_DAY}';`,
  },
  command: { verb: 'link_transfer_pair', payload: { id_a: PAIR_OUT, id_b: PAIR_IN, user_id: USER } },
  expect: { outcome: 'refused', error: 'transfer sides must have exactly opposite non-zero amounts (0.00 vs 0.00)' },

  state: [
    transferShape(PAIR_OUT, 'expense:Weekly shop:-:-:-'),
    transferShape(PAIR_IN, 'income:-:-:-:-'),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
