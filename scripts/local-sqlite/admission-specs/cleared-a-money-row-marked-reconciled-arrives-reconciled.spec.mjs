// The second of the two mandatory cases — see the QIF sibling.
export default {
  invariant: 'TS-I9',
  title: 'the Money code 2 means reconciled: the row arrives marked AND committed',
  design: 'PHASE1-PLAN §4.2, verified at all five sites; crates/wealth-core/src/admission/cleared.rs',
  consequence: 'a .mny file is a decade of reconciled history, and losing the ticks is losing the work rather than the data',
  parity: 'match',

  command: { verb: 'plan_cleared_flag', payload: { source: 'ms_money', cleared_flag: '2' } },

  expect: { outcome: 'ok' },
  result: { cleared: true, reconciled: true },
  rustOnly: {
    policy: 'the TypeScript has no such value: the policy is a LINE in each importer, not a named thing, and the port carries the name so that three sources answering false stay three distinguishable answers',
  },
  rustResult: { policy: 'money_status_scale' },
};
