// The other direction of the same test: the two sources that CAN answer true
// answer it to different values, so a port that merged them fails here.
export default {
  invariant: 'TS-I9',
  title: 'clearedStatus 2 sent to QIF is not the QIF flag',
  design: 'PHASE1-PLAN §4.2, verified at all five sites; crates/wealth-core/src/admission/cleared.rs',
  consequence: 'merging the two true-capable policies marks rows reconciled on a code the format never uses',
  parity: 'match',

  command: { verb: 'plan_cleared_flag', payload: { source: 'qif', cleared_flag: '2' } },

  expect: { outcome: 'ok' },
  result: { cleared: false },
  rustOnly: {
    policy: 'the TypeScript has no such value: the policy is a LINE in each importer, not a named thing, and the port carries the name so that three sources answering false stay three distinguishable answers',
  },
  rustResult: { policy: 'file_flag' },
};
