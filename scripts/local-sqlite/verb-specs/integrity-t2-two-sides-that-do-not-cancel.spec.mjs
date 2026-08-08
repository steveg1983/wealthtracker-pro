import { OTHER_LEG, THIS_LEG, linkedSidesThatAreNotOpposites } from './_shared.mjs';

export default {
  invariant: 'T-2',
  title: 'a transfer whose two sides are not exact opposites — reported on BOTH rows',
  design: 'schema.sql transfer_amounts_not_opposite, the port of 20260716100000:108-111',
  consequence: 'money appears or vanishes between two accounts the user believes are joined, and because both balances are individually consistent with their own rows, nothing else in the product can notice',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: linkedSidesThatAreNotOpposites,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  // TWO findings, and deliberately so: the check reads every row that names
  // another, and both of these are wrong about the same movement. Naming one
  // would leave the other looking innocent. The order is the ORDER BY's: same
  // check, same entity, so the id decides, and OTHER_LEG (…0004) sorts before
  // THIS_LEG (…0005).
  result: {
    ok: false,
    violations: 2,
    warnings: 0,
    findings: [
      {
        check: 'transfer_amounts_not_opposite',
        entity: 'transaction',
        id: OTHER_LEG,
        severity: 'violation',
        detail: 'linked transfer sides are not exact opposites',
      },
      {
        check: 'transfer_amounts_not_opposite',
        entity: 'transaction',
        id: THIS_LEG,
        severity: 'violation',
        detail: 'linked transfer sides are not exact opposites',
      },
    ],
  },
};
