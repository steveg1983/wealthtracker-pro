import { USER, EVERYDAY, everyStateOfCommitment, accountText, accountMoney,
  balanceOf, balanceIdentityHolds } from './_shared.mjs';

// "Reconciled on the 3rd" without "against what" is a claim nobody can check
// afterwards, and the next reconciliation has to open at the figure this one
// finished on. Both go on the ACCOUNT, in the same transaction as the rows.
//
// `balance` is asserted UNMOVED beside them, which is the point of the whole
// pairing: `last_reconciled_balance` is a RECORD of what a person confirmed, not
// an amount added to anything and not a figure the ledger is reconciled TO. A
// difference between the two is what the screen exists to show, and an engine
// that closed it silently would be inventing money.
export default {
  invariant: 'A-2',
  title: 'it records the day and the figure the reconciliation was settled against',
  design: 'finalize_reconciliation 20260810200000:261-266, and :195-199 for why the figure is recorded at all',
  consequence: 'the next reconciliation opens at a figure that is not the one this one finished on, and nobody can check what was agreed',
  parity: 'match',

  setup: everyStateOfCommitment,
  command: {
    verb: 'finalize_reconciliation',
    payload: { account_id: EVERYDAY, ending_balance: '-28.00', reconciled_on: '2024-03-31', user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { ending_balance: '-28.00', reconciled_on: '2024-03-31' },

  state: [
    accountText(EVERYDAY, 'last_reconciled_date', '2024-03-31'),
    accountMoney(EVERYDAY, 'last_reconciled_balance', {
      sqlite: '-28.00', postgres: '-28.00',
    }),
    balanceOf(EVERYDAY, '-28.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
