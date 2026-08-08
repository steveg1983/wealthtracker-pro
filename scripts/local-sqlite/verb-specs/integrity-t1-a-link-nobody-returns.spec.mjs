import { OTHER_LEG, aLinkNobodyReturns } from './_shared.mjs';

export default {
  invariant: 'T-1',
  title: 'one side names the other and is not named back',
  design: 'schema.sql transfer_link_not_mutual. Mutual linkage is enforced NOWHERE in the cloud — only repair_claimed_transfer even looks at it (20260805145035:327-331)',
  consequence: 'the half-linked row shows a transfer badge and a target the other row has never heard of, so deleting either one leaves the survivor pointing at nothing and the transfer sweep re-offers a pair it already made',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: aLinkNobodyReturns,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 1,
    warnings: 0,
    findings: [{
      check: 'transfer_link_not_mutual',
      entity: 'transaction',
      id: OTHER_LEG,
      severity: 'violation',
      detail: 'this row links to one that does not link back',
    }],
  },
};
