
export default {
  invariant: 'TS-I9',
  title: 'a CSV has no cleared column, and that is the whole rule',
  design: 'PHASE1-PLAN §4.2, verified at all five sites; crates/wealth-core/src/admission/cleared.rs',
  consequence: 'the same answer as OFX for a different reason, which is why they are two policies and not one',
  parity: 'match',

  command: { verb: 'plan_cleared_flag', payload: { source: 'csv', cleared_flag: null } },

  expect: { outcome: 'ok' },
  result: { cleared: false },
  rustOnly: {
    policy: 'the TypeScript has no such value: the policy is a LINE in each importer, not a named thing, and the port carries the name so that three sources answering false stay three distinguishable answers',
  },
  rustResult: { policy: 'no_cleared_column' },
};
