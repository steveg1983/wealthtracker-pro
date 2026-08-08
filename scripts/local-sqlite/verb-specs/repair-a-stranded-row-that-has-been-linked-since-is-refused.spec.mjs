import { USER, EVERYDAY, RAINY_DAY, HOLIDAY_FUND, MATCHING, thirdAccount,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  auditRowsInTotal } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// The other half of the staleness check. T-15 asks whether the pair being BROKEN
// is still the one the caller saw; this asks whether the row being CLAIMED is
// still free. Between the sweep building its list and the user clicking, another
// device may have paired the stranded row with something else — and re-pointing
// it here would strand THAT row instead.
export default {
  invariant: 'T-3',
  title: 'a stranded row that has been linked to something else since the list was built is refused',
  design: 'repair_claimed_transfer 20260805145035:352-355',
  consequence: 'the repair strands a different row than the one it displaced, and the sweep offers to repair that one next',
  parity: 'match',

  setup: {
    sqlite: `${claimedTransfer.sqlite}
      ${thirdAccount.sqlite}
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, transfer_account_id)
        VALUES ('${MATCHING}', '${USER}', '${HOLIDAY_FUND}', 'Claimed first', 1500, 'transfer', '2024-04-01', '${EVERYDAY}');
      UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '${HOLIDAY_FUND}';
      UPDATE transactions SET linked_transfer_id = '${MATCHING}', transfer_account_id = '${HOLIDAY_FUND}'
       WHERE id = '${STRANDED}';
      UPDATE transactions SET linked_transfer_id = '${STRANDED}' WHERE id = '${MATCHING}';`,
    postgres: `${claimedTransfer.postgres}
      ${thirdAccount.postgres}
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, transfer_account_id)
        VALUES ('${MATCHING}', '${USER}', '${HOLIDAY_FUND}', 'Claimed first', 15.00, 'transfer', '2024-04-01', '${EVERYDAY}');
      UPDATE public.accounts SET balance = balance + 15.00 WHERE id = '${HOLIDAY_FUND}';
      UPDATE public.transactions SET linked_transfer_id = '${MATCHING}', transfer_account_id = '${HOLIDAY_FUND}'
       WHERE id = '${STRANDED}';
      UPDATE public.transactions SET linked_transfer_id = '${STRANDED}' WHERE id = '${MATCHING}';`,
  },
  command: { verb: 'repair_claimed_transfer', payload: repairPayload() },
  expect: { outcome: 'refused', error: 'stranded_row_already_linked' },

  state: [
    // The setup links it without re-typing it — which is itself the shape the
    // sweep sees in real data — and the verb leaves it exactly so.
    transferShape(STRANDED, `expense:-:0003:${MATCHING.slice(-4)}:-`),
    transferShape(PARTNER, `transfer:-:0002:${COUNTERPART.slice(-4)}:-`),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceOf(HOLIDAY_FUND, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    balanceIdentityHolds(HOLIDAY_FUND),
    auditRowsInTotal('0'),
  ],
};
