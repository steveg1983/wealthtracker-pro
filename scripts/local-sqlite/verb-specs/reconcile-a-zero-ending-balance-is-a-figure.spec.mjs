import { USER, EVERYDAY, everyStateOfCommitment, accountMoney,
  balanceOf, balanceIdentityHolds } from './_shared.mjs';

// A real account in this product is swept to zero every night, so its correct
// statement balance is exactly £0.00. An engine that treated 0 as "nothing was
// confirmed" would refuse to finish that reconciliation for ever — which is why
// the column is nullable and why `ending_balance_required` fires on absence
// rather than on falsiness.
//
// The stored figure is asserted as `0.00` and not as `NULL`, which is the whole
// distinction: `accountMoney` renders the two differently on purpose.
export default {
  invariant: 'A-2',
  title: 'a zero ending balance is a figure, not "none"',
  design: 'finalize_reconciliation 20260810200000:117-121 — "£0.00 is a real statement balance … so the two cannot share a representation"',
  consequence: 'an account that really closes at zero can never be finished, and its last statement balance reads as "never reconciled"',
  parity: 'match',

  setup: everyStateOfCommitment,
  command: {
    verb: 'finalize_reconciliation',
    payload: { account_id: EVERYDAY, ending_balance: '0', reconciled_on: '2024-03-31', user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { reconciled: 1 },

  // The RPC ECHOES its own argument — `jsonb_build_object('ending_balance',
  // p_ending_balance)` — and `p_ending_balance` is an unconstrained `numeric`,
  // so a payload of "0" comes back `0` and a payload of "-28.00" comes back
  // `-28.00`: the scale is the caller's literal's. The crate answers through
  // `Money`, which is minor units and always renders two places, so it says
  // "0.00". MEASURED here rather than assumed, and it is a difference in the
  // ECHO alone: `account_last_reconciled_balance` below is `0.00` on both
  // engines, because that value went through numeric(20,2) on one side and
  // INTEGER minor units on the other. Excluded from the row comparison for this
  // spec only, where the two spellings of zero really do differ.
  rowDivergence: {
    ending_balance: 'the cloud echoes the caller\'s own numeric literal, so "0" keeps its scale; Money always renders pennies. The STORED figure agrees to the penny and is asserted below.',
  },

  state: [
    accountMoney(EVERYDAY, 'last_reconciled_balance', '0.00'),
    balanceOf(EVERYDAY, '-28.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
