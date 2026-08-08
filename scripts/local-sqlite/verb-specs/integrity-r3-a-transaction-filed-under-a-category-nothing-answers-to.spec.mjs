import { CORNER_SHOP, aTransactionFiledUnderNothing } from './_shared.mjs';

export default {
  invariant: 'R-3',
  title: 'a category id on a transaction that names no category',
  design: 'schema.sql dangling_category_ref. transactions.category is TEXT with NO foreign key in BOTH engines, on purpose — the legacy transfer-in/transfer-out sentinels are legal values — so danglers are REPORTED, never rejected',
  consequence: 'this is the wreckage delete_unused_categories leaves behind when the cascade eats a referenced child, measured on both engines. The row shows a blank category in the register and counts under nothing in every report, and no amount of re-filing elsewhere will surface it',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: aTransactionFiledUnderNothing,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 1,
    warnings: 0,
    findings: [{
      check: 'dangling_category_ref',
      entity: 'transaction',
      id: CORNER_SHOP,
      severity: 'violation',
      detail: 'category text names no category of this user',
    }],
  },
};
