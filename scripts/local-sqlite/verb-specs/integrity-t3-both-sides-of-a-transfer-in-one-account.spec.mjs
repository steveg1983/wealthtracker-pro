import { OTHER_LEG, THIS_LEG, bothSidesInOneAccount } from './_shared.mjs';

export default {
  invariant: 'T-3',
  title: 'both sides of one transfer sitting in the same account',
  design: 'schema.sql transfer_same_account. transactions_transfer_two_accounts forbids a row pointing at its OWN account, which is a different rule and does not catch this',
  consequence: 'the account shows a payment out and a payment in that cancel, described as a transfer to somewhere else — so a reconciliation against the statement finds two rows the bank never saw and no way to tell which to remove',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: bothSidesInOneAccount,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 2,
    warnings: 0,
    findings: [
      {
        check: 'transfer_same_account',
        entity: 'transaction',
        id: OTHER_LEG,
        severity: 'violation',
        detail: 'both sides of this transfer are in one account',
      },
      {
        check: 'transfer_same_account',
        entity: 'transaction',
        id: THIS_LEG,
        severity: 'violation',
        detail: 'both sides of this transfer are in one account',
      },
    ],
  },
};
