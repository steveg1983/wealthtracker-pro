import {
  USER, EVERYDAY,
  accountText, balanceOf, balanceIdentityHolds, writeInstants,
} from './_shared.mjs';

// The gap slice 20 closed. Zero is the value that proves it: a swept account
// really does close on £0.00, so "never reconciled" cannot be zero.
export default {
  invariant: 'READ-4',
  title: 'a reconciliation’s ending balance of zero is stored as zero, not as never-reconciled',
  design: '20260810200000_marking_is_not_reconciling.sql:123 added the cloud column; scripts/local-sqlite/schema.sql gained last_reconciled_balance_minor in slice 20, because AccountUpdate names the field',
  consequence: 'mapAccountFromDb treats a missing figure as never reconciled and offers no starting balance. Storing zero as NULL would make the next reconciliation start from nothing on an account that is swept to zero every night',
  parity: 'match',

  command: {
    verb: 'update_account',
    payload: {
      id: EVERYDAY,
      user_id: USER,
      patch: { last_reconciled_date: '2024-03-31', last_reconciled_balance: '0.00' },
    },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: { last_reconciled_date: '2024-03-31', last_reconciled_balance: '0.00' },

  state: [
    accountText(EVERYDAY, 'last_reconciled_date', '2024-03-31'),
    // Recording a reconciliation is not a payment: nothing moved.
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
