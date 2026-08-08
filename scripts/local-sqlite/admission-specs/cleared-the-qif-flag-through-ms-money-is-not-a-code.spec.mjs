
export default {
  invariant: 'TS-I9',
  title: 'a * sent to MS Money is not clearedStatus 2',
  design: 'PHASE1-PLAN §4.2, verified at all five sites; crates/wealth-core/src/admission/cleared.rs',
  consequence: 'and the same in reverse — the Money scale is numeric and nothing else is on it',
  parity: 'match',

  command: { verb: 'plan_cleared_flag', payload: { source: 'ms_money', cleared_flag: '*' } },

  expect: { outcome: 'ok' },
  result: { cleared: false },
  rustOnly: {
    policy: 'the TypeScript has no such value: the policy is a LINE in each importer, not a named thing, and the port carries the name so that three sources answering false stay three distinguishable answers',
  },
  rustResult: { policy: 'reconciled_status' },
};
