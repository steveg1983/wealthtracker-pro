import { LEG_LINE, aLegAndACounterpartThatDisagree } from './_shared.mjs';

export default {
  invariant: 'T-4',
  title: 'a split leg compared against its LINE, never against its parent',
  design: 'schema.sql split_leg_amounts_not_opposite, the port of 20260720120000:15-17 — the rule the whole split-leg feature turns on',
  consequence: 'a leg that does not cancel its counterpart moves money the split does not account for, and it does it inside a transaction whose own lines still sum correctly, so S-1 reports nothing',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  // The subject is the LINE, not the transaction: this is the one check whose
  // entity is `split_line`, and the whole point of T-4 is which of the two the
  // amount is compared against.
  setup: aLegAndACounterpartThatDisagree,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 1,
    warnings: 0,
    findings: [{
      check: 'split_leg_amounts_not_opposite',
      entity: 'split_line',
      id: LEG_LINE,
      severity: 'violation',
      detail: 'a split leg and its counterpart are not exact opposites',
    }],
  },
};
