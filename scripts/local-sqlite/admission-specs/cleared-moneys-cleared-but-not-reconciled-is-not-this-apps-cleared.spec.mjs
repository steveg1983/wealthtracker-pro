// Money's scale is 0 unreconciled, 1 cleared, 2 reconciled. Only the third
// is this app's `cleared`, and the middle one is the trap: it is truthy, it is
// non-zero, and it means something else.
export default {
  invariant: 'TS-I9',
  title: 'the Money code 1 means the bank cleared it, which is not the same statement',
  design: 'PHASE1-PLAN §4.2, verified at all five sites; crates/wealth-core/src/admission/cleared.rs',
  consequence: 'treating 1 as a tick marks rows reconciled that the user never checked, which is the exact failure reconciliation exists to catch',
  parity: 'match',

  command: { verb: 'plan_cleared_flag', payload: { source: 'ms_money', cleared_flag: '1' } },

  expect: { outcome: 'ok' },
  result: { cleared: false },
  rustOnly: {
    policy: 'the TypeScript has no such value: the policy is a LINE in each importer, not a named thing, and the port carries the name so that three sources answering false stay three distinguishable answers',
  },
  rustResult: { policy: 'reconciled_status' },
};
