import { CORNER_SHOP, aSplitThatDoesNotSum } from './_shared.mjs';

export default {
  invariant: 'S-1',
  title: 'split lines that add up to less than the transaction they belong to',
  design: 'schema.sql split_sum, the check the covering index idx_splits_sum_cover exists for',
  consequence: 'the parent says one figure and its lines say another, so the account total and the category totals disagree by the difference and no screen shows both',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: aSplitThatDoesNotSum,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 1,
    warnings: 0,
    findings: [{
      check: 'split_sum',
      entity: 'transaction',
      id: CORNER_SHOP,
      severity: 'violation',
      detail: 'split lines do not sum to the parent amount',
    }],
  },
};
