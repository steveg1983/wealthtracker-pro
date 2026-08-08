import { EVERYDAY, aSecondToFromCategory } from './_shared.mjs';

export default {
  invariant: 'C-3',
  title: 'two To/From categories for one account',
  design: 'schema.sql account_multiple_transfer_categories. C-3 says exactly one; the trigger guarantees at least one and nothing guarantees at most one',
  consequence: 'transfer_category_for takes whichever LIMIT 1 finds, so the same account transfers into two different categories depending on nothing the user can see, and the category report splits one account\'s transfers across two lines',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: aSecondToFromCategory,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 1,
    warnings: 0,
    findings: [{
      check: 'account_multiple_transfer_categories',
      entity: 'account',
      id: EVERYDAY,
      severity: 'violation',
      detail: 'this account has more than one To/From category',
    }],
  },
};
