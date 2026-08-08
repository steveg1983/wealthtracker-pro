
export default {
  invariant: 'TS-I9',
  title: 'no C line, no tick',
  design: 'PHASE1-PLAN §4.2, verified at all five sites; crates/wealth-core/src/admission/cleared.rs',
  consequence: 'marking an unflagged row reconciled tells the user they checked something they did not',
  parity: 'match',

  command: { verb: 'plan_cleared_flag', payload: { source: 'qif', cleared_flag: null } },

  expect: { outcome: 'ok' },
  result: { cleared: false },
  rustOnly: {
    policy: 'the TypeScript has no such value: the policy is a LINE in each importer, not a named thing, and the port carries the name so that three sources answering false stay three distinguishable answers',
  },
  rustResult: { policy: 'file_flag' },
};
