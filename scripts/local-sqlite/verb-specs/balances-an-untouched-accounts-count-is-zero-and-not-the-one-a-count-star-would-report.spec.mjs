import {
  USER, EVERYDAY, RAINY_DAY,
  anAccountNobodyHasUsed, derivedBalance, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'BAL-4',
  title: 'the count is COUNT(t.id), so an account with no rows answers zero rather than one',
  design: '20260722160000 counts t.id and not *. Under a LEFT JOIN with nothing on the right, COUNT(*) counts the manufactured null row and answers 1 — the two spellings differ by one character and by one row per empty account',
  consequence: 'the count is how a caller tells "this account has no transactions" from "this account\'s transactions have not arrived yet". One of those is a fact and the other is a loading state, and a balance verb that reports the loading state as a fact is a dashboard that stops waiting too early. It is also the property that would EVAPORATE if this query were rewritten as correlated subqueries for speed — see crate::verbs::reads on why it was not',
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
