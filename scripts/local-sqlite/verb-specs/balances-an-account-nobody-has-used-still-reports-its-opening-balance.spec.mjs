import {
  USER, EVERYDAY, RAINY_DAY,
  anAccountNobodyHasUsed, derivedBalance, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'BAL-3',
  title: 'an account with no transactions is in the answer, carrying the money it opened with',
  design: '20260722160000 spells the reason at the join: "LEFT JOIN so an account with no transactions still reports its opening balance instead of dropping out of the result"',
  consequence: 'an inner join drops the account entirely, and a missing key in this map is not £0.00 to the caller — computeAccountBalances falls back to its own sum for an account the map does not name. For an account whose opening balance IS its whole content, that means showing nothing at all until the rows arrive, which for this account is never',
  parity: 'match',

  setup: anAccountNobodyHasUsed,
  command: { verb: 'account_balances', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    account_balances: [
      derivedBalance({ account_id: EVERYDAY, balance: '-25.00', txn_count: 1 }),
      derivedBalance({ account_id: RAINY_DAY, balance: '42.00', txn_count: 0 }),
    ],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
