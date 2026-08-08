import { LEG_COUNTERPART, aCounterpartTheLineIgnores } from './_shared.mjs';

export default {
  invariant: 'T-5',
  title: 'a row naming a split line that does not name it back',
  design: 'schema.sql split_leg_link_not_mutual — the split-line half of T-1, and the pair legPairsAreMutual asserts on every split spec',
  consequence: 'the counterpart renders as half of a split leg and the split renders as if nothing were linked, so the split writer will happily mint a SECOND counterpart for money that already moved once',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: aCounterpartTheLineIgnores,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 1,
    warnings: 0,
    findings: [{
      check: 'split_leg_link_not_mutual',
      entity: 'transaction',
      id: LEG_COUNTERPART,
      severity: 'violation',
      detail: 'this row names a split line that does not name it back',
    }],
  },
};
