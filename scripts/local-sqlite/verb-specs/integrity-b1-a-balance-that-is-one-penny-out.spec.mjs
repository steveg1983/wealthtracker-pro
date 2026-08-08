import { EVERYDAY, aBalanceThatIsOneOut } from './_shared.mjs';

export default {
  invariant: 'B-1',
  title: 'a balance that does not equal initial_balance plus its rows',
  design: 'schema.sql balance_identity. B-1 is the identity the whole application rests on and NEITHER engine can enforce it — there is no constraint that can, in Postgres or in SQLite',
  consequence: 'every figure the user sees is derived from this one. A penny out here is a penny out on the dashboard, in every report and in the reconciliation screen, with nothing anywhere to say which is right',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only; the cloud checks B-1 in two throwaway migration SELECTs (20260808090000:292-299, 20260807200000:100-110) and nowhere a caller can reach',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: aBalanceThatIsOneOut,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 1,
    warnings: 0,
    findings: [{
      check: 'balance_identity',
      entity: 'account',
      id: EVERYDAY,
      severity: 'violation',
      detail: 'account balance is not initial_balance + sum(transactions)',
    }],
  },
  state: [
    { name: 'v_integrity_ok', sqlite: "SELECT CASE WHEN (SELECT ok FROM v_integrity_ok) = 1 THEN 'ok' ELSE 'not-ok' END", expect: 'not-ok' },
  ],
};
