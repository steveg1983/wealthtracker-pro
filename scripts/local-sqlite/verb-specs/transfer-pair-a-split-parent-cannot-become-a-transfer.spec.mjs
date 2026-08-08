import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, MATCHING, splitWithAnUnlinkedLeg, matchingRow,
  setups, balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  splitSumHolds, auditRowsInTotal } from './_shared.mjs';

// T-5. A split's amount is the sum of its lines; a transfer's amount is pinned
// by the row on the other side. A row that is both has two authorities for one
// number, and the local file says so twice over — the RPC refuses here, and
// `transactions_transfer_not_split` would refuse the write anyway. The verb
// still checks, because a named refusal in the RPC's own order is what the
// caller is promised and `constraint_violated` is not it.
//
// The parent is −25.00 and the row it is aimed at is +25.00, so T-1 and T-2 are
// both satisfied: this reaches refusal 6 and nothing else.
export default {
  invariant: 'T-5',
  title: 'a split parent cannot be linked into a transfer',
  design: 'link_transfer_pair 20260716100000:112-115',
  consequence: 'one row\'s amount is claimed by both its split lines and its other side, and the two can disagree',
  parity: 'match',

  setup: setups(splitWithAnUnlinkedLeg, {
    sqlite: `${matchingRow.sqlite}
      UPDATE transactions SET amount_minor = 2500 WHERE id = '${MATCHING}';
      UPDATE accounts SET balance_minor = balance_minor + 1000 WHERE id = '${RAINY_DAY}';`,
    postgres: `${matchingRow.postgres}
      UPDATE public.transactions SET amount = 25.00 WHERE id = '${MATCHING}';
      UPDATE public.accounts SET balance = balance + 10.00 WHERE id = '${RAINY_DAY}';`,
  }),
  command: { verb: 'link_transfer_pair', payload: { id_a: CORNER_SHOP, id_b: MATCHING, user_id: USER } },
  expect: { outcome: 'refused', error: 'a split transaction cannot become a transfer' },

  state: [
    transferShape(CORNER_SHOP, 'expense::-:-:-'),
    transferShape(MATCHING, 'income:-:-:-:-'),
    splitSumHolds(CORNER_SHOP),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '25.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
