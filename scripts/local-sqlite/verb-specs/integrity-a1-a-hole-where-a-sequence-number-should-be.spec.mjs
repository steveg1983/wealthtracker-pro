import { AUDIT_SECOND, anAuditChainWithAHoleInIt } from './_shared.mjs';

export default {
  invariant: 'A-1',
  title: 'a missing seq — a row removed from the middle rather than rewritten',
  design: 'schema.sql audit_chain_broken\'s other half: seq is dense, so a predecessor that is not there is as much a break as a hash that does not match',
  consequence: 'deleting is the easier tamper. Without the density half, a row could be lifted out of the middle of the log and every remaining hash would still chain to the row before the hole',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  // The purge exemption (trg_audit_no_delete stands down for
  // _rpc_guard('audit_purge')) deletes from the OLD end only, which moves MIN(seq)
  // and leaves the survivors dense. This plants the other thing: a hole in the
  // middle, which the check separates from a purge by comparing against MIN(seq)
  // rather than against 1.
  setup: anAuditChainWithAHoleInIt,
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
