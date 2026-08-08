import { AUDIT_SECOND, anAuditChainThatDoesNotChain } from './_shared.mjs';

export default {
  invariant: 'A-1',
  title: 'an audit row whose prev_hash is not its predecessor\'s hash',
  design: 'schema.sql audit_chain_broken. The local log is TAMPER-EVIDENT, not tamper-proof — the user owns the file and can open it with any SQLite tool — and this check is the whole of the evidence half',
  consequence: 'the audit log is the only thing that can still say what a wiped or restored file used to hold. A chain nobody verifies is a list of claims, and an edit made outside the app would be indistinguishable from history',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: anAuditChainThatDoesNotChain,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 1,
    warnings: 0,
    findings: [{
      check: 'audit_chain_broken',
      entity: 'audit_entry',
      id: AUDIT_SECOND,
      severity: 'violation',
      detail: 'this audit row does not chain to its predecessor',
    }],
  },
};
