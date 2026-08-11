import { USER, EVERYDAY, MARKED_ROW, everyStateOfCommitment, storedTriFlag,
  accountMoney, accountText, balanceIdentityHolds } from './_shared.mjs';

// The second call has an empty working set — everything ticked was committed by
// the first — so it converts nothing and says so. What it DOES do is re-state
// the account's record: a reconciliation finished against a new statement
// records that statement's figure and day even when no row changed hands.
//
// Both halves matter. A verb that counted the rows it had already committed
// would tell the user it had done work it had not; one that refused to re-stamp
// an account with nothing left to convert would leave the next reconciliation
// opening at a stale figure.
export default {
  invariant: 'A-2',
  title: 'finalizing twice commits nothing the second time, and re-states the figure',
  design: 'finalize_reconciliation 20260810200000:240-266 — the loop and the account UPDATE are independent',
  consequence: 'a repeated finish either double-counts the work or refuses to record the newest statement',
  parity: 'match',

  setup: {
    sqlite: `${everyStateOfCommitment.sqlite}
      UPDATE transactions SET is_reconciled = 1 WHERE id = '${MARKED_ROW}';
      UPDATE accounts SET last_reconciled_date = '2024-03-31',
                          last_reconciled_balance_minor = -2800
       WHERE id = '${EVERYDAY}';`,
    postgres: `${everyStateOfCommitment.postgres}
      UPDATE public.transactions SET is_reconciled = true WHERE id = '${MARKED_ROW}';
      UPDATE public.accounts SET last_reconciled_date = '2024-03-31',
                                 last_reconciled_balance = -28.00
       WHERE id = '${EVERYDAY}';`,
  },
  command: {
    verb: 'finalize_reconciliation',
    payload: { account_id: EVERYDAY, ending_balance: '-30.50', reconciled_on: '2024-04-30', user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { reconciled: 0, ending_balance: '-30.50', reconciled_on: '2024-04-30' },

  state: [
    storedTriFlag(MARKED_ROW, 'is_reconciled', 'yes'),
    accountText(EVERYDAY, 'last_reconciled_date', '2024-04-30'),
    accountMoney(EVERYDAY, 'last_reconciled_balance', '-30.50'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
