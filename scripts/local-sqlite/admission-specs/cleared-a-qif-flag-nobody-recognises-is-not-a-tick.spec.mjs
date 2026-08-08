// Some writers emit `Cc` for "cleared but not reconciled", which is the
// distinction this app's `cleared` does NOT make. Reading it as a tick would
// import the bank's opinion as the user's.
export default {
  invariant: 'TS-I9',
  title: 'a lower-case c is not the flag, and neither is anything else',
  design: 'PHASE1-PLAN §4.2, verified at all five sites; crates/wealth-core/src/admission/cleared.rs',
  consequence: 'reading any non-empty flag as true would mark a bank-cleared row as user-reconciled',
  parity: 'match',

  command: { verb: 'plan_cleared_flag', payload: { source: 'qif', cleared_flag: 'c' } },

  expect: { outcome: 'ok' },
  result: { cleared: false },
  rustOnly: {
    policy: 'the TypeScript has no such value: the policy is a LINE in each importer, not a named thing, and the port carries the name so that three sources answering false stay three distinguishable answers',
  },
  rustResult: { policy: 'file_flag' },
};
