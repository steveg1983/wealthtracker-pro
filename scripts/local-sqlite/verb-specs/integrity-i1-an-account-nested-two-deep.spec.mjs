import { RAINY_DAY, anAccountNestedTwoDeep } from './_shared.mjs';

export default {
  invariant: 'I-1',
  title: 'a nested account that is itself a parent',
  design: 'schema.sql account_nesting_too_deep. The (Cash) pairing (20260722090000) is ONE level: an investment account and its cash sibling. Neither engine constrains the depth',
  consequence: 'every reader of the pairing walks exactly one link. A second level means the third account is invisible to the account list and its balance is counted once, twice or not at all depending on which screen is asking',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: anAccountNestedTwoDeep,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 1,
    warnings: 0,
    findings: [{
      check: 'account_nesting_too_deep',
      entity: 'account',
      id: RAINY_DAY,
      severity: 'violation',
      detail: 'a nested account is itself a parent',
    }],
  },
};
