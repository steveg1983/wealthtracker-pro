import { CARD, EVERYDAY, setups, aBalanceThatIsOneOut, aCardWhoseSignsWereInverted } from './_shared.mjs';

export default {
  invariant: 'V',
  title: 'one broken rule and one suspicion, counted apart and reported in check order',
  design: 'schema.sql\'s severity column and v_integrity_ok, which counts only violations. PHASE1-PLAN §2.5 requires exactly this: adding advisory checks must not make the existing "must be empty" assertion flaky',
  consequence: 'if a heuristic could turn ok false, the first credit card in credit would make every file look corrupt — and the fix somebody reached for would be deleting the check, taking the two real ingest catches with it',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  // Also the ordering proof across checks: ORDER BY check_name first, so
  // balance_identity comes before card_account_sign_implausible whatever order
  // the UNION ALL happens to produce them in. The T-2 spec proves the tie-break
  // on subject within one check.
  setup: setups(aBalanceThatIsOneOut, aCardWhoseSignsWereInverted),
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 1,
    warnings: 1,
    findings: [
      {
        check: 'balance_identity',
        entity: 'account',
        id: EVERYDAY,
        severity: 'violation',
        detail: 'account balance is not initial_balance + sum(transactions)',
      },
      {
        check: 'card_account_sign_implausible',
        entity: 'account',
        id: CARD,
        severity: 'warning',
        detail: "a credit account is in credit and its rows were imported — the statement's signs may be inverted",
      },
    ],
  },
  state: [
    { name: 'v_integrity_ok', sqlite: "SELECT CASE WHEN (SELECT ok FROM v_integrity_ok) = 1 THEN 'ok' ELSE 'not-ok' END", expect: 'not-ok' },
    { name: 'rows_in_the_view', sqlite: 'SELECT COUNT(*) FROM v_integrity_violations', expect: '2' },
  ],
};
