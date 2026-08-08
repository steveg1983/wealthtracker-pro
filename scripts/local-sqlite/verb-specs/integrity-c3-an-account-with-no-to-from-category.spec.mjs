import { SOMEONE_ELSES_ACCOUNT, secondUser } from './_shared.mjs';

export default {
  invariant: 'C-3',
  title: 'an account that never got a To/From category, because its owner had no Transfer anchor',
  design: 'schema.sql account_missing_transfer_category, and C-3\'s trigger, which SKIPS when the user has no type-level Transfer root — a documented behaviour the restore path depends on (20260807083000 inserts accounts before categories)',
  consequence: 'nothing can be transferred into or out of that account: the category every transfer verb resolves through does not exist, so the money has nowhere to be filed and the whole account is an island',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  // This violation cannot be planted by REMOVING a category. MEASURED
  // (probe-integrity1.mjs, case 12): deleting the Transfer anchor cascades into
  // the existing To/From rows and C-5's trigger refuses the whole statement with
  // transfer_category_protected. It is reachable only FORWARDS — by creating an
  // account whose owner has no anchor for C-3's trigger to hang a category from —
  // which is C-3 and C-5 both doing exactly their jobs. `secondUser` is that
  // shape and has been in this file since the transfer family; it turns out to
  // have carried an integrity violation all along, which nothing until now could
  // report.
  setup: secondUser,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 1,
    warnings: 0,
    findings: [{
      check: 'account_missing_transfer_category',
      entity: 'account',
      id: SOMEONE_ELSES_ACCOUNT,
      severity: 'violation',
      detail: 'this account has no To/From category',
    }],
  },
};
