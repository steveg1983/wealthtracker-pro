// Money's scale is 0 unreconciled, 1 cleared (C), 2 reconciled (R), and since
// migration 20260810200000 the app keeps the same two states apart: a MARK, and
// a COMMITMENT made by finishing a balance against a stated ending figure.
//
// So 1 is the value that has to land in the middle, and it is the trap at both
// ends. Drop it and a balance session its owner left half-finished comes back
// looking untouched — the transform did exactly that until it stopped keeping
// `clearedStatus === 2` alone. Promote it and the app reports a reconciliation
// nobody performed, on every C row in the file at once.
export default {
  invariant: 'TS-I9',
  title: 'the Money code 1 is a mark and only a mark: marked, not committed',
  design: 'PHASE1-PLAN §4.2, verified at all five sites; crates/wealth-core/src/admission/cleared.rs',
  consequence: 'treating 1 as a commitment claims reconciliations the user never performed, which is the exact failure reconciliation exists to catch; dropping it loses the marks of every balance session left unfinished',
  parity: 'match',

  command: { verb: 'plan_cleared_flag', payload: { source: 'ms_money', cleared_flag: '1' } },

  expect: { outcome: 'ok' },
  result: { cleared: true, reconciled: false },
  rustOnly: {
    policy: 'the TypeScript has no such value: the policy is a LINE in each importer, not a named thing, and the port carries the name so that three sources answering false stay three distinguishable answers',
  },
  rustResult: { policy: 'money_status_scale' },
};
