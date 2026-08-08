
export default {
  invariant: 'TS-I9',
  title: 'OFX has no such tag, so a caller offering one is ignored rather than obeyed',
  design: 'PHASE1-PLAN §4.2, verified at all five sites; crates/wealth-core/src/admission/cleared.rs',
  consequence: 'a policy that read a flag OFX cannot carry would be reading what the caller believes rather than what the file states',
  parity: 'match',

  command: { verb: 'plan_cleared_flag', payload: { source: 'ofx', cleared_flag: '*' } },

  expect: { outcome: 'ok' },
  result: { cleared: false },
  rustOnly: {
    policy: 'the TypeScript has no such value: the policy is a LINE in each importer, not a named thing, and the port carries the name so that three sources answering false stay three distinguishable answers',
  },
  rustResult: { policy: 'never_pre_cleared' },
};
