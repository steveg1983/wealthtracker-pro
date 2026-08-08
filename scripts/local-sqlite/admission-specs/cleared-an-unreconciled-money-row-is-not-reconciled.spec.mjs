
export default {
  invariant: 'TS-I9',
  title: 'the Money code 0 is a plain no',
  design: 'PHASE1-PLAN §4.2, verified at all five sites; crates/wealth-core/src/admission/cleared.rs',
  consequence: 'the ordinary case, and the one a truthiness test would get right by accident',
  parity: 'match',

  command: { verb: 'plan_cleared_flag', payload: { source: 'ms_money', cleared_flag: '0' } },

  expect: { outcome: 'ok' },
  result: { cleared: false },
  rustOnly: {
    policy: 'the TypeScript has no such value: the policy is a LINE in each importer, not a named thing, and the port carries the name so that three sources answering false stay three distinguishable answers',
  },
  rustResult: { policy: 'reconciled_status' },
};
