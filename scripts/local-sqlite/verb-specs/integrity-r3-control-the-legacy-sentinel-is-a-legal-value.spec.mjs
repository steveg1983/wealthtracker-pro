import { aTransactionFiledUnderTheSentinel } from './_shared.mjs';

export default {
  invariant: 'R-3',
  title: "'transfer-out' names no category and is not a dangler",
  design: "schema.sql dangling_category_ref's exemption list. The sentinels predate the To/From lifecycle and transfer_category_for still falls back to them (20260716100000:43-61)",
  consequence: 'without the exemption the checker would report every pre-lifecycle transfer in a real file as corrupt, which is how a checker gets switched off',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: aTransactionFiledUnderTheSentinel,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: { ok: true, violations: 0, warnings: 0, findings: [] },
};
