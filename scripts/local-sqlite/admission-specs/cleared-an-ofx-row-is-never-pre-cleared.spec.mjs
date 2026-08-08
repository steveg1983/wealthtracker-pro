// `ofxImportService.ts:558-565` says this deliberately and at length: importing
// a statement is the MOMENT the check should happen, so arriving pre-cleared
// skips the one step that would catch a missing or wrong row.
export default {
  invariant: 'TS-I9',
  title: 'the bank having processed it is not the user having checked it',
  design: 'PHASE1-PLAN §4.2, verified at all five sites; crates/wealth-core/src/admission/cleared.rs',
  consequence: 'an import that arrives pre-ticked leaves reconciliation with nothing to do and the account agreeing with a statement nobody read',
  parity: 'match',

  command: { verb: 'plan_cleared_flag', payload: { source: 'ofx', cleared_flag: null } },

  expect: { outcome: 'ok' },
  result: { cleared: false },
  rustOnly: {
    policy: 'the TypeScript has no such value: the policy is a LINE in each importer, not a named thing, and the port carries the name so that three sources answering false stay three distinguishable answers',
  },
  rustResult: { policy: 'never_pre_cleared' },
};
