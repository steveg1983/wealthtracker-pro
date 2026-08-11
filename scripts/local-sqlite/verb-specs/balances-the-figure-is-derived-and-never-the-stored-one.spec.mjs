import {
  USER, EVERYDAY, RAINY_DAY,
  aStoredBalanceThatDrifted, derivedBalance, balanceOf, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'BAL-1',
  title: 'a stored balance that has drifted is ignored: the answer is initial_balance + the rows',
  design: '20260722160000:26-42 aggregates. accounts.balance is a CACHE that every write verb maintains, and B-1 says it must equal initial_balance + SUM(amount) — but no constraint in either engine enforces that, which is why v_integrity_violations opens with balance_identity. The two are siblings and the relationship runs one way: this verb DERIVES what verify_integrity CHECKS',
  consequence: 'R-2. A port that read accounts.balance would report the drift AS MONEY on the dashboard, and the one instrument that could have caught it would still be quietly naming balance_identity in a report nobody\'s figures contradicted. Two numbers are only worth having while they are arrived at independently',
  parity: 'match',

  // THE ONE FIXTURE OUTSIDE THE integrity-* FAMILY THAT PLANTS A B-1 VIOLATION,
  // and it is planted because the violation IS the subject. balanceIdentityHolds
  // is therefore not asserted here — it would be asserting that the fixture
  // failed to do its job — and the stored figure is asserted instead, which
  // proves the fixture did it and the verb ignored it.
  setup: aStoredBalanceThatDrifted,
  command: { verb: 'account_balances', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    account_balances: [
      derivedBalance({ account_id: EVERYDAY, balance: '-25.00', txn_count: 1 }),
      derivedBalance({ account_id: RAINY_DAY, balance: '0.00', txn_count: 0 }),
    ],
  },
  state: [
    balanceOf(EVERYDAY, '999.99'),
    auditRowsInTotal('0'),
  ],
};
