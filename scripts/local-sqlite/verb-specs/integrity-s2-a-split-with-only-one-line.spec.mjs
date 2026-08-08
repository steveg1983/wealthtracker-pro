import { CORNER_SHOP, aSplitWithOneLine } from './_shared.mjs';

export default {
  invariant: 'S-2',
  title: 'a split with one line — which is not a split, it is a category',
  design: 'schema.sql split_min_lines, the port of 20260713100000:185',
  consequence: 'a one-line split renders as a split in the register and edits as one in the panel, so the user is shown a breakdown of one thing into itself and cannot get out of it without deleting the line',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: aSplitWithOneLine,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 1,
    warnings: 0,
    findings: [{
      check: 'split_min_lines',
      entity: 'transaction',
      id: CORNER_SHOP,
      severity: 'violation',
      detail: 'a split has fewer than two lines',
    }],
  },
};
