
export default {
  invariant: 'TS-I9',
  title: 'X and * are both the QIF cleared flag, and they are the only two',
  design: 'PHASE1-PLAN §4.2, verified at all five sites; crates/wealth-core/src/admission/cleared.rs',
  consequence: 'a port that recognised only one of the two spellings would silently unreconcile half the files',
  parity: 'match',

  command: { verb: 'plan_cleared_flag', payload: { source: 'qif', cleared_flag: 'X' } },

  expect: { outcome: 'ok' },
  result: { cleared: true },
  rustOnly: {
    policy: 'the TypeScript has no such value: the policy is a LINE in each importer, not a named thing, and the port carries the name so that three sources answering false stay three distinguishable answers',
  },
  rustResult: { policy: 'file_flag' },
};
