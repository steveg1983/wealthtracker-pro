// One of the two cases in the whole family that can answer TRUE. PHASE1-PLAN
// §4.2 names it as mandatory for exactly that reason: three of the five sources
// produce false, so only the two that produce true can tell a four-policy port
// from a one-policy one.
export default {
  invariant: 'TS-I9',
  title: 'a QIF C* is the user own past reconciliation, exported',
  design: 'PHASE1-PLAN §4.2, verified at all five sites; crates/wealth-core/src/admission/cleared.rs',
  consequence: 'dropping it re-asks for reconciliation work the user already did, on every row of a decade of history',
  parity: 'match',

  command: { verb: 'plan_cleared_flag', payload: { source: 'qif', cleared_flag: '*' } },

  expect: { outcome: 'ok' },
  result: { cleared: true },
  rustOnly: {
    policy: 'the TypeScript has no such value: the policy is a LINE in each importer, not a named thing, and the port carries the name so that three sources answering false stay three distinguishable answers',
  },
  rustResult: { policy: 'file_flag' },
};
