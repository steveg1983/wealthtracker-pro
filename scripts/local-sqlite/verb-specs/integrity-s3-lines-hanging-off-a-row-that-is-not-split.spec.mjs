import { CORNER_SHOP, linesOnARowThatIsNotSplit } from './_shared.mjs';

export default {
  invariant: 'S-3',
  title: 'split lines on a transaction that is not split',
  design: 'schema.sql orphan_split_lines. is_split and the presence of lines are two facts that must agree, and no constraint pairs them',
  consequence: 'the lines are invisible — every reader keys off is_split — while still counting in any query that walks transaction_splits, so category reports and the register disagree and neither is obviously wrong',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: linesOnARowThatIsNotSplit,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 1,
    warnings: 0,
    findings: [{
      check: 'orphan_split_lines',
      entity: 'transaction',
      id: CORNER_SHOP,
      severity: 'violation',
      detail: 'split lines on a transaction that is not split',
    }],
  },
};
