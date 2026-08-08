import { aCardInCreditNobodyImported } from './_shared.mjs';

export default {
  invariant: 'INGEST-1',
  title: 'the same balance, typed in by a person, is nobody\'s business',
  design: 'card_account_sign_implausible\'s provenance test: at least one feed- or file-sourced row against the account',
  consequence: 'without the provenance half the check fires on every card a user has overpaid, which is a real and ordinary thing to do — and a warning that fires on ordinary data is a warning that gets ignored on the day it is right',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: aCardInCreditNobodyImported,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: { ok: true, violations: 0, warnings: 0, findings: [] },
};
