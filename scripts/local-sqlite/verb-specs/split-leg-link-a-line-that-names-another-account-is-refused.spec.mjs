import { USER, EVERYDAY, RAINY_DAY, HOLIDAY_FUND, CORNER_SHOP, LEG_LINE, STRANDED,
  splitWithAnUnlinkedLeg, thirdAccount, setups,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  auditRowsInTotal } from './_shared.mjs';

// The line already says which account is on the other side — that is what makes
// it an UNMATCHED leg rather than an ordinary line — and a row sitting somewhere
// else is not that account. MEASURED to beat the amount check
// (probe-transfers3.sh, `lsl-target-beats-amounts`): a row in the wrong account
// AND of the wrong amount is told about the account.
export default {
  invariant: 'S-8',
  title: 'a leg whose target names one account cannot be paired with a row in another',
  design: 'link_split_line_transfer 20260806094058:575-579',
  consequence: 'the line claims to transfer to one account while its other side sits in a different one, and every transfer report names the wrong account',
  parity: 'match',

  setup: setups(splitWithAnUnlinkedLeg, thirdAccount, {
    sqlite: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
        VALUES ('${STRANDED}', '${USER}', '${HOLIDAY_FUND}', 'Wrong account', 1500, 'income', '2024-03-02');
      UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '${HOLIDAY_FUND}';`,
    postgres: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date)
        VALUES ('${STRANDED}', '${USER}', '${HOLIDAY_FUND}', 'Wrong account', 15.00, 'income', '2024-03-02');
      UPDATE public.accounts SET balance = balance + 15.00 WHERE id = '${HOLIDAY_FUND}';`,
  }),
  command: {
    verb: 'link_split_line_transfer',
    payload: { split_id: LEG_LINE, transaction_id: STRANDED, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'split_line_target_mismatch' },

  state: [
    splitLines(CORNER_SHOP, '0:-15.00:Weekly shop:0002:-:- | 1:-10.00:Weekly shop:-:-:-'),
    splitSumHolds(CORNER_SHOP),
    legPairsAreMutual(),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceOf(HOLIDAY_FUND, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    balanceIdentityHolds(HOLIDAY_FUND),
    auditRowsInTotal('0'),
  ],
};
