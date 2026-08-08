import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, LEG_LINE, STRANDED,
  splitWithAnUnlinkedLeg, setups,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  auditRowsInTotal } from './_shared.mjs';

// T-2, measured against the SPLIT PARENT's account rather than the line's
// target — the line may not have a target at all, and the parent's account is
// the one the money is actually leaving.
export default {
  invariant: 'T-2',
  title: 'a leg\'s other side must sit in a different account from the split',
  design: 'link_split_line_transfer 20260806094058:572-574 — v_txn.account_id = v_parent.account_id',
  consequence: 'a split line "transfers" to the account its own parent is in and the money never leaves',
  parity: 'match',

  setup: setups(splitWithAnUnlinkedLeg, {
    sqlite: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
        VALUES ('${STRANDED}', '${USER}', '${EVERYDAY}', 'Same account', 1500, 'income', '2024-03-02');
      UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '${EVERYDAY}';`,
    postgres: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date)
        VALUES ('${STRANDED}', '${USER}', '${EVERYDAY}', 'Same account', 15.00, 'income', '2024-03-02');
      UPDATE public.accounts SET balance = balance + 15.00 WHERE id = '${EVERYDAY}';`,
  }),
  command: {
    verb: 'link_split_line_transfer',
    payload: { split_id: LEG_LINE, transaction_id: STRANDED, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'a transfer needs two different accounts' },

  state: [
    splitLines(CORNER_SHOP, '0:-15.00:Weekly shop:0002:-:- | 1:-10.00:Weekly shop:-:-:-'),
    splitSumHolds(CORNER_SHOP),
    legPairsAreMutual(),
    balanceOf(EVERYDAY, '-10.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
