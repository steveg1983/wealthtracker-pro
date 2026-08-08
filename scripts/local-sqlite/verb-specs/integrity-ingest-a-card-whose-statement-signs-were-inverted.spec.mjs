import { CARD, aCardWhoseSignsWereInverted } from './_shared.mjs';

export default {
  invariant: 'INGEST-1',
  title: 'a credit card in credit, whose rows came out of an import',
  design: "PHASE1-PLAN §2.5's first addendum check, card_account_sign_implausible. A card's stored balance is -current (TS-F1/TS-F2); a positive one is either a genuine credit balance or an importer that got the sign backwards",
  consequence: 'an inverted card import produces data that is INTERNALLY CONSISTENT and entirely wrong — the balance matches the rows, the rows match the file, and every total in the product is the wrong way round. MEASURED before this check was written (probe-integrity1.mjs case 16): the other fifteen reported nothing at all',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  // A WARNING, not a violation: a credit card genuinely can be in credit. It is
  // therefore counted separately, v_integrity_ok ignores it, and `ok` stays true.
  setup: aCardWhoseSignsWereInverted,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: true,
    violations: 0,
    warnings: 1,
    findings: [{
      check: 'card_account_sign_implausible',
      entity: 'account',
      id: CARD,
      severity: 'warning',
      detail: "a credit account is in credit and its rows were imported — the statement's signs may be inverted",
    }],
  },
  state: [
    { name: 'v_integrity_ok', sqlite: "SELECT CASE WHEN (SELECT ok FROM v_integrity_ok) = 1 THEN 'ok' ELSE 'not-ok' END", expect: 'ok' },
    { name: 'rows_in_the_view', sqlite: 'SELECT COUNT(*) FROM v_integrity_violations', expect: '1' },
  ],
};
