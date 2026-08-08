// THE SPEC THAT CATCHES A ONE-POLICY PORT. The payload is identical to the
// QIF spec's but for the source, and the answer must be the opposite. A port
// that read the flag wherever it found one would pass every other spec in this
// family and fail this one.
export default {
  invariant: 'TS-I9',
  title: 'the same flag, sent to CSV, is still not a tick',
  design: 'PHASE1-PLAN §4.2, verified at all five sites; crates/wealth-core/src/admission/cleared.rs',
  consequence: 'a CSV row marked reconciled from a column that does not exist is a tick the user never gave',
  parity: 'match',

  command: { verb: 'plan_cleared_flag', payload: { source: 'csv', cleared_flag: '*' } },

  expect: { outcome: 'ok' },
  result: { cleared: false },
  rustOnly: {
    policy: 'the TypeScript has no such value: the policy is a LINE in each importer, not a named thing, and the port carries the name so that three sources answering false stay three distinguishable answers',
  },
  rustResult: { policy: 'no_cleared_column' },
};
