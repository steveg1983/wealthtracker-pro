import { USER, EVERYDAY, RAINY_DAY, HOLIDAY_FUND, CORNER_SHOP, LEG_LINE, MATCHING, STRANDED,
  splitWithAnUnlinkedLeg, matchingRow, thirdAccount, setups,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  transferLinksAreMutual, auditRowsInTotal } from './_shared.mjs';

// T-3 from the other side. The row being offered is already paired with
// something in a third account, and taking it would strand that.
//
// The check tests BOTH link columns — `linked_transfer_id IS NOT NULL OR
// linked_transfer_split_id IS NOT NULL` — and the second is the one that is easy
// to drop: a row that is already the other side of some OTHER split's line
// carries only that column, and without it a second line could steal it.
export default {
  invariant: 'T-3',
  title: 'a row that is already half a transfer cannot be taken as a leg\'s other side',
  design: 'link_split_line_transfer 20260806094058:562-564 — both link columns, not just the first',
  consequence: 'one row is the other side of two different movements and one of them is stranded',
  parity: 'match',

  setup: setups(splitWithAnUnlinkedLeg, matchingRow, thirdAccount, {
    sqlite: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, transfer_account_id)
        VALUES ('${STRANDED}', '${USER}', '${HOLIDAY_FUND}', 'Partner', -1500, 'transfer', '2024-03-02', '${RAINY_DAY}');
      UPDATE accounts SET balance_minor = balance_minor - 1500 WHERE id = '${HOLIDAY_FUND}';
      UPDATE transactions SET transfer_account_id = '${HOLIDAY_FUND}', linked_transfer_id = '${STRANDED}'
       WHERE id = '${MATCHING}';
      UPDATE transactions SET linked_transfer_id = '${MATCHING}' WHERE id = '${STRANDED}';`,
    postgres: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, transfer_account_id)
        VALUES ('${STRANDED}', '${USER}', '${HOLIDAY_FUND}', 'Partner', -15.00, 'transfer', '2024-03-02', '${RAINY_DAY}');
      UPDATE public.accounts SET balance = balance - 15.00 WHERE id = '${HOLIDAY_FUND}';
      UPDATE public.transactions SET transfer_account_id = '${HOLIDAY_FUND}', linked_transfer_id = '${STRANDED}'
       WHERE id = '${MATCHING}';
      UPDATE public.transactions SET linked_transfer_id = '${MATCHING}' WHERE id = '${STRANDED}';`,
  }),
  command: {
    verb: 'link_split_line_transfer',
    payload: { split_id: LEG_LINE, transaction_id: MATCHING, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'transaction is already part of a linked transfer' },

  state: [
    splitLines(CORNER_SHOP, '0:-15.00:Weekly shop:0002:-:- | 1:-10.00:Weekly shop:-:-:-'),
    transferLinksAreMutual(),
    legPairsAreMutual(),
    splitSumHolds(CORNER_SHOP),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceOf(HOLIDAY_FUND, '-15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    balanceIdentityHolds(HOLIDAY_FUND),
    auditRowsInTotal('0'),
  ],
};
