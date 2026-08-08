import { LEG_LINE, aSplitLineFiledUnderNothing } from './_shared.mjs';

export default {
  invariant: 'R-3',
  title: 'a split line whose category names nothing — and it has no sentinel exemption',
  design: 'schema.sql dangling_split_category_ref. The transaction check exempts transfer-in/transfer-out and this one does not, because a split line has never been allowed to carry them',
  consequence: 'a split line must carry a non-blank category by CHECK, so the corruption cannot be seen as a blank — it is a line filed under an id, rendering as that id, belonging to no group anywhere',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: aSplitLineFiledUnderNothing,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 1,
    warnings: 0,
    findings: [{
      check: 'dangling_split_category_ref',
      entity: 'split_line',
      id: LEG_LINE,
      severity: 'violation',
      detail: 'split line category names no category of this user',
    }],
  },
};
