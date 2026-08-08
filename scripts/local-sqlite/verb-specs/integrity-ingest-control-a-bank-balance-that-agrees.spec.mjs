import { aBankBalanceThatAgrees } from './_shared.mjs';

export default {
  invariant: 'INGEST-2',
  title: 'a card and a bank that agree are not suspicious',
  design: 'bank_balance_implausible\'s two conditions together: the signs must DIFFER and the gap must exceed the ledger itself. Either one alone would fire on ordinary unreconciled data',
  consequence: 'an unreconciled card is normally a little out and always the same sign. A check that fired on that would fire on every card in every file, every day',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: aBankBalanceThatAgrees,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: { ok: true, violations: 0, warnings: 0, findings: [] },
};
